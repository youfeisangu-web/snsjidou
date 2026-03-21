'use client'

import { useState, useEffect } from 'react'
import { UploadCloud, Image as ImageIcon, Trash2, CheckCircle2, Loader2 } from 'lucide-react'

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dialog, setDialog] = useState<{type: 'confirm'|'alert', message: string, onConfirm?: () => void} | null>(null)
  
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  const fetchAssets = () => {
    setLoading(true)
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAssets(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const match = document.cookie.match(/activeProfileId=([^;]+)/)
          if (match && match[1]) {
            setSelectedProfileId(match[1])
          } else if (data.length > 0) {
            setSelectedProfileId(data[0].id)
          }
        }
        fetchAssets()
      })
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    
    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)
    if (selectedProfileId) formData.append('profileId', selectedProfileId)

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('Upload failed')
      fetchAssets()
    } catch (error) {
      setDialog({ type: 'alert', message: 'アップロードに失敗しました' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    setDialog({
      type: 'confirm',
      message: 'この画像を倉庫から削除してよろしいですか？',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Delete failed')
          setAssets(prev => prev.filter(a => a.id !== id))
        } catch {
          setDialog({ type: 'alert', message: '削除に失敗しました' })
        }
      }
    })
  }

  return (
    <div className="max-w-5xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">画像倉庫 (Asset Warehouse)</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">AIが自由に使用できる画像ストックを管理します。</p>
        </div>
        <div>
          <label className={`cursor-pointer flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20 text-xs font-medium tracking-widest uppercase ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>{uploading ? 'アップロード中...' : '画像をストックする'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </header>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          <span className="text-sm">読み込み中...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-32 rounded-3xl border border-dashed border-gray-200 bg-gray-50/50">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">画像がありません</h3>
          <p className="text-xs text-gray-400">右上のボタンから、AIに使わせたい画像をストックしてください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all">
              <div className="aspect-square bg-gray-50 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt="Stock" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleDelete(asset.id)}
                    className="p-2 bg-white/20 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 bg-white">
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">使用回数: <strong className="text-gray-700">{asset.usedCount}回</strong></span>
                  {asset.lastUsedAt && <span title={`最終使用: ${new Date(asset.lastUsedAt).toLocaleDateString()}`}><CheckCircle2 className="w-3 h-3 text-green-500" /></span>}
                </div>
              </div>
            </div>
          ))}
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
  )
}
