import { prisma } from '@/lib/prisma'
import { ArrowUpRight, AtSign, Eye, Heart, Users } from 'lucide-react'
import { SyncButton } from '@/components/SyncButton'
import { DashboardChart } from '@/components/DashboardChart'
import { AIAssistant } from '@/components/AIAssistant'
import { cookies } from 'next/headers'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  let activeProfileId = cookieStore.get('activeProfileId')?.value

  if (!activeProfileId) {
    const firstProfile = await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })
    if (firstProfile) activeProfileId = firstProfile.id
  }

  // 最新のPageInsight（フォロワー数）
  const latestPageInsight = activeProfileId
    ? await prisma.pageInsight.findFirst({
        where: { profileId: activeProfileId, platform: 'threads' },
        orderBy: { recordedAt: 'desc' }
      })
    : null

  // 過去30日分のPageInsight履歴（チャート用）
  const pageInsightHistory = activeProfileId
    ? await prisma.pageInsight.findMany({
        where: {
          profileId: activeProfileId,
          platform: 'threads',
          recordedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        orderBy: { recordedAt: 'asc' }
      })
    : []

  // 総インプレッション・エンゲージメント集計
  const postInsightTotals = activeProfileId
    ? await prisma.postInsight.aggregate({
        where: { post: { profileId: activeProfileId } },
        _sum: { impressions: true, likes: true, comments: true, shares: true }
      })
    : null

  const recentPosts = activeProfileId
    ? await prisma.post.findMany({
        where: { profileId: activeProfileId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        include: {
          insights: { orderBy: { recordedAt: 'desc' }, take: 1 }
        }
      })
    : []

  const followers = latestPageInsight?.followers ?? 0
  const totalImpressions = postInsightTotals?._sum.impressions ?? 0
  const totalLikes = postInsightTotals?._sum.likes ?? 0
  const totalComments = postInsightTotals?._sum.comments ?? 0
  const totalShares = postInsightTotals?._sum.shares ?? 0
  const totalEngagement = totalLikes + totalComments + totalShares

  // チャート用データを整形
  const chartData = pageInsightHistory.map(i => ({
    recordedAt: i.recordedAt.toISOString(),
    followersCount: i.followers,
    totalEngagement: i.postImpressions,
  }))

  return (
    <div className="space-y-8 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-center justify-between border-b border-primary-50 pb-5 md:pb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-light tracking-tight text-primary-950 mb-1">ダッシュボード</h1>
          <p className="text-xs md:text-sm tracking-wide text-gray-500 font-normal hidden md:block">Threadsアカウントのパフォーマンスを確認します。</p>
        </div>
        <div className="flex gap-4">
          <SyncButton />
        </div>
      </header>

      <AIAssistant profileId={activeProfileId} />

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4 md:mb-8">主要な指標</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="フォロワー数" value={followers.toLocaleString()} icon={<Users className="w-4 h-4" />} />
          <KpiCard title="総インプレッション" value={totalImpressions.toLocaleString()} icon={<Eye className="w-4 h-4" />} />
          <KpiCard title="総エンゲージメント" value={totalEngagement.toLocaleString()} icon={<ArrowUpRight className="w-4 h-4" />} />
          <KpiCard title="いいね合計" value={totalLikes.toLocaleString()} icon={<Heart className="w-4 h-4" />} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">フォロワー推移</h2>
          </div>
          <DashboardChart thData={chartData} fbData={[]} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">最近の投稿</h2>
          </div>
          <div className="space-y-4">
            {recentPosts.length === 0 ? (
              <p className="text-sm text-gray-400 font-light">投稿はまだありません。</p>
            ) : (
              recentPosts.map((post: any) => {
                const insight = post.insights[0]
                return (
                  <div key={post.id} className="group flex flex-col gap-2 p-4 rounded-2xl bg-white border border-gray-100 hover:border-primary-200 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AtSign className="w-3.5 h-3.5 text-gray-900/70" />
                        <span className="text-[10px] uppercase tracking-wider text-gray-400/80">
                          {new Date(post.publishedAt).toLocaleDateString('ja-JP')}
                        </span>
                      </div>
                      {insight && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{insight.impressions.toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{insight.likes.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-800 line-clamp-2">{post.content}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="p-4 md:p-6 rounded-2xl bg-white border border-gray-100/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:border-primary-200 transition-colors duration-300">
      <div className="flex justify-between items-start mb-3 md:mb-6 text-gray-400 group-hover:text-primary-600 transition-colors duration-300">
        <span className="text-[10px] md:text-xs tracking-widest uppercase font-medium">{title}</span>
        {icon}
      </div>
      <div className="text-2xl md:text-3xl font-light tracking-tight text-gray-900">{value}</div>
    </div>
  )
}
