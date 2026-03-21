import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { prompt, profileId, image } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const profile = profileId 
      ? await prisma.profile.findUnique({ where: { id: profileId } })
      : await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
    }

    const customPersona = profile.aiPrompt 
      ? `【あなたの人格（ペルソナ）・アカウントの前提・絶対遵守の指示】\n${profile.aiPrompt}\n`
      : `あなたはSNSマーケティングのプロフェッショナルです。\n`;

    const serviceInfo = `
【サービス情報：実装済みの機能】
${profile.implementedFeatures || '（特になし）'}

【サービス情報：開発中・今後の実装予定機能】
${profile.upcomingFeatures || '（特になし）'}

【ターゲットとする関連項目・リサーチテーマ（これらに関連するトピックスに言及・意見を述べてインプレッションを獲得してください）】
${profile.relatedTopics || '（特になし）'}
`

    const sysPrompt = `${customPersona}
上記の【あなたの人格】として振る舞い、以下のサービス情報を踏まえて投稿を生成してください。
${serviceInfo}

入力されたテーマや短いメモを元に、Threadsで共感とエンゲージメント（いいね、コメント、インプレッション）を圧倒的に獲得できる魅力的な投稿文を作成してください。
無駄な挨拶や『こちらが投稿文です』系のメタ発言は一切不要です。直接コピペして使える文章のみを出力してください。
出力は【投稿文のテキストのみ】としてください（余計な挨拶や前置きは絶対に不要）。
適度に絵文字やハッシュタグを使用し、改行をうまく使ってスマホで読みやすくしてください。`

    const userParts: any[] = [{ text: prompt }]
    if (image) {
      const match = image.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/)
      if (match) {
        userParts.push({
          inlineData: {
            data: match[2],
            mimeType: match[1]
          }
        })
      }
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: userParts }
        ],
        generationConfig: {
           temperature: 0.7,
           maxOutputTokens: 800,
        }
      })
    })

    if (!res.ok) throw new Error('Failed to fetch from Gemini API')
    
    const data = await res.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return NextResponse.json({ text: generatedText.trim() })
  } catch (error) {
    console.error('Gemini API Error:', error)
    return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 })
  }
}
