import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { profileId, postCountPerDay, postIntervalType, postStartHour, postEndHour } = await req.json()
    if (!profileId) return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })

    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: {
        postCountPerDay: parseInt(postCountPerDay || '3', 10),
        postIntervalType: postIntervalType || 'uniform',
        postStartHour: parseInt(postStartHour ?? '9', 10),
        postEndHour: parseInt(postEndHour ?? '21', 10),
      }
    })

    const scheduledPosts = await prisma.post.findMany({
      where: { profileId, status: { in: ['scheduled', 'draft'] } },
      orderBy: { scheduledAt: 'asc' }
    })

    if (scheduledPosts.length === 0) {
      return NextResponse.json({ success: true, message: 'No scheduled posts to reschedule.' })
    }

    const countPerDay = profile.postCountPerDay || 3
    const intervalType = profile.postIntervalType || 'uniform'
    const startHour = profile.postStartHour ?? 9
    const endHour = (profile.postEndHour ?? 21) > startHour ? (profile.postEndHour ?? 21) : startHour + 12

    // 今日のJST時刻を取得し、投稿枠を計算する
    const nowUtc = new Date()
    const nowJstHour = (nowUtc.getUTCHours() + 9) % 24
    const nowJstMinute = nowUtc.getUTCMinutes()
    const nowJstDecimal = nowJstHour + nowJstMinute / 60

    // 今日使える投稿枠インデックスを計算（現在時刻より15分以上先のスロットのみ）
    const getTodaySlots = () => {
      const slots: number[] = [] // postIndexInDay values
      for (let p = 0; p < countPerDay; p++) {
        let slotHour: number
        if (intervalType === 'uniform') {
          const totalAvailableHours = endHour - startHour
          const hourOffset = countPerDay > 1
            ? startHour + (p * (totalAvailableHours / (countPerDay - 1)))
            : (startHour + endHour) / 2
          slotHour = hourOffset
        } else {
          // randomの場合は時間が固定されていないので今日は全スロット使わず翌日から
          return []
        }
        if (slotHour >= nowJstDecimal + 0.25) slots.push(p)
      }
      return slots
    }
    const todaySlots = getTodaySlots()

    // ベース日付：今日（UTC）
    const todayUtcBase = new Date(nowUtc)
    todayUtcBase.setUTCHours(0, 0, 0, 0)

    // 各投稿にスロットを割り当て
    // todaySlotsが使える分は今日に、残りは明日以降にDayIndexを進める
    const updates: { id: string, scheduledFor: Date }[] = []
    let todayUsed = 0
    let tomorrowPostIndex = 0 // 明日以降のpost index (0-based per day)

    for (let i = 0; i < scheduledPosts.length; i++) {
      const postData = scheduledPosts[i]
      let finalHour: number
      let finalMinute: number
      let scheduledFor: Date

      if (todayUsed < todaySlots.length) {
        // 今日のスロット
        const postIndexInDay = todaySlots[todayUsed]
        todayUsed++

        const totalAvailableHours = endHour - startHour
        const hourOffset = countPerDay > 1
          ? startHour + (postIndexInDay * (totalAvailableHours / (countPerDay - 1)))
          : (startHour + endHour) / 2
        finalHour = Math.floor(hourOffset)
        finalMinute = Math.floor((hourOffset % 1) * 60)

        scheduledFor = new Date(todayUtcBase)
        scheduledFor.setUTCHours(finalHour - 9, finalMinute, 0, 0)
      } else {
        // 明日以降
        const dayIndex = Math.floor(tomorrowPostIndex / countPerDay) + 1
        const postIndexInDay = tomorrowPostIndex % countPerDay
        tomorrowPostIndex++

        if (intervalType === 'uniform') {
          const totalAvailableHours = endHour - startHour
          const hourOffset = countPerDay > 1
            ? startHour + (postIndexInDay * (totalAvailableHours / (countPerDay - 1)))
            : (startHour + endHour) / 2
          finalHour = Math.floor(hourOffset)
          finalMinute = Math.floor((hourOffset % 1) * 60)
        } else {
          finalHour = startHour + Math.floor(Math.random() * (endHour - startHour))
          finalMinute = Math.floor(Math.random() * 60)
        }

        scheduledFor = new Date(todayUtcBase)
        scheduledFor.setDate(scheduledFor.getDate() + dayIndex)
        scheduledFor.setUTCHours(finalHour - 9, finalMinute, 0, 0)
      }

      updates.push({ id: postData.id, scheduledFor })
    }

    for (const { id, scheduledFor } of updates) {
      await prisma.post.update({
        where: { id },
        data: { scheduledAt: scheduledFor, status: 'scheduled' }
      })
    }

    return NextResponse.json({ success: true, rescheduledCount: scheduledPosts.length })
  } catch (err: any) {
    console.error('Reschedule error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
