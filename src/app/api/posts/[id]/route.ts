import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { content, time } = await req.json()
    const post = await prisma.post.findUnique({ where: { id } })
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    let updatedScheduledAt = post.scheduledAt;
    if (time && updatedScheduledAt) {
      const parts = time.split(':');
      if (parts.length === 2) {
        updatedScheduledAt.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      }
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        content,
        scheduledAt: updatedScheduledAt
      }
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('Update post error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
