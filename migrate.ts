import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const setting = await prisma.setting.findFirst()
  if (!setting) {
    console.log("No setting found")
    return
  }
  
  const existingProfile = await prisma.profile.findFirst()
  if (existingProfile) {
    console.log("Profile already exists!")
    return
  }

  const profile = await prisma.profile.create({
    data: {
      name: "メインアカウント",
      threadsUserId: setting.threadsUserId,
      threadsAccessToken: setting.threadsAccessToken,
      rssUrl: setting.rssUrl,
      hpUrl: setting.hpUrl,
      aiPrompt: setting.aiPrompt,
      implementedFeatures: setting.implementedFeatures,
      upcomingFeatures: setting.upcomingFeatures,
      relatedTopics: setting.relatedTopics,
      isActive: true
    }
  })
  
  console.log("Migrated correctly!", profile.id)
}

main().catch(console.error).finally(() => prisma.$disconnect())
