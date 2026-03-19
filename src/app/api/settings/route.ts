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
    const { geminiApiKey, imgbbApiKey } = data

    const settings = await prisma.setting.upsert({
      where: { id: 1 },
      update: {
        geminiApiKey,
        imgbbApiKey
      },
      create: {
        id: 1,
        geminiApiKey,
        imgbbApiKey
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
