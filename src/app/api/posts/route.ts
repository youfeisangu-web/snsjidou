import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const content = formData.get('content') as string
    const platform = formData.get('platform') as string
    const profileId = formData.get('profileId') as string | null
    const image = formData.get('image') as File | null
    const scheduledAtStr = formData.get('scheduledAt') as string | null

    let imagePath = null
    let publicImageUrl: string | null = null

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    
    let profile = null
    if (profileId) {
      profile = await prisma.profile.findUnique({ where: { id: profileId } })
    } else {
      profile = await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })
    }

    if (image) {
      const bytes = await image.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const filename = `${Date.now()}-${image.name}`
      const filepath = path.join(uploadDir, filename)
      fs.writeFileSync(filepath, buffer)
      imagePath = `/uploads/${filename}`

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
            publicImageUrl = imgbbData.data.url
          }
        } catch (error) {
          console.error('Failed to upload to ImgBB:', error)
        }
      }
    }

    let fbPostId = null
    let threadsId = null
    let status = 'failed'
    
    const isScheduled = !!scheduledAtStr && new Date(scheduledAtStr) > new Date()

    if (profile) {
      if (isScheduled) {
        status = 'scheduled'
      } else {
        status = 'published'

        // Threadsへ投稿
        if ((platform === 'threads' || platform === 'both') && profile.threadsUserId && profile.threadsAccessToken) {
          try {
            let mediaUrl = `https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`
            let payload: any = {
              media_type: 'TEXT',
              text: content,
              access_token: profile.threadsAccessToken
            }

            if (publicImageUrl) {
              payload = {
                media_type: 'IMAGE',
                image_url: publicImageUrl,
                text: content,
                access_token: profile.threadsAccessToken
              }
            }

            const mediaRes = await fetch(mediaUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            const mediaData = await mediaRes.json()

            if (mediaData.id) {
              const creationId = mediaData.id

              const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  creation_id: creationId,
                  access_token: profile.threadsAccessToken
                })
              })
              const publishData = await publishRes.json()
              if (publishData.id) {
                threadsId = publishData.id
              } else {
                console.error('Threads Publish Error:', publishData)
                status = 'failed'
              }
            } else {
              console.error('Threads Media Error:', mediaData)
              status = 'failed'
            }
          } catch (error) {
            console.error('Threads API Catch Error:', error)
            status = 'failed'
          }
        }
      }
    }

    const post = await prisma.post.create({
      data: {
        content,
        platform,
        imageUrl: imagePath,
        status,
        scheduledAt: scheduledAtStr ? new Date(scheduledAtStr) : null,
        threadsId,
        profileId: profile?.id
      }
    })

    return NextResponse.json(post)

  } catch (error) {
    console.error('Create post error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}

import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const posts = await prisma.post.findMany({
      where: activeProfileId ? { profileId: activeProfileId } : {},
      orderBy: { publishedAt: 'desc' },
      include: { insights: true, profile: true }
    })
    return NextResponse.json(posts)
  } catch (error) {
    console.error('Fetch posts error:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
