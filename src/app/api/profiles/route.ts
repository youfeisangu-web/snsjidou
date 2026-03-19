import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(profiles)
  } catch (error) {
    console.error('Failed to fetch profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const profile = await prisma.profile.create({
      data: {
        name: data.name || "新規アカウント",
        threadsUserId: data.threadsUserId,
        threadsAccessToken: data.threadsAccessToken,
        rssUrl: data.rssUrl,
        hpUrl: data.hpUrl,
        aiPrompt: data.aiPrompt,
        implementedFeatures: data.implementedFeatures,
        upcomingFeatures: data.upcomingFeatures,
        relatedTopics: data.relatedTopics,
        isActive: data.isActive ?? true
      }
    })
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Failed to create profile:', error)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }
}
