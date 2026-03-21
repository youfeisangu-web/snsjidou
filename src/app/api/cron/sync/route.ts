import { NextResponse } from 'next/server'

// 毎日自動的にインサイト同期を実行するcronハンドラ
export async function GET() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/sync`, {
      method: 'POST',
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Auto sync cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
