'use client'

import { useState } from 'react'
import { Sparkles, BrainCircuit } from 'lucide-react'
import { SwipeReview } from './SwipeReview'

export function AIAssistant({ profileId }: { profileId?: string }) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [previewPosts, setPreviewPosts] = useState<any[] | null>(null)

  const getCurrentProfileId = () => {
    if (profileId) return profileId;
    const match = document.cookie.match(/activeProfileId=([^;]+)/)
    return match ? match[1] : null;
  }

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const pid = getCurrentProfileId()
      const res = await fetch('/api/ai/analyze-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid }) // Assuming the route accepts it, or just generic
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInsight(data.text)
    } catch (error: any) {
      alert(`診断に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoGenerate = async () => {
    setGenerating(true)
    try {
      const pid = getCurrentProfileId()
      const res = await fetch('/api/ai/preview-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: pid, targetDays: 5 }) // 5 posts for Swiping
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.posts || data.posts.length === 0) throw new Error('投稿が生成されませんでした (JSON Parse Error)')
      setPreviewPosts(data.posts)
    } catch (error: any) {
      alert(`自動生成に失敗しました: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleSwipeFinish = async (approved: any[], rejected: any[]) => {
    setPreviewPosts(null)
    setGenerating(true)
    try {
       const pid = getCurrentProfileId()

       const res = await fetch('/api/ai/save-swiped-posts', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ profileId, approvedPosts: approved, rejectedPosts: rejected })
       })
       const data = await res.json()
       if (data.error) throw new Error(data.error)
       alert(`${approved.length}件の投稿を採用して予約しました！AIがあなたの好みを学習しました。`)
    } catch {
       alert('保存中にエラーが発生しました。')
    } finally {
       setGenerating(false)
    }
  }

  return (
    <div className="bg-linear-to-br from-indigo-50/50 to-primary-50/30 rounded-2xl border border-indigo-100/50 p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-all hover:border-indigo-200/60">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h2 className="text-sm font-medium tracking-wide flex items-center gap-2 mb-1">
            <BrainCircuit className="w-5 h-5 text-indigo-500" />
            AI マーケティングアソシエイト
          </h2>
          <p className="text-xs text-gray-500 font-light">
            分析による改善提案や、テーマもお任せの「完全自動」未来スケジュール作成を一元管理します。
          </p>
        </div>
        <div className="flex flex-col gap-2 min-w-max">
          <button
            onClick={handleAutoGenerate}
            disabled={generating || loading}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 shadow-sm text-xs font-medium tracking-widest uppercase rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? '全自動考案中...' : 'AIに完全お任せで作る (スワイプ)'}
          </button>
          
          <button
            onClick={handleAnalyze}
            disabled={loading || generating}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 shadow-sm text-xs font-medium tracking-widest uppercase rounded-full bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <BrainCircuit className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
            {loading ? '分析中...' : 'アカウント診断を実行'}
          </button>
        </div>
      </div>

      {insight && (
        <div className="bg-white/80 p-6 rounded-xl border border-indigo-50 text-sm leading-relaxed text-gray-700 font-light whitespace-pre-wrap">
          {insight}
        </div>
      )}

      {previewPosts && (
        <SwipeReview posts={previewPosts} onFinish={handleSwipeFinish} />
      )}
    </div>
  )
}
