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

  const [templates, setTemplates] = useState<any[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', examplePost: '', memo: '' })
  const [isAddingTemplate, setIsAddingTemplate] = useState(false)
  const [templateSaving, setTemplateSaving] = useState(false)

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
      fetch(`/api/templates?profileId=${pid}`).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setTemplates(data)
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
    if (!confirm('新しいアカウントを追加しますか？（作成後、画面上部のアカウントボタンから切り替えてください）')) return
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

  const handleAddTemplate = async () => {
    if (!profile || !newTemplate.name || !newTemplate.examplePost) return
    setTemplateSaving(true)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id, ...newTemplate })
      })
      const t = await res.json()
      setTemplates(prev => [...prev, t])
      setNewTemplate({ name: '', examplePost: '', memo: '' })
      setIsAddingTemplate(false)
    } catch { alert('保存に失敗しました') }
    finally { setTemplateSaving(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    await fetch(`/api/templates/${id}`, { method: 'DELETE' })
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const handleToggleTemplate = async (id: string, isActive: boolean) => {
    await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive })
    })
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, isActive: !isActive } : t))
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
                  <div>
                    <label className="block text-[10px] uppercase text-gray-500 mb-1">文章の長さ</label>
                    <select
                      value={profile.postLength || 'normal'} onChange={e => updateProfileLocal('postLength', e.target.value)}
                      className={inputBase}
                    >
                      <option value="normal">普通</option>
                      <option value="short">短い（短文）</option>
                      <option value="long">長い（長文・スレッド形式）</option>
                      <option value="random">おまかせ（ランダム）</option>
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
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[10px] font-semibold tracking-widest text-indigo-500 uppercase">🤖 スワイプで学習した『好み』 (自動更新)</label>
                          <button
                            type="button"
                            onClick={() => updateProfileLocal('aiPreferenceRules', '')}
                            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                          >
                            直ちにリセット
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                          {profile.aiPreferenceRules || '(まだスワイプによる好みが学習されていません)'}
                        </p>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[10px] font-semibold tracking-widest text-pink-500 uppercase">📈 バズ要因・成功法則 (自動更新)</label>
                          <button
                            type="button"
                            onClick={() => updateProfileLocal('successFactors', '')}
                            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                          >
                            直ちにリセット
                          </button>
                        </div>
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

              {/* 投稿テンプレート管理 */}
              <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">📋 投稿パターン（型）管理</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">バズった投稿の例文を登録すると、AI生成時にその型を循環して使います。</p>
                  </div>
                  <button
                    onClick={() => setIsAddingTemplate(v => !v)}
                    className="px-4 py-2 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition"
                  >
                    {isAddingTemplate ? 'キャンセル' : '＋ 追加'}
                  </button>
                </div>

                {isAddingTemplate && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">型の名前 <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={newTemplate.name}
                        onChange={e => setNewTemplate(v => ({ ...v, name: e.target.value }))}
                        placeholder="例：衝撃の事実スレッド型、ハウツー連投型"
                        className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 py-2.5 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">参考例文（バズった投稿をそのままコピペ） <span className="text-red-400">*</span></label>
                      <textarea
                        value={newTemplate.examplePost}
                        onChange={e => setNewTemplate(v => ({ ...v, examplePost: e.target.value }))}
                        placeholder="スレッド形式の場合は「|||THREAD|||」で区切って貼ってください。"
                        className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 py-2.5 px-3 text-sm font-light min-h-[160px] leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">メモ（なぜ良いか、使いどころ等）</label>
                      <input
                        type="text"
                        value={newTemplate.memo}
                        onChange={e => setNewTemplate(v => ({ ...v, memo: e.target.value }))}
                        placeholder="例：フック→理由→3つのTips→CTAの型。朝に相性が良い。"
                        className="w-full bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-400 py-2.5 px-3 text-sm"
                      />
                    </div>
                    <button
                      onClick={handleAddTemplate}
                      disabled={templateSaving || !newTemplate.name || !newTemplate.examplePost}
                      className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-full hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {templateSaving ? '保存中...' : 'テンプレートを追加'}
                    </button>
                  </div>
                )}

                {templates.length > 0 ? (
                  <div className="space-y-3">
                    {templates.map((t, i) => (
                      <div key={t.id} className={`border rounded-2xl p-4 transition-all ${t.isActive ? 'bg-white border-indigo-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">#{i + 1}</span>
                            <span className="text-sm font-semibold text-gray-800 truncate">{t.name}</span>
                            {t.usageCount > 0 && <span className="text-[10px] text-gray-400 shrink-0">{t.usageCount}回使用</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleTemplate(t.id, t.isActive)}
                              className={`text-[10px] px-3 py-1 rounded-full font-medium transition ${t.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                              {t.isActive ? '有効' : '無効'}
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(t.id)}
                              className="text-[10px] px-3 py-1 rounded-full font-medium bg-red-50 text-red-400 hover:bg-red-100 transition"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        {t.memo && <p className="text-[11px] text-indigo-500 mb-2">💡 {t.memo}</p>}
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 whitespace-pre-wrap">{t.examplePost}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-2xl">
                    まだテンプレートがありません。「＋ 追加」からバズった投稿の型を登録してください。
                  </p>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl px-6">
            画面上部のアカウントボタンで切り替えるか、上の「新規アカウントを追加」を押してください。
          </div>
        )}
      </div>
    </div>
  )
}
