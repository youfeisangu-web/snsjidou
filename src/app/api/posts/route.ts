import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const content = formData.get('content') as string
    const platform = formData.get('platform') as string
    const image = formData.get('image') as File | null
    const scheduledAtStr = formData.get('scheduledAt') as string | null

    let imagePath = null
    let publicImageUrl: string | null = null

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })

    if (image) {
      const bytes = await image.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 1. ローカルに保存
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const filename = `${Date.now()}-${image.name}`
      const filepath = path.join(uploadDir, filename)
      fs.writeFileSync(filepath, buffer)
      imagePath = `/uploads/${filename}`

      // 2. ImgBBにアップロードして公開URLを取得（設定がある場合）
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
            console.log('Public URL generated:', publicImageUrl)
          } else {
            console.error('ImgBB Error:', imgbbData)
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

    if (settings) {
      if (isScheduled) {
        status = 'scheduled'
      } else {
        status = 'published'

        // Facebookへ投稿
        if ((platform === 'facebook' || platform === 'both') && settings.fbPageId && settings.fbAccessToken) {
          try {
            let fbUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}/feed`
            let payload: any = {
              message: content,
              access_token: settings.fbAccessToken
            }

            // publicImageUrlがあれば写真投稿エンドポイントに切り替える
            if (publicImageUrl) {
              fbUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}/photos`
              payload = {
                url: publicImageUrl,
                caption: content, // messageでなくcaptionになります
                access_token: settings.fbAccessToken
              }
            }

            const fbRes = await fetch(fbUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })

            const fbData = await fbRes.json()
            if (fbData.error) {
              console.error('FB API Error:', fbData.error)
              status = 'failed'
            } else {
              fbPostId = fbData.id
            }
          } catch (error) {
            console.error('FB API Catch Error:', error)
            status = 'failed'
          }
        }

        // Threadsへ投稿
        if ((platform === 'threads' || platform === 'both') && settings.threadsUserId && settings.threadsAccessToken) {
          try {
            // コンテナ作成
            const createUrl = `https://graph.threads.net/v1.0/${settings.threadsUserId}/threads`
            
            let createPayload: any = {
              media_type: 'TEXT',
              text: content,
              access_token: settings.threadsAccessToken
            }

            if (publicImageUrl) {
              createPayload = {
                media_type: 'IMAGE',
                image_url: publicImageUrl,
                text: content,
                access_token: settings.threadsAccessToken
              }
            }

            const createRes = await fetch(createUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(createPayload)
            })
            const createData = await createRes.json()

            if (createData.id) {
              // コンテナの公開処理
              const publishUrl = `https://graph.threads.net/v1.0/${settings.threadsUserId}/threads_publish`
              const publishRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  creation_id: createData.id,
                  access_token: settings.threadsAccessToken
                })
              })
              const publishData = await publishRes.json()
              if (publishData.error) {
                console.error('Threads Publish Error:', publishData.error)
                status = 'failed'
              } else {
                threadsId = publishData.id

                // HPのURL設定があれば、コメント（リプライ）として追加する
                if (settings.hpUrl) {
                  try {
                    const replyCreateRes = await fetch(`https://graph.threads.net/v1.0/${settings.threadsUserId}/threads`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        media_type: 'TEXT', 
                        text: `詳細はこちら: ${settings.hpUrl}`, 
                        reply_to_id: threadsId,
                        access_token: settings.threadsAccessToken 
                      })
                    })
                    const replyCreateData = await replyCreateRes.json()
                    if (replyCreateData.id) {
                      await fetch(`https://graph.threads.net/v1.0/${settings.threadsUserId}/threads_publish`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ creation_id: replyCreateData.id, access_token: settings.threadsAccessToken })
                      })
                    }
                  } catch (replyErr) {
                    console.error('Failed to post Thread reply with HP URL', replyErr)
                  }
                }
              }
            } else {
              console.error('Threads Create Media Error:', createData.error)
              status = 'failed'
            }
          } catch (error) {
            console.error('Threads API Catch Error:', error)
            status = 'failed'
          }
        }
      }
    }

    // データベースに投稿履歴を保存
    const post = await prisma.post.create({
      data: {
        content,
        platform,
        imagePath: publicImageUrl || imagePath, // 公開URLがあればそれを優先
        status,
        fbPostId,
        threadsId,
        scheduledAt: scheduledAtStr ? new Date(scheduledAtStr) : null
      }
    })

    return NextResponse.json(post)
  } catch (error) {
    console.error('Error in /api/posts:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
