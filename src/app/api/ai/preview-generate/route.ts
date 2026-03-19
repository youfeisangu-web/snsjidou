import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const { targetDays = 7, profileId } = await req.json().catch(() => ({ targetDays: 7, profileId: null }))
    if (!profileId) return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })

    const profile = await prisma.profile.findUnique({ where: { id: profileId } })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Context from recent posts
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
      : `あなたはSNSマーケターです。\n`;

    const preferences = profile.aiPreferenceRules
      ? `【重要！ユーザーの好み・過去の学習データ】\n${profile.aiPreferenceRules}\nこの好みを厳格に守って生成してください。\n`
      : ''

    const successRule = profile.successFactors
      ? `【過去のバズ投稿の成功要因】\n${profile.successFactors}\nこれも意識して要素を取り入れてください。\n`
      : ''

    const sysPrompt = `${customPersona}
${preferences}
${successRule}
以下のサービス情報を踏まえて投稿を生成してください。
【実装済】${profile.implementedFeatures || '特になし'}
【予定】${profile.upcomingFeatures || '特になし'}
【関連項目】${profile.relatedTopics || '特になし'}

向こう${targetDays}日分の独立した投稿内容を考案してください。
出力は必ずJSON形式の配列で返してください。
[
  { "content": "（投稿文1、ハッシュタグや絵文字含む、具体的な文章）" },
  { "content": "（投稿文2）" }
]
余計なマークダウンや説明は不要です。
${contextContext}`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [{ text: "ユーザーがスワイプ形式で一つずつ可否を判断して評価します。最高に魅力的な投稿のJSON配列を生成してください。" }] }
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 2000,
          responseMimeType: "application/json"
        }
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Gemini API Error details:', errorText)
      throw new Error(`Gemini API Error: ${res.status} - ${errorText.substring(0,100)}`)
    }
    
    const data = await res.json()
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    generatedText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim()

    let postsArray: any[] = []
    try { 
      // Enhance robustness for finding JSON array block
      const match = generatedText.match(/\[[\s\S]*\]/)
      if (match) generatedText = match[0]
      postsArray = JSON.parse(generatedText) 
    } catch { 
      console.error('JSON Parse Error. Raw text:', generatedText)
      return NextResponse.json({ error: 'JSON Parse Error' }, { status: 500 }) 
    }

    return NextResponse.json({ posts: postsArray })

  } catch (error: any) {
    console.error('Preview Generate Error:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}
