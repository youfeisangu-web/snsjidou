import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const result = await prisma.post.deleteMany({
      where: {
        status: { in: ['published', 'failed'] },
        ...(activeProfileId ? { profileId: activeProfileId } : {})
      }
    })

    return NextResponse.json({ deleted: result.count })
  } catch (err: any) {
    console.error('Bulk delete published error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
