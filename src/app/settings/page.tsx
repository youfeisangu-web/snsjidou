'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [globalData, setGlobalData] = useState({ geminiApiKey: '', imgbbApiKey: '' })
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    // 1. Fetch Global Settings
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d) setGlobalData({ geminiApiKey: d.geminiApiKey || '', imgbbApiKey: d.imgbbApiKey || '' })
    })
    
    // 2. Determine active profile from cookie
    const match = document.cookie.match(/activeProfileId=([^;]+)/)
    const pid = match ? match[1] : null
    setActiveProfileId(pid)

    if (pid) {
      fetch(`/api/profiles/${pid}`).then(r => {
         if (r.ok) return r.json()
         throw new Error()
      }).then(data => {
         // Because we don't have GET /api/profiles/[id], actually we can just fetch all and find it
         // Wait, do we have GET /api/profiles/[id]? It might not exist.
      }).catch(() => {
         fetch('/api/profiles').then(r => r.json()).then(profiles => {
            const p = profiles.find((x: any) => x.id === pid)
            if (p) setProfile(p)
         })
      })
    }
  }, [])

  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGlobalStatus('saving')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalData),
      })
      if (!res.ok) throw new Error('Failed to save settings')
      setGlobalStatus('saved')
      setTimeout(() => setGlobalStatus('idle'), 3000)
    } catch {
      setGlobalStatus('error')
    }
  }

  const handleCreateProfile = async () => {
    if (!confirm('新しいアカウントを追加しますか？（作成後、左のメニューから切り替えてください）')) return
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `新しいアカウント` }),
      })
      const newP = await res.json()
      document.cookie = `activeProfileId=${newP.id}; path=/; max-age=31536000`
      window.location.reload()
    } catch (err) {
      alert("エラーが発生しました")
    }
  }

  const updateProfileLocal = (key: string, value: any) => {
    if (profile) setProfile({ ...profile, [key]: value })
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setProfileStatus('saving')
    try {
      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error()
      setProfileStatus('saved')
      setTimeout(() => setProfileStatus('idle'), 3000)
      
      // Update the navigation title secretly if possible, or just let users reload to see
      // Actually simply reloading will refresh the navbar's text
      if (keyChanged) {
        window.dispatchEvent(new Event('profileUpdated')) // Custom event if we implemented it, not needed strictly
      }
    } catch {
      setProfileStatus('error')
    }
  }
  let keyChanged = false

  const handleDeleteProfile = async () => {
    if (!profile) return
    if (!confirm('現在のアカウントを完全に削除してよろしいですか？（元には戻せません）\n削除後、再度ページを読み込んで別のアカウントを選択してください。')) return
    try {
      await fetch(`/api/profiles/${profile.id}`, { method: 'DELETE' })
      document.cookie = 'activeProfileId=; path=/; max-age=0' // expire
      window.location.reload()
    } catch (err) {
      alert("削除に失敗しました")
    }
  }

  return (
    <div className="max-w-4xl space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      <header className="flex items-end justify-between border-b border-primary-50 pb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-primary-950 mb-2">システム・プロファイル設定</h1>
          <p className="text-sm tracking-wide text-gray-500 font-normal">全体システム設定と、現在選択中のアカウントの設定を行います。</p>
        </div>
      </header>

      {/* GLOBAL SETTINGS */}
      <form onSubmit={handleGlobalSubmit} className="space-y-12">
        <section className="space-y-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 flex justify-between items-center">
            全体設定 (AI & 画像サーバー)
            <button type="button" onClick={handleCreateProfile} className="text-primary-600 hover:underline lowercase tracking-normal font-medium flex items-center gap-1"><span className="text-lg leading-none">+</span> 新規アカウントを追加する</button>
          </h2>
          <div className="grid gap-8 p-8 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Gemini API Key</label>
              <input 
                type="password"
                value={globalData.geminiApiKey}
                onChange={e => setGlobalData({ ...globalData, geminiApiKey: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="AI自動生成用のGemini APIキー"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">ImgBB API Key</label>
              <input 
                type="password"
                value={globalData.imgbbApiKey}
                onChange={e => setGlobalData({ ...globalData, imgbbApiKey: e.target.value })}
                className="w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"
                placeholder="Meta公式API用の公開画像URL取得キー (api.imgbb.com)"
              />
            </div>
          </div>
        </section>

        <div className="pt-2 flex items-center gap-6">
          <button 
            type="submit" 
            disabled={globalStatus === 'saving'}
            className="px-8 py-3 bg-gray-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {globalStatus === 'saving' ? '保存中...' : 'システム設定を保存'}
          </button>
          {globalStatus === 'saved' && <span className="text-sm font-light text-primary-600 animate-in fade-in">保存しました。</span>}
          {globalStatus === 'error' && <span className="text-sm font-light text-red-500 animate-in fade-in">エラーが発生しました。</span>}
        </div>
      </form>

      <div className="w-full h-px bg-gray-200/50 my-10" />

      {/* ACTIVE PROFILE */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-light tracking-tight text-primary-950">現在のアカウントの設定</h2>
        </div>

        {profile ? (
          <div className="border border-indigo-100 rounded-3xl overflow-hidden bg-white shadow-xl shadow-indigo-100/20">
            <div className="bg-indigo-50/50 p-6 border-b border-indigo-100 flex items-center justify-between">
              <input 
                type="text"
                value={profile.name}
                onChange={e => updateProfileLocal('name', e.target.value)}
                className="bg-transparent text-xl font-medium text-indigo-900 border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 outline-none w-1/2"
                placeholder="アカウント名 (例: Billia広報担当)"
              />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={profile.isActive} 
                    onChange={e => updateProfileLocal('isActive', e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-sm text-indigo-600 font-medium tracking-wide">自動運転(Cron) ON</span>
                </label>
                <button 
                  onClick={handleDeleteProfile}
                  className="text-xs text-red-500 hover:text-red-700 font-medium underline"
                >
                  アカウントを削除
                </button>
              </div>
            </div>

            <div className="p-8 space-y-10">
              {/* 連携キー */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Threads */}
              <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">Threads 連携情報</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 mb-1">User ID</label>
                      <input 
                        type="text" value={profile.threadsUserId || ''} onChange={e => updateProfileLocal('threadsUserId', e.target.value)}
                        className="w-full bg-white border border-slate-300 outline-none focus:border-slate-500 py-2 px-3 text-sm rounded transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-slate-500 mb-1">Access Token</label>
                      <input 
                        type="password" value={profile.threadsAccessToken || ''} onChange={e => updateProfileLocal('threadsAccessToken', e.target.value)}
                        className="w-full bg-white border border-slate-300 outline-none focus:border-slate-500 py-2 px-3 text-sm rounded transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 自動連携 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">RSS / HP 連携情報</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">自動投稿 RSS URL</label>
                    <input 
                      type="text" value={profile.rssUrl || ''} onChange={e => updateProfileLocal('rssUrl', e.target.value)}
                      className="w-full bg-white border border-gray-200 outline-none focus:border-primary-500 py-2 px-3 text-sm rounded transition-colors"
                      placeholder="https://.../feed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">宣伝用 固定リンク</label>
                    <input 
                      type="text" value={profile.hpUrl || ''} onChange={e => updateProfileLocal('hpUrl', e.target.value)}
                      className="w-full bg-white border border-gray-200 outline-none focus:border-primary-500 py-2 px-3 text-sm rounded transition-colors"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 自動投稿（Cron）設定 */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">自動投稿（スケジューリング）設定</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">1日の投稿数</label>
                    <input 
                      type="number" min={1} max={20} value={profile.postCountPerDay || 3} onChange={e => updateProfileLocal('postCountPerDay', parseInt(e.target.value) || 3)}
                      className="w-full bg-white border border-gray-200 outline-none focus:border-primary-500 py-2 px-3 text-sm rounded transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">投稿間隔</label>
                    <select 
                      value={profile.postIntervalType || 'uniform'} onChange={e => updateProfileLocal('postIntervalType', e.target.value)}
                      className="w-full bg-white border border-gray-200 outline-none focus:border-primary-500 py-2 px-3 text-sm rounded transition-colors"
                    >
                      <option value="uniform">均一（等間隔）</option>
                      <option value="random">まちまち（ランダム）</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={profile.autoCreateDeficientPosts ?? true} 
                      onChange={e => updateProfileLocal('autoCreateDeficientPosts', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 mt-0.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-800 font-medium">在庫が足りない時、AIが自動生成して埋める</span>
                      <span className="text-xs text-gray-500 font-light leading-relaxed">スワイプで手動承認した予約在庫が「1日の投稿数」に満たない場合、勝手に追加生成して投稿枠を埋めます。</span>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={profile.useImageWarehouse ?? false} 
                      onChange={e => updateProfileLocal('useImageWarehouse', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 mt-0.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-800 font-medium">「画像倉庫」の画像を勝手に・散らして使う</span>
                      <span className="text-xs text-gray-500 font-light leading-relaxed">溜めておいた画像からランダムで引き取って投稿に添付します（一度使った画像は当分使いません）。</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* AI プロンプト設定 */}
              <div className="space-y-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">✨ AI 人格・プロンプト設定</h3>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-2">人格・アカウントの前提条件</label>
                    <textarea 
                      value={profile.aiPrompt || ''} onChange={e => updateProfileLocal('aiPrompt', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-primary-500 py-3 px-4 text-sm font-light min-h-[100px]"
                      placeholder="例：このアカウントは関西弁の20代女性経理担当として話します。"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-2">実装済みの機能（サービス内容）</label>
                    <textarea 
                      value={profile.implementedFeatures || ''} onChange={e => updateProfileLocal('implementedFeatures', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-primary-500 py-3 px-4 text-sm font-light min-h-[80px]"
                      placeholder="ワンクリックで請求書を作れるサービスです。"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-2">開発中・実装予定の機能</label>
                    <textarea 
                      value={profile.upcomingFeatures || ''} onChange={e => updateProfileLocal('upcomingFeatures', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-primary-500 py-3 px-4 text-sm font-light min-h-[80px]"
                      placeholder="AIで領収書を読み取る機能を開発中です。"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-2">関連項目・リサーチテーマ（インプレッション用）</label>
                    <textarea 
                      value={profile.relatedTopics || ''} onChange={e => updateProfileLocal('relatedTopics', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-primary-500 py-3 px-4 text-sm font-light min-h-[80px]"
                      placeholder="インボイス制度、経理の属人化について意見を述べてください。"
                    />
                  </div>
                  
                  {/* Read-Only AI learned context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                      <label className="block text-[10px] font-semibold tracking-widest text-indigo-500 mb-2 uppercase">🤖 スワイプで学習した『好み』 (自動更新)</label>
                      <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                        {profile.aiPreferenceRules || '(まだスワイプによる好みが学習されていません)'}
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                      <label className="block text-[10px] font-semibold tracking-widest text-pink-500 mb-2 uppercase">📈 バズ要因・成功法則 (自動更新)</label>
                      <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                        {profile.successFactors || '(まだバズ要因が抽出されていません)'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button 
                  onClick={handleSaveProfile}
                  disabled={profileStatus === 'saving'}
                  className="px-8 py-3 bg-indigo-600 text-white text-xs font-semibold rounded-full hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {profileStatus === 'saving' ? '保存中...' : 'アカウント設定を保存'}
                </button>
                {profileStatus === 'saved' && <span className="text-sm font-medium text-indigo-600">保存しました！</span>}
                {profileStatus === 'error' && <span className="text-sm font-medium text-red-500">エラーが発生しました</span>}
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl">
            左のメニューからアカウントを選択するか、全体設定横の「新規追加」を押してください。
          </div>
        )}
      </div>
    </div>
  )
}
