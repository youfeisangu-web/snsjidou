'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, CheckCircle } from 'lucide-react'

export function ImportFromThreadsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const router = useRouter()

  async function handleImport() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/posts/import-from-threads', { method: 'POST' })
      const data = await res.json()
      if (data.imported !== undefined) {
        setResult({ imported: data.imported, skipped: data.skipped })
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        <span className="text-[10px] text-green-700 font-medium">{result.imported}件インポート完了</span>
        <button onClick={() => setResult(null)} className="text-[10px] text-gray-400 hover:text-gray-600 ml-1">✕</button>
      </div>
    )
  }

  return (
    <button
      onClick={handleImport}
      disabled={loading}
      className="flex items-center gap-1.5 text-[11px] font-medium text-blue-500 hover:text-blue-700 disabled:opacity-50 transition-colors bg-blue-50/50 hover:bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100/50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {loading ? '読み込み中...' : 'すレッズから読み込む'}
    </button>
  )
}
