import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await req.json()

  const template = await prisma.postTemplate.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.examplePost !== undefined && { examplePost: data.examplePost }),
      ...(data.memo !== undefined && { memo: data.memo }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    }
  })
  return NextResponse.json(template)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.postTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
