'use client'

import { useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Clock, AtSign, Rss } from 'lucide-react'

type Post = any

export function CalendarView({ posts }: { posts: Post[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const dateFormat = "d"
  const rows = []
  let days = []
  let day = startDate
  let formattedDate = ""

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat)
      const cloneDay = day
      
      const dayPosts = posts.filter(post => {
        const postDate = new Date(post.publishedAt || post.scheduledAt || Date.now())
        return isSameDay(postDate, cloneDay)
      })

      days.push(
        <div
          key={day.toString()}
          className={`min-h-[120px] p-2 border-r border-b border-gray-100 flex flex-col transition-colors ${
            !isSameMonth(day, monthStart)
              ? "bg-gray-50/50 text-gray-300"
              : isToday(day) ? "bg-primary-50/20 text-primary-600" : "bg-white text-gray-700 hover:bg-gray-50/50"
          }`}
        >
          <div className="flex justify-between items-center mb-2 px-1">
            <span className={`text-sm font-medium ${isToday(day) ? 'bg-primary-500 text-white w-7 h-7 flex items-center justify-center rounded-full' : ''}`}>
              {formattedDate}
            </span>
            {dayPosts.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{dayPosts.length}件</span>}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 hide-scrollbar">
            {dayPosts.slice(0, 3).map(post => (
              <div 
                key={post.id} 
                className={`text-[10px] p-1.5 rounded-md leading-tight truncate border flex flex-col gap-1 transition-all ${
                  post.status === 'scheduled' ? 'bg-indigo-50/80 border-indigo-100/50 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                <div className="flex items-center gap-1 opacity-70">
                  {post.status === 'scheduled' ? <Clock className="w-3 h-3 text-indigo-500" /> : null}
                  <AtSign className="w-3 h-3 text-black" />
                  <span className="font-medium ml-auto">
                    {format(new Date(post.scheduledAt || post.publishedAt), 'HH:mm')}
                  </span>
                </div>
                <div className="truncate font-medium">{post.content}</div>
              </div>
            ))}
            {dayPosts.length > 3 && (
              <div className="text-[10px] text-center text-gray-400 font-medium py-1">
                + {dayPosts.length - 3} 件
              </div>
            )}
          </div>
        </div>
      )
      day = addDays(day, 1)
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    )
    days = []
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 className="text-xl font-medium tracking-tight text-gray-900 flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-primary-500" />
          {format(currentMonth, 'yyyy年 MMMM', { locale: ja })}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
            今日
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div key={d} className={`py-3 text-center text-xs font-medium tracking-widest ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex flex-col">
        {rows}
      </div>
    </div>
  )
}

function CalendarIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}
