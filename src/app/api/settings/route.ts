import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.setting.findUnique({
      where: { id: 1 }
    })
    return NextResponse.json(settings || {})
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { fbPageId, fbAccessToken, threadsUserId, threadsAccessToken, geminiApiKey, imgbbApiKey, rssUrl, hpUrl } = data

    const settings = await prisma.setting.upsert({
      where: { id: 1 },
      update: {
        fbPageId,
        fbAccessToken,
        threadsUserId,
        threadsAccessToken,
        geminiApiKey,
        imgbbApiKey,
        rssUrl,
        hpUrl
      },
      create: {
        id: 1,
        fbPageId,
        fbAccessToken,
        threadsUserId,
        threadsAccessToken,
        geminiApiKey,
        imgbbApiKey,
        rssUrl,
        hpUrl
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
