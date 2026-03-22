import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await req.json()
    const { id } = await params

    const existing = await prisma.profile.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    let threadsTokenExpiresAt = existing.threadsTokenExpiresAt
    if (data.threadsAccessToken && data.threadsAccessToken !== existing.threadsAccessToken) {
      // 変更があった場合は現在から60日後を有効期限に設定
      threadsTokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    } else if (data.threadsAccessToken === '') {
      threadsTokenExpiresAt = null
    }

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        name: data.name,
        threadsUserId: data.threadsUserId,
        threadsAccessToken: data.threadsAccessToken,
        threadsTokenExpiresAt,
        rssUrl: data.rssUrl,
        hpUrl: data.hpUrl,
        aiPrompt: data.aiPrompt,
        implementedFeatures: data.implementedFeatures,
        upcomingFeatures: data.upcomingFeatures,
        relatedTopics: data.relatedTopics,
        isActive: data.isActive,
        postCountPerDay: data.postCountPerDay !== undefined ? parseInt(data.postCountPerDay, 10) : undefined,
        postIntervalType: data.postIntervalType,
        postLength: data.postLength,
        autoCreateDeficientPosts: data.autoCreateDeficientPosts,
        useImageWarehouse: data.useImageWarehouse
      }
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.profile.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete profile error:', error)
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
  }
}
