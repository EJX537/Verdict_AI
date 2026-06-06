'use client'

import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  type ChartOptions,
  type ChartData,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { SignalPoint } from '@/lib/mock-data'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

const AGENT_COLORS = {
  archivist: 'oklch(0.72 0.08 220)',
  money_tracker: 'oklch(0.74 0.12 55)',
  people_watcher: 'oklch(0.68 0.12 340)',
  press_room: 'oklch(0.72 0.1 160)',
}

const AGENT_NAMES = {
  archivist: 'Archivist',
  money_tracker: 'Money Tracker',
  people_watcher: 'People Watcher',
  press_room: 'Press Room',
}

interface SignalGraphProps {
  points: SignalPoint[]
}

export function SignalGraph({ points }: SignalGraphProps) {
  const labels = points.map((_, i) => i)

  const datasets = (Object.keys(AGENT_COLORS) as (keyof typeof AGENT_COLORS)[]).map((id) => ({
    label: AGENT_NAMES[id],
    data: points.map((p) => p[id]),
    borderColor: AGENT_COLORS[id],
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0.4,
  }))

  const data: ChartData<'line'> = { labels, datasets }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        min: 0,
        max: 10,
        display: true,
        grid: {
          color: 'oklch(0.22 0 0)',
          lineWidth: 1,
          drawTicks: false,
        },
        border: { display: false },
        ticks: {
          color: 'oklch(0.55 0 0)',
          font: { family: 'var(--font-ibm-plex-mono)', size: 9 },
          maxTicksLimit: 5,
          padding: 8,
          stepSize: 2,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'oklch(0.13 0 0)',
        borderColor: 'oklch(0.22 0 0)',
        borderWidth: 1,
        titleColor: 'oklch(0.52 0 0)',
        bodyColor: 'oklch(0.88 0 0)',
        titleFont: { family: 'var(--font-ibm-plex-mono)', size: 9 },
        bodyFont: { family: 'var(--font-ibm-plex-mono)', size: 10 },
        padding: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
        },
      },
    },
  }

  return (
    <div className="border-t border-border bg-background px-6 py-3">
      {/* Legend */}
      <div className="flex items-center gap-5 mb-3">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mr-2">
          Signal
        </span>
        {(Object.entries(AGENT_NAMES) as [keyof typeof AGENT_NAMES, string][]).map(([id, name]) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="w-3 h-px" style={{ backgroundColor: AGENT_COLORS[id] }} />
            <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              {name}
            </span>
          </div>
        ))}

        {/* Reference bands legend */}
        <div className="ml-auto flex items-center gap-4">
          {[
            { label: 'Danger', color: 'oklch(0.58 0.14 25)' },
            { label: 'Guarded', color: 'oklch(0.72 0.12 55)' },
            { label: 'Stable', color: 'oklch(0.78 0.09 150)' },
            { label: 'Thriving', color: 'oklch(0.82 0.06 200)' },
          ].map((z) => (
            <div key={z.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm opacity-50" style={{ backgroundColor: z.color }} />
              <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                {z.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="h-28 relative">
        {/* Reference bands */}
        <div className="absolute inset-0 flex flex-col pointer-events-none">
          {/* 0-30% = danger */}
          <div className="absolute bottom-0 left-0 right-8 opacity-[0.04] bg-[oklch(0.58_0.14_25)]" style={{ height: '30%' }} />
          {/* 30-60% = guarded */}
          <div className="absolute left-0 right-8 opacity-[0.04] bg-[oklch(0.72_0.12_55)]" style={{ bottom: '30%', height: '30%' }} />
          {/* 60-80% = stable */}
          <div className="absolute left-0 right-8 opacity-[0.04] bg-[oklch(0.78_0.09_150)]" style={{ bottom: '60%', height: '20%' }} />
          {/* 80-100% = thriving */}
          <div className="absolute left-0 right-8 opacity-[0.04] bg-[oklch(0.82_0.06_200)]" style={{ bottom: '80%', height: '20%' }} />
        </div>

        {points.length > 1 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Awaiting signal data
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
