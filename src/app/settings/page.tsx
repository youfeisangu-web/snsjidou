'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'

function SecretInput({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [globalData, setGlobalData] = useState({ geminiApiKey: '', imgbbApiKey: '' })
  const [globalStatus, setGlobalStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d) setGlobalData({ geminiApiKey: d.geminiApiKey || '', imgbbApiKey: d.imgbbApiKey || '' })
    })

    const match = document.cookie.match(/activeProfileId=([^;]+)/)
    const pid = match ? match[1] : null
    setActiveProfileId(pid)

    if (pid) {
      fetch(`/api/profiles/${pid}`).then(r => {
         if (r.ok) return r.json()
         throw new Error()
      }).then(data => {
         if (data) setProfile(data)
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
    } catch {
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
    } catch {
      setProfileStatus('error')
    }
  }

  const handleDeleteProfile = async () => {
    if (!profile) return
    if (!confirm('現在のアカウントを完全に削除してよろしいですか？（元には戻せません）\n削除後、再度ページを読み込んで別のアカウントを選択してください。')) return
    try {
      await fetch(`/api/profiles/${profile.id}`, { method: 'DELETE' })
      document.cookie = 'activeProfileId=; path=/; max-age=0'
      window.location.reload()
    } catch {
      alert("削除に失敗しました")
    }
  }

  const inputBase = "w-full bg-white border border-slate-300 outline-none focus:border-slate-500 py-2 px-3 text-sm rounded transition-colors"
  const globalInputBase = "w-full bg-transparent border-b border-gray-200 outline-none focus:border-primary-500 py-3 text-sm text-gray-800 transition-colors font-light"

  return (
    <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-24">
      <header className="border-b border-primary-50 pb-6">
        <h1 className="text-2xl font-light tracking-tight text-primary-950 mb-1">システム・プロファイル設定</h1>
        <p className="text-sm text-gray-500 font-normal">全体システム設定と、現在選択中のアカウントの設定を行います。</p>
      </header>

      {/* GLOBAL SETTINGS */}
      <form onSubmit={handleGlobalSubmit} className="space-y-8">
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400">全体設定 (AI & 画像サーバー)</h2>
            <button type="button" onClick={handleCreateProfile} className="text-primary-600 hover:underline text-xs font-medium flex items-center gap-1">
              <span className="text-base leading-none">+</span> 新規アカウントを追加
            </button>
          </div>
          <div className="grid gap-6 p-6 border border-gray-100/80 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm">
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">Gemini API Key</label>
              <SecretInput
                value={globalData.geminiApiKey}
                onChange={v => setGlobalData({ ...globalData, geminiApiKey: v })}
                placeholder="AI自動生成用のGemini APIキー"
                className={globalInputBase}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-widest text-primary-800/80 font-medium">ImgBB API Key</label>
              <SecretInput
                value={globalData.imgbbApiKey}
                onChange={v => setGlobalData({ ...globalData, imgbbApiKey: v })}
                placeholder="Meta公式API用の公開画像URL取得キー (api.imgbb.com)"
                className={globalInputBase}
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={globalStatus === 'saving'}
            className="px-6 py-3 bg-gray-900 text-white text-xs uppercase tracking-widest font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            {globalStatus === 'saving' ? '保存中...' : 'システム設定を保存'}
          </button>
          {globalStatus === 'saved' && <span className="text-sm font-light text-primary-600 animate-in fade-in">保存しました。</span>}
          {globalStatus === 'error' && <span className="text-sm font-light text-red-500 animate-in fade-in">エラーが発生しました。</span>}
        </div>
      </form>

      <div className="w-full h-px bg-gray-200/50" />

      {/* ACTIVE PROFILE */}
      <div className="space-y-6">
        <h2 className="text-xl font-light tracking-tight text-primary-950">現在のアカウントの設定</h2>

        {profile ? (
          <div className="border border-indigo-100 rounded-3xl overflow-hidden bg-white shadow-xl shadow-indigo-100/20">
            {/* Profile Header */}
            <div className="bg-indigo-50/50 p-4 sm:p-6 border-b border-indigo-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => updateProfileLocal('name', e.target.value)}
                  className="bg-transparent text-lg font-medium text-indigo-900 border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 outline-none w-full sm:w-auto sm:flex-1 sm:mr-4"
                  placeholder="アカウント名 (例: Billia広報担当)"
                />
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.isActive}
                      onChange={e => updateProfileLocal('isActive', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-sm text-indigo-600 font-medium whitespace-nowrap">自動運転 ON</span>
                  </label>
                  <button
                    onClick={handleDeleteProfile}
                    className="text-xs text-red-500 hover:text-red-700 font-medium underline whitespace-nowrap"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-8 space-y-8">
              {/* Threads 連携 */}
              <div className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Threads 連携情報</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 mb-1">User ID</label>
                    <input
                      type="text"
                      value={profile.threadsUserId || ''}
                      onChange={e => updateProfileLocal('threadsUserId', e.target.value)}
                      className={inputBase}
                      placeholder="例: 1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-slate-500 mb-1">Access Token</label>
                    <SecretInput
                      value={profile.threadsAccessToken || ''}
                      onChange={v => updateProfileLocal('threadsAccessToken', v)}
                      placeholder="Threads Access Token"
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>

              {/* RSS / HP */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">RSS / HP 連携情報</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">自動投稿 RSS URL</label>
                    <input
                      type="text" value={profile.rssUrl || ''} onChange={e => updateProfileLocal('rssUrl', e.target.value)}
                      className={inputBase}
                      placeholder="https://.../feed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">宣伝用 固定リンク</label>
                    <input
                      type="text" value={profile.hpUrl || ''} onChange={e => updateProfileLocal('hpUrl', e.target.value)}
                      className={inputBase}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 自動投稿設定 */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">自動投稿（スケジューリング）設定</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">1日の投稿数</label>
                    <input
                      type="number" min={1} max={20} value={profile.postCountPerDay || 3} onChange={e => updateProfileLocal('postCountPerDay', parseInt(e.target.value) || 3)}
                      className={inputBase}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">投稿間隔</label>
                    <select
                      value={profile.postIntervalType || 'uniform'} onChange={e => updateProfileLocal('postIntervalType', e.target.value)}
                      className={inputBase}
                    >
                      <option value="uniform">均一（等間隔）</option>
                      <option value="random">まちまち（ランダム）</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mt-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.autoCreateDeficientPosts ?? true}
                      onChange={e => updateProfileLocal('autoCreateDeficientPosts', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 mt-0.5 shrink-0"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-800 font-medium">在庫が足りない時、AIが自動生成して埋める</span>
                      <span className="text-xs text-gray-500 font-light leading-relaxed">スワイプで手動承認した予約在庫が「1日の投稿数」に満たない場合、勝手に追加生成して投稿枠を埋めます。</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.useImageWarehouse ?? false}
                      onChange={e => updateProfileLocal('useImageWarehouse', e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 mt-0.5 shrink-0"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-800 font-medium">「画像倉庫」の画像を勝手に・散らして使う</span>
                      <span className="text-xs text-gray-500 font-light leading-relaxed">溜めておいた画像からランダムで引き取って投稿に添付します（一度使った画像は当分使いません）。</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* AI プロンプト設定 */}
              <div className="space-y-6 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800">✨ AI 人格・プロンプト設定</h3>

                <div className="space-y-5">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileStatus === 'saving'}
                  className="px-6 py-3 bg-indigo-600 text-white text-xs font-semibold rounded-full hover:bg-indigo-700 transition shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {profileStatus === 'saving' ? '保存中...' : 'アカウント設定を保存'}
                </button>
                {profileStatus === 'saved' && <span className="text-sm font-medium text-indigo-600">保存しました！</span>}
                {profileStatus === 'error' && <span className="text-sm font-medium text-red-500">エラーが発生しました</span>}
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl px-6">
            左のメニューからアカウントを選択するか、全体設定横の「新規追加」を押してください。
          </div>
        )}
      </div>
    </div>
  )
}
