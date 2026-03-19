import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const activeProfileId = cookieStore.get('activeProfileId')?.value

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const posts = await prisma.post.findMany({
      where: activeProfileId ? { profileId: activeProfileId } : {},
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

    const sysPrompt = `あなたはThreadsのアルゴリズムに精通した超一流のSNSマーケターです。
以下の直近の投稿データとそのパフォーマンスを分析し、**「現在のアカウントの傾向」**と**「次にどんな投稿をすべきか（具体的な改善アクション）」**について、150字〜250字程度の簡潔でプロフェッショナルなアドバイスを提供してください。
不要な挨拶は省き、具体的な提案を箇条書きで含めてください。

【重要制約】
あなたの出力の「一番最後」に、改行して必ず \`SUCCESS_FACTORS:\` という文字列から始め、今回の分析と過去のデータから得られた「今後このアカウントがバズるための絶対ルールや成功要因」を100字程度で出力してください。これはシステムが次回AI生成時に学習するためのデータになります。`

    const userPrompt = `【最近の投稿データ】\n${dataSummary}\n\nこのデータを元に、アカウント診断と改善提案と成功要因の抽出をお願いします。`

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
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // 抽出とProfileへの保存
    const sfMatch = generatedText.match(/SUCCESS_FACTORS:\s*([\s\S]*)/i)
    if (sfMatch && sfMatch[1] && activeProfileId) {
       await prisma.profile.update({
         where: { id: activeProfileId },
         data: { successFactors: sfMatch[1].trim() }
       })
       // フロントエンドにはSUCCESS_FACTORS部分を隠す
       generatedText = generatedText.replace(/SUCCESS_FACTORS:\s*([\s\S]*)/i, '').trim()
    }

    return NextResponse.json({ text: generatedText.trim() })
  } catch (error) {
    console.error('Gemini Analysis Error:', error)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
