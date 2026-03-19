import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const { targetDays = 7, profileId } = await req.json().catch(() => ({ targetDays: 7, profileId: null }))

    const profiles = profileId
      ? await prisma.profile.findMany({ where: { id: profileId } })
      : await prisma.profile.findMany({ where: { isActive: true } })
      
    if (profiles.length === 0) {
      return NextResponse.json({ message: 'No active profiles found.' })
    }

    const results = await Promise.all(profiles.map(async (profile) => {
      try {
        // Get recent posts to feed context to AI
        const recentPosts = await prisma.post.findMany({
          where: { status: 'published', profileId: profile.id },
          orderBy: { publishedAt: 'desc' },
          take: 5
        })

        const contextContext = recentPosts.length > 0 
          ? `過去の投稿の雰囲気：\n${recentPosts.map((p: any) => `- ${p.content.substring(0, 50)}...`).join('\n')}`
          : '（まだ過去の投稿データはありません）'

        const customPersona = profile.aiPrompt 
          ? `【あなたの人格（ペルソナ）・前提】\n${profile.aiPrompt}\n`
          : `あなたはThreadsのアルゴリズムに精通した超一流のSNSマーケターであり、AI自動運用システムの中枢です。\n`;

        const serviceInfo = `
【サービス情報：実装済みの機能】
${profile.implementedFeatures || '（特になし）'}

【サービス情報：開発中・今後の実装予定機能】
${profile.upcomingFeatures || '（特になし）'}

【ターゲットとする関連項目・リサーチテーマ（これらに関連するトピックスに言及・意見を述べてインプレッションを獲得してください）】
${profile.relatedTopics || '（特になし）'}
`

        const countPerDay = profile.postCountPerDay || 3;
        const totalTargetPosts = targetDays * countPerDay;
        
        let generateCount = totalTargetPosts;
        const existingScheduledCount = await prisma.post.count({
          where: { profileId: profile.id, status: 'scheduled' }
        });
        
        if (profile.autoCreateDeficientPosts ?? true) {
          generateCount = Math.max(0, totalTargetPosts - existingScheduledCount);
        }
        
        if (generateCount <= 0) {
          return { profileId: profile.id, scheduledCount: 0, message: '在庫が十分なため生成をスキップします。' };
        }

        const sysPrompt = `${customPersona}
上記の【あなたの人格】として振る舞い、以下のサービス情報を踏まえて投稿を生成してください。
${serviceInfo}

市場調査データや対象ペルソナの悩みを分析し、独立した投稿内容を合計${generateCount}個（1日あたり${countPerDay}投稿ペース想定）考案してください。
投稿のテーマには、以下のバリエーションを必ず織り交ぜてください：
1. 指定された「関連項目・リサーチテーマ」や「経理・請求書」など現場の悩みに寄り添う『あるあるネタ』や共感を生むもの。
2. 指定された「実装済みの機能」や「実装予定の機能」などのサービスアップデート情報や、自然な『宣伝投稿』。
3. 日本の経理・税務制度などの最新トレンドに対する意見や、SNSでエンゲージメントを獲得しやすい有益なビジネスハック。

出力は必ずJSON形式の配列で返してください。内部形式:
[
  { "content": "（投稿文1、ハッシュタグや絵文字含む完全なスレッド文章）" },
  { "content": "（投稿文2）" },
  ...
]
余計なマークダウンや説明は不要です。配列から始めてください。
${contextContext}`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sysPrompt }] },
            contents: [
              { role: "user", parts: [{ text: "完全にゼロから、SNSでバズりやすい極上の投稿を生成してスケジュール用にJSONを返してください。" }] }
            ],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 2000,
            }
          })
        })

        if (!res.ok) throw new Error(`Gemini API Error for profile ${profile.id}`)
        
        const data = await res.json()
        let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
        generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim()

        let postsArray: any[] = []
        try { postsArray = JSON.parse(generatedText) } catch { return { profileId: profile.id, error: 'JSON Parse Error' } }

        if (!Array.isArray(postsArray) || postsArray.length === 0) {
          return { profileId: profile.id, error: 'Empty array returned' }
        }

        const currentScheduled = await prisma.post.findMany({
          where: { profileId: profile.id, status: 'scheduled' },
          orderBy: { scheduledAt: 'desc' },
          take: 1
        })
        
        let scheduleDate = new Date()
        if (currentScheduled.length > 0 && currentScheduled[0].scheduledAt) {
          scheduleDate = new Date(currentScheduled[0].scheduledAt)
        }
        scheduleDate.setDate(scheduleDate.getDate() + 1)
        scheduleDate.setHours(9, 0, 0, 0)
        
        const intervalType = profile.postIntervalType || 'uniform'

        let availableImages: any[] = []
        if (profile.useImageWarehouse) {
          // Fetch least recently used images, prioritizing null lastUsedAt then oldest
          availableImages = await prisma.imageAsset.findMany({
            where: { profileId: profile.id },
            // nulls first supported via secondary sort or trick, but normally order by lastUsedAt: asc will put nulls first? Actually Prisma nulls are first naturally or last. Let's just sort by usedCount asc, then lastUsedAt asc
            orderBy: [{ usedCount: 'asc' }, { lastUsedAt: 'asc' }]
          })
        }

        const scheduledPosts = []
        for (let i = 0; i < postsArray.length; i++) {
          const postData = postsArray[i]
          if (postData.content) {
            const dayIndex = Math.floor(i / countPerDay)
            const postIndexInDay = i % countPerDay
            
            const scheduledFor = new Date(scheduleDate)
            scheduledFor.setDate(scheduledFor.getDate() + dayIndex)

            if (intervalType === 'uniform') {
              const totalAvailableHours = 12 // 9am to 9pm
              let hourOffset = 9
              if (countPerDay > 1) {
                  hourOffset = 9 + (postIndexInDay * (totalAvailableHours / (countPerDay - 1)))
              } else {
                  hourOffset = 12
              }
              scheduledFor.setHours(Math.floor(hourOffset), (hourOffset % 1) * 60, 0, 0)
            } else {
              // random time between 8am and 10pm (8 to 22)
              const randomHour = 8 + Math.floor(Math.random() * 15)
              const randomMinute = Math.floor(Math.random() * 60)
              scheduledFor.setHours(randomHour, randomMinute, 0, 0)
            }

            let imageUrl = null;
            if (availableImages.length > 0) {
              // Only attach image roughly 50% of the time to avoid being too repetitive
              if (Math.random() > 0.5) {
                const selectedImg = availableImages.shift()!
                imageUrl = selectedImg.url
                availableImages.push(selectedImg)
                
                // Update usage stats for the image
                await prisma.imageAsset.update({
                  where: { id: selectedImg.id },
                  data: { usedCount: selectedImg.usedCount + 1, lastUsedAt: new Date() }
                })
              }
            }
            
            const post = await prisma.post.create({
              data: {
                content: postData.content,
                platform: 'both',
                status: 'scheduled',
                scheduledAt: scheduledFor,
                profileId: profile.id,
                imageUrl: imageUrl
              }
            })
            scheduledPosts.push(post)
          }
        }

        return { profileId: profile.id, scheduledCount: scheduledPosts.length }

      } catch (err: any) {
        return { profileId: profile.id, error: err.message }
      }
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Auto generate global error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
