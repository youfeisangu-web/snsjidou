import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300 // 5 minutes max for API routes on Vercel Pro/Hobby config

export async function POST(req: Request) {
  try {
    const settings = await prisma.setting.findFirst();
    if (!settings || !settings.geminiApiKey) {
      return NextResponse.json({ error: 'System not configured' }, { status: 500 });
    }

    const profiles = await prisma.profile.findMany({
      where: {
        isActive: true,
        autoReplyEnabled: true,
        threadsAccessToken: { not: null },
        threadsUserId: { not: null }
      }
    });

    if (profiles.length === 0) {
      return NextResponse.json({ message: 'No profiles enabled for auto-reply' });
    }

    const results = [];

    // Look back at posts from the last 72 hours
    const lookbackDate = new Date(Date.now() - 72 * 60 * 60 * 1000);

    for (const profile of profiles) {
      if (!profile.threadsAccessToken || !profile.threadsUserId) continue;
      
      try {
        // Fetch own username to ignore own replies (like thread chains)
        const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${profile.threadsAccessToken}`);
        const meData = await meRes.json();
        const myUsername = meData.username;
        if (!myUsername) continue;

        const recentPosts = await prisma.post.findMany({
          where: {
            profileId: profile.id,
            status: 'published',
            threadsId: { not: null },
            publishedAt: { gte: lookbackDate }
          },
          select: { id: true, threadsId: true, content: true }
        });

        if (recentPosts.length === 0) continue;

        let repliedCount = 0;

        for (const post of recentPosts) {
          if (!post.threadsId) continue;

          // Fetch replies for this specific post
          const repliesRes = await fetch(
            `https://graph.threads.net/v1.0/${post.threadsId}/replies?fields=id,text,username&access_token=${profile.threadsAccessToken}`
          );
          const repliesData = await repliesRes.json();
          
          if (!repliesData.data || !Array.isArray(repliesData.data)) continue;

          for (const reply of repliesData.data) {
            if (reply.username === myUsername) continue; // Skip own replies/threads
            
            // Check if we already replied to this comment
            const existingRecord = await prisma.autoReplyRecord.findUnique({
              where: { targetCommentId: reply.id }
            });
            if (existingRecord) continue;

            // Generate Reply via Gemini
            const customPersona = profile.aiPrompt 
              ? `【あなたの人格・振る舞いの絶対ルール】\n${profile.aiPrompt}\n\n` 
              : 'あなたはフレンドリーで親しみやすいSNSユーザーです。\n';

            const sysPrompt = `${customPersona}
上記の【あなたの人格】として振る舞い、フォロワーからのコメントに返信（リプライ）をしてください。

【元のあなたの投稿】
${post.content}

【上記投稿に対してフォロワーから来たコメント】
${reply.text}

【返信のルール】
1. 短く、親しみやすく、SNSらしい自然な会話のトーンで返信してください（最大でも2〜3文程度）。
2. AIのような堅苦しい言葉遣い（「いかがでしたか？」「〜ですね。」という平坦な表現）は絶対に避けてください。
3. フォロワーのコメントに共感したり、さらに軽い質問を投げ返したりして、会話が弾むようにしてください。
4. Markdownや説明は不要です。返信テキストのみをそのまま出力してください。`;

            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${settings.geminiApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: sysPrompt }] },
                contents: [{ role: "user", parts: [{ text: "返信テキストのみを出力してください。" }] }],
                generationConfig: { temperature: 0.85, maxOutputTokens: 200 }
              })
            });

            if (!geminiRes.ok) throw new Error("Gemini generation failed for reply");
            const geminiData = await geminiRes.json();
            const replyText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!replyText) continue;

            // Post Reply via Threads API
            const creationRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                media_type: 'TEXT',
                text: replyText,
                reply_to_id: reply.id,
                access_token: profile.threadsAccessToken
              })
            });
            const creationData = await creationRes.json();

            if (!creationData.id) {
              console.error('Threads API Creation Error for reply', creationData);
              continue;
            }

            // Poll until FINISHED
            let isFinished = false;
            let currentErrorLog = null;
            for (let poll = 0; poll < 10; poll++) {
              const statusRes = await fetch(`https://graph.threads.net/v1.0/${creationData.id}?fields=status,error_message&access_token=${profile.threadsAccessToken}`);
              const statusData = await statusRes.json();
              if (statusData.status === 'FINISHED') {
                isFinished = true; break;
              } else if (statusData.status === 'ERROR') {
                currentErrorLog = statusData.error_message;
                break;
              }
              await new Promise(r => setTimeout(r, 2000));
            }

            if (!isFinished) {
              console.error('Reply processing failed or timed out:', currentErrorLog);
              continue;
            }

            // Publish the reply container
            const publishRes = await fetch(`https://graph.threads.net/v1.0/${profile.threadsUserId}/threads_publish`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creation_id: creationData.id, access_token: profile.threadsAccessToken })
            });
            const pubData = await publishRes.json();

            if (pubData.id) {
              // Successfully replied, record it
              await prisma.autoReplyRecord.create({
                data: {
                  profileId: profile.id,
                  targetCommentId: reply.id,
                  replyText: replyText
                }
              });
              repliedCount++;
              await new Promise(r => setTimeout(r, 3000)); // Sleep to prevent rate limits
            }
          }
        }
        
        results.push({ profileId: profile.id, repliedCount });
      } catch (e: any) {
        console.error(`Auto-reply error for profile ${profile.id}:`, e);
        results.push({ profileId: profile.id, error: e.message });
      }
    }

    return NextResponse.json({ message: 'Auto-reply processed', results });
  } catch (error) {
    console.error('Auto-reply global error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
