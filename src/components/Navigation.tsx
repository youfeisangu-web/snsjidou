'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PenSquare, BarChart3, Settings, Calendar, Menu, X, ChevronDown, UserCircle2, Image as ImageIcon } from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/create', label: '新規投稿', icon: PenSquare },
  { href: '/calendar', label: 'カレンダー', icon: Calendar },
  { href: '/analytics', label: '分析', icon: BarChart3 },
  { href: '/assets', label: '画像倉庫', icon: ImageIcon },
  { href: '/settings', label: '設定', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [profiles, setProfiles] = useState<any[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [switcherOpen, setSwitcherOpen] = useState(false)

  useEffect(() => {
    fetch('/api/profiles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setProfiles(data)
          const match = document.cookie.match(/activeProfileId=([^;]+)/)
          if (match && match[1]) {
            setActiveProfileId(match[1])
          } else if (data.length > 0) {
            // Default to first profile silently
            setActiveProfileId(data[0].id)
            document.cookie = `activeProfileId=${data[0].id}; path=/; max-age=31536000`
          }
        }
      })
  }, [])

  const handleSwitchProfile = (id: string) => {
    document.cookie = `activeProfileId=${id}; path=/; max-age=31536000`
    setActiveProfileId(id)
    setSwitcherOpen(false)
    window.location.reload()
  }

  const activeProfile = profiles.find(p => p.id === activeProfileId)

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/90 backdrop-blur-md z-40 border-b border-primary-100 flex items-center justify-between px-6">
        <div className="font-semibold tracking-wide text-sm text-primary-900">
          MetaSocial
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 -mr-2 text-primary-900 focus:outline-none">
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-background pt-20 px-6">
          <div className="mb-8">
            <div className="text-xs uppercase text-gray-400 mb-2 tracking-widest">Active Account</div>
            <select 
              value={activeProfileId}
              onChange={(e) => handleSwitchProfile(e.target.value)}
              className="w-full bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-900 font-medium outline-none"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <nav className="flex flex-col gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-4 text-sm tracking-wide transition-colors duration-200 ${
                    isActive ? 'text-primary-600 font-medium' : 'text-gray-500 hover:text-primary-800'
                  }`}
                >
                  <Icon strokeWidth={isActive ? 2 : 1.5} className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col pt-12 px-8 border-r border-primary-100/40 shrink-0">
        <div className="mb-10 relative">
          {/* Account Switcher */}
          <button 
            onClick={() => setSwitcherOpen(!switcherOpen)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:border-primary-200 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-sm text-white">
                <UserCircle2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start truncate overflow-hidden">
                <span className="text-xs text-gray-400 tracking-wider font-medium uppercase font-sans">Account</span>
                <span className="text-sm font-semibold text-gray-800 truncate w-full pr-2">
                  {activeProfile ? activeProfile.name : 'アカウントを選択'}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${switcherOpen ? 'rotate-180' : ''}`} />
          </button>

          {switcherOpen && profiles.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSwitchProfile(p.id)}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-primary-50 transition-colors ${
                    activeProfileId === p.id ? 'text-primary-700 font-medium bg-primary-50/50' : 'text-gray-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${activeProfileId === p.id ? 'bg-primary-500' : 'bg-transparent'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              <div className="h-px bg-gray-100 my-2" />
              <Link href="/settings" onClick={() => setSwitcherOpen(false)} className="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-primary-600 flex items-center transition-colors">
                <Settings className="w-3 h-3 mr-2" />
                アカウントを管理
              </Link>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-6 flex-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 group transition-colors duration-300 ${
                  isActive ? 'text-primary-700' : 'text-gray-400 hover:text-primary-600'
                }`}
              >
                <div className={`transition-transform duration-300 group-hover:-translate-y-0.5 ${isActive ? 'translate-x-1' : ''}`}>
                  <Icon strokeWidth={isActive ? 1.75 : 1.5} className="w-5 h-5" />
                </div>
                <span className={`text-sm tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>
                  {item.label}
                </span>
                {isActive && (
                 <span className="ml-auto w-1 h-1 rounded-full bg-primary-500" />
                )}
              </Link>
            )
          })}
        </nav>
        
        <div className="pb-8 mt-auto px-2">
          <div className="font-semibold tracking-widest text-[#111] text-[10px] uppercase opacity-40 mb-1">
            MetaSocial
          </div>
          <div className="text-[10px] text-gray-400/70 tracking-widest uppercase">
            v2.0.0
          </div>
        </div>
      </aside>
    </>
  )
}
