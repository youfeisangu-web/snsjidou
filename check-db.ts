import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const settings = await prisma.setting.findMany()
  console.log("Found settings in DB:")
  console.log(settings)
}

check().finally(() => prisma.$disconnect())
