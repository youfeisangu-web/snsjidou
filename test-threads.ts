import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("データベースから設定を取得しています...")
  const setting = await prisma.setting.findFirst()
  
  if (!setting || !setting.threadsAccessToken || !setting.threadsUserId) {
    console.log("❌ エラー：データベースにトークンまたはユーザーIDが正しく保存されていません。")
    return
  }
  
  console.log("Threads APIと通信テストを行っています...")
  const res = await fetch(`https://graph.threads.net/v1.0/${setting.threadsUserId}?fields=id,username,name&access_token=${setting.threadsAccessToken}`)
  const data = await res.json()
  
  if (data.id) {
    console.log(`\n================================`);
    console.log(`✅ 大成功！Threads APIと完璧に連携できています！`);
    console.log(`アカウント名: @${data.username}`);
    console.log(`名前: ${data.name}`);
    console.log(`================================\n`);
  } else {
    console.log(`\n❌ エラー：連携に失敗しました。トークンやIDに間違いがあるか、権限が不足しています。`);
    console.log(JSON.stringify(data, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
