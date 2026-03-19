import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function magic() {
  const setting = await prisma.setting.findFirst()
  if (!setting || !setting.threadsAccessToken) return
  
  const token = setting.threadsAccessToken
  console.log("Fetching /me with token...")
  const res = await fetch(`https://graph.threads.net/v1.0/me?access_token=${token}`)
  const data = await res.json()
  console.log(data)

  if (data.id) {
    await prisma.setting.update({
      where: { id: setting.id },
      data: { threadsUserId: data.id }
    })
    console.log(`Successfully pulled ID ${data.id} and updated database!`)
  }
}

magic().finally(() => prisma.$disconnect())
