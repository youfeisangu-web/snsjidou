'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function BulkDeleteScheduledButton({ count }: { count: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (count === 0) return null

  async function handleDelete() {
    if (!confirm(`予約中の投稿を${count}件すべて削除しますか？`)) return
    setLoading(true)
    try {
      await fetch('/api/posts/scheduled/bulk-delete', { method: 'DELETE' })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
      {loading ? '削除中...' : '一括削除'}
    </button>
  )
}
