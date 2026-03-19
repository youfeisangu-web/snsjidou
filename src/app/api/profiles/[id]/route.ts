import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const data = await req.json()
    const { id } = await params

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        name: data.name,
        threadsUserId: data.threadsUserId,
        threadsAccessToken: data.threadsAccessToken,
        rssUrl: data.rssUrl,
        hpUrl: data.hpUrl,
        aiPrompt: data.aiPrompt,
        implementedFeatures: data.implementedFeatures,
        upcomingFeatures: data.upcomingFeatures,
        relatedTopics: data.relatedTopics,
        isActive: data.isActive
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
