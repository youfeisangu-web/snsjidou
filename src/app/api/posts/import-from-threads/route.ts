import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const profile = activeProfileId
      ? await prisma.profile.findUnique({ where: { id: activeProfileId } })
      : await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })

    if (!profile?.threadsUserId || !profile?.threadsAccessToken) {
      return NextResponse.json({ error: 'Threads設定が見つかりません' }, { status: 400 })
    }

    // Threads APIから投稿一覧を取得
    const url = `https://graph.threads.net/v1.0/${profile.threadsUserId}/threads?fields=id,text,timestamp,media_type&limit=100&access_token=${profile.threadsAccessToken}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.error || !data.data) {
      return NextResponse.json({ error: data.error?.message || 'Threads APIエラー' }, { status: 500 })
    }

    const threads: any[] = data.data

    let imported = 0
    let skipped = 0

    for (const thread of threads) {
      // すでにDBに存在するか確認
      const existing = await prisma.post.findFirst({
        where: { threadsId: thread.id, profileId: profile.id }
      })
      if (existing) {
        skipped++
        continue
      }

      await prisma.post.create({
        data: {
          content: thread.text || '',
          platform: 'threads',
          status: 'published',
          threadsId: thread.id,
          profileId: profile.id,
          publishedAt: thread.timestamp ? new Date(thread.timestamp) : new Date(),
        }
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, total: threads.length })
  } catch (err: any) {
    console.error('Import from Threads error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
