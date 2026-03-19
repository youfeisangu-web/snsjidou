import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const image = formData.get('image') as File | null
    const profileId = formData.get('profileId') as string | null

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 })
    }

    let profile = null
    if (profileId) {
      profile = await prisma.profile.findUnique({ where: { id: profileId } })
    } else {
      profile = await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    const filename = `${Date.now()}-${image.name}`
    const filepath = path.join(uploadDir, filename)
    fs.writeFileSync(filepath, buffer)
    
    // We will save ImgBB URL or local path.
    let storedUrl = `/uploads/${filename}`
    
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    
    if (settings?.imgbbApiKey) {
      try {
        const imgFormData = new FormData()
        imgFormData.append('image', new Blob([buffer]), filename)
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${settings.imgbbApiKey}`, {
          method: 'POST',
          body: imgFormData,
        })
        const imgbbData = await imgbbRes.json()
        if (imgbbData.success) {
          storedUrl = imgbbData.data.url
        }
      } catch (error) {
        console.error('Failed to upload to ImgBB:', error)
      }
    }

    const asset = await prisma.imageAsset.create({
      data: {
        url: storedUrl,
        profileId: profile.id
      }
    })

    return NextResponse.json(asset)

  } catch (error) {
    console.error('Create asset error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const assets = await prisma.imageAsset.findMany({
      where: activeProfileId ? { profileId: activeProfileId } : {},
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(assets)
  } catch (error) {
    console.error('Fetch assets error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
