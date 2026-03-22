import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const settings = await prisma.setting.findUnique({ where: { id: 1 } })
    if (!settings || !settings.geminiApiKey) return NextResponse.json({ error: 'Gemini API key is missing' }, { status: 400 })

    const sysPrompt = `あなたはプロのSNSアナリストです。
提供されたSNSの投稿のスクリーンショット画像を読み取り、以下の3点を抽出・考案してください。

1. name: この投稿の「型（構成パターン）」に15文字以内でキャッチーな名前をつけてください。（例: 衝撃の事実スレッド型）
2. examplePost: 画像に書かれているテキスト本文をそのまま完全に抽出（OCR）してください。（UIの文字や関係ないボタンのテキストは排除し、投稿者の書いた純粋なテキストのみを抽出してください。）
3. memo: この投稿がなぜエンゲージメントを獲得できるのか、どういう構造になっているか、AIがこの型を真似して投稿を作る際の注意点などを100文字程度で解説してください。

出力は必ず指定されたJSON形式にしてください。`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sysPrompt }] },
        contents: [
          { role: "user", parts: [
              { text: "このスクリーンショットを解析してください。" },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
            ] 
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              examplePost: { type: "STRING" },
              memo: { type: "STRING" }
            },
            required: ["name", "examplePost", "memo"]
          }
        }
      })
    })

    if (!res.ok) throw new Error('Gemini API Error for Vision Template Parse')
    
    const data = await res.json()
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    return NextResponse.json(JSON.parse(text))

  } catch (err: any) {
    console.error('Vision Parsing Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
