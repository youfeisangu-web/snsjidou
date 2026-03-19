'use client'

import { useState, useEffect } from 'react'
import { ImagePlus, X, AtSign, Send, Sparkles, UserCircle } from 'lucide-react'

export default function CreatePostPage() {
  const [content, setContent] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [platform, setPlatform] = useState<'threads'>('threads')
  const [scheduledAt, setScheduledAt] = useState('')
  const [status, setStatus] = useState<'idle' | 'publishing' | 'scheduled' | 'success' | 'error' | 'generating'>('idle')
  
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
      let base64Image = null;
      if (imageFile) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        base64Image = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
        });
      }

      const aiPrompt = content.trim() || (imageFile ? 'この画像の内容を理解して、それに関連する魅力的なSNS投稿を作成して。' : '今日の天気やトレンドに合った魅力的なSNS投稿を作成して。');

      const res = await fetch('/api/ai/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: aiPrompt, 
          profileId: selectedProfileId,
          image: base64Image
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setContent(data.text)
    } catch (error) {
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
    if (scheduledAt) formData.append('scheduledAt', new Date(scheduledAt).toISOString())

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) throw new Error('Failed to publish post')
      
      if (scheduledAt) {
        setStatus('scheduled')
      } else {
        setStatus('success')
      }
      setContent('')
      setScheduledAt('')
      removeImage()
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <div className="max-w-3xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">新規投稿</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">コンテンツを作成し、複数のネットワークへ同時に公開します。</p>
        </div>
      </header>

      <div className="grid gap-12">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1" />

            <button 
              onClick={handleGenerateAI}
              disabled={status === 'generating'}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium tracking-widest uppercase rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${status === 'generating' ? 'animate-pulse text-indigo-400' : ''}`} />
              {status === 'generating' ? 'AI生成中...' : 'AIで自動生成'}
            </button>
          </div>
          
          <div className="relative rounded-2xl border border-gray-100/80 bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-all overflow-hidden focus-within:border-primary-300 focus-within:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
            <textarea
              className="w-full min-h-[240px] p-8 bg-transparent outline-none resize-none text-gray-800 leading-relaxed font-light placeholder:text-gray-300"
              placeholder="いまなにしてる？..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            
            {imagePreview && (
              <div className="px-8 pb-4 relative">
                <div className="relative inline-block border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="h-48 w-auto object-cover" />
                  <button 
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur rounded-full text-gray-600 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 border-t border-gray-50">
              <div>
                <input 
                  type="file" 
                  id="image-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                />
                <label 
                  htmlFor="image-upload"
                  className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer hover:bg-white text-gray-500 hover:text-primary-700 transition-all text-xs tracking-wider font-medium"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span className="uppercase">画像追加</span>
                </label>
              </div>
              
              <div className="text-xs font-medium text-gray-400">
                {content.length} 文字
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">投稿先プラットフォーム</h2>
          <div className="flex flex-wrap gap-4">
            <PlatformSelector 
              active={platform === 'threads'}
              onClick={() => setPlatform('threads')}
              icon={<AtSign strokeWidth={1.5} className="w-5 h-5" />}
              label="Threads"
            />
          </div>
        </section>

        <div className="pt-8 border-t border-primary-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col space-y-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">予約投稿 (オプション)</h2>
            <input 
              type="datetime-local" 
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 font-light outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
            />
          </div>

          <div className="flex items-center gap-4 mt-6 md:mt-0">
            <button 
              onClick={handleSubmit}
              disabled={status === 'publishing' || (!content.trim() && !imageFile)}
              className="group flex items-center gap-3 px-10 py-4 bg-primary-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-primary-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-full shadow-lg shadow-primary-900/20"
            >
              <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              {status === 'publishing' ? '送信中...' : (scheduledAt ? '予約する' : '今すぐ投稿')}
            </button>
            {status === 'success' && <span className="text-sm font-light text-primary-600 animate-in fade-in">投稿が完了しました！</span>}
            {status === 'scheduled' && <span className="text-sm font-light text-primary-600 animate-in fade-in">投稿を予約しました！</span>}
            {status === 'error' && <span className="text-sm font-light text-red-500 animate-in fade-in">エラーが発生しました。</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlatformSelector({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300
        ${active 
          ? 'border-primary-500 bg-primary-50/30 text-primary-900 shadow-sm' 
          : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      <div className={active ? 'text-primary-600' : 'text-gray-400'}>{icon}</div>
      <span className={`text-sm tracking-wide ${active ? 'font-medium' : 'font-light'}`}>{label}</span>
    </button>
  )
}
