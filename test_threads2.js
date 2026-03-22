const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pendingPosts = await prisma.post.findMany({
    where: { status: 'failed' },
    include: { profile: true },
    take: 1
  });

  if (!pendingPosts.length) { console.log('No failed tasks'); return; }
  const post = pendingPosts[0];
  const profile = post.profile;

  const payload = {
    media_type: 'TEXT',
    text: 'Test Node Text Publish',
    access_token: profile.threadsAccessToken
  };
  
  console.log('Testing Threads creation API...');
  const res = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const creationData = await res.json();
  console.log('Creation Data:', creationData);

  if(!creationData.id) return;
  
  let isFinished = false;
  for (let poll = 0; poll < 10; poll++) {
    const statusRes = await fetch(`https://graph.threads.net/v1.0/${creationData.id}?fields=status,error_message&access_token=${profile.threadsAccessToken}`);
    const statusData = await statusRes.json();
    console.log('Status polling:', statusData);
    if (statusData.status === 'FINISHED') {
      isFinished = true;
      break;
    } else if (statusData.status === 'ERROR') {
      console.error('Container error:', statusData);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  if(!isFinished) { console.log("Not finished!"); return;}

  console.log('Publishing container...');
  const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationData.id, access_token: profile.threadsAccessToken })
  });
  const pubData = await publishRes.json();
  console.log('Publish result:', pubData);
}

run().finally(() => prisma.$disconnect());
