import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings) {
      return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })
    }

    // 1. Sync Page Insights (Facebook)
    if (settings.fbPageId && settings.fbAccessToken) {
      try {
        // Fetch page insights (e.g., page_impressions, page_engaged_users)
        // using page access token
        const fbUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}/insights?metric=page_impressions,page_engaged_users&period=day&access_token=${settings.fbAccessToken}`
        const fbRes = await fetch(fbUrl)
        if (fbRes.ok) {
          const fbData = await fbRes.json()
          
          let totalImp = 0
          let totalEng = 0
          
          if (fbData.data && fbData.data.length > 0) {
              const impData = fbData.data.find((d: any) => d.name === 'page_impressions')
              const engData = fbData.data.find((d: any) => d.name === 'page_engaged_users')
              // Simple aggregation of latest value
              totalImp = impData?.values[impData.values.length - 1]?.value || 0
              totalEng = engData?.values[engData.values.length - 1]?.value || 0
          }

          // Optional: Fetch Page Follower Count
          const fbDetailsUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}?fields=followers_count&access_token=${settings.fbAccessToken}`
          const fbDetailsRes = await fetch(fbDetailsUrl)
          const fbDetails = await fbDetailsRes.json()
          const followersCount = fbDetails.followers_count || 0

          await prisma.pageInsight.create({
            data: {
              platform: 'facebook',
              followersCount,
              totalImpressions: totalImp,
              totalEngagement: totalEng,
            }
          })
        }
      } catch (err) {
        console.error('FB Page Sync Error', err)
      }
    }

    // 2. Sync Threads Follower/Profile (Threads User)
    if (settings.threadsUserId && settings.threadsAccessToken) {
      try {
        const thUrl = `https://graph.threads.net/v1.0/${settings.threadsUserId}?fields=id,username,threads_profile_picture_url,threads_biography,followers_count&access_token=${settings.threadsAccessToken}`
        const thRes = await fetch(thUrl)
        if (thRes.ok) {
           const thData = await thRes.json()
           const followersCount = thData.followers_count || 0
           
           await prisma.pageInsight.create({
             data: {
               platform: 'threads',
               followersCount,
               totalImpressions: 0,
               totalEngagement: 0,
             }
           })
        }
      } catch (err) {
        console.error('Threads Profile Sync Error', err)
      }
    }

    // 3. Sync Post Insights
    const recentPosts = await prisma.post.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 20
    })

    for (const post of recentPosts) {
       let fbImp = 0, fbLikes = 0, fbComments = 0, fbShares = 0
       let thImp = 0, thLikes = 0, thComments = 0, thShares = 0

       // Facebook Post Insights
       if (post.fbPostId && settings.fbAccessToken) {
          try {
             // metric for impressions: post_impressions
             const postInsightsUrl = `https://graph.facebook.com/v19.0/${post.fbPostId}/insights?metric=post_impressions&access_token=${settings.fbAccessToken}`
             const insRes = await fetch(postInsightsUrl)
             const insData = await insRes.json()
             if (insData.data) {
                const impData = insData.data.find((d: any) => d.name === 'post_impressions')
                fbImp = impData?.values[0]?.value || 0
             }

             // likes, comments, shares
             const postDetailsUrl = `https://graph.facebook.com/v19.0/${post.fbPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${settings.fbAccessToken}`
             const detRes = await fetch(postDetailsUrl)
             const detData = await detRes.json()
             fbLikes = detData.likes?.summary?.total_count || 0
             fbComments = detData.comments?.summary?.total_count || 0
             fbShares = detData.shares?.count || 0
          } catch(err) {
             console.error('FB Post Sync Error', err)
          }
       }

       // Threads Post Insights
       if (post.threadsId && settings.threadsAccessToken) {
          try {
             const thPostUrl = `https://graph.threads.net/v1.0/${post.threadsId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${settings.threadsAccessToken}`
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
       if ((post.fbPostId || post.threadsId) && (fbImp > 0 || thImp > 0 || fbLikes > 0 || thLikes > 0)) {
         await prisma.postInsight.create({
           data: {
             postId: post.id,
             impressions: fbImp + thImp,
             likes: fbLikes + thLikes,
             comments: fbComments + thComments,
             shares: fbShares + thShares
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
