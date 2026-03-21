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
      let newStatus = 'failed'
      let wasPosted = false

      const profile = post.profile
      if (!profile) {
        await prisma.post.update({ where: { id: post.id }, data: { status: 'failed' } })
        continue
      }

      // Threads
      if ((post.platform === 'threads' || post.platform === 'both') && profile.threadsUserId && profile.threadsAccessToken) {
        try {
          let initialNodes = post.content.split(/\|\|\|THREAD\|\|\|/).map((s: string) => s.trim()).filter(Boolean)
          let threadNodes: string[] = []
          
          for (const node of initialNodes) {
             let currentText = node
             while (currentText.length > 450) {
                 let breakPoint = currentText.lastIndexOf('\n', 450)
                 if (breakPoint === -1 || breakPoint < 100) {
                     breakPoint = currentText.lastIndexOf('。', 450)
                 }
                 if (breakPoint === -1 || breakPoint < 100) {
                     breakPoint = 450
                 } else {
                     breakPoint += 1
                 }
                 const chunk = currentText.substring(0, breakPoint).trim()
                 if (chunk) threadNodes.push(chunk)
                 currentText = currentText.substring(breakPoint).trim()
             }
             if (currentText.length > 0) threadNodes.push(currentText)
          }

          if (profile.hpUrl && !post.content.includes(profile.hpUrl)) {
            threadNodes.push(`【詳細はこちら👇】\n${profile.hpUrl}`)
          }
          
          let firstPublishedId = null
          let lastPublishedId = null
          let postingFailed = false

          for (let i = 0; i < threadNodes.length; i++) {
            const nodeText = threadNodes[i]
            const isFirstNode = (i === 0)
            const hasImage = isFirstNode && post.imageUrl

            const payload: any = {
              media_type: hasImage ? 'IMAGE' : 'TEXT',
              text: nodeText,
              access_token: profile.threadsAccessToken
            }
            if (hasImage) payload.image_url = post.imageUrl
            if (!isFirstNode && lastPublishedId) {
              payload.reply_to_id = lastPublishedId
            }

            const creationRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            const creationData = await creationRes.json()

            if (creationData.id) {
              // Poll container status
              let isFinished = false;
              for (let poll = 0; poll < 10; poll++) {
                const statusRes = await fetch(`https://graph.threads.net/v1.0/${creationData.id}?fields=status,error_message&access_token=${profile.threadsAccessToken}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'FINISHED') {
                  isFinished = true;
                  break;
                } else if (statusData.status === 'ERROR') {
                  console.error('Container error:', statusData);
                  newStatus = 'failed';
                  break;
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }

              if (!isFinished && newStatus !== 'failed') {
                newStatus = 'failed';
                break;
              }
              if (newStatus === 'failed') break;

              const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creation_id: creationData.id, access_token: profile.threadsAccessToken })
              })
              const pubData = await publishRes.json()
              
              if (pubData.error) {
                console.error('Threads Publish Error:', pubData);
                newStatus = 'failed';
                break;
              }
              
              lastPublishedId = pubData.id;
              if (isFirstNode) firstPublishedId = lastPublishedId;

              if (i < threadNodes.length - 1) await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              console.error('Threads API Creation Error', creationData)
              postingFailed = true
              break
            }
          }
          threadsId = firstPublishedId
          if (firstPublishedId && !postingFailed) wasPosted = true
        } catch (err) {
          console.error('Threads posting error for post', post.id, err)
          newStatus = 'failed'
        }
      }

      if (wasPosted) newStatus = 'published'
      else if (newStatus !== 'failed') newStatus = 'failed'

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
