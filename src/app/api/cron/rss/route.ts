import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Parser from 'rss-parser'

export const maxDuration = 300; // Vercel Pro timeout

const parser = new Parser()

export async function GET() {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ message: 'Gemini API Key not configured' }, { status: 400 })
    }

    const allProfiles = await prisma.profile.findMany({
      where: { isActive: true }
    })
    const profiles = allProfiles.filter(p => p.rssUrl && p.rssUrl.trim() !== '')

    if (profiles.length === 0) {
      return NextResponse.json({ message: 'No active profiles with RSS URL found' })
    }

    let totalScheduled = 0

    for (const profile of profiles) {
      if (!profile.rssUrl) continue

      try {
        const feed = await parser.parseURL(profile.rssUrl)
        
        // 過去24以内の新着記事を最大5件取得
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const recentItems = feed.items.filter(item => {
          if (!item.isoDate && !item.pubDate) return true // 日付が取れなければとりあえず取得
          const pubD = item.isoDate ? new Date(item.isoDate) : new Date(item.pubDate!)
          return pubD >= twentyFourHoursAgo
        }).slice(0, 5)

        for (let i = 0; i < recentItems.length; i++) {
          const item = recentItems[i]
          if (!item.link) continue

          const existingPost = await prisma.post.findFirst({
            where: {
              profileId: profile.id,
              content: { contains: item.link }
            }
          })

          if (existingPost) continue

          // Generate Summary via Gemini
          const sysPrompt = `あなたはSNS運用者です。以下のブログ/ニュース記事のタイトルと一部の内容を読み取り、Threads向けのキャッチーな紹介文（絵文字入り、ハッシュタグ2〜3個）を作成してください。\n必ず『続きを読むにはこちら👇』と書いて、その下にURLを配置してください。出力は投稿文のテキストのみにしてください。`
          const userPrompt = `記事タイトル: ${item.title}\n概要: ${item.contentSnippet || item.content}\nURL: ${item.link}`

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: sysPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }]
            })
          })

          if (!res.ok) throw new Error('Gemini API Error for RSS generation')
          
          const data = await res.json()
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const finalContent = `${generatedText.trim()}\n\n詳細はこちら：\n${item.link}`

          // 複数ある場合は1時間ずつずらしてスケジュール
          const scheduledTime = new Date()
          scheduledTime.setHours(scheduledTime.getHours() + 1 + i)

          await prisma.post.create({
            data: {
              content: finalContent,
              platform: 'both',
              status: 'scheduled',
              isRss: true,
              scheduledAt: scheduledTime,
              profileId: profile.id
            }
          })
          totalScheduled++
        }
      } catch (err) {
        console.error(`RSS Processing error for profile ${profile.id}:`, err)
      }
    }

    return NextResponse.json({ message: `Scheduled ${totalScheduled} new RSS posts.` })
  } catch (error: any) {
    console.error('Cron RSS Global Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
