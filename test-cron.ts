import { prisma } from './src/lib/prisma';

async function test() {
  const post = await prisma.post.findUnique({ where: { id: 'cmn1oq7ek0003y3bpobdpbltr' }, include: { profile: true } }) as any;
  if (!post) return;

  let threadsId = post.threadsId;
  let newStatus = 'failed';
  let wasPosted = false;
  let currentErrorLog: string | null = null;
  const profile = post.profile;

  console.log("Platform:", post.platform);
  console.log("Has threadsUserId:", !!profile.threadsUserId);
  console.log("Has threadsAccessToken:", !!profile.threadsAccessToken);

  if ((post.platform === 'threads' || post.platform === 'both') && profile.threadsUserId && profile.threadsAccessToken) {
    console.log("Entered Threads block");
    try {
      let initialNodes = post.content.split(/\|\|\|THREAD\|\|\|/).map((s: string) => s.trim()).filter(Boolean);
      let threadNodes: string[] = [];
      
      for (const node of initialNodes) {
         let currentText = node;
         while (currentText.length > 450) {
             let breakPoint = currentText.lastIndexOf('\n', 450);
             if (breakPoint === -1 || breakPoint < 100) breakPoint = currentText.lastIndexOf('。', 450);
             if (breakPoint === -1 || breakPoint < 100) breakPoint = 450;
             else breakPoint += 1;
             
             const chunk = currentText.substring(0, breakPoint).trim();
             if (chunk) threadNodes.push(chunk);
             currentText = currentText.substring(breakPoint).trim();
         }
         if (currentText.length > 0) threadNodes.push(currentText);
      }
      
      console.log("threadNodes length:", threadNodes.length);

      let firstPublishedId = null;
      let lastPublishedId = null;
      let postingFailed = false;

      for (let i = 0; i < threadNodes.length; i++) {
        const nodeText = threadNodes[i];
        const isFirstNode = (i === 0);
        const hasImage = isFirstNode && post.imageUrl;

        const payload: any = {
          media_type: hasImage ? 'IMAGE' : 'TEXT',
          text: nodeText,
          access_token: profile.threadsAccessToken
        };
        if (hasImage) payload.image_url = post.imageUrl;
        if (!isFirstNode && lastPublishedId) payload.reply_to_id = lastPublishedId;

        console.log(`Node ${i} payload length:`, nodeText.length);
        
        const creationRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const creationData = await creationRes.json();
        
        console.log(`Node ${i} creationRes:`, creationData);

        if (creationData.id) {
          let isFinished = false;
          for (let poll = 0; poll < 10; poll++) {
            const statusRes = await fetch(`https://graph.threads.net/v1.0/${creationData.id}?fields=status,error_message&access_token=${profile.threadsAccessToken}`);
            const statusData = await statusRes.json();
            console.log(`Node ${i} statusData poll ${poll}:`, statusData);
            if (statusData.status === 'FINISHED') {
              isFinished = true; break;
            } else if (statusData.status === 'ERROR') {
              currentErrorLog = statusData.error_message || JSON.stringify(statusData);
              newStatus = 'failed'; break;
            }
            await new Promise(r => setTimeout(r, 2000));
          }

          if (!isFinished && newStatus !== 'failed') {
            currentErrorLog = 'Container processing timed out';
            newStatus = 'failed';
            break;
          }
          if (newStatus === 'failed') break;

          const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: creationData.id, access_token: profile.threadsAccessToken })
          });
          const pubData = await publishRes.json();
          console.log(`Node ${i} pubData:`, pubData);
          
          if (pubData.error) {
            currentErrorLog = pubData.error.message || JSON.stringify(pubData.error);
            newStatus = 'failed'; break;
          }
          lastPublishedId = pubData.id;
          if (isFirstNode) firstPublishedId = lastPublishedId;
          
          if (i < threadNodes.length - 1) await new Promise(r => setTimeout(r, 3000));
        } else {
          currentErrorLog = creationData.error?.message || JSON.stringify(creationData);
          postingFailed = true; break;
        }
      }
      threadsId = firstPublishedId;
      if (firstPublishedId && !postingFailed) wasPosted = true;
      console.log("wasPosted:", wasPosted);
      
    } catch (err: any) {
      console.error("CATCH block hit:", err);
      currentErrorLog = err.message || String(err);
      newStatus = 'failed';
    }
  }

  if (wasPosted) newStatus = 'published';
  else if (newStatus !== 'failed') newStatus = 'failed';

  console.log("FINAL STATUS:", newStatus);
  console.log("FINAL ERROR LOG:", currentErrorLog);
}
test().catch(console.error).finally(()=>process.exit(0));
