import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

  const templates = await prisma.postTemplate.findMany({
    where: { profileId },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const { profileId, name, examplePost, memo } = await req.json()
  if (!profileId || !name || !examplePost) {
    return NextResponse.json({ error: 'profileId, name, examplePost are required' }, { status: 400 })
  }

  const template = await prisma.postTemplate.create({
    data: { profileId, name, examplePost, memo: memo || null }
  })
  return NextResponse.json(template)
}
