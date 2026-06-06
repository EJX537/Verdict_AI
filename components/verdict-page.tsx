'use client'

import { useState, useRef, useEffect } from 'react'
import { line, curveCatmullRom } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { AGENTS, getScoreTint } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return current
}

const ZONE_COLORS: Record<VerdictData['zone'], string> = {
  Terminal: 'oklch(0.65 0.14 25)',
  Critical: 'oklch(0.72 0.14 30)',
  Guarded: 'oklch(0.78 0.12 55)',
  Stable:   'oklch(0.82 0.09 150)',
  Thriving: 'oklch(0.86 0.06 200)',
}

const ZONE_TEXT: Record<VerdictData['zone'], string> = {
  Terminal: 'text-[oklch(0.65_0.14_25)]',
  Critical: 'text-[oklch(0.72_0.14_30)]',
  Guarded:  'text-[oklch(0.78_0.12_55)]',
  Stable:   'text-[oklch(0.82_0.09_150)]',
  Thriving: 'text-[oklch(0.86_0.06_200)]',
}

const DANGER = 'oklch(0.65 0.14 25)'

// ─── Main Timeline Canvas ─────────────────────────────────────────────────────

interface NodePos {
  x: number
  y: number
  side: 'left' | 'right' // which side the dot sits — card goes on the SAME side inside the arc
}

interface FlowingTimelineProps {
  events: VerdictData['timeline']
  zone: VerdictData['zone']
  company: string
  verdict: VerdictData
  onReset: () => void
  onCompare: (c: string) => void
}

function FlowingTimeline({ events, zone, company, verdict, onReset, onCompare }: FlowingTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(0)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [showSignals, setShowSignals] = useState(false)
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayed = useCountUp(verdict.score)
  const tint = getScoreTint(verdict.score)

  // Stagger events in
  useEffect(() => {
    let i = 0
    const tick = () => {
      setVisible(v => v + 1)
      i++
      if (i < events.length) animRef.current = setTimeout(tick, 180)
    }
    animRef.current = setTimeout(tick, 400)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [events.length])

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute node positions — wide swing so cards fit inside the arc belly
  const ROW_H = 140
  const TOTAL_H = Math.max(dims.h, events.length * ROW_H + 120)
  const PAD_TOP = 100
  const PAD_BOT = 100

  const nodePositions: NodePos[] = []

  if (dims.w > 0) {
    const cx = dims.w / 2
    // swing: how far left/right of center the dot is placed
    // Large enough that the card (placed inside the arc) has room
    const swing = Math.min(dims.w * 0.38, 340)

    const yScale = scaleLinear()
      .domain([0, events.length - 1])
      .range([PAD_TOP, TOTAL_H - PAD_BOT])

    events.forEach((_, i) => {
      // Alternate: even = right side, odd = left side
      // The arc CURVES toward the opposite side, so the concave pocket
      // opens on the opposite side — we place the card there
      const side: 'left' | 'right' = i % 2 === 0 ? 'right' : 'left'
      const xOffset = side === 'right' ? swing : -swing
      nodePositions.push({ x: cx + xOffset, y: yScale(i), side })
    })
  }

  // Draw D3 canvas path
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodePositions.length === 0 || dims.w === 0) return
    const dpr = window.devicePixelRatio || 1

    canvas.width = dims.w * dpr
    canvas.height = TOTAL_H * dpr
    canvas.style.width = `${dims.w}px`
    canvas.style.height = `${TOTAL_H}px`

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, dims.w, TOTAL_H)

    const pts = nodePositions.map(n => ({ x: n.x, y: n.y }))
    const pathGen = line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(curveCatmullRom.alpha(0.5))

    // Ghost track
    const ghostD = pathGen(pts) ?? ''
    ctx.save()
    ctx.setLineDash([2, 8])
    ctx.strokeStyle = 'oklch(0.22 0 0)'
    ctx.lineWidth = 1
    ctx.stroke(new Path2D(ghostD))
    ctx.restore()

    // Lit track up to visible
    if (visible > 1) {
      const litD = pathGen(pts.slice(0, Math.min(visible, pts.length))) ?? ''
      ctx.save()
      ctx.setLineDash([])
      ctx.strokeStyle = ZONE_COLORS[zone]
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.65
      ctx.stroke(new Path2D(litD))
      ctx.restore()
    }

    // Dots
    nodePositions.forEach((node, i) => {
      const isVis = i < visible
      const ev = events[i]

      if (!isVis) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'oklch(0.18 0 0)'
        ctx.fill()
        ctx.restore()
        return
      }

      if (ev.critical) {
        // Outer glow
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2)
        ctx.fillStyle = 'oklch(0.65 0.14 25 / 0.1)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 7, 0, Math.PI * 2)
        ctx.fillStyle = 'oklch(0.65 0.14 25 / 0.25)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = DANGER
        ctx.fill()
        ctx.restore()
      } else if (ev.label === 'Now') {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 9, 0, Math.PI * 2)
        ctx.fillStyle = ZONE_COLORS[zone] + '22'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = ZONE_COLORS[zone]
        ctx.fill()
        ctx.restore()
      } else {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3.5, 0, Math.PI * 2)
        ctx.fillStyle = 'oklch(0.1 0 0)'
        ctx.strokeStyle = 'oklch(0.48 0 0)'
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, visible, events, zone, TOTAL_H])

  // Card width — fits inside the arc belly (half the swing minus padding)
  const CARD_W = dims.w > 0 ? Math.min(260, dims.w * 0.30) : 220

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-y-auto overflow-x-hidden">

      {/* Canvas — full scrollable height */}
      <div style={{ height: TOTAL_H, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: TOTAL_H }}
        />

        {/* Event cards — placed inside the arc concave pocket */}
        {dims.w > 0 && nodePositions.map((node, i) => {
          const ev = events[i]
          const isVis = i < visible
          const isLeft = node.side === 'left'
          // Card sits on the concave (inner) side: opposite to where the dot is
          // node.side = 'right' means dot is right, arc opens to the left → card on left
          // node.side = 'left' means dot is left, arc opens to the right → card on right
          const cardOnLeft = node.side === 'right'
          const cx = dims.w / 2
          const cardLeft = cardOnLeft
            ? cx - CARD_W - 16
            : cx + 16

          return (
            <div
              key={ev.t}
              className="absolute pointer-events-none"
              style={{
                left: cardLeft,
                top: node.y - 20,
                width: CARD_W,
                opacity: isVis ? 1 : 0,
                transform: isVis ? 'none' : `translateX(${cardOnLeft ? '10px' : '-10px'})`,
                transition: 'opacity 0.3s ease, transform 0.3s ease',
              }}
            >
              <div
                className={`px-3 py-2.5 border ${
                  ev.critical
                    ? 'border-[oklch(0.65_0.14_25/0.45)] bg-[oklch(0.65_0.14_25/0.07)]'
                    : ev.label === 'Now'
                    ? 'border-[var(--zone-color)] bg-[oklch(0.14_0_0)]'
                    : 'border-[oklch(0.22_0_0)] bg-[oklch(0.11_0_0/0.85)]'
                }`}
                style={{ '--zone-color': ZONE_COLORS[zone] + '55' } as React.CSSProperties}
              >
                <p className={`font-mono text-[11px] font-medium leading-snug ${
                  ev.critical
                    ? 'text-[oklch(0.75_0.14_25)]'
                    : ev.label === 'Now'
                    ? ZONE_TEXT[zone]
                    : 'text-foreground'
                }`}>
                  {ev.label}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground mt-0.5 tabular-nums">
                  Month {ev.t}
                </p>
              </div>
              {/* Connector line from card to dot */}
              <div
                className="absolute top-[18px] h-px bg-[oklch(0.28_0_0)]"
                style={{
                  width: Math.abs(node.x - (cardOnLeft ? cardLeft + CARD_W : cardLeft)) - 4,
                  left: cardOnLeft ? CARD_W : 0,
                }}
              />
            </div>
          )
        })}
      </div>

      {/* ── Score HUD — top-left overlay ─────────────────────────────────── */}
      <div
        className="fixed top-16 left-6 z-20 border border-border backdrop-blur-sm"
        style={{ backgroundColor: tint + 'e0' }}
      >
        {/* Score block */}
        <div className="px-5 py-4 border-b border-border flex items-end gap-3">
          <span className="font-sans text-[4.5rem] font-light text-white leading-none tabular-nums">
            {displayed}
          </span>
          <div className="pb-1">
            <p className="font-mono text-[8px] tracking-[0.3em] uppercase text-muted-foreground leading-none mb-1">Score</p>
            <p className={`font-mono text-xs tracking-[0.22em] uppercase leading-none ${ZONE_TEXT[zone]}`}>
              {zone}
            </p>
          </div>
        </div>

        {/* Toggle signals */}
        <button
          onClick={() => setShowSignals(s => !s)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors border-b border-border"
        >
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Agent Signals
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            {showSignals ? '▲' : '▼'}
          </span>
        </button>

        {showSignals && (
          <div className="divide-y divide-border">
            {verdict.agents.map(a => {
              const cfg = AGENTS.find(ag => ag.id === a.id)!
              return (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-[8px] uppercase tracking-widest ${cfg.colorClass}`}>
                      {cfg.name}
                    </span>
                    <span className={`font-mono text-xs font-medium ${cfg.colorClass}`}>
                      {a.score}/10
                    </span>
                  </div>
                  <p className="font-sans text-[10px] text-foreground/80 leading-relaxed">
                    {a.summary}
                  </p>
                  <p className="font-mono text-[8px] text-muted-foreground mt-1">
                    {a.sourceCount} sources
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Pattern Match + Counterfactual overlay — bottom-right ─────────── */}
      <PatternOverlay verdict={verdict} company={company} onReset={onReset} onCompare={onCompare} />
    </div>
  )
}

// ─── Pattern + Counterfactual + Actions overlay ───────────────────────────────

function PatternOverlay({ verdict, company, onReset, onCompare }: {
  verdict: VerdictData; company: string
  onReset: () => void; onCompare: (c: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareText, setCompareText] = useState('')
  const [shared, setShared] = useState(false)

  const btnCls = 'font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-3 py-1.5 hover:border-foreground/30 whitespace-nowrap'
  const inputCls = 'flex-1 bg-muted border border-border px-2 py-1.5 font-sans text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40'
  const submitCls = 'px-3 py-1.5 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest'

  const handleShare = () => {
    setShared(true)
    setTimeout(() => setShared(false), 2000)
    navigator.clipboard?.writeText(`${company} scored ${verdict.score}/100 — ${verdict.zone}. Investigated by The Verdict.`)
  }

  return (
    <div className="fixed bottom-6 right-6 z-20 w-72 border border-border backdrop-blur-sm bg-background/90">
      {/* Header toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border hover:bg-white/5 transition-colors"
      >
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          Pattern Match
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">{expanded ? '▼' : '▲'}</span>
      </button>

      {/* Always-visible dead/alive comparison */}
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div className="p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.65_0.14_25)] mb-1">Closest Dead</p>
          <p className="font-sans text-sm font-medium text-foreground">{verdict.closestDead.name}</p>
          <p className="font-mono text-[8px] text-muted-foreground mt-0.5">{verdict.closestDead.match}% match</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.82_0.09_150)] mb-1">Closest Living</p>
          <p className="font-sans text-sm font-medium text-foreground">{verdict.closestAlive.name}</p>
          <p className="font-mono text-[8px] text-muted-foreground mt-0.5">{verdict.closestAlive.match}% match</p>
        </div>
      </div>

      {/* Expandable: cause, fork, counterfactual */}
      {expanded && (
        <div className="border-b border-border divide-y divide-border">
          <div className="p-4">
            <p className="font-mono text-[8px] uppercase tracking-wide text-muted-foreground mb-2">Cause / Survival</p>
            <div className="grid grid-cols-2 gap-2">
              <p className="font-sans text-[10px] text-foreground/80 leading-relaxed">
                {verdict.closestDead.cause}
              </p>
              <p className="font-sans text-[10px] text-foreground/80 leading-relaxed">
                {verdict.closestAlive.what}
              </p>
            </div>
          </div>
          <div className="p-4">
            <p className="font-mono text-[8px] uppercase tracking-wide text-muted-foreground mb-2">Divergence</p>
            <p className="font-sans text-[10px] text-foreground/80 leading-relaxed">{verdict.fork}</p>
          </div>
          <div className="p-4">
            <p className="font-mono text-[8px] uppercase tracking-wide text-muted-foreground mb-2">Counterfactual</p>
            <p className="font-sans text-[10px] text-foreground/80 leading-relaxed">{verdict.counterfactual}</p>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="p-3 flex flex-wrap gap-1.5 items-center">
        {challenging ? (
          <form onSubmit={e => { e.preventDefault(); setChallenging(false); setChallengeText('') }} className="flex gap-1 w-full">
            <input autoFocus value={challengeText} onChange={e => setChallengeText(e.target.value)} placeholder="What signal did we miss?" className={inputCls} />
            <button type="submit" className={submitCls}>Re-run</button>
          </form>
        ) : comparing ? (
          <form onSubmit={e => { e.preventDefault(); if (compareText.trim()) { onCompare(compareText.trim()); setComparing(false); setCompareText('') } }} className="flex gap-1 w-full">
            <input autoFocus value={compareText} onChange={e => setCompareText(e.target.value)} placeholder="Another company" className={inputCls} />
            <button type="submit" className={submitCls}>Compare</button>
          </form>
        ) : (
          <>
            <button onClick={() => setChallenging(true)} className={btnCls}>Was I wrong?</button>
            <button onClick={() => setComparing(true)} className={btnCls}>Compare</button>
            <button onClick={handleShare} className={btnCls}>{shared ? 'Copied' : 'Share'}</button>
            <button onClick={onReset} className="font-mono text-[9px] text-background bg-foreground hover:bg-foreground/80 transition-colors uppercase tracking-widest px-3 py-1.5 whitespace-nowrap">
              New case
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Verdict Page ─────────────────────────────────────────────────────────────

interface VerdictPageProps {
  company: string
  verdict: VerdictData
  onReset: () => void
  onCompare: (company: string) => void
}

export function VerdictPage({ company, verdict, onReset, onCompare }: VerdictPageProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 z-30 bg-background relative">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Verdict
          </span>
          <span className="font-sans text-base font-semibold text-foreground">{company}</span>
        </div>
        <button
          onClick={onReset}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          New case
        </button>
      </div>

      {/* Full-screen timeline — no sidebars */}
      <div className="flex-1 relative overflow-hidden">
        <FlowingTimeline
          events={verdict.timeline}
          zone={verdict.zone}
          company={company}
          verdict={verdict}
          onReset={onReset}
          onCompare={onCompare}
        />
      </div>
    </div>
  )
}
