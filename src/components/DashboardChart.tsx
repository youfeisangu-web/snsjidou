'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
)

interface InsightData {
  recordedAt: string
  followersCount: number
  totalEngagement: number
}

export function DashboardChart({ 
  fbData = [], 
  thData = [] 
}: { 
  fbData: InsightData[], 
  thData: InsightData[] 
}) {

  const hasData = thData.length > 0
  const labels = hasData
    ? thData.map(d => new Date(d.recordedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }))
    : Array.from({ length: 7 }).map((_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
      })

  const data = {
    labels,
    datasets: [
      {
        label: 'フォロワー数',
        data: hasData ? thData.map(d => d.followersCount) : [],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        tension: 0.4,
        borderWidth: 2,
        pointRadius: hasData ? 3 : 0,
        pointHitRadius: 20,
        fill: true,
      }
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#fff',
        titleColor: '#1c1c1c',
        bodyColor: '#666',
        borderColor: '#e5ebe1',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#a3a3a3', font: { family: 'Inter', size: 10 } }
      },
      y: {
        border: { display: false },
        grid: { color: '#f5f5f5' },
        ticks: { color: '#a3a3a3', font: { family: 'Inter', size: 10 }, padding: 10 }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }

  return (
    <div className="w-full h-[320px] bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.01)] transition-colors hover:border-primary-100">
      <Line options={options} data={data} />
    </div>
  )
}
