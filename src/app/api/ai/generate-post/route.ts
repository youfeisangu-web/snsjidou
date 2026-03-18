import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const sysPrompt = `あなたはSNSマーケティングのプロフェッショナルです。
入力されたテーマや短いメモを元に、FacebookやThreadsでバズりやすい、エンゲージメント（いいね、コメント）を獲得できる魅力的な投稿文を作成してください。
必要に応じて、マーケティングの視点から「請求書や経理のあるあるネタ（共感系）」や「有益な宣伝投稿」の要素を取り入れてください。
出力は投稿文のテキストのみとしてください（余計な挨拶や説明は不要）。
適度に絵文字やハッシュタグを使用し、改行をうまく使って読みやすくしてください。`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [{ text: prompt }] }
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
