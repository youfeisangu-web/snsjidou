'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      router.refresh()
    } catch (error) {
      console.error(error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <button 
      onClick={handleSync}
      disabled={isSyncing}
      className="flex items-center gap-2 text-xs tracking-widest font-medium uppercase text-primary-600 hover:text-primary-800 transition-colors border-b border-transparent hover:border-primary-600 pb-1 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      {isSyncing ? '同期中...' : '手動同期 (Manual Sync)'}
    </button>
  )
}
