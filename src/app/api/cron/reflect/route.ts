import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300; // Vercel Pro timeout for long AI reflection

export async function GET(req: Request) {
  try {
    const settings = await prisma.setting.findUnique({ where: { id: 1 } });
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured' }, { status: 400 });
    }

    const profiles = await prisma.profile.findMany({
      where: { isActive: true, threadsUserId: { not: null }, threadsAccessToken: { not: null } }
    });

    if (profiles.length === 0) {
      return NextResponse.json({ message: 'No active profiles with API credentials found.' });
    }

    const results = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const profile of profiles) {
      try {
        const posts = await prisma.post.findMany({
          where: {
            profileId: profile.id,
            status: 'published',
            publishedAt: { gte: sevenDaysAgo },
            threadsId: { not: null }
          },
          orderBy: { publishedAt: 'desc' }
        });

        if (posts.length === 0) {
          results.push({ profileId: profile.id, message: 'No published posts in the last 7 days to reflect on.' });
          continue;
        }

        const metricsData = [];

        // Fetch metrics from Graph API
        for (const post of posts) {
          try {
            const res = await fetch(`https://graph.threads.net/v1.0/${post.threadsId}?fields=text,like_count,reply_count,quote_count,repost_count&access_token=${profile.threadsAccessToken}`);
            const data = await res.json();
            
            if (data.id) {
              metricsData.push(`
📝 投稿内容: ${post.content}
❤️ いいね: ${data.like_count ?? 0}
💬 返信: ${data.reply_count ?? 0}
🔄 引用: ${data.quote_count ?? 0}
🔁 再投稿: ${data.repost_count ?? 0}
---
              `.trim());
              
              // Increment insights in DB securely while we are here:
              await prisma.postInsight.create({
                data: {
                  postId: post.id,
                  likes: data.like_count || 0,
                  comments: data.reply_count || 0,
                  shares: (data.quote_count || 0) + (data.repost_count || 0)
                }
              });
            }
          } catch (e) {
            console.error(`Failed to fetch metrics for post ${post.id}`, e);
          }
        }

        if (metricsData.length === 0) {
          results.push({ profileId: profile.id, message: 'Could not fetch any metrics from Threads.' });
          continue;
        }

        const sysPrompt = `あなたはプロのSNSアナリストであり、アカウント自らを成長させる自己学習AIエンジンです。
以下の過去7日間の投稿データとそのエンゲージメント（いいね・返信など）の数値を読み込み、徹底的に分析してください。

【出力要件】
- どの投稿の「文字数」「トーン」「ハッシュタグ」「内容（トピック）」が最もウケたか（いいね数・返信数が多いか）を抽出すること。
- 逆に、全く反応が悪かった投稿の共通点を抽出し、「やってはいけないこと」として言語化すること。
- 分析結果の数値の羅列ではなく、次回の『投稿自動生成プロンプト』としてそのまま使える【必勝ルール・ガイドライン（300文字程度）】のみを出力すること。不要な挨拶や「分析結果はこちらです」といった応答は一切書かないでください。`;

        const userPrompt = `以下は直近の投稿結果データです。これを元に次回の投稿の教訓・ルールを生成してください：\n\n${metricsData.join('\n\n')}`;

        const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sysPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }]
          })
        });

        if (!gRes.ok) throw new Error('Gemini API Error for Reflection');
        const gData = await gRes.json();
        const learnedInsights = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (learnedInsights.trim()) {
          await prisma.profile.update({
            where: { id: profile.id },
            data: { aiLearnedInsights: learnedInsights.trim() }
          });
          results.push({ profileId: profile.id, message: 'Reflection complete', insights: learnedInsights.trim() });
        } else {
          results.push({ profileId: profile.id, message: 'Gemini returned empty insights.' });
        }
      } catch (err: any) {
        results.push({ profileId: profile.id, error: err.message });
      }
    }

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error('Reflect Cron Global Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
