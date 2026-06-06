'use client'

import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  type ChartOptions,
  type ChartData,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useRef } from 'react'
import type { SignalPoint, EvidenceItem } from '@/lib/mock-data'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler)

const AGENT_COLORS: Record<string, string> = {
  archivist:      '#5b9cf6',
  money_tracker:  '#f5a623',
  people_watcher: '#e879a0',
  press_room:     '#4ade80',
}

const AGENT_NAMES: Record<string, string> = {
  archivist:      'Archivist',
  money_tracker:  'Money',
  people_watcher: 'People',
  press_room:     'Press',
}

const AGENT_IDS = Object.keys(AGENT_COLORS)

function formatDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
  })
}

interface SignalGraphProps {
  points: SignalPoint[]
  evidence: EvidenceItem[]
}

const INVESTIGATION_START = Date.now() - 24 * 60 * 60 * 1000

export function SignalGraph({ points, evidence }: SignalGraphProps) {
  const chartRef = useRef<ChartJS<'line'> | null>(null)

  const timestamps = points.map((p) => INVESTIGATION_START + p.t)

  // X labels — cap at 8 visible labels
  const MAX_LABELS = 8
  const LABEL_EVERY = Math.max(1, Math.floor(points.length / MAX_LABELS))
  const labels = points.map((_, i) =>
    i % LABEL_EVERY === 0 || i === points.length - 1
      ? formatDate(timestamps[i])
      : ''
  )

  const datasets = AGENT_IDS.map((id) => ({
    label: AGENT_NAMES[id],
    data: points.map((p) => (p as Record<string, number>)[id]),
    borderColor: AGENT_COLORS[id],
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 0,
    tension: 0,
  }))

  const data: ChartData<'line'> = { labels, datasets }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(255,255,255,0.08)', lineWidth: 1, drawTicks: false },
        border: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.55)',
          font: { family: 'var(--font-mono)', size: 9 },
          maxRotation: 0,
          padding: 6,
          autoSkip: false,
          callback: (_val, index) => labels[index] || null,
        },
      },
      y: {
        min: 0,
        max: 10,
        display: true,
        position: 'right',
        grid: { color: 'rgba(255,255,255,0.1)', lineWidth: 1, drawTicks: false },
        border: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.6)',
          font: { family: 'var(--font-mono)', size: 10 },
          stepSize: 1,
          padding: 12,
          callback: (value) => value.toString(),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  }

  // Always show the latest point in the bottom bar
  const latestPoint = points.length > 0 ? points[points.length - 1] : null
  const latestTs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null

  // Latest evidence per agent
  const latestNews: Record<string, EvidenceItem | null> = {}
  for (const id of AGENT_IDS) {
    const items = evidence
      .filter((e) => e.agent === id)
      .sort((a, b) => b.timestamp - a.timestamp)
    latestNews[id] = items[0] ?? null
  }

  return (
    <div className="flex flex-col h-full bg-card">

      {/* Top toolbar */}
      <div className="flex items-center gap-5 px-4 py-2 border-b border-foreground/10 flex-shrink-0 bg-foreground/[0.02]">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Signal</span>
        {AGENT_IDS.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <div className="w-4 h-px" style={{ backgroundColor: AGENT_COLORS[id] }} />
            <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: AGENT_COLORS[id] }}>
              {AGENT_NAMES[id]}
            </span>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="flex-1 relative min-h-0 m-3 mb-0 border border-foreground/5">
        {/* Zone bands */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 bg-[oklch(0.58_0.14_25)] opacity-[0.04]" style={{ height: '30%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.72_0.12_55)] opacity-[0.03]" style={{ bottom: '30%', height: '30%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.78_0.09_150)] opacity-[0.02]" style={{ bottom: '60%', height: '20%' }} />
          <div className="absolute left-0 right-0 bg-[oklch(0.82_0.06_200)] opacity-[0.02]" style={{ bottom: '80%', height: '20%' }} />
        </div>

        {points.length > 1 ? (
          <Line ref={chartRef} data={data} options={options} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              Awaiting signal data
            </span>
          </div>
        )}
      </div>

      {/* Bottom status bar — always shows latest values */}
      <div className="flex-shrink-0 border border-foreground/5 bg-foreground/[0.02] m-3 mt-2">
        {/* Date + scores row */}
        <div className="flex items-center gap-5 px-4 py-1.5 border-b border-foreground/5">
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-36 flex-shrink-0">
            {latestTs ? formatDate(latestTs) : '—'}
          </span>
          <div className="flex items-center gap-5">
            {AGENT_IDS.map((id) => {
              const val = latestPoint ? (latestPoint as Record<string, number>)[id] : null
              return (
                <div key={id} className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">{AGENT_NAMES[id]}</span>
                  <span
                    className="font-mono text-[11px] font-medium tabular-nums"
                    style={{ color: val !== null ? AGENT_COLORS[id] : 'rgba(255,255,255,0.2)' }}
                  >
                    {val !== null ? val.toFixed(1) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
            {points.length > 0 ? `${points.length} pts` : '—'}
          </span>
        </div>
        {/* Latest news per agent — fixed height to prevent layout shift */}
        <div className="grid grid-cols-4 divide-x divide-foreground/5 h-16 overflow-hidden">
          {AGENT_IDS.map((id) => {
            const item = latestNews[id]
            return (
              <div key={id} className="px-3 py-2 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-px flex-shrink-0" style={{ backgroundColor: AGENT_COLORS[id] }} />
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                    {AGENT_NAMES[id]}
                  </span>
                </div>
                <p className="font-sans text-[10px] text-foreground/90 truncate">
                  {item ? item.finding : <span className="text-muted-foreground">No signal yet</span>}
                </p>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
