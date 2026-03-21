import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Parser from 'rss-parser'

const parser = new Parser()

export async function GET() {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.rssUrl || !settings.geminiApiKey) {
      return NextResponse.json({ message: 'RSS URL or Gemini API Key not configured' }, { status: 400 })
    }

    const feed = await parser.parseURL(settings.rssUrl)
    
    // Get latest item
    const latestItem = feed.items[0]
    if (!latestItem || !latestItem.link) {
      return NextResponse.json({ message: 'No valid items found in RSS feed' })
    }

    // Check if we already posted this link (using content matching or a new field, but matching text simply for MVP)
    const existingPost = await prisma.post.findFirst({
      where: {
        content: { contains: latestItem.link }
      }
    })

    if (existingPost) {
      return NextResponse.json({ message: 'Latest RSS item already processed' })
    }

    // Generate Summary via Gemini
    const sysPrompt = `あなたはSNS運用者です。以下のブログ/ニュース記事のタイトルと一部の内容を読み取り、Threads向けのキャッチーな紹介文（絵文字入り、ハッシュタグ2〜3個）を作成してください。
必ず『続きを読むにはこちら👇』と書いて、その下にURLを配置してください。出力は投稿文のテキストのみにし、余計な説明は省いてください。`

    const userPrompt = `記事タイトル: ${latestItem.title}\n概要: ${latestItem.contentSnippet || latestItem.content}\nURL: ${latestItem.link}`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
      })
    })

    if (!res.ok) throw new Error('Gemini API Error for RSS generation')
    
    const data = await res.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    const finalContent = `${generatedText.trim()}\n\n詳細はこちら：\n${latestItem.link}`

    // Schedule it for 1 hour later (as an example of automated scheduling)
    const scheduledTime = new Date()
    scheduledTime.setHours(scheduledTime.getHours() + 1)

    // Save as Scheduled
    const post = await prisma.post.create({
      data: {
        content: finalContent,
        platform: 'both',
        status: 'scheduled',
        isRss: true,
        scheduledAt: scheduledTime
      }
    })

    return NextResponse.json({ message: 'Scheduled new RSS post', post })
  } catch (error: any) {
    console.error('Cron RSS Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
