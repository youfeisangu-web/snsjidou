'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    fbPageId: '',
    fbAccessToken: '',
    threadsUserId: '',
    threadsAccessToken: '',
    geminiApiKey: '',
    imgbbApiKey: '',
    rssUrl: '',
    hpUrl: '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setFormData({
            fbPageId: data.fbPageId || '',
            fbAccessToken: data.fbAccessToken || '',
            threadsUserId: data.threadsUserId || '',
            threadsAccessToken: data.threadsAccessToken || '',
            geminiApiKey: data.geminiApiKey || '',
            imgbbApiKey: data.imgbbApiKey || '',
            rssUrl: data.rssUrl || '',
            hpUrl: data.hpUrl || '',
          })
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="max-w-3xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">プラットフォーム設定</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">Metaアカウントを連携させて、投稿と分析機能を有効にします。</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-12">
        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">Facebookページ 連携</h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Page ID</label>
              <input 
                type="text"
                value={formData.fbPageId}
                onChange={e => setFormData({ ...formData, fbPageId: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="e.g. 101234567890"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Page Access Token</label>
              <input 
                type="password"
                value={formData.fbAccessToken}
                onChange={e => setFormData({ ...formData, fbAccessToken: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="Long-lived page access token"
              />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">Threads 連携</h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">User ID</label>
              <input 
                type="text"
                value={formData.threadsUserId}
                onChange={e => setFormData({ ...formData, threadsUserId: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="e.g. 123456789"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Access Token</label>
              <input 
                type="password"
                value={formData.threadsAccessToken}
                onChange={e => setFormData({ ...formData, threadsAccessToken: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="Threads API access token"
              />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">AI アシスタント設定 (Gemini)</h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Gemini API Key</label>
              <input 
                type="password"
                value={formData.geminiApiKey}
                onChange={e => setFormData({ ...formData, geminiApiKey: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="AI自動生成用のGemini APIキー"
              />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">画像アップロード設定 (ImgBB)</h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">ImgBB API Key</label>
              <input 
                type="password"
                value={formData.imgbbApiKey}
                onChange={e => setFormData({ ...formData, imgbbApiKey: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="Meta公式API用の公開画像URL取得キー (api.imgbb.com)"
              />
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">RSS ブログ自動連携 (Auto-Blogger)</h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">RSS Feed URL</label>
              <input 
                type="text"
                value={formData.rssUrl}
                onChange={e => setFormData({ ...formData, rssUrl: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="例: https://example.com/feed (更新情報をAIが自動で投稿します)"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">企業HP / 宣伝URL</label>
              <input 
                type="text"
                value={formData.hpUrl}
                onChange={e => setFormData({ ...formData, hpUrl: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="例: https://example.com/ (Threadsで投稿のコメント欄に自動で貼り付けられます)"
              />
            </div>
          </div>
        </section>

        <div className="pt-8 border-t border-primary-50 flex items-center gap-6">
          <button 
            type="submit" 
            disabled={status === 'saving'}
            className="px-8 py-3 bg-primary-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-primary-950 transition-colors disabled:opacity-50"
          >
            {status === 'saving' ? '保存中...' : '設定を保存'}
          </button>
          
          {status === 'saved' && <span className="text-sm font-light text-primary-600 animate-in fade-in">設定を保存しました。</span>}
          {status === 'error' && <span className="text-sm font-light text-red-500 animate-in fade-in">保存中にエラーが発生しました。</span>}
        </div>
      </form>
    </div>
  )
}
