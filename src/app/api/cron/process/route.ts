import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const pendingPosts = await prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: new Date() }
      },
      include: { profile: true }
    })

    if (pendingPosts.length === 0) {
      return NextResponse.json({ message: 'No scheduled posts to process' })
    }

    let successCount = 0

    for (const post of pendingPosts) {
      let threadsId = post.threadsId
      let newStatus = 'published'

      const profile = post.profile
      if (!profile) {
        await prisma.post.update({ where: { id: post.id }, data: { status: 'failed' } })
        continue
      }

      // Threads
      if ((post.platform === 'threads' || post.platform === 'both') && profile.threadsUserId && profile.threadsAccessToken) {
        try {
          const thCreationUrl = `https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`
          const params = new URLSearchParams()
          params.append('media_type', post.imageUrl ? 'IMAGE' : 'TEXT')
          params.append('text', post.content)
          if (post.imageUrl) params.append('image_url', post.imageUrl)
          params.append('access_token', profile.threadsAccessToken)

          const creationRes = await fetch(thCreationUrl + '?' + params.toString(), { method: 'POST' })
          const creationData = await creationRes.json()
          const creationId = creationData.id
          if (creationId) {
            const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish?creation_id=${creationId}&access_token=${profile.threadsAccessToken}`, { method: 'POST' })
            const pubData = await publishRes.json()
            threadsId = pubData.id || creationId

            if (profile.hpUrl) {
              try {
                const replyCreateRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    media_type: 'TEXT',
                    text: `詳細はこちら: ${profile.hpUrl}`,
                    reply_to_id: threadsId,
                    access_token: profile.threadsAccessToken
                  })
                })
                const replyCreateData = await replyCreateRes.json()
                if (replyCreateData.id) {
                  await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ creation_id: replyCreateData.id, access_token: profile.threadsAccessToken })
                  })
                }
              } catch (replyErr) {
                console.error('Failed to post Thread reply with HP URL', replyErr)
              }
            }

          } else {
            console.error('Threads API Creation Error', creationData)
            newStatus = 'failed'
          }
        } catch (err) {
          console.error(err)
          newStatus = 'failed'
        }
      }

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: newStatus,
          threadsId,
          publishedAt: newStatus === 'published' ? new Date() : null
        }
      })
      if (newStatus === 'published') successCount++
    }

    return NextResponse.json({ message: `Successfully processed ${successCount} scheduled posts out of ${pendingPosts.length}` })
  } catch (error: any) {
    console.error('Process scheduled posts error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
