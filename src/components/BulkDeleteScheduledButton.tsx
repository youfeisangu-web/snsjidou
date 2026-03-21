'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, AlertCircle } from 'lucide-react'

export function BulkDeleteScheduledButton({ count }: { count: number }) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  if (count === 0) return null

  async function handleDelete() {
    setLoading(true)
    setShowConfirm(false)
    try {
      await fetch('/api/posts/scheduled/bulk-delete', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[10px] text-red-600 font-medium">{count}件すべて削除しますか？</span>
        <button onClick={handleDelete} className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded ml-1 hover:bg-red-600 transition-colors">
          はい
        </button>
        <button onClick={() => setShowConfirm(false)} className="text-[10px] font-medium text-gray-500 hover:text-gray-700 px-2 py-0.5">
          キャンセル
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      disabled={loading}
      className="flex items-center gap-1.5 text-[11px] font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors bg-red-50/50 hover:bg-red-50 px-3 py-1.5 rounded-full border border-red-100/50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      {loading ? '削除中...' : '一括削除'}
    </button>
  )
}
