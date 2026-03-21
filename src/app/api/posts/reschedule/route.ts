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

    let scheduleDate = new Date()
    scheduleDate.setDate(scheduleDate.getDate() + 1)
    scheduleDate.setHours(9, 0, 0, 0)
    
    const countPerDay = profile.postCountPerDay || 3
    const intervalType = profile.postIntervalType || 'uniform'
    const startHour = profile.postStartHour ?? 9
    const endHour = (profile.postEndHour ?? 21) > startHour ? (profile.postEndHour ?? 21) : startHour + 12

    for (let i = 0; i < scheduledPosts.length; i++) {
        const postData = scheduledPosts[i]
        const dayIndex = Math.floor(i / countPerDay)
        const postIndexInDay = i % countPerDay

        const scheduledFor = new Date(scheduleDate)
        scheduledFor.setDate(scheduledFor.getDate() + dayIndex)

        let finalHour = Math.floor((startHour + endHour) / 2);
        let finalMinute = 0;

        if (intervalType === 'uniform') {
          const totalAvailableHours = endHour - startHour
          let hourOffset = startHour
          if (countPerDay > 1) {
              hourOffset = startHour + (postIndexInDay * (totalAvailableHours / (countPerDay - 1)))
          } else {
              hourOffset = (startHour + endHour) / 2
          }
          finalHour = Math.floor(hourOffset);
          finalMinute = Math.floor((hourOffset % 1) * 60);
        } else {
          finalHour = startHour + Math.floor(Math.random() * (endHour - startHour))
          finalMinute = Math.floor(Math.random() * 60)
        }
        
        // JST to UTC conversion
        scheduledFor.setUTCHours(finalHour - 9, finalMinute, 0, 0)

        await prisma.post.update({
          where: { id: postData.id },
          data: { scheduledAt: scheduledFor, status: 'scheduled' }
        })
    }

    return NextResponse.json({ success: true, rescheduledCount: scheduledPosts.length })
  } catch (err: any) {
    console.error('Reschedule error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
