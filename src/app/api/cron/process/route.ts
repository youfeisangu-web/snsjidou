import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings) {
      return NextResponse.json({ message: 'Settings not configured' }, { status: 400 })
    }

    // 今より前の時間で、statusが'scheduled'のものを取得
    const pendingPosts = await prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: new Date()
        }
      }
    })

    if (pendingPosts.length === 0) {
      return NextResponse.json({ message: 'No scheduled posts to process' })
    }

    let successCount = 0

    for (const post of pendingPosts) {
      let fbPostId = post.fbPostId
      let threadsId = post.threadsId
      let finalStatus = 'published'

      // Facebook
      if ((post.platform === 'facebook' || post.platform === 'both') && settings.fbPageId && settings.fbAccessToken) {
        try {
          let fbUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}/feed`
          let payload: any = { message: post.content, access_token: settings.fbAccessToken }

          if (post.imagePath && post.imagePath.startsWith('http')) {
            fbUrl = `https://graph.facebook.com/v19.0/${settings.fbPageId}/photos`
            payload = { url: post.imagePath, caption: post.content, access_token: settings.fbAccessToken }
          }

          const fbRes = await fetch(fbUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          const fbData = await fbRes.json()
          if (!fbData.error) fbPostId = fbData.id
          else finalStatus = 'failed'
        } catch { finalStatus = 'failed' }
      }

      // Threads
      if ((post.platform === 'threads' || post.platform === 'both') && settings.threadsUserId && settings.threadsAccessToken) {
        try {
          const createUrl = `https://graph.threads.net/v1.0/${settings.threadsUserId}/threads`
          let createPayload: any = { media_type: 'TEXT', text: post.content, access_token: settings.threadsAccessToken }

          if (post.imagePath && post.imagePath.startsWith('http')) {
            createPayload = { media_type: 'IMAGE', image_url: post.imagePath, text: post.content, access_token: settings.threadsAccessToken }
          }

          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createPayload)
          })
          const createData = await createRes.json()

          if (createData.id) {
            const publishRes = await fetch(`https://graph.threads.net/v1.0/${settings.threadsUserId}/threads_publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creation_id: createData.id, access_token: settings.threadsAccessToken })
            })
            const publishData = await publishRes.json()
            if (!publishData.error) {
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

            } else finalStatus = 'failed'
          } else { finalStatus = 'failed' }
        } catch { finalStatus = 'failed' }
      }

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: finalStatus,
          fbPostId,
          threadsId,
          publishedAt: new Date()
        }
      })
      if (finalStatus === 'published') successCount++
    }

    return NextResponse.json({ message: `Successfully processed ${successCount} scheduled posts out of ${pendingPosts.length}` })
  } catch (error: any) {
    console.error('Process scheduled posts error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
