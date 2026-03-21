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

        let combinedPosts: any[] = []

        // 1. Pull from drafts first
        const drafts = await prisma.post.findMany({
          where: { profileId: profile.id, status: 'draft' },
          orderBy: { id: 'asc' },
          take: generateCount
        })
        for (const d of drafts) {
          combinedPosts.push({ content: d.content, suggestedTime: 'any', draftId: d.id })
        }
        generateCount -= drafts.length

        // 2. Generate with AI if needed
        if (generateCount > 0 && true /* We already checked autoCreateDeficientPosts, wait, actually if we hit this, we need Gemini */) {

          // テンプレートを取得（最後に使った順で循環）
          const activeTemplates = await (prisma as any).postTemplate.findMany({
            where: { profileId: profile.id, isActive: true },
            orderBy: [{ lastUsedAt: 'asc' }, { createdAt: 'asc' }]
          })

          const templateSection = activeTemplates.length > 0
            ? `【投稿パターン（型）の指定】
以下の${activeTemplates.length}種類のパターンを順番に使い回して、それぞれの型の文体・構成・トーンを忠実に再現してください。
生成する${generateCount}件の投稿を、これらのパターンで均等にカバーするよう分散させてください。

${activeTemplates.map((t: any, i: number) => `--- パターン${i + 1}：${t.name} ---\n（参考例文）\n${t.examplePost}${t.memo ? `\n（ポイント）${t.memo}` : ''}`).join('\n\n')}

上記パターンの【文体・構成・長さ・トーン・スレッド分け方】を参考にしつつ、サービス内容や人格に合わせた独自コンテンツを作成してください。
`
            : ''

          const sysPrompt = `${customPersona}
上記の【あなたの人格】として振る舞い、以下のサービス情報を踏まえて投稿を生成してください。
${serviceInfo}
${templateSection}
向こう${targetDays}日分（1日あたり${countPerDay}投稿ペース想定）の独立した投稿内容を考案してください。

【スレッド形式（ツリー投稿）の推奨】
長文になる場合や、クイズ形式、結論を焦らしたい場合は、1つの投稿にまとめず、Threadsでよくある「スレッド形式（リプライで続きを書く）」にしてください。
スレッド形式にする場合は、各投稿（親投稿、子投稿1、子投稿2...）の間を必ず \`|||THREAD|||\` という文字列で区切ってください。

【URLの自然な誘導】
たまに（毎回ではなく自然な頻度で）、スレッドの一番最後（一番下）の投稿に、あなたのホームページURL（${profile.hpUrl || '設定なし'}）への誘導文を含めてください。単にURLを貼るだけでなく、「〇〇の続きはWebで！」「詳しくはプロフィールのリンク（または以下のURL）から👇」のように魅力的な文章を添えてください。

出力は必ずJSON形式の配列で返してください。内部形式:
[
  { "content": "（投稿文1。スレッドの場合は: 1投稿目 |||THREAD||| 2投稿目 |||THREAD||| 3投稿目(URL付き) ）", "suggestedTime": "morning" },
  { "content": "（投稿文2）", "suggestedTime": "any" }
]
※ suggestedTime には内容に応じて、そのコンテンツが朝(morning)、昼(noon)、夜(night)のいつ読まれるのが最適か、あるいはいつでも良いか(any)を含めてください。余計なマークダウンや説明は不要です。配列から始めてください。
※ 投稿文には絶対に「**太字**」のようなMarkdown記法（アスタリスクを使った強調）を使わないでください。SNSに投稿するプレーンテキストとして書いてください。
※ 【厳守】|||THREAD|||で区切られた各投稿は必ず500文字以内にしてください。500文字を超える場合は、|||THREAD|||でさらに分割してください。途中で切れた文章は絶対にNGです。
${contextContext}`

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: sysPrompt }] },
              contents: [
                { role: "user", parts: [{ text: "完全にゼロから、SNSでバズりやすい極上の投稿を生成してスケジュール用にJSONを返してください。" }] }
              ],
              generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      content: { type: "STRING" },
                      suggestedTime: { type: "STRING" }
                    },
                    required: ["content", "suggestedTime"]
                  }
                }
              }
            })
          })

          if (!res.ok) throw new Error(`Gemini API Error for profile ${profile.id}`)
          
          const data = await res.json()
          let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
          generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim()

          let postsArray: any[] = []
          try { 
            let parsed = null;
            try {
              parsed = JSON.parse(generatedText);
            } catch (e) {
              const start = generatedText.indexOf('[');
              const end = generatedText.lastIndexOf(']');
              if (start !== -1 && end !== -1 && end > start) {
                parsed = JSON.parse(generatedText.substring(start, end + 1));
              } else {
                throw e;
              }
            }
            postsArray = parsed;
          } catch { 
            console.error(`JSON Parse Error for profile ${profile.id}. Raw text:`, generatedText);
            return { profileId: profile.id, error: 'JSON Parse Error' } 
          }

          if (Array.isArray(postsArray)) {
            postsArray.forEach(p => combinedPosts.push({ content: p.content, suggestedTime: p.suggestedTime || 'any' }))
          }

          // テンプレートの使用記録を更新
          if (activeTemplates.length > 0) {
            const now = new Date()
            for (const t of activeTemplates) {
              await (prisma as any).postTemplate.update({
                where: { id: t.id },
                data: { usageCount: t.usageCount + 1, lastUsedAt: now }
              })
            }
          }
        }

        if (combinedPosts.length === 0) {
          return { profileId: profile.id, error: 'Empty array returned and no drafts available' }
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
        const startHour = (profile as any).postStartHour ?? 9
        const rawEndHour = (profile as any).postEndHour ?? 21
        const endHour = rawEndHour > startHour ? rawEndHour : startHour + 12

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
        for (let i = 0; i < combinedPosts.length; i++) {
          const postData = combinedPosts[i]
          if (postData.content) {
            const dayIndex = Math.floor(i / countPerDay)
            const postIndexInDay = i % countPerDay
            
            const scheduledFor = new Date(scheduleDate)
            scheduledFor.setDate(scheduledFor.getDate() + dayIndex)

            let finalHour = 12;
            let finalMinute = 0;
            
            if (postData.suggestedTime === 'morning') {
              finalHour = 7 + Math.floor(Math.random() * 3); // 7, 8, 9
              finalMinute = Math.floor(Math.random() * 60);
            } else if (postData.suggestedTime === 'noon') {
              finalHour = 11 + Math.floor(Math.random() * 3); // 11, 12, 13
              finalMinute = Math.floor(Math.random() * 60);
            } else if (postData.suggestedTime === 'night') {
              finalHour = 19 + Math.floor(Math.random() * 4); // 19 to 22
              finalMinute = Math.floor(Math.random() * 60);
            } else {
              if (intervalType === 'uniform') {
                const totalAvailableHours = endHour - startHour
                let hourOffset = startHour
                if (countPerDay > 1) {
                    hourOffset = startHour + (postIndexInDay * (totalAvailableHours / (countPerDay - 1)))
                } else {
                    hourOffset = (startHour + endHour) / 2
                }
                finalHour = Math.floor(hourOffset);
                finalMinute = Math.floor((hourOffset % 1) * 60);
              } else {
                finalHour = startHour + Math.floor(Math.random() * (endHour - startHour))
                finalMinute = Math.floor(Math.random() * 60)
              }
            }
            
            // finalHour is JST. We subtract 9 to set it correctly in UTC.
            scheduledFor.setUTCHours(finalHour - 9, finalMinute, 0, 0)

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
            
            let post;
            if (postData.draftId) {
              post = await prisma.post.update({
                where: { id: postData.draftId },
                data: {
                  status: 'scheduled',
                  scheduledAt: scheduledFor,
                  imageUrl: imageUrl || undefined
                }
              })
            } else {
              post = await prisma.post.create({
                data: {
                  content: postData.content,
                  platform: 'both',
                  status: 'scheduled',
                  scheduledAt: scheduledFor,
                  profileId: profile.id,
                  imageUrl: imageUrl
                }
              })
            }
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

// Vercel cron jobs send GET requests, so we need a GET handler
export async function GET(req: Request) {
  return POST(req)
}
