import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const profiles = await prisma.profile.findMany()

    for (const profile of profiles) {
      // 1. Sync フォロワー数 (PageInsight)
      if (profile.threadsUserId && profile.threadsAccessToken) {
        try {
          const thUrl = `https://graph.threads.net/v1.0/${profile.threadsUserId}?fields=id,username,followers_count&access_token=${profile.threadsAccessToken}`
          const thRes = await fetch(thUrl)
          if (thRes.ok) {
            const thData = await thRes.json()
            const followersCount = thData.followers_count || 0

            // 総インプレッションを最新PostInsightsから集計
            const totalImpResult = await prisma.postInsight.aggregate({
              where: { post: { profileId: profile.id } },
              _sum: { impressions: true }
            })
            const totalImpressions = totalImpResult._sum.impressions || 0

            await prisma.pageInsight.create({
              data: {
                platform: 'threads',
                profileId: profile.id,
                date: new Date(),
                followers: followersCount,
                postImpressions: totalImpressions,
                pageViews: 0,
              }
            })
          }
        } catch (err) {
          console.error(`Threads Profile Sync Error for profile ${profile.id}`, err)
        }
      }
    }

    // 2. Post Insights を同期
    const recentPosts = await prisma.post.findMany({
      where: { status: 'published', threadsId: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: { profile: true }
    })

    for (const post of recentPosts) {
      const profile = post.profile
      if (!profile?.threadsAccessToken || !post.threadsId) continue

      try {
        const url = `https://graph.threads.net/v1.0/${post.threadsId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${profile.threadsAccessToken}`
        const res = await fetch(url)
        const data = await res.json()

        if (!data.data || data.error) {
          console.error('Threads Post Insights Error', post.threadsId, data.error || 'no data')
          continue
        }

        // Threads API は values[0].value か value のどちらかで返す
        const getVal = (name: string) => {
          const item = data.data.find((d: any) => d.name === name)
          if (!item) return 0
          return item.values?.[0]?.value ?? item.value ?? 0
        }

        const impressions = getVal('views')
        const likes = getVal('likes')
        const comments = getVal('replies')
        const shares = getVal('reposts') + getVal('quotes')

        // 同じpostIdの最新レコードをupsert（日付が今日のものがあれば更新、なければ作成）
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const existing = await prisma.postInsight.findFirst({
          where: { postId: post.id, recordedAt: { gte: today } }
        })

        if (existing) {
          await prisma.postInsight.update({
            where: { id: existing.id },
            data: { impressions, likes, comments, shares }
          })
        } else {
          await prisma.postInsight.create({
            data: { postId: post.id, impressions, likes, comments, shares }
          })
        }
      } catch (err) {
        console.error('Threads Post Sync Error', post.id, err)
      }
    }

    return NextResponse.json({ success: true, message: 'Sync complete' })
  } catch (error) {
    console.error('Master Sync Error', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
