'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PenSquare, BarChart3, Settings, Calendar, Rss, Menu, X } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/create', label: '新規投稿', icon: PenSquare },
  { href: '/calendar', label: 'カレンダー', icon: Calendar },
  { href: '/analytics', label: '分析', icon: BarChart3 },
  { href: '/settings', label: '設定', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // A very clean, minimal design approach to the sidebar
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
      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col pt-16 px-10 border-r border-primary-100/40 shrink-0">
        <div className="mb-14">
          <div className="font-semibold tracking-widest text-xs uppercase text-primary-800/80 mb-1">
            MetaSocial
          </div>
          <div className="text-[10px] text-gray-400 tracking-wider">Commander HQ</div>
        </div>

        <nav className="flex flex-col gap-8 flex-1">
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
                  <Icon strokeWidth={isActive ? 1.75 : 1.5} className="w-[18px] h-[18px]" />
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
        
        <div className="pb-10 mt-auto">
          <div className="text-[10px] text-gray-400/70 tracking-widest uppercase">
            v1.0.0
          </div>
        </div>
      </aside>
    </>
  )
}
