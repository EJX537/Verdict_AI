'use client'

import { useState, useRef, useEffect } from 'react'
import { line, curveCatmullRom } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { AGENTS, getScoreTint } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCurrent(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return current
}

const ZONE_COLORS: Record<VerdictData['zone'], string> = {
  Terminal: 'oklch(0.65 0.14 25)',
  Critical: 'oklch(0.72 0.14 30)',
  Guarded:  'oklch(0.78 0.12 55)',
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

// ─── Flowing Timeline ─────────────────────────────────────────────────────────

interface FlowingTimelineProps {
  verdict: VerdictData
  company: string
  onReset: () => void
  onCompare: (c: string) => void
}

function FlowingTimeline({ verdict, company, onReset, onCompare }: FlowingTimelineProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const wrapRef    = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(0)
  const [dims, setDims]       = useState({ w: 0, h: 0 })
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayed  = useCountUp(verdict.score)
  const tint       = getScoreTint(verdict.score)
  const events     = verdict.timeline
  const zone       = verdict.zone
  const zoneColor  = ZONE_COLORS[zone]

  // Stagger events in
  useEffect(() => {
    let i = 0
    const tick = () => {
      setVisible(v => v + 1)
      i++
      if (i < events.length) animRef.current = setTimeout(tick, 150)
    }
    animRef.current = setTimeout(tick, 300)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [events.length])

  // Measure
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setDims({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Node geometry ──────────────────────────────────────────────────────────
  // All 11 events must fit in the visible viewport height.
  // We space them equally across 92% of the container height.
  // The spine snakes left/right with a wide swing so cards
  // (placed in the concave belly of each arc) have generous room.

  const PAD_V    = 60   // px from top/bottom edge to first/last node
  const n        = events.length

  type NodePos = { x: number; y: number; side: 'left' | 'right' }
  const nodePositions: NodePos[] = []

  if (dims.w > 0 && dims.h > 0) {
    const yStep   = (dims.h - PAD_V * 2) / (n - 1)
    // Swing: how far off-center each node is.
    // Make it dynamic so it fills ~35% of each half.
    // Centre channel reserved: 80px each side (for dots + connector)
    const CENTRE_RESERVE = 80
    const swing = (dims.w / 2 - CENTRE_RESERVE) * 0.9

    events.forEach((_, i) => {
      const side: 'left' | 'right' = i % 2 === 0 ? 'right' : 'left'
      const x = dims.w / 2 + (side === 'right' ? swing : -swing)
      const y = PAD_V + i * yStep
      nodePositions.push({ x, y, side })
    })
  }

  const TOTAL_H = dims.h || 800

  // ── Draw canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodePositions.length === 0 || dims.w === 0) return
    const dpr = window.devicePixelRatio || 1

    canvas.width  = dims.w   * dpr
    canvas.height = TOTAL_H  * dpr
    canvas.style.width  = `${dims.w}px`
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
    ctx.setLineDash([2, 10])
    ctx.strokeStyle = 'oklch(0.20 0 0)'
    ctx.lineWidth = 1
    ctx.stroke(new Path2D(ghostD))
    ctx.restore()

    // Lit track up to visible
    if (visible > 1) {
      const litD = pathGen(pts.slice(0, Math.min(visible, pts.length))) ?? ''
      ctx.save()
      ctx.setLineDash([])
      ctx.strokeStyle = zoneColor
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
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
        ctx.save()
        for (const [r, a] of [[14, 0.07], [9, 0.18], [4.5, 1]] as [number, number][]) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
          ctx.fillStyle = `oklch(0.65 0.14 25 / ${a})`
          ctx.fill()
        }
        ctx.restore()
      } else if (ev.label === 'Now') {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 10, 0, Math.PI * 2)
        ctx.fillStyle = zoneColor + '22'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = zoneColor
        ctx.fill()
        ctx.restore()
      } else {
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fillStyle  = 'oklch(0.10 0 0)'
        ctx.strokeStyle = 'oklch(0.42 0 0)'
        ctx.lineWidth  = 1.5
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, visible, events, zoneColor, TOTAL_H])

  // ── Card geometry ──────────────────────────────────────────────────────────
  // Card sits in the concave pocket: opposite side from the dot.
  // Width = space from screen edge to centre channel (minus 16px gap)
  const CENTRE_RESERVE = 80
  const CARD_W = dims.w > 0 ? dims.w / 2 - CENTRE_RESERVE - 16 : 260

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Event cards — one per node, in the concave arc pocket */}
      {dims.w > 0 && nodePositions.map((node, i) => {
        const ev     = events[i]
        const isVis  = i < visible
        // dot is on `node.side`; card goes on the OPPOSITE side (inside the arc)
        const cardOnRight = node.side === 'left'  // dot left → arc opens right → card right
        const cardLeft = cardOnRight
          ? dims.w / 2 + CENTRE_RESERVE + 16
          : 16
        const cardH = 54 // approx, for centering
        return (
          <div
            key={ev.t}
            className="absolute pointer-events-none"
            style={{
              left:      cardLeft,
              top:       node.y - cardH / 2,
              width:     CARD_W,
              opacity:   isVis ? 1 : 0,
              transform: isVis ? 'none' : `translateX(${cardOnRight ? '-12px' : '12px'})`,
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}
          >
            <div className={`px-4 py-3 border ${
              ev.critical
                ? 'border-[oklch(0.65_0.14_25/0.4)] bg-[oklch(0.65_0.14_25/0.07)]'
                : ev.label === 'Now'
                ? 'border-border bg-[oklch(0.13_0_0)]'
                : 'border-[oklch(0.19_0_0)] bg-[oklch(0.11_0_0/0.9)]'
            }`}>
              <p className={`font-mono text-[11px] font-medium leading-snug ${
                ev.critical ? 'text-[oklch(0.75_0.14_25)]' : ev.label === 'Now' ? ZONE_TEXT[zone] : 'text-foreground'
              }`}>
                {ev.label}
              </p>
              <p className="font-mono text-[9px] text-muted-foreground tabular-nums mt-0.5">
                Month {ev.t}
              </p>
            </div>
            {/* Connector tick to dot */}
            <div
              className="absolute top-[18px] h-px bg-[oklch(0.24_0_0)]"
              style={cardOnRight
                ? { right: '100%', width: CENTRE_RESERVE }
                : { left:  '100%', width: CENTRE_RESERVE }
              }
            />
          </div>
        )
      })}

      {/* ── Score + Signals overlay — left half, centered vertically ──────── */}
      <ScoreOverlay
        verdict={verdict}
        displayed={displayed}
        tint={tint}
        zone={zone}
        zoneColor={zoneColor}
      />

      {/* ── Pattern Match + Actions overlay — right half ───────────────────── */}
      <PatternOverlay
        verdict={verdict}
        company={company}
        zone={zone}
        onReset={onReset}
        onCompare={onCompare}
      />
    </div>
  )
}

// ─── Score + Signals Overlay ─────────────────────────────────────────────────
// Fixed to the LEFT half, vertically centered — large and prominent

function ScoreOverlay({ verdict, displayed, tint, zone, zoneColor }: {
  verdict: VerdictData
  displayed: number
  tint: string
  zone: VerdictData['zone']
  zoneColor: string
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="absolute left-6 top-1/2 -translate-y-1/2 z-20 border border-border backdrop-blur-sm flex flex-col"
      style={{ backgroundColor: tint + 'f0', width: 'calc(50% - 140px)', maxWidth: 380, minWidth: 260 }}
    >
      {/* Big score */}
      <div className="px-7 pt-7 pb-5 border-b border-border flex items-end gap-4">
        <span className="font-sans text-[7rem] font-light text-white leading-none tabular-nums score-reveal">
          {displayed}
        </span>
        <div className="pb-2 flex flex-col gap-1.5">
          <p className="font-mono text-[8px] tracking-[0.3em] uppercase text-muted-foreground leading-none">Score</p>
          <p className={`font-mono text-sm tracking-[0.18em] uppercase font-medium leading-none ${ZONE_TEXT[zone]}`}>
            {zone}
          </p>
          <div
            className="mt-1 h-0.5 w-16 rounded-full"
            style={{ backgroundColor: zoneColor }}
          />
        </div>
      </div>

      {/* Signals toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="px-7 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-border text-left"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          Agent Signals
        </span>
        <span className="font-mono text-[9px] text-muted-foreground ml-4">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Agent signal list */}
      {expanded && (
        <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 360 }}>
          {verdict.agents.map(a => {
            const cfg = AGENTS.find(ag => ag.id === a.id)!
            return (
              <div key={a.id} className="px-7 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[8px] uppercase tracking-[0.2em] ${cfg.colorClass}`}>
                    {cfg.name}
                  </span>
                  <span className={`font-mono text-base font-medium ${cfg.colorClass}`}>
                    {a.score}<span className="text-[10px] opacity-60">/10</span>
                  </span>
                </div>
                <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">
                  {a.summary}
                </p>
                <p className="font-mono text-[8px] text-muted-foreground mt-2">
                  {a.sourceCount} sources
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Pattern Match + Actions Overlay ─────────────────────────────────────────
// Fixed to the RIGHT half, vertically centered — large and prominent

function PatternOverlay({ verdict, company, zone, onReset, onCompare }: {
  verdict: VerdictData
  company: string
  zone: VerdictData['zone']
  onReset: () => void
  onCompare: (c: string) => void
}) {
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [comparing, setComparing]     = useState(false)
  const [compareText, setCompareText] = useState('')
  const [shared, setShared]           = useState(false)

  const btnCls  = 'font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-4 py-2 hover:border-foreground/30 whitespace-nowrap'
  const inCls   = 'flex-1 bg-muted border border-border px-3 py-2 font-sans text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40'
  const subCls  = 'px-4 py-2 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest'

  const handleShare = () => {
    setShared(true)
    setTimeout(() => setShared(false), 2000)
    navigator.clipboard?.writeText(`${company} scored ${verdict.score}/100 — ${verdict.zone}. Investigated by The Verdict.`)
  }

  return (
    <div
      className="absolute right-6 top-1/2 -translate-y-1/2 z-20 border border-border backdrop-blur-sm bg-background/90 flex flex-col"
      style={{ width: 'calc(50% - 140px)', maxWidth: 380, minWidth: 260 }}
    >
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-border">
        <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground mb-3">
          Pattern Match
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.65_0.14_25)] mb-1.5">Closest Dead</p>
            <p className="font-sans text-xl font-semibold text-foreground leading-tight">{verdict.closestDead.name}</p>
            <p className="font-mono text-[8px] text-muted-foreground mt-1">{verdict.closestDead.match}% match</p>
          </div>
          <div>
            <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.82_0.09_150)] mb-1.5">Closest Living</p>
            <p className="font-sans text-xl font-semibold text-foreground leading-tight">{verdict.closestAlive.name}</p>
            <p className="font-mono text-[8px] text-muted-foreground mt-1">{verdict.closestAlive.match}% match</p>
          </div>
        </div>
      </div>

      {/* Cause / Survival */}
      <div className="px-7 py-4 border-b border-border">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Cause / Survival factor</p>
        <div className="grid grid-cols-2 gap-4">
          <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">{verdict.closestDead.cause}</p>
          <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">{verdict.closestAlive.what}</p>
        </div>
      </div>

      {/* Divergence */}
      <div className="px-7 py-4 border-b border-border">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Divergence</p>
        <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">{verdict.fork}</p>
      </div>

      {/* Counterfactual */}
      <div className="px-7 py-4 border-b border-border">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Counterfactual</p>
        <p className="font-sans text-[11px] text-foreground/80 leading-relaxed">{verdict.counterfactual}</p>
      </div>

      {/* Actions */}
      <div className="px-7 py-5">
        {challenging ? (
          <form onSubmit={e => { e.preventDefault(); setChallenging(false); setChallengeText('') }} className="flex gap-2">
            <input autoFocus value={challengeText} onChange={e => setChallengeText(e.target.value)} placeholder="What signal did we miss?" className={inCls} />
            <button type="submit" className={subCls}>Re-run</button>
          </form>
        ) : comparing ? (
          <form onSubmit={e => { e.preventDefault(); if (compareText.trim()) { onCompare(compareText.trim()); setComparing(false); setCompareText('') } }} className="flex gap-2">
            <input autoFocus value={compareText} onChange={e => setCompareText(e.target.value)} placeholder="Another company" className={inCls} />
            <button type="submit" className={subCls}>Compare</button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setChallenging(true)} className={btnCls}>Was I wrong?</button>
            <button onClick={() => setComparing(true)}   className={btnCls}>Compare</button>
            <button onClick={handleShare}                className={btnCls}>{shared ? 'Copied' : 'Share'}</button>
            <button onClick={onReset} className="font-mono text-[9px] text-background bg-foreground hover:bg-foreground/80 transition-colors uppercase tracking-widest px-4 py-2">
              New case
            </button>
          </div>
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
    <div className="min-h-screen h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0 bg-background relative z-30">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">Verdict</span>
          <span className="font-sans text-base font-semibold text-foreground">{company}</span>
        </div>
        <button
          onClick={onReset}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          New case
        </button>
      </div>

      {/* Timeline — fills remaining height, no scroll */}
      <div className="flex-1 relative overflow-hidden">
        <FlowingTimeline
          verdict={verdict}
          company={company}
          onReset={onReset}
          onCompare={onCompare}
        />
      </div>
    </div>
  )
}
