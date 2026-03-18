import { prisma } from '@/lib/prisma'
import { Facebook, AtSign, Eye, Heart, MessageCircle, Repeat } from 'lucide-react'

export default async function AnalyticsPage() {
  const posts = await prisma.post.findMany({
    orderBy: { publishedAt: 'desc' },
    include: {
      insights: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  })

  return (
    <div className="max-w-5xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">パフォーマンス分析</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">コンテンツのエンゲージメントとオーディエンスの反応を詳細に分析します。</p>
        </div>
      </header>

      <section className="bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] border border-gray-100 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-primary-50 bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium whitespace-nowrap">投稿内容</th>
                <th className="px-8 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium">プラットフォーム</th>
                <th className="px-4 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-medium text-right"><div className="flex justify-end gap-1.5 items-center"><Eye className="w-3.5 h-3.5" /> 表示回数</div></th>
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
                const rate = insight.impressions > 0 ? ((engagement / insight.impressions) * 100).toFixed(1) : '0.0'

                return (
                  <tr key={post.id} className="group hover:bg-primary-50/30 transition-colors duration-300">
                    <td className="px-8 py-6 max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{new Date(post.publishedAt).toLocaleDateString()}</span>
                        <p className="text-sm font-light text-gray-900 line-clamp-2 leading-relaxed">{post.content}</p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        {post.platform === 'facebook' || post.platform === 'both' ? <Facebook className="w-4 h-4 text-blue-600/70" /> : null}
                        {post.platform === 'threads' || post.platform === 'both' ? <AtSign className="w-4 h-4 text-gray-900/70" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.impressions.toLocaleString()}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.likes.toLocaleString()}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.comments.toLocaleString()}</span></td>
                    <td className="px-4 py-6 text-right"><span className="text-sm text-gray-600 font-light">{insight.shares.toLocaleString()}</span></td>
                    <td className="px-8 py-6 text-right">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary-50 text-primary-800 text-[10px] font-medium tracking-wide">
                        {rate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-16 text-center text-sm font-light text-gray-400">
                    分析データはまだありません。
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
