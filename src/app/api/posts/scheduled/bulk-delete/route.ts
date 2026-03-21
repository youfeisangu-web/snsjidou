import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function DELETE() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const result = await prisma.post.deleteMany({
      where: {
        status: 'scheduled',
        ...(activeProfileId ? { profileId: activeProfileId } : {})
      }
    })

    return NextResponse.json({ deleted: result.count })
  } catch (err: any) {
    console.error('Bulk delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
