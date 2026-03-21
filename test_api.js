const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const profile = await prisma.profile.findFirst();
  if(!profile) { console.log("No profile"); return;}
  const res = await fetch("http://localhost:3000/api/ai/preview-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetDays: 1, profileId: profile.id })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
main().finally(() => prisma.$disconnect());
