'use client'

import { useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday, startOfDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, AtSign, Rss, Archive, RefreshCw, X, Loader2, PlayCircle } from 'lucide-react'

type Post = any

export function CalendarView({ posts, profile }: { posts: Post[], profile?: any }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTime, setEditTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [postCountPerDay, setPostCountPerDay] = useState(profile?.postCountPerDay || 3)
  const [postIntervalType, setPostIntervalType] = useState(profile?.postIntervalType || 'uniform')
  const [postStartHour, setPostStartHour] = useState(profile?.postStartHour ?? 9)
  const [postEndHour, setPostEndHour] = useState(profile?.postEndHour ?? 21)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showPublished, setShowPublished] = useState(false)
  const [dialog, setDialog] = useState<{type: 'confirm' | 'alert', message: string, onConfirm?: () => void} | null>(null)

  const handleProcessCron = async () => {
    setDialog({
      type: 'confirm',
      message: '現在時刻を過ぎている予約投稿がないか確認し、あれば今すぐ投稿を実行しますか？（Vercelの自動巡回を待たずに即時実行します）',
      onConfirm: async () => {
        setIsProcessing(true)
        try {
          const res = await fetch('/api/cron/process', { method: 'GET' })
          const data = await res.json()
          setDialog({
            type: 'alert',
            message: data.message || data.error || '実行完了しました',
            onConfirm: () => window.location.reload()
          })
        } catch (e: any) {
          setDialog({ type: 'alert', message: 'エラー: ' + e.message })
        } finally {
          setIsProcessing(false)
        }
      }
    })
  }

  const handleRestoreToDraft = async () => {
    if (!profile) return;
    setDialog({
      type: 'confirm',
      message: '実際にThreadsに投稿されていない「投稿済み」の投稿を、すべて在庫（ドラフト）に戻しますか？',
      onConfirm: async () => {
        setIsRestoring(true)
        try {
          const res = await fetch('/api/posts/restore-to-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: profile.id })
          })
          if (res.ok) {
            const d = await res.json()
            setDialog({ type: 'alert', message: `${d.restoredCount}件の投稿を在庫に戻しました。`, onConfirm: () => window.location.reload() })
          } else {
            const d = await res.json()
            setDialog({ type: 'alert', message: 'エラー: ' + d.error })
          }
        } catch (e: any) {
          setDialog({ type: 'alert', message: 'エラー: ' + e.message })
        } finally {
          setIsRestoring(false)
        }
      }
    })
  }

  const handleReschedule = async () => {
    if (!profile) return;
    if (postEndHour <= postStartHour) {
      setDialog({ type: 'alert', message: `エラー: 投稿終了時刻（${String(postEndHour).padStart(2,'0')}:00）は開始時刻（${String(postStartHour).padStart(2,'0')}:00）より後に設定してください。` })
      return
    }
    setDialog({
      type: 'confirm',
      message: '現在の設定で予約済みの投稿を再振り分け（リスケジュール）しますか？\n※既に過ぎた投稿や公開済みのものは変更されません。',
      onConfirm: async () => {
        setIsRescheduling(true)
        try {
          const res = await fetch('/api/posts/reschedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId: profile.id,
              postCountPerDay,
              postIntervalType,
              postStartHour,
              postEndHour,
            })
          })
          if (res.ok) {
            window.location.reload()
          } else {
            const d = await res.json()
            setDialog({ type: 'alert', message: 'エラー: ' + d.error })
          }
        } catch (e: any) {
          setDialog({ type: 'alert', message: 'エラー: ' + e.message })
        } finally {
          setIsRescheduling(false)
        }
      }
    })
  }

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handlePostClick = (post: Post) => {
    if (post.status !== 'scheduled' && post.status !== 'draft') {
      alert('予約済み（未投稿）または在庫のもののみ編集できます');
      return;
    }
    setEditingPost(post)
    setEditContent(post.content)
    if (post.status === 'scheduled') {
      setEditTime(format(new Date(post.scheduledAt), 'HH:mm'))
    } else {
      setEditTime('')
    }
  }

  const handleSave = async () => {
    if (!editingPost) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, time: editTime })
      })
      if (res.ok) {
        window.location.reload();
      } else {
        const d = await res.json()
        setDialog({ type: 'alert', message: 'エラー: ' + d.error })
      }
    } catch (e: any) {
      setDialog({ type: 'alert', message: 'エラー: ' + e.message })
    } finally {
      setIsSaving(false);
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const dateFormat = "d"
  const rows = []
  let days = []
  let day = startDate
  let formattedDate = ""

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat)
      const cloneDay = day
      
      const dayPosts = posts.filter(post => {
        if (post.status !== 'scheduled' || !post.scheduledAt) return false
        const postDate = new Date(post.scheduledAt)
        return isSameDay(postDate, cloneDay)
      })

      days.push(
        <div
          key={day.toString()}
          onClick={() => dayPosts.length > 0 && setSelectedDay(cloneDay)}
          className={`min-h-[120px] p-2 border-r border-b border-gray-100 flex flex-col transition-colors ${dayPosts.length > 0 ? 'cursor-pointer' : ''} ${
            !isSameMonth(day, monthStart)
              ? "bg-gray-50/50 text-gray-300"
              : isToday(day) ? "bg-primary-50/20 text-primary-600" : "bg-white text-gray-700 hover:bg-gray-50/50"
          }`}
        >
          <div className="flex justify-between items-center mb-2 px-1">
            <span className={`text-sm font-medium ${isToday(day) ? 'bg-primary-500 text-white w-7 h-7 flex items-center justify-center rounded-full' : ''}`}>
              {formattedDate}
            </span>
            {dayPosts.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{dayPosts.length}件</span>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 hide-scrollbar">
            {dayPosts.slice(0, 3).map(post => (
              <div 
                key={post.id} 
                onClick={(e) => { e.stopPropagation(); post.status === 'scheduled' && handlePostClick(post) }}
                className={`text-[10px] p-1.5 rounded-md leading-tight truncate border flex flex-col gap-1 transition-all ${
                  post.status === 'scheduled' ? 'bg-indigo-50/80 border-indigo-100/50 text-indigo-700 cursor-pointer hover:bg-indigo-100' : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                <div className="flex items-center gap-1 opacity-70">
                  {post.status === 'scheduled' ? <Clock className="w-3 h-3 text-indigo-500" /> : null}
                  <AtSign className="w-3 h-3 text-black" />
                  <span className="font-medium ml-auto">
                    {format(new Date(post.scheduledAt), 'HH:mm')}
                  </span>
                </div>
                <div className="truncate font-medium">{post.content}</div>
              </div>
            ))}
            {dayPosts.length > 3 && (
              <div className="text-[10px] text-center text-gray-400 font-medium py-1">
                + {dayPosts.length - 3} 件
              </div>
            )}
          </div>
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    )
    days = []
  }

  // 今後7日分の予定投稿をグループ化して表示するデータ
  const upcomingScheduled = posts
    .filter(p => p.status === 'scheduled' && p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  const upcomingByDay: { label: string, date: Date, posts: Post[] }[] = []
  const today = startOfDay(new Date())
  for (let d = 0; d < 7; d++) {
    const day = addDays(today, d)
    const dayPosts = upcomingScheduled.filter(p => isSameDay(new Date(p.scheduledAt), day))
    if (dayPosts.length > 0) {
      const label = d === 0 ? '今日' : d === 1 ? '明日' : format(day, 'M/d（E）', { locale: ja })
      upcomingByDay.push({ label, date: day, posts: dayPosts })
    }
  }

  return (
    <div className="space-y-6">
      {/* Settings Card for Reschedule */}
      {profile && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col xl:flex-row gap-6 items-start xl:items-end justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col sm:flex-row flex-wrap gap-6 w-full xl:w-auto">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">1日の投稿数</label>
              <input type="number" min="1" max="50" className="w-full sm:w-32 p-2.5 rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium" value={postCountPerDay} onChange={e => setPostCountPerDay(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">1日の中での投稿間隔</label>
              <select className="w-full sm:w-64 p-2.5 rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all font-medium text-gray-700" value={postIntervalType} onChange={e => setPostIntervalType(e.target.value)}>
                <option value="uniform">等間隔（均等に配分）</option>
                <option value="random">まちまち（ランダムな時間）</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">投稿時間帯（JST）</label>
              <div className="flex items-center gap-2">
                <select className="p-2.5 rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all font-medium text-gray-700 w-full sm:w-auto" value={postStartHour} onChange={e => setPostStartHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">〜</span>
                <select className="p-2.5 rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white transition-all font-medium text-gray-700 w-full sm:w-auto" value={postEndHour} onChange={e => setPostEndHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 shrink-0">
            <button
              onClick={handleReschedule}
              disabled={isRescheduling || isRestoring}
              className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:shadow-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isRescheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {isRescheduling ? '再振り分け中...' : '変更して再振り分け'}
            </button>
            <button
              onClick={handleRestoreToDraft}
              disabled={isRestoring || isRescheduling || isProcessing}
              className="w-full sm:w-auto px-5 py-2.5 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:shadow-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              {isRestoring ? '在庫に戻し中...' : '未投稿を在庫に戻す'}
            </button>
            <button
              onClick={handleProcessCron}
              disabled={isProcessing || isRescheduling || isRestoring}
              className="w-full sm:w-auto px-5 py-2.5 bg-green-50 text-green-600 hover:bg-green-100 hover:shadow-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              {isProcessing ? '実行中...' : '配信チェックを開始'}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Schedule Timeline */}
      {upcomingByDay.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            今後の投稿スケジュール
            <span className="text-xs font-normal text-gray-400 ml-1">（{upcomingScheduled.length}件予約中）</span>
          </h3>
          <div className="space-y-4">
            {upcomingByDay.map(({ label, date, posts: dayPosts }) => (
              <div key={date.toISOString()}>
                <div className="text-xs font-semibold text-indigo-600 mb-2 flex items-center gap-2">
                  <span className="bg-indigo-50 px-2 py-0.5 rounded-full">{label}</span>
                  <span className="text-gray-400 font-normal">{dayPosts.length}件</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dayPosts.map(post => (
                    <div
                      key={post.id}
                      onClick={() => handlePostClick(post)}
                      className="flex items-center gap-2 px-3 py-2 bg-indigo-50/60 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-100 transition-all group max-w-xs"
                    >
                      <span className="text-xs font-bold text-indigo-600 whitespace-nowrap">
                        {format(new Date(post.scheduledAt), 'HH:mm')}
                      </span>
                      <span className="text-xs text-gray-600 truncate group-hover:text-gray-900 transition-colors">
                        {post.content.replace(/\|\|\|THREAD\|\|\|/g, ' ').slice(0, 30)}{post.content.length > 30 ? '…' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-primary-500" />
          {format(currentMonth, 'yyyy年 MMMM', { locale: ja })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            今日
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div key={d} className={`py-3 text-center text-xs font-medium tracking-widest ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-col border-b border-gray-100">
        {rows}
      </div>

      {/* Failed Posts Section */}
      {posts.filter(p => p.status === 'failed').length > 0 && (
        <div className="p-6 bg-red-50/50 border-b border-red-100">
          <h3 className="text-sm font-bold text-red-600 mb-4 flex items-center gap-2">
            <X className="w-5 h-5 bg-red-100 rounded-full p-1" />
            投稿に失敗した記事（再認証・修正等が必要です） {posts.filter(p => p.status === 'failed').length}件
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {posts.filter(p => p.status === 'failed').map(post => (
              <div key={post.id} onClick={() => handlePostClick(post)} className="p-4 bg-white border border-red-200 rounded-2xl hover:border-red-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]" />
                <div className="text-xs text-slate-700 leading-relaxed line-clamp-4 group-hover:text-red-900 transition-colors pl-2">
                  {post.content}
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 self-start px-2 py-1 rounded-md ml-2 drop-shadow-sm">
                    ⚠️ 投稿失敗（クリックして確認・編集）
                  </div>
                  {post.errorLog && (
                    <div className="text-[9px] text-red-400 bg-red-50/50 p-1.5 rounded-md ml-2 max-h-16 overflow-hidden text-ellipsis break-all bg-white border border-red-100/50 font-mono">
                      {post.errorLog}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory (Drafts) Section */}
      {posts.filter(p => p.status === 'draft').length > 0 && (
        <div className="p-6 bg-gray-50/30">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Archive className="w-4 h-4 text-indigo-500" />
            投稿の在庫（承認済み・未予約） {posts.filter(p => p.status === 'draft').length}件
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {posts.filter(p => p.status === 'draft').map(post => (
              <div key={post.id} onClick={() => handlePostClick(post)} className="p-4 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between gap-3">
                <div className="text-xs text-gray-600 leading-relaxed line-clamp-4 group-hover:text-gray-900 transition-colors">
                  {post.content}
                </div>
                <div className="text-[10px] font-medium text-indigo-500 bg-indigo-50 self-start px-2 py-1 rounded-md">在庫（自動入力待ち）</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Published Posts Section */}
      {posts.filter(p => p.status === 'published').length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowPublished(v => !v)}
            className="w-full px-6 py-4 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50/50 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <Rss className="w-4 h-4 text-green-500" />
              投稿済みを見る
              <span className="text-xs text-gray-400 font-normal">{posts.filter(p => p.status === 'published').length}件</span>
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showPublished ? 'rotate-90' : ''}`} />
          </button>
          {showPublished && (
            <div className="px-6 pb-6 bg-gray-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {posts.filter(p => p.status === 'published').sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).map(post => (
                  <div key={post.id} className="p-4 bg-white border border-gray-200 rounded-2xl flex flex-col gap-2">
                    <div className="text-xs text-gray-600 leading-relaxed line-clamp-4">
                      {post.content}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {post.publishedAt ? format(new Date(post.publishedAt), 'M/d HH:mm') : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl shadow-black/10 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              予約投稿の編集
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">投稿内容 <span className="text-xs text-gray-400 font-normal">※スレッドの場合は「|||THREAD|||」で区切ってください</span></label>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full h-40 p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none transition-colors leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">配信予定時間</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingPost(null)}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? '保存中...' : '変更を保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl shadow-black/10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                {format(selectedDay, 'yyyy年 M月 d日')} の予定
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {posts.filter(p => {
                if (p.status !== 'scheduled' || !p.scheduledAt) return false;
                return isSameDay(new Date(p.scheduledAt), selectedDay)
              }).sort((a, b) => {
                return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
              }).map(post => (
                <div key={post.id} onClick={() => handlePostClick(post)} className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                  post.status === 'scheduled'
                    ? 'border-indigo-100 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-200'
                    : 'border-gray-100 bg-gray-50/30 hover:bg-gray-50 hover:border-gray-200'
                }`}>
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className={`text-sm font-bold ${post.status === 'scheduled' ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {format(new Date(post.scheduledAt), 'HH:mm')}
                    </span>
                    <span className="block text-[10px] text-gray-500 mt-1 uppercase tracking-widest">{post.status}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  </div>
                </div>
              ))}
              {posts.filter(p => {
                return p.status === 'scheduled' && p.scheduledAt && isSameDay(new Date(p.scheduledAt), selectedDay)
              }).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">この日の投稿はありません。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              {dialog.type === 'confirm' ? '確認' : 'お知らせ'}
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mb-6">
              {dialog.message}
            </p>
            <div className="flex justify-end gap-3">
              {dialog.type === 'confirm' && (
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  キャンセル
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm()
                  setDialog(null)
                }}
                className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-md transition-all"
              >
                {dialog.type === 'confirm' ? 'はい' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

function CalendarIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}
