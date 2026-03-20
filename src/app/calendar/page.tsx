import { prisma } from '@/lib/prisma'
import { Calendar, Clock, CheckCircle2, AtSign, Rss } from 'lucide-react'
import { format, isFuture, isPast } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarView } from '@/components/CalendarView'

import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const cookieStore = await cookies()
  const activeProfileId = cookieStore.get('activeProfileId')?.value
  const profile = activeProfileId ? await prisma.profile.findUnique({ where: { id: activeProfileId } }) : null

  const posts = await prisma.post.findMany({
    where: activeProfileId ? { profileId: activeProfileId } : {},
    orderBy: {
      publishedAt: 'desc'
    }
  })

  // Separate scheduled vs published
  const scheduled = posts.filter((p: any) => p.status === 'scheduled')
  const published = posts.filter((p: any) => p.status === 'published' || p.status === 'failed')

  return (
    <div className="max-w-5xl space-y-8 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-center justify-between border-b border-primary-50 pb-5 md:pb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-light tracking-tight text-primary-950 mb-1">投稿カレンダー</h1>
          <p className="text-xs md:text-sm tracking-wide text-gray-500 font-normal hidden md:block">予約中の投稿やこれまでのコンテンツ履歴をスケジュール単位で管理します。</p>
        </div>
      </header>

      <CalendarView posts={posts} profile={profile} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-400" />
            これからの投稿 (予約済)
          </h2>
          <div className="space-y-4">
            {scheduled.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <p className="text-sm text-gray-400 font-light">予約されている投稿はありません。</p>
              </div>
            ) : (
              scheduled.map((post: any) => (
                <div key={post.id} className="p-5 rounded-2xl bg-white border border-indigo-100 shadow-sm shadow-indigo-100/20">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <span className="font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {post.scheduledAt ? format(new Date(post.scheduledAt), 'yyyy年MM月dd日 HH:mm', { locale: ja }) : '未定'}
                    </span>
                    <div className="flex items-center gap-2">
                      {post.isRss && <div title="RSS自動生成"><Rss className="w-3.5 h-3.5 text-orange-400" /></div>}
                      <AtSign className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 font-light leading-relaxed whitespace-pre-wrap line-clamp-3">
                    {post.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            過去の投稿
          </h2>
          <div className="space-y-4">
            {published.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <p className="text-sm text-gray-400 font-light">過去の投稿はありません。</p>
              </div>
            ) : (
              published.map((post: any) => (
                <div key={post.id} className="p-5 rounded-2xl bg-white border border-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
                    <span className="font-light">
                      {format(new Date(post.publishedAt || post.scheduledAt || Date.now()), 'MM月dd日 HH:mm', { locale: ja })}
                    </span>
                    <div className="flex items-center gap-2">
                      {post.status === 'failed' && <span className="text-red-500 font-medium">失敗</span>}
                      {post.isRss && <div title="RSS自動生成"><Rss className="w-3.5 h-3.5 text-orange-400" /></div>}
                      <AtSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-light leading-relaxed whitespace-pre-wrap line-clamp-2 opacity-80">
                    {post.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
