'use client'

import { useState, useEffect } from 'react'
import { ImagePlus, X, AtSign, Send, Sparkles, Clock, Zap } from 'lucide-react'

export default function CreatePostPage() {
  const [content, setContent] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [platform] = useState<'threads'>('threads')
  const [scheduledAt, setScheduledAt] = useState('')
  const [postMode, setPostMode] = useState<'now' | 'schedule'>('now')
  const [status, setStatus] = useState<'idle' | 'publishing' | 'success' | 'error' | 'generating'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProfiles(data)
          const match = document.cookie.match(/activeProfileId=([^;]+)/)
          if (match && match[1]) {
            setSelectedProfileId(match[1])
          } else if (data.length > 0) {
            setSelectedProfileId(data[0].id)
          }
        }
      })
  }, [])

  const handleGenerateAI = async () => {
    setStatus('generating')
    try {
      let base64Image = null
      if (imageFile) {
        const reader = new FileReader()
        reader.readAsDataURL(imageFile)
        base64Image = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string)
        })
      }
      const aiPrompt = content.trim() || (imageFile ? 'この画像の内容を理解して、それに関連する魅力的なSNS投稿を作成して。' : '今日のトレンドに合った魅力的なSNS投稿を作成して。')
      const res = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, profileId: selectedProfileId, image: base64Image })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(data.text)
    } catch {
      alert('AI生成に失敗しました。SettingsでGemini APIキーが設定されているか確認してください。')
    } finally {
      setStatus('idle')
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile) return
    setStatus('publishing')

    const formData = new FormData()
    formData.append('content', content)
    formData.append('platform', platform)
    if (selectedProfileId) formData.append('profileId', selectedProfileId)
    if (imageFile) formData.append('image', imageFile)
    if (postMode === 'schedule' && scheduledAt) {
      formData.append('scheduledAt', new Date(scheduledAt).toISOString())
    }

    try {
      const res = await fetch('/api/posts', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '投稿に失敗しました')
      setStatus('success')
      setContent('')
      setScheduledAt('')
      removeImage()
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e: any) {
      setErrorMessage(e.message || '投稿に失敗しました')
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setErrorMessage('') }, 5000)
    }
  }

  const canSubmit = (content.trim() || imageFile) && status !== 'publishing'
  const submitLabel = status === 'publishing'
    ? '送信中...'
    : postMode === 'now'
    ? '今すぐ投稿'
    : '予約する'

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-3xl font-light tracking-tight text-primary-950">新規投稿</h1>
        <button
          onClick={handleGenerateAI}
          disabled={status === 'generating'}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium tracking-wide rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${status === 'generating' ? 'animate-pulse' : ''}`} />
          {status === 'generating' ? 'AI生成中...' : 'AIで生成'}
        </button>
      </div>

      {/* Profile selector */}
      {profiles.length > 1 && (
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">アカウント</label>
          <select
            value={selectedProfileId}
            onChange={e => setSelectedProfileId(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary-400"
          >
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Textarea */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden focus-within:border-primary-300 focus-within:shadow-md transition-all">
        <textarea
          className="w-full min-h-[180px] md:min-h-[240px] p-4 md:p-6 bg-transparent outline-none resize-none text-base text-gray-800 leading-relaxed placeholder:text-gray-300"
          placeholder="いまなにしてる？..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {imagePreview && (
          <div className="px-4 pb-3 relative">
            <div className="relative inline-block rounded-xl overflow-hidden border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Preview" className="h-36 w-auto object-cover" />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full text-gray-600 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-50">
          <div>
            <input type="file" id="image-upload" accept="image/*" className="hidden" onChange={handleImageChange} />
            <label
              htmlFor="image-upload"
              className="flex items-center gap-2 px-3 py-2 rounded-full cursor-pointer hover:bg-white text-gray-500 hover:text-primary-700 transition-all text-xs font-medium"
            >
              <ImagePlus className="w-4 h-4" />
              <span>画像</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-300 tabular-nums">{content.length}</span>
            <div className="flex items-center gap-1 text-gray-400">
              <AtSign className="w-3.5 h-3.5" />
              <span className="text-xs">Threads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Post mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
        <button
          onClick={() => setPostMode('now')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            postMode === 'now'
              ? 'bg-primary-900 text-white'
              : 'text-gray-500 hover:text-primary-700 hover:bg-gray-50'
          }`}
        >
          <Zap className="w-4 h-4" />
          今すぐ投稿
        </button>
        <button
          onClick={() => setPostMode('schedule')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            postMode === 'schedule'
              ? 'bg-primary-900 text-white'
              : 'text-gray-500 hover:text-primary-700 hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          予約投稿
        </button>
      </div>

      {/* Schedule date picker */}
      {postMode === 'schedule' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="text-xs text-gray-400 uppercase tracking-widest mb-2 block">投稿日時</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-gray-700 outline-none focus:border-primary-400 bg-white"
          />
          <p className="text-xs text-gray-400 mt-2">
            ※ 設定した時刻の次の毎時0分に投稿されます（最大1時間のズレあり）
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || (postMode === 'schedule' && !scheduledAt)}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary-900 text-white text-sm font-medium hover:bg-primary-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl shadow-lg shadow-primary-900/20"
        >
          <Send className="w-4 h-4" />
          {submitLabel}
        </button>

        {status === 'success' && (
          <p className="text-center text-sm text-primary-600 animate-in fade-in">
            {postMode === 'now' ? '投稿が完了しました！' : '予約しました！'}
          </p>
        )}
        {status === 'error' && (
          <p className="text-center text-sm text-red-500 animate-in fade-in">
            {errorMessage || 'エラーが発生しました。'}
          </p>
        )}
      </div>
    </div>
  )
}
