import { PrismaClient } from '@prisma/client';

async function test() {
  const prisma = new PrismaClient();
  const settings = await prisma.setting.findUnique({ where: { id: 1 } });
  
  const sysPrompt = `あなたはSNSマーケターです。
以下のサービス情報を踏まえて投稿を生成してください。

向こう5日分の独立した投稿内容を考案してください。
出力は必ずJSON形式の配列で返してください。
[
  { "content": "（投稿文1、ハッシュタグや絵文字含む、具体的な文章）" },
  { "content": "（投稿文2）" }
]
余計なマークダウンや説明は不要です。`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings?.geminiApiKey}`, {
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
  });
  
  if (!res.ok) {
    console.error(await res.text());
    return;
  }
  const data = await res.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  console.log("=== RAW ===");
  console.log(generatedText);
  console.log("=== PARSE TEST ===");
  try {
    let t = generatedText;
    const match = t.match(/\[[\s\S]*\]/);
    if (match) t = match[0];
    JSON.parse(t);
    console.log("SUCCESS");
  } catch (e: any) {
    console.log("JSON PARSE FAILED", e.message);
  }
}
test();
