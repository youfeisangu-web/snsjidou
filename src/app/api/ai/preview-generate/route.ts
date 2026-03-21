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

向こう${targetDays}日分（1日あたり1-3投稿ペース想定）の独立した投稿内容を考案してください。

【スレッド形式（ツリー投稿）の推奨】
長文になる場合や、クイズ形式、結論を焦らしたい場合は、1つの投稿にまとめず、Threadsでよくある「スレッド形式（リプライで続きを書く）」にしてください。
スレッド形式にする場合は、各投稿（親投稿、子投稿1、子投稿2...）の間を必ず \`|||THREAD|||\` という文字列で区切ってください。

【URLの自然な誘導】
たまに（毎回ではなく自然な頻度で）、スレッドの一番最後（一番下）の投稿に、あなたのホームページURL（${profile.hpUrl || '設定なし'}）への誘導文を含めてください。単にURLを貼るだけでなく、「〇〇の続きはWebで！」「詳しくはプロフィールのリンク（または以下のURL）から👇」のように魅力的な文章を添えてください。

出力は必ずJSON形式の配列で返してください。
[
  { "content": "（投稿文1。スレッドの場合は: 1投稿目 |||THREAD||| 2投稿目 |||THREAD||| 3投稿目(URL付き) ）", "suggestedTime": "morning" },
  { "content": "（投稿文2）", "suggestedTime": "any" }
]
※ suggestedTime には内容に応じて、そのコンテンツが朝(morning)、昼(noon)、夜(night)のいつ読まれるのが最適か、あるいはいつでも良いか(any)を含めてください。
※ 【厳守】|||THREAD|||で区切られた各投稿は必ず500文字以内にしてください。500文字を超える場合は、|||THREAD|||でさらに分割してください。途中で切れた文章は絶対にNGです。
余計なマークダウンや説明は不要です。
${contextContext}`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [{ text: "ユーザーがスワイプ形式で一つずつ可否を判断して評価します。最高に魅力的な投稿のJSON配列を生成してください。" }] }
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
      let parsed = null;
      try {
        parsed = JSON.parse(generatedText);
      } catch (e) {
        // Fallback: extract from first [ to last ]
        const start = generatedText.indexOf('[');
        const end = generatedText.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          parsed = JSON.parse(generatedText.substring(start, end + 1));
        } else {
          throw e; // Re-throw to catch below
        }
      }
      postsArray = parsed;
    } catch (parseError: any) { 
      console.error('JSON Parse Error. Raw text:', generatedText)
      return NextResponse.json({ error: 'JSON Parse Error', details: parseError.message, rawText: generatedText }, { status: 500 }) 
    }

    return NextResponse.json({ posts: postsArray })

  } catch (error: any) {
    console.error('Preview Generate Error:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}
