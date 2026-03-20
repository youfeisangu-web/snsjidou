import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'メタソーシャルコマンダー - Threads自動化ツール',
  description: 'Manage Threads posts with analytics.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${inter.variable} antialiased font-sans`}>
      <body className="bg-background text-foreground min-h-screen flex flex-col md:flex-row font-sans selection:bg-primary-200">
        <Navigation />
        <main className="flex-1 flex flex-col pt-14 md:pt-0">
          <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:px-12 md:py-16 md:pb-16">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
