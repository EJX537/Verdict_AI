'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { line, curveCatmullRom } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { AGENTS, getScoreTint } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
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
  Stable: 'oklch(0.82 0.09 150)',
  Thriving: 'oklch(0.86 0.06 200)',
}

const ZONE_TEXT: Record<VerdictData['zone'], string> = {
  Terminal: 'text-[oklch(0.65_0.14_25)]',
  Critical: 'text-[oklch(0.72_0.14_30)]',
  Guarded: 'text-[oklch(0.78_0.12_55)]',
  Stable: 'text-[oklch(0.82_0.09_150)]',
  Thriving: 'text-[oklch(0.86_0.06_200)]',
}

const DANGER = 'oklch(0.65 0.14 25)'

// ─── Flowing Timeline (D3 + Canvas) ──────────────────────────────────────────

interface FlowingTimelineProps {
  events: VerdictData['timeline']
  zone: VerdictData['zone']
  score: number
}

function FlowingTimeline({ events, zone, score }: FlowingTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(0) // how many events are revealed
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stagger events in on mount
  useEffect(() => {
    let i = 0
    const tick = () => {
      setVisible((v) => v + 1)
      i++
      if (i < events.length) {
        animRef.current = setTimeout(tick, 160)
      }
    }
    animRef.current = setTimeout(tick, 300)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [events.length])

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute node positions using D3 scales
  const padding = { top: 60, bottom: 60 }
  const nodePositions: { x: number; y: number; side: 'left' | 'right' }[] = []

  if (dims.w > 0 && dims.h > 0) {
    const yScale = scaleLinear()
      .domain([0, events.length - 1])
      .range([padding.top, dims.h - padding.bottom])

    const cx = dims.w / 2
    const swing = Math.min(80, dims.w * 0.18) // how far left/right the path swings

    events.forEach((_, i) => {
      const side = i % 2 === 0 ? 'left' : 'right'
      const xOffset = side === 'left' ? -swing : swing
      nodePositions.push({
        x: cx + xOffset,
        y: yScale(i),
        side,
      })
    })
  }

  // Draw path + nodes on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodePositions.length === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.w * dpr
    canvas.height = dims.h * dpr
    canvas.style.width = `${dims.w}px`
    canvas.style.height = `${dims.h}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, dims.w, dims.h)

    // Build D3 line generator for the path
    const pathGen = line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveCatmullRom.alpha(0.5))

    const points = nodePositions.map((n) => ({ x: n.x, y: n.y }))

    // Draw full ghost track
    const ghostPath = new Path2D(pathGen(points) ?? '')
    ctx.save()
    ctx.strokeStyle = 'oklch(0.28 0 0)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 6])
    ctx.stroke(ghostPath)
    ctx.restore()

    // Draw lit path (only up to `visible` nodes)
    if (visible > 1) {
      const litPoints = points.slice(0, Math.min(visible, points.length))
      const litPath = new Path2D(pathGen(litPoints) ?? '')
      ctx.save()
      ctx.strokeStyle = ZONE_COLORS[zone]
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.7
      ctx.setLineDash([])
      ctx.stroke(litPath)
      ctx.restore()
    }

    // Draw nodes
    nodePositions.forEach((node, i) => {
      const isVisible = i < visible
      const ev = events[i]
      const isCritical = ev.critical
      const isNow = ev.label === 'Now'

      if (!isVisible) {
        // Faint ghost dot
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = 'oklch(0.25 0 0)'
        ctx.fill()
        ctx.restore()
        return
      }

      if (isCritical) {
        // Glow ring
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 10, 0, Math.PI * 2)
        ctx.fillStyle = `oklch(0.65 0.14 25 / 0.15)`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = `oklch(0.65 0.14 25 / 0.3)`
        ctx.fill()
        ctx.restore()
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = DANGER
        ctx.fill()
        ctx.restore()
      } else if (isNow) {
        // Zone-colored "now" dot
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = `${ZONE_COLORS[zone]}33`
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = ZONE_COLORS[zone]
        ctx.fill()
        ctx.restore()
      } else {
        // Normal dot
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3.5, 0, Math.PI * 2)
        ctx.strokeStyle = 'oklch(0.55 0 0)'
        ctx.lineWidth = 1.5
        ctx.fillStyle = 'oklch(0.09 0 0)'
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
    })
  }, [dims, visible, events, zone, nodePositions])

  // Card sizing
  const CARD_W = Math.max(100, (dims.w / 2) - 60)

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Event cards flanking the path */}
      {dims.w > 0 && nodePositions.map((node, i) => {
        const ev = events[i]
        const isVisible = i < visible
        const isCritical = ev.critical
        const isLeft = node.side === 'left'

        // Cards go on the OPPOSITE side from the dot so they point outward
        const cardLeft = isLeft
          ? node.x - CARD_W - 20
          : node.x + 20

        return (
          <div
            key={ev.t}
            className="absolute pointer-events-none transition-all duration-300"
            style={{
              left: cardLeft,
              top: node.y - 18,
              width: CARD_W,
              opacity: isVisible ? 1 : 0,
              transform: isVisible
                ? 'translateX(0)'
                : `translateX(${isLeft ? '12px' : '-12px'})`,
            }}
          >
            {/* Connector tick */}
            <div
              className="absolute top-4 h-px bg-border"
              style={{
                width: 16,
                left: isLeft ? 'auto' : -16,
                right: isLeft ? -16 : 'auto',
              }}
            />
            <div
              className={`px-3 py-2 border ${
                isCritical
                  ? 'border-[oklch(0.65_0.14_25/0.5)] bg-[oklch(0.65_0.14_25/0.06)]'
                  : 'border-border bg-background/60'
              }`}
            >
              <p
                className={`font-mono text-[10px] leading-snug ${
                  isCritical
                    ? 'text-[oklch(0.65_0.14_25)]'
                    : ev.label === 'Now'
                    ? ZONE_TEXT[zone]
                    : 'text-muted-foreground'
                }`}
              >
                {ev.label}
              </p>
              <p className="font-mono text-[9px] text-foreground/40 mt-0.5 tabular-nums">
                M{ev.t}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Score Block ──────────────────────────────────────────────────────────────

function ScoreBlock({ score, zone }: { score: number; zone: VerdictData['zone'] }) {
  const displayed = useCountUp(score)
  const tint = getScoreTint(score)
  return (
    <div
      className="flex items-center gap-5 px-6 py-4 border-b border-border"
      style={{ backgroundColor: tint }}
    >
      <span className="font-sans text-5xl font-light text-white tabular-nums leading-none">
        {displayed}
      </span>
      <div>
        <p className="font-mono text-[8px] tracking-[0.25em] uppercase text-muted-foreground">
          Score
        </p>
        <p className={`font-mono text-sm tracking-[0.2em] uppercase ${ZONE_TEXT[zone]}`}>
          {zone}
        </p>
      </div>
    </div>
  )
}

// ─── Signal Cards ─────────────────────────────────────────────────────────────

function SignalCards({ agents }: { agents: VerdictData['agents'] }) {
  return (
    <div className="grid grid-cols-2 border-b border-border">
      {agents.map((a) => {
        const config = AGENTS.find((ag) => ag.id === a.id)!
        return (
          <div key={a.id} className="border-r border-b border-border last:border-r-0 p-4 [&:nth-child(even)]:border-r-0 [&:nth-child(n+3)]:border-b-0">
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-[9px] tracking-widest uppercase ${config.colorClass}`}>
                {config.name}
              </span>
              <span className={`font-mono text-sm font-medium ${config.colorClass}`}>
                {a.score}/10
              </span>
            </div>
            <p className="font-sans text-[11px] leading-relaxed text-foreground/80">
              {a.summary}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground mt-2">
              {a.sourceCount} sources
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Pattern Match ────────────────────────────────────────────────────────────

function PatternMatch({ closestDead, closestAlive, fork }: {
  closestDead: VerdictData['closestDead']
  closestAlive: VerdictData['closestAlive']
  fork: string
}) {
  return (
    <div className="border-b border-border p-5">
      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Pattern Match
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-[oklch(0.65_0.14_25/0.4)] bg-[oklch(0.65_0.14_25/0.05)] p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.65_0.14_25)] mb-1">Closest Dead</p>
          <p className="font-sans text-sm font-medium text-foreground">{closestDead.name}</p>
          <p className="font-mono text-[9px] text-muted-foreground my-1">{closestDead.match}% match</p>
          <p className="font-sans text-[11px] text-foreground/80 leading-snug">{closestDead.cause}</p>
        </div>
        <div className="border border-[oklch(0.82_0.09_150/0.4)] bg-[oklch(0.82_0.09_150/0.05)] p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.82_0.09_150)] mb-1">Closest Living</p>
          <p className="font-sans text-sm font-medium text-foreground">{closestAlive.name}</p>
          <p className="font-mono text-[9px] text-muted-foreground my-1">{closestAlive.match}% match</p>
          <p className="font-sans text-[11px] text-foreground/80 leading-snug">{closestAlive.what}</p>
        </div>
      </div>
      <p className="font-sans text-xs text-foreground/80 leading-relaxed border-t border-border pt-3">{fork}</p>
    </div>
  )
}

// ─── Counterfactual ───────────────────────────────────────────────────────────

function Counterfactual({ text }: { text: string }) {
  return (
    <div className="border-b border-border p-5">
      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Counterfactual
      </p>
      <p className="font-sans text-xs leading-relaxed text-foreground/80">{text}</p>
    </div>
  )
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ company, score, zone, onCompare, onReset }: {
  company: string; score: number; zone: VerdictData['zone']
  onCompare: (c: string) => void; onReset: () => void
}) {
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareText, setCompareText] = useState('')
  const [shared, setShared] = useState(false)

  const handleShare = () => {
    setShared(true)
    setTimeout(() => setShared(false), 2000)
    navigator.clipboard?.writeText(`${company} scored ${score}/100 — ${zone}. Investigated by The Verdict.`)
  }

  const inputCls = 'flex-1 bg-muted border border-border px-2 py-1.5 font-sans text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40'
  const submitCls = 'px-3 py-1.5 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest whitespace-nowrap'
  const btnCls = 'font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-3 py-1.5 hover:border-foreground/40 whitespace-nowrap'

  return (
    <div className="p-4 flex flex-wrap gap-2 items-center justify-between border-t border-border">
      {challenging ? (
        <form onSubmit={(e) => { e.preventDefault(); setChallenging(false); setChallengeText('') }} className="flex gap-1 flex-1">
          <input autoFocus value={challengeText} onChange={(e) => setChallengeText(e.target.value)} placeholder="What signal did we miss?" className={inputCls} />
          <button type="submit" className={submitCls}>Re-run</button>
        </form>
      ) : (
        <button onClick={() => setChallenging(true)} className={btnCls}>Was I wrong?</button>
      )}
      {comparing ? (
        <form onSubmit={(e) => { e.preventDefault(); if (compareText.trim()) { onCompare(compareText.trim()); setComparing(false); setCompareText('') } }} className="flex gap-1 flex-1">
          <input autoFocus value={compareText} onChange={(e) => setCompareText(e.target.value)} placeholder="Another company" className={inputCls} />
          <button type="submit" className={submitCls}>Compare</button>
        </form>
      ) : (
        <button onClick={() => setComparing(true)} className={btnCls}>Compare</button>
      )}
      <button onClick={handleShare} className={btnCls}>{shared ? 'Copied' : 'Share'}</button>
      <button onClick={onReset} className="font-mono text-[10px] text-background bg-foreground hover:bg-foreground/80 transition-colors uppercase tracking-widest px-3 py-1.5 whitespace-nowrap">New case</button>
    </div>
  )
}

// ─── Verdict Page (3-column) ──────────────────────────────────────────────────

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
      <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">Verdict</span>
          <span className="font-sans text-base font-semibold text-foreground">{company}</span>
        </div>
        <button onClick={onReset} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          New case
        </button>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel: Score + Signal cards */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
          <ScoreBlock score={verdict.score} zone={verdict.zone} />
          <div className="flex-1 overflow-y-auto">
            <SignalCards agents={verdict.agents} />
          </div>
        </div>

        {/* Center: Flowing timeline — the primary focus */}
        <div className="flex-1 overflow-y-auto relative bg-background">
          <div className="sticky top-0 z-10 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Timeline</span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{verdict.timeline.length} events · M0 → M84</span>
          </div>
          <div style={{ height: Math.max(800, verdict.timeline.length * 140) }}>
            <FlowingTimeline
              events={verdict.timeline}
              zone={verdict.zone}
              score={verdict.score}
            />
          </div>
        </div>

        {/* Right panel: Pattern match + Counterfactual + Actions */}
        <div className="w-72 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <PatternMatch closestDead={verdict.closestDead} closestAlive={verdict.closestAlive} fork={verdict.fork} />
            <Counterfactual text={verdict.counterfactual} />
          </div>
          <ActionBar company={company} score={verdict.score} zone={verdict.zone} onReset={onReset} onCompare={onCompare} />
        </div>

      </div>
    </div>
  )
}
