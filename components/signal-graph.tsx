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
import { useRef, useState, useCallback, useEffect } from 'react'
import type { SignalPoint } from '@/lib/mock-data'

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

// Format a timestamp (ms) as "Jan 06 14:32"
function formatDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

interface SignalGraphProps {
  points: SignalPoint[]
}

// Investigation "starts" at a fixed offset from now so dates look real
const INVESTIGATION_START = Date.now() - 24 * 60 * 60 * 1000 // 24h ago

export function SignalGraph({ points }: SignalGraphProps) {
  const chartRef = useRef<ChartJS<'line'> | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [lockedIndex, setLockedIndex] = useState<number | null>(null)
  const isLocked = lockedIndex !== null

  // The index we're actually displaying — locked takes priority over hover, else latest
  const activeIndex = lockedIndex ?? hoverIndex ?? (points.length > 0 ? points.length - 1 : null)

  // Build timestamps from t (ms elapsed) + investigation start
  const timestamps = points.map((p) => INVESTIGATION_START + p.t)

  // X labels — show every 5th point to get a dense but readable axis
  const LABEL_EVERY = Math.max(1, Math.floor(points.length / 20))
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
        grid: { color: 'rgba(255,255,255,0.05)', lineWidth: 1, drawTicks: false },
        border: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
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
        grid: { color: 'rgba(255,255,255,0.08)', lineWidth: 1, drawTicks: false },
        border: { display: false },
        ticks: {
          color: 'rgba(255,255,255,0.35)',
          font: { family: 'var(--font-mono)', size: 10 },
          stepSize: 1,
          padding: 12,
          callback: (value) => value.toString(),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }, // disabled — we drive the bottom bar ourselves
    },
  }

  // --- Custom hover tracking via canvas mousemove ---
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) return
    const chart = chartRef.current
    if (!chart || points.length === 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const xScale = chart.scales.x
    if (!xScale) return
    const idx = Math.round(xScale.getValueForPixel(x) ?? 0)
    setHoverIndex(Math.max(0, Math.min(idx, points.length - 1)))
  }, [isLocked, points.length])

  const handleMouseLeave = useCallback(() => {
    if (!isLocked) setHoverIndex(null)
  }, [isLocked])

  const handleClick = useCallback(() => {
    if (isLocked) {
      // Unlock — snap back to latest
      setLockedIndex(null)
      setHoverIndex(null)
    } else {
      // Lock at current hover position
      setLockedIndex(hoverIndex)
    }
  }, [isLocked, hoverIndex])

  // Draw a crosshair line on the canvas at the active index
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || activeIndex === null) return
    chart.update('none')
  }, [activeIndex])

  // Active point values for the bottom bar
  const activePoint = activeIndex !== null ? points[activeIndex] : null
  const activeTs = activeIndex !== null ? timestamps[activeIndex] : null

  return (
    <div className="flex flex-col h-full bg-black">

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
        {isLocked && (
          <span className="ml-auto font-mono text-[10px] tracking-widest uppercase text-muted-foreground animate-pulse">
            Locked — click to release
          </span>
        )}
      </div>

      {/* Chart area */}
      <div
        className="flex-1 relative min-h-0 m-3 mb-0 border border-foreground/5 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
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

      {/* Bottom status bar — shows values at hover/locked/latest index */}
      <div className="flex items-center gap-6 px-4 py-2 border-t border-foreground/10 flex-shrink-0 bg-foreground/[0.02] m-3 mt-0 border border-foreground/5">
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-36 flex-shrink-0">
          {activeTs ? formatDate(activeTs) : '—'}
        </span>
        <div className="flex items-center gap-5">
          {AGENT_IDS.map((id) => {
            const val = activePoint ? (activePoint as Record<string, number>)[id] : null
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
          {activeIndex !== null ? `${activeIndex + 1} / ${points.length}` : '—'}
        </span>
      </div>

    </div>
  )
}
