import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const profiles = await prisma.profile.findMany()

    for (const profile of profiles) {
      // 1. Sync Page Insights (Threads User)
      if (profile.threadsUserId && profile.threadsAccessToken) {
        try {
          const thUrl = `https://graph.threads.net/v1.0/${profile.threadsUserId}?fields=id,username,threads_profile_picture_url,threads_biography,followers_count&access_token=${profile.threadsAccessToken}`
          const thRes = await fetch(thUrl)
          if (thRes.ok) {
             const thData = await thRes.json()
             const followersCount = thData.followers_count || 0
             
             await prisma.pageInsight.create({
               data: {
                 platform: 'threads',
                 profileId: profile.id,
                 date: new Date(),
                 followers: followersCount,
                 postImpressions: 0,
                 pageViews: 0,
               }
             })
          }
        } catch (err) {
          console.error(`Threads Profile Sync Error for profile ${profile.id}`, err)
        }
      }
    }

    // 2. Sync Post Insights
    const recentPosts = await prisma.post.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      include: { profile: true }
    })

    for (const post of recentPosts) {
       let thImp = 0, thLikes = 0, thComments = 0, thShares = 0
       const profile = post.profile

       if (!profile) continue

       // Threads Post Insights
       if (post.threadsId && profile.threadsAccessToken) {
          try {
             const thPostUrl = `https://graph.threads.net/v1.0/${post.threadsId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${profile.threadsAccessToken}`
             const tpRes = await fetch(thPostUrl)
             const tpData = await tpRes.json()
             if (tpData.data) {
                const views = tpData.data.find((d:any) => d.name === 'views')?.values[0]?.value || 0
                const likes = tpData.data.find((d:any) => d.name === 'likes')?.values[0]?.value || 0
                const replies = tpData.data.find((d:any) => d.name === 'replies')?.values[0]?.value || 0
                const reposts = tpData.data.find((d:any) => d.name === 'reposts')?.values[0]?.value || 0
                const quotes = tpData.data.find((d:any) => d.name === 'quotes')?.values[0]?.value || 0

                thImp = views
                thLikes = likes
                thComments = replies
                thShares = reposts + quotes
             }
          } catch(err) {
             console.error('Threads Post Sync Error', err)
          }
       }

       // Save combined insight
       if (post.threadsId && (thImp > 0 || thLikes > 0)) {
         await prisma.postInsight.create({
           data: {
             postId: post.id,
             impressions: thImp,
             likes: thLikes,
             comments: thComments,
             shares: thShares
           }
         })
       }
    }

    return NextResponse.json({ success: true, message: 'Sync complete' })
  } catch (error) {
    console.error('Master Sync Error', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
