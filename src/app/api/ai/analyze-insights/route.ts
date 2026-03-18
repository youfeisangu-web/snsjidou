import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const posts = await prisma.post.findMany({
      include: {
        insights: {
          orderBy: { recordedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { publishedAt: 'desc' },
      take: 10
    })

    const pageInsights = await prisma.pageInsight.findMany()

    if (posts.length === 0) {
      return NextResponse.json({ text: '分析する投稿データがありません。投稿を作成して同期した後に再度お試しください。' })
    }

    // Format data to pass to Gemini
    const dataSummary = posts.map((p: any) => {
      const ins = p.insights[0] || { impressions: 0, likes: 0, comments: 0, shares: 0 }
      const engRate = ins.impressions > 0 ? ((ins.likes + ins.comments + ins.shares) / ins.impressions * 100).toFixed(1) : 0
      return `- [${p.platform}] 投稿内容: "${p.content.substring(0, 50)}..." | 表示回数: ${ins.impressions}, いいね: ${ins.likes}, 反応率: ${engRate}%`
    }).join('\n')

    const sysPrompt = `あなたはFacebookやThreadsのアルゴリズムに精通した超一流のSNSマーケターです。
以下の直近の投稿データとそのパフォーマンスを分析し、**「現在のアカウントの傾向」**と**「次にどんな投稿をすべきか（具体的な改善アクション）」**について、150字〜250字程度の簡潔でプロフェッショナルなアドバイスを提供してください。
不要な挨拶は省き、具体的な提案を箇条書きで含めてください。`

    const userPrompt = `【最近の投稿データ】\n${dataSummary}\n\nこのデータを元に、アカウント診断と改善提案をお願いします。`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
           temperature: 0.8,
           maxOutputTokens: 600,
        }
      })
    })

    if (!res.ok) throw new Error('Failed to fetch from Gemini API')
    
    const data = await res.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return NextResponse.json({ text: generatedText.trim() })
  } catch (error) {
    console.error('Gemini Analysis Error:', error)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
