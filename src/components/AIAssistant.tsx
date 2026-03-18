'use client'

import { useState } from 'react'
import { Sparkles, BrainCircuit } from 'lucide-react'

export function AIAssistant() {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleAnalyze = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/analyze-insights')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setInsight(data.text)
    } catch (error: any) {
      alert('自動分析に失敗しました。SettingsでGemini APIキーが設定されているか確認してください。')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/cron/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      alert(`${data.count}件の投稿をAIが完全自動で考え、予約しました！「カレンダー」をご確認ください。`)
    } catch (error: any) {
      alert('自動生成に失敗しました。SettingsでGemini APIキーが設定されているか確認してください。')
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
            {generating ? '全自動考案中...' : 'AIに完全お任せで作る (3日分)'}
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
    </div>
  )
}
