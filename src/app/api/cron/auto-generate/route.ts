import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const { targetDays = 7 } = await req.json().catch(() => ({ targetDays: 7 }))

    // Get insights or recent posts to feed context to AI
    const recentPosts = await prisma.post.findMany({
      where: { status: 'published' },
      orderBy: { publishedAt: 'desc' },
      take: 5
    })

    const contextContext = recentPosts.length > 0 
      ? `過去の投稿の雰囲気：\n${recentPosts.map((p: any) => `- ${p.content.substring(0, 50)}...`).join('\n')}`
      : '（まだ過去の投稿データはありません）'

    const sysPrompt = `あなたはFacebookやThreadsのアルゴリズムに精通した超一流のSNSマーケターであり、AI自動運用システムの中枢です。
市場調査データや対象ペルソナの悩みを分析し、**向こう${targetDays}日分**の独立した投稿内容を${targetDays}つ考案してください。
投稿のテーマには、以下のバリエーションを必ず織り交ぜてください：
1. 「請求書処理」や「経理作業」などに関する、現場の悩みに寄り添う『あるあるネタ』や共感を生むもの。
2. これらを解決する自社ツール・サービスの自然な『宣伝投稿』。
3. その他、SNSでエンゲージメントを獲得しやすい有益なビジネスハックやマインドセット。

出力は必ずJSON形式の配列で返してください。内部形式:
[
  { "content": "（投稿文1、ハッシュタグや絵文字含む完全な文章）" },
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

    if (!res.ok) throw new Error('Gemini API Error for auto generation')
    
    const data = await res.json()
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    
    // Clean up possible markdown wrappers
    generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim()

    let postsArray = []
    try {
      postsArray = JSON.parse(generatedText)
    } catch {
      throw new Error('Failed to parse JSON from AI')
    }

    if (!Array.isArray(postsArray) || postsArray.length === 0) {
      throw new Error('AI returned empty or invalid format')
    }

    // Schedule them for upcoming days
    const createdPosts = []
    let scheduleDate = new Date()
    // Start scheduling from tomorrow 12:00
    scheduleDate.setDate(scheduleDate.getDate() + 1)
    scheduleDate.setHours(12, 0, 0, 0)

    for (let i = 0; i < postsArray.length; i++) {
       const postData = postsArray[i]
       if (postData.content) {
         const scheduledFor = new Date(scheduleDate)
         scheduledFor.setDate(scheduledFor.getDate() + i) // Each post separated by 1 day
         
         const post = await prisma.post.create({
           data: {
             content: postData.content,
             platform: 'both',
             status: 'scheduled',
             scheduledAt: scheduledFor,
             isRss: false
           }
         })
         createdPosts.push(post)
       }
    }

    return NextResponse.json({ message: `Successfully auto-generated and scheduled ${createdPosts.length} posts.`, count: createdPosts.length })
  } catch (error: any) {
    console.error('Auto Generation Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
