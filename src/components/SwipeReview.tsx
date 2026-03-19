'use client'

import { useState } from 'react'
import { Check, X, Sparkles, MoveRight } from 'lucide-react'

type PostPreview = { content: string }

export function SwipeReview({ 
  posts, 
  onFinish 
}: { 
  posts: PostPreview[], 
  onFinish: (approved: PostPreview[], rejected: PostPreview[]) => void 
}) {
  const [index, setIndex] = useState(0)
  const [approved, setApproved] = useState<PostPreview[]>([])
  const [rejected, setRejected] = useState<PostPreview[]>([])
  const [slideDir, setSlideDir] = useState<'' | 'left' | 'right'>('')

  const handleSwipe = (direction: 'left' | 'right') => {
    setSlideDir(direction)
    setTimeout(() => {
      if (direction === 'right') {
        setApproved([...approved, posts[index]])
      } else {
        setRejected([...rejected, posts[index]])
      }
      setSlideDir('')
      if (index === posts.length - 1) {
        onFinish([...approved, (direction === 'right' ? posts[index] : null)].filter(Boolean) as PostPreview[], 
                 [...rejected, (direction === 'left' ? posts[index] : null)].filter(Boolean) as PostPreview[])
      } else {
        setIndex(index + 1)
      }
    }, 300)
  }

  const currentPost = posts[index]

  if (!currentPost) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center text-white/80 space-y-2">
        <h2 className="text-xl font-medium tracking-widest uppercase flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-300" />
          AI POST REVIEW
        </h2>
        <p className="text-sm font-light">好みの投稿を右にスワイプ（採用）してください</p>
        <div className="flex gap-1 justify-center mt-4">
          {posts.map((_, i) => (
            <div key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i < index ? 'bg-primary-500' : i === index ? 'bg-white' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm aspect-[4/5] relative">
        <div 
          className={`absolute inset-0 bg-white rounded-3xl shadow-2xl p-8 flex flex-col justify-between border-4 border-transparent transition-all duration-300 ease-out transform ${
            slideDir === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' : 
            slideDir === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' : 'scale-100 opacity-100 rotate-0 translate-x-0 cursor-grab hover:scale-[1.02]'
          }`}
          style={{
             borderColor: slideDir === 'right' ? '#22c55e' : slideDir === 'left' ? '#ef4444' : 'transparent',
             boxShadow: slideDir === 'right' ? '0 0 40px rgba(34,197,94,0.4)' : slideDir === 'left' ? '0 0 40px rgba(239,68,68,0.4)' : '0 20px 50px -12px rgba(0,0,0,0.2)'
          }}
        >
          {/* Card Content */}
          <div className="overflow-y-auto hide-scrollbar flex-1 relative">
             {slideDir === 'right' && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]"><div className="border-4 border-green-500 text-green-500 font-bold text-4xl px-6 py-2 rounded-xl rotate-[-15deg] uppercase">LIKE!</div></div>}
             {slideDir === 'left' && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[2px]"><div className="border-4 border-red-500 text-red-500 font-bold text-4xl px-6 py-2 rounded-xl rotate-[15deg] uppercase">NOPE</div></div>}
             
             <div className="font-medium text-gray-800 whitespace-pre-wrap leading-relaxed">
               {currentPost.content}
             </div>
          </div>
          
          <div className="mt-8">
            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-full border border-gray-100 shadow-inner">
              <button 
                onClick={() => handleSwipe('left')}
                disabled={slideDir !== ''}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm hover:bg-red-50 hover:scale-110 active:scale-95 transition-all outline-none"
              >
                <X strokeWidth={3} className="w-6 h-6" />
              </button>
              <div className="text-xs text-gray-400 font-medium tracking-widest uppercase">
                <MoveRight className="w-4 h-4 text-gray-300 mx-auto" />
              </div>
              <button 
                onClick={() => handleSwipe('right')}
                disabled={slideDir !== ''}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-green-400 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-green-500/20 hover:scale-110 active:scale-95 transition-all outline-none"
              >
                <Check strokeWidth={3} className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
