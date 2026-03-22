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
    text: 'Test posting from automated MVP tool.',
    access_token: profile.threadsAccessToken
  };
  console.log('Testing Threads creation API...');
  const res = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', data);
}

run().finally(() => prisma.$disconnect());
