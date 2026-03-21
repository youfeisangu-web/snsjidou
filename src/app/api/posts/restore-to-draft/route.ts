import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 実際には投稿されていない（threadsId が null）のに published になっている投稿を draft に戻す
export async function POST(req: Request) {
  try {
    const { profileId } = await req.json()
    if (!profileId) return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })

    const result = await prisma.post.updateMany({
      where: {
        profileId,
        status: 'published',
        threadsId: null,
      },
      data: {
        status: 'draft',
        scheduledAt: null,
        publishedAt: null,
      }
    })

    return NextResponse.json({ success: true, restoredCount: result.count })
  } catch (err: any) {
    console.error('Restore to draft error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
