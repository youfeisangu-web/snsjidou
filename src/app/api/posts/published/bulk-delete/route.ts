import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    // 削除対象の投稿をプロフィール（access token）付きで取得
    const posts = await prisma.post.findMany({
      where: {
        status: { in: ['published', 'failed'] },
        ...(activeProfileId ? { profileId: activeProfileId } : {})
      },
      include: { profile: true }
    })

    // Threads APIで実際の投稿を削除
    let threadsDeleted = 0
    let threadsFailed = 0

    for (const post of posts) {
      if (post.threadsId && post.profile?.threadsAccessToken) {
        try {
          const res = await fetch(
            `https://graph.threads.net/v1.0/${post.threadsId}?access_token=${post.profile.threadsAccessToken}`,
            { method: 'DELETE' }
          )
          const data = await res.json()
          if (data.success === true) {
            threadsDeleted++
          } else {
            console.warn('Threads delete failed for', post.threadsId, data)
            threadsFailed++
          }
        } catch (e) {
          console.warn('Threads delete error for', post.threadsId, e)
          threadsFailed++
        }
        // レート制限対策（100件/日）
        await new Promise(r => setTimeout(r, 200))
      }
    }

    // DBから削除
    const result = await prisma.post.deleteMany({
      where: {
        status: { in: ['published', 'failed'] },
        ...(activeProfileId ? { profileId: activeProfileId } : {})
      }
    })

    return NextResponse.json({
      deleted: result.count,
      threadsDeleted,
      threadsFailed
    })
  } catch (err: any) {
    console.error('Bulk delete published error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
