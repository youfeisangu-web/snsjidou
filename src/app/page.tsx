import { prisma } from '@/lib/prisma'
import { ArrowUpRight, AtSign, Eye, Heart } from 'lucide-react'
import { SyncButton } from '@/components/SyncButton'
import { DashboardChart } from '@/components/DashboardChart'
import { AIAssistant } from '@/components/AIAssistant'
import { cookies } from 'next/headers'

// Very simple, generic Card component structure for elegant layout
export default async function DashboardPage() {
  const cookieStore = await cookies()
  let activeProfileId = cookieStore.get('activeProfileId')?.value

  // If no cookie, fallback to first profile
  if (!activeProfileId) {
    const firstProfile = await prisma.profile.findFirst({ orderBy: { createdAt: 'desc' } })
    if (firstProfile) activeProfileId = firstProfile.id
  }

  const pageInsights = activeProfileId 
    ? await prisma.pageInsight.findMany({ where: { profileId: activeProfileId } })
    : []

  const recentPosts = activeProfileId
    ? await prisma.post.findMany({
        where: { profileId: activeProfileId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        include: { insights: true }
      })
    : []

  // Basic aggregation
  const thInsight = pageInsights.find((i: any) => i.platform === 'threads') || { followers: 0, postImpressions: 0, pageViews: 0 }

  return (
    <div className="space-y-8 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-center justify-between border-b border-primary-50 pb-5 md:pb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-light tracking-tight text-primary-950 mb-1">ダッシュボード</h1>
          <p className="text-xs md:text-sm tracking-wide text-gray-500 font-normal hidden md:block">Metaプラットフォーム全体でのブランドプレゼンスを監視します。</p>
        </div>
        <div className="flex gap-4">
          <SyncButton />
        </div>
      </header>

      <AIAssistant profileId={activeProfileId} />

      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4 md:mb-8">主要な指標</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <KpiCard title="Threads フォロワー数" value={thInsight.followers.toLocaleString()} icon={<AtSign className="w-4 h-4" />} />
          <KpiCard title="Threads 反応 (Engagement)" value={thInsight.postImpressions.toLocaleString()} icon={<ArrowUpRight className="w-4 h-4" />} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
        <div>
           <div className="flex items-center justify-between mb-8">
             <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">成長推移 (Growth Over Time)</h2>
           </div>
           {/* Placeholder for Chart.js - we'll implement the actual chart component next */}
           <DashboardChart 
             fbData={[]} // In accurate implementation map real pageInsights data correctly
             thData={[]} 
           />
        </div>

        <div>
           <div className="flex items-center justify-between mb-8">
             <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">最近の投稿 (Recent Posts)</h2>
           </div>
           <div className="space-y-6">
             {recentPosts.length === 0 ? (
               <p className="text-sm text-gray-400 font-light">投稿はまだありません。作成タブから最初の投稿を行ってください。</p>
             ) : (
               recentPosts.map((post: any) => (
                 <div key={post.id} className="group relative flex flex-col gap-3 p-5 rounded-2xl bg-white border border-gray-100 hover:border-primary-200 transition-all duration-300">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <AtSign className="w-3.5 h-3.5 text-gray-900/70" />
                       <span className="text-[10px] uppercase tracking-wider text-gray-400/80">
                         {new Date(post.publishedAt).toLocaleDateString()}
                       </span>
                     </div>
                   </div>
                   <p className="text-sm leading-relaxed text-gray-800 line-clamp-2 pr-8">{post.content}</p>
                 </div>
               ))
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
