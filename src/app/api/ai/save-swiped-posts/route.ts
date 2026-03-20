import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 })
    }

    const { profileId, approvedPosts = [], rejectedPosts = [] }: { profileId: string, approvedPosts: any[], rejectedPosts: any[] } = await req.json()
    if (!profileId) return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })

    const profile = await prisma.profile.findUnique({ where: { id: profileId } })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // 1. Save Approved Posts as Inventory (Drafts)
    for (const post of approvedPosts) {
      await prisma.post.create({
        data: {
          content: post.content,
          platform: 'both',
          status: 'draft',
          profileId: profile.id
        }
      })
    }

    // 2. Analyze User Preferences with Gemini (Feedback Loop)
    if (approvedPosts.length > 0 || rejectedPosts.length > 0) {
      const oldRules = profile.aiPreferenceRules || '現在、特別な好みは学習されていません。'
      
      const analysisPrompt = `あなたはSNS運用者であるユーザーの「好み（スタイル）」を分析・学習するAIです。
現在のユーザーの好みの設定（aiPreferenceRules）:
===
${oldRules}
===

今回のスワイプ審査の結果：
【ユーザーが「採用（💖）」した投稿】
${approvedPosts.map(p => `- ${p.content}`).join('\n')}

【ユーザーが「不採用（❌）」にした投稿】
${rejectedPosts.map(p => `- ${p.content}`).join('\n')}

上記を読み取り、現在の設定を「更新」する形で、以下のフォーマットで『最新のユーザー好み設定』の文章を生成してください。
- どんなトーン＆マナーが好きか、嫌いか
- どんなテーマやフォーマットだと採用されやすいか
簡潔に100〜200字程度にアップデートしてください。
出力は「更新された設定の文章のみ（マークダウン無し）」でお願いします。`

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        })
      })

      if (res.ok) {
        const data = await res.json()
        const newRules = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (newRules) {
          await prisma.profile.update({
            where: { id: profile.id },
            data: { aiPreferenceRules: newRules }
          })
        }
      }
    }

    return NextResponse.json({ success: true, savedCount: approvedPosts.length })

  } catch (error) {
    console.error('Save Swiped Posts Error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
