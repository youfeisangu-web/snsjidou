import { prisma } from '@/lib/prisma'
import { AtSign, Eye, Heart, MessageCircle, Repeat, Users, TrendingUp } from 'lucide-react'
import { cookies } from 'next/headers'

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const activeProfileId = cookieStore.get('activeProfileId')?.value

  const posts = await prisma.post.findMany({
    where: {
      ...(activeProfileId ? { profileId: activeProfileId } : {}),
      status: 'published',
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
    include: {
      insights: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  })

  // 最新フォロワー数
  const latestPageInsight = activeProfileId
    ? await prisma.pageInsight.findFirst({
        where: { profileId: activeProfileId, platform: 'threads' },
        orderBy: { recordedAt: 'desc' }
      })
    : null

  // 集計
  const postsWithInsights = posts.filter(p => p.insights.length > 0)
  const totalImpressions = postsWithInsights.reduce((s, p) => s + (p.insights[0]?.impressions ?? 0), 0)
  const totalLikes = postsWithInsights.reduce((s, p) => s + (p.insights[0]?.likes ?? 0), 0)
  const totalComments = postsWithInsights.reduce((s, p) => s + (p.insights[0]?.comments ?? 0), 0)
  const totalShares = postsWithInsights.reduce((s, p) => s + (p.insights[0]?.shares ?? 0), 0)
  const totalEngagement = totalLikes + totalComments + totalShares
  const avgRate = totalImpressions > 0 ? ((totalEngagement / totalImpressions) * 100).toFixed(1) : '0.0'

  return (
    <div className="max-w-5xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">パフォーマンス分析</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">コンテンツのエンゲージメントとオーディエンスの反応を分析します。</p>
        </div>
      </header>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard icon={<Users className="w-4 h-4" />} label="フォロワー数" value={(latestPageInsight?.followers ?? 0).toLocaleString()} />
        <SummaryCard icon={<Eye className="w-4 h-4" />} label="総インプレッション" value={totalImpressions.toLocaleString()} />
        <SummaryCard icon={<Heart className="w-4 h-4" />} label="総いいね" value={totalLikes.toLocaleString()} />
        <SummaryCard icon={<MessageCircle className="w-4 h-4" />} label="総コメント" value={totalComments.toLocaleString()} />
        <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="平均反応率" value={`${avgRate}%`} />
      </div>

      {/* 投稿別テーブル */}
      <section className="bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] border border-gray-100 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-primary-50 bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium whitespace-nowrap">投稿内容</th>
                <th className="px-4 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right"><div className="flex justify-end gap-1.5 items-center"><Eye className="w-3.5 h-3.5" /> 表示</div></th>
                <th className="px-4 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right"><div className="flex justify-end gap-1.5 items-center"><Heart className="w-3.5 h-3.5" /> いいね</div></th>
                <th className="px-4 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right"><div className="flex justify-end gap-1.5 items-center"><MessageCircle className="w-3.5 h-3.5" /> コメント</div></th>
                <th className="px-4 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right"><div className="flex justify-end gap-1.5 items-center"><Repeat className="w-3.5 h-3.5" /> シェア</div></th>
                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right">反応率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-50">
              {posts.map((post: any) => {
                const insight = post.insights[0] || { impressions: 0, likes: 0, comments: 0, shares: 0 }
                const engagement = insight.likes + insight.comments + insight.shares
                const rate = insight.impressions > 0 ? ((engagement / insight.impressions) * 100).toFixed(1) : '—'

                return (
                  <tr key={post.id} className="group hover:bg-primary-50/30 transition-colors duration-300">
                    <td className="px-8 py-6 max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AtSign className="w-3 h-3" />
                          {new Date(post.publishedAt).toLocaleDateString('ja-JP')}
                        </span>
                        <p className="text-sm font-light text-gray-900 line-clamp-2 leading-relaxed">
                          {post.content.replace(/\|\|\|THREAD\|\|\|/g, ' ')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.impressions > 0 ? insight.impressions.toLocaleString() : <span className="text-gray-300">—</span>}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.likes > 0 ? insight.likes.toLocaleString() : <span className="text-gray-300">—</span>}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.comments > 0 ? insight.comments.toLocaleString() : <span className="text-gray-300">—</span>}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.shares > 0 ? insight.shares.toLocaleString() : <span className="text-gray-300">—</span>}</span></td>
                    <td className="px-8 py-6 text-right">
                      {rate !== '—' ? (
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary-50 text-primary-800 text-[10px] font-medium tracking-wide">
                          {rate}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">未取得</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-16 text-center text-sm font-light text-gray-400">
                    分析データはまだありません。投稿後に「同期」ボタンを押してください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-gray-400 text-[10px] uppercase tracking-widest font-medium">
        {icon}
        {label}
      </div>
      <div className="text-xl font-light tracking-tight text-gray-900">{value}</div>
    </div>
  )
}
