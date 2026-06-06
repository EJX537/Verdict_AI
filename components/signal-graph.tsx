'use client'

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
  archivist:      '#5b9cf6',
  money_tracker:  '#f5a623',
  people_watcher: '#e879a0',
  press_room:     '#4ade80',
}

const AGENT_NAMES = {
  archivist:      'Archivist',
  money_tracker:  'Money',
  people_watcher: 'People',
  press_room:     'Press',
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
    pointHoverRadius: 4,
    tension: 0, // jagged — straight line segments between points
  }))

  const data: ChartData<'line'> = { labels, datasets }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        display: false,
      },
      y: {
        min: 0,
        max: 10,
        display: true,
        position: 'left',
        grid: {
          color: 'rgba(255,255,255,0.05)',
          lineWidth: 1,
          drawTicks: false,
        },
        border: { display: false, dash: [2, 4] },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { family: 'var(--font-ibm-plex-mono)', size: 9 },
          maxTicksLimit: 6,
          padding: 8,
          stepSize: 2,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10,10,10,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: 'rgba(255,255,255,0.4)',
        bodyColor: 'rgba(255,255,255,0.85)',
        titleFont: { family: 'var(--font-ibm-plex-mono)', size: 9 },
        bodyFont: { family: 'var(--font-ibm-plex-mono)', size: 10 },
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`,
        },
      },
    },
  }

  return (
    <div className="flex flex-col h-full bg-background border-b border-border">

      {/* Top toolbar — trading terminal style */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50 flex-shrink-0">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Signal
        </span>
        {(Object.entries(AGENT_NAMES) as [keyof typeof AGENT_NAMES, string][]).map(([id, name]) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="w-5 h-px" style={{ backgroundColor: AGENT_COLORS[id] }} />
            <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: AGENT_COLORS[id] }}>
              {name}
            </span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {[
            { label: '0–3', color: 'oklch(0.58 0.14 25)' },
            { label: '3–6', color: 'oklch(0.72 0.12 55)' },
            { label: '6–8', color: 'oklch(0.78 0.09 150)' },
            { label: '8–10', color: 'oklch(0.82 0.06 200)' },
          ].map((z) => (
            <div key={z.label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: z.color, opacity: 0.5 }} />
              <span className="font-mono text-[9px] text-muted-foreground">{z.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart — fills remaining space */}
      <div className="flex-1 relative min-h-0 px-2 py-2">
        {/* Zone bands */}
        <div className="absolute inset-2 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 bg-[oklch(0.58_0.14_25)] opacity-[0.06]" style={{ height: '30%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.72_0.12_55)] opacity-[0.05]" style={{ bottom: '30%', height: '30%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.78_0.09_150)] opacity-[0.04]" style={{ bottom: '60%', height: '20%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.82_0.06_200)] opacity-[0.04]" style={{ bottom: '80%', height: '20%' }} />
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
