'use client'

import { useState, useRef, useEffect } from 'react'
import { line, curveCatmullRom } from 'd3-shape'
import { AGENTS, getScoreTint } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'
import { ShareModal } from './share-modal'

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
  Terminal:  'oklch(0.65 0.14 25)',
  Critical:  'oklch(0.72 0.14 30)',
  Guarded:   'oklch(0.78 0.12 55)',
  Stable:    'oklch(0.82 0.09 150)',
  Thriving:  'oklch(0.86 0.06 200)',
}
const ZONE_HEX: Record<VerdictData['zone'], string> = {
  Terminal:  '#c0392b',
  Critical:  '#e67e22',
  Guarded:   '#d4ac0d',
  Stable:    '#27ae60',
  Thriving:  '#2980b9',
}
const ZONE_TEXT: Record<VerdictData['zone'], string> = {
  Terminal:  'text-[oklch(0.65_0.14_25)]',
  Critical:  'text-[oklch(0.72_0.14_30)]',
  Guarded:   'text-[oklch(0.78_0.12_55)]',
  Stable:    'text-[oklch(0.82_0.09_150)]',
  Thriving:  'text-[oklch(0.86_0.06_200)]',
}
const DANGER_HEX = '#c0392b'

// ─── Node layout ─────────────────────────────────────────────────────────────

/**
 * For N events, compute each node's (x, y) on the canvas and card positioning.
 * x increases evenly left → right.
 * y is driven by each event's health score (log-scaled).
 * 
 * Cards flow spatially:
 * - Founded (first event) at middle-left
 * - Doing well (high score) → moves toward top-right
 * - Poorly (low score) → moves toward bottom-right
 */
function computeNodes(
  events: VerdictData['timeline'],
  cw: number,
  ch: number,
): { x: number; y: number; side: 'above' | 'below' }[] {
  const n = events.length
  const padL = 60
  const padR = 60
  const padT = 32
  const padB = 32
  const usableW = cw - padL - padR
  const usableH = ch - padT - padB
  const centerY = padT + usableH / 2

  return events.map((ev, i) => {
    const x = padL + (i / (n - 1)) * usableW

    // Log scale: score ∈ [1,100] → [0,1], top of canvas = high health
    const logNorm = Math.log(ev.score + 1) / Math.log(101)
    const y = padT + (1 - logNorm) * usableH

    // Card positioning: start at centerY, drift toward top for high scores, bottom for low
    // side determines whether card renders above or below the curve line
    // For first event (i=0), card should be at center height
    // For subsequent events, card moves up (if score is good) or down (if score is poor)
    const sideMultiplier = logNorm > 0.5 ? -1 : 1 // above (-1) for good scores, below (+1) for poor
    const side: 'above' | 'below' = sideMultiplier === -1 ? 'above' : 'below'

    return { x, y, side }
  })
}

// ─── Canvas Timeline ──────────────────────────────────────────────────────────

interface TimelineCanvasProps {
  events: VerdictData['timeline']
  zone: VerdictData['zone']
  visible: number
  nodes: { x: number; y: number; side: 'above' | 'below' }[]
  dims: { w: number; h: number }
}

function TimelineCanvas({ events, zone, visible, nodes, dims }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0 || dims.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = dims.w * dpr
    canvas.height = dims.h * dpr
    canvas.style.width  = `${dims.w}px`
    canvas.style.height = `${dims.h}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, dims.w, dims.h)

    const pts = nodes.map(n => ({ x: n.x, y: n.y }))

    // D3 line generator with CatmullRom curve (smooth S-bends)
    const pathGen = line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(curveCatmullRom.alpha(0.5))

    // Build a Path2D from the D3 string
    const buildPath = (points: typeof pts) => new Path2D(pathGen(points) ?? '')

    // 1. Ghost track (full path, dim dashed)
    const ghostPath = buildPath(pts)
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 8])
    ctx.stroke(ghostPath)
    ctx.restore()

    // 2. Lit track up to `visible` — gradient from red → zone color
    if (visible > 1) {
      const litPts = pts.slice(0, Math.min(visible, pts.length))
      const litPath = buildPath(litPts)

      // Horizontal gradient: left (danger) → right (zone color)
      const x0 = litPts[0].x
      const x1 = litPts[litPts.length - 1].x
      const grad = ctx.createLinearGradient(x0, 0, x1, 0)
      grad.addColorStop(0,   DANGER_HEX)
      grad.addColorStop(0.4, '#e67e22')
      grad.addColorStop(0.7, '#d4ac0d')
      grad.addColorStop(1,   ZONE_HEX[zone])

      ctx.save()
      ctx.strokeStyle = grad
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.shadowColor = ZONE_HEX[zone]
      ctx.shadowBlur = 6
      ctx.stroke(litPath)
      ctx.restore()
    }

    // 3. Nodes
    nodes.forEach((node, i) => {
      const ev = events[i]
      const isLit = i < visible
      const isCritical = !!ev.critical
      const isNow = ev.label === 'Now'
      const r = isNow || isCritical ? 10 : 7

      if (!isLit) {
        // Ghost dot
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.restore()
        return
      }

      // Glow ring for critical / now
      if (isCritical || isNow) {
        const glowColor = isCritical ? DANGER_HEX : ZONE_HEX[zone]
        ctx.save()
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2)
        ctx.fillStyle = glowColor + '22'
        ctx.fill()
        ctx.restore()
      }

      // Circle fill
      ctx.save()
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      if (isCritical) {
        ctx.fillStyle = DANGER_HEX + '33'
        ctx.strokeStyle = DANGER_HEX
      } else if (isNow) {
        ctx.fillStyle = ZONE_HEX[zone] + '33'
        ctx.strokeStyle = ZONE_HEX[zone]
      } else {
        // Gradient lit color based on position
        const t = i / (events.length - 1)
        const r2 = Math.round(192 - t * 65)
        const g2 = Math.round(57  + t * 80)
        const b2 = Math.round(43  + t * 100)
        ctx.fillStyle = `rgba(${r2},${g2},${b2},0.25)`
        ctx.strokeStyle = `rgba(${r2},${g2},${b2},0.9)`
      }
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()
      ctx.restore()

      // Inner dot
      ctx.save()
      ctx.beginPath()
      ctx.arc(node.x, node.y, isCritical || isNow ? 3.5 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = isCritical ? DANGER_HEX : isNow ? ZONE_HEX[zone] : 'rgba(255,255,255,0.7)'
      ctx.fill()
      ctx.restore()

      // Connector tick: vertical line from node up or down toward card
      const tickLen = 24
      const tickY1 = node.side === 'above' ? node.y - r : node.y + r
      const tickY2 = node.side === 'above' ? tickY1 - tickLen : tickY1 + tickLen
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(node.x, tickY1)
      ctx.lineTo(node.x, tickY2)
      ctx.strokeStyle = isCritical ? DANGER_HEX + '80' : 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    })
  }, [dims, visible, events, zone, nodes])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  ev,
  node,
  index,
  isVisible,
  zone,
  cardHeight,
}: {
  ev: VerdictData['timeline'][number]
  node: { x: number; y: number; side: 'above' | 'below' }
  index: number
  isVisible: boolean
  zone: VerdictData['zone']
  cardHeight: number
}) {
  const isCritical = !!ev.critical
  const isNow = ev.label === 'Now'
  const tickLen = 28
  const nodeR = isNow || isCritical ? 10 : 7
  const cardW = 130
  const cardH = 52

  // Card sits above or below the node, with extra spacing to avoid overlap
  const cardTop = node.side === 'above'
    ? node.y - nodeR - tickLen - cardH - 2
    : node.y + nodeR + tickLen + 2
  const cardLeft = node.x - cardW / 2

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: cardLeft,
        top: cardTop,
        width: cardW,
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translateY(0)'
          : `translateY(${node.side === 'above' ? '10px' : '-10px'})`,
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        transitionDelay: `${index * 60}ms`,
      }}
    >
      <div
        className={`px-3 py-2 border-t-2 text-center ${
          isCritical
            ? 'border-t-[oklch(0.72_0.17_25)] bg-[oklch(0.17_0_0)]'
            : isNow
            ? `border-t-[${ZONE_COLORS[zone]}] bg-[oklch(0.17_0_0)]`
            : 'border-t-[oklch(0.4_0.1_250)] bg-[oklch(0.16_0_0)]'
        }`}
      >
        <p
          className={`font-mono text-[11px] font-semibold leading-tight ${
            isCritical
              ? 'text-[oklch(0.75_0.17_25)]'
              : isNow
              ? ZONE_TEXT[zone]
              : 'text-foreground'
          }`}
        >
          {ev.label}
        </p>
        <p className="font-mono text-[9px] text-foreground/60 mt-1 tabular-nums">
          M{ev.t}
        </p>
      </div>
    </div>
  )
}

// ─── Flowing Timeline ─────────────────────────────────────────────────────────

interface FlowingTimelineProps {
  events: VerdictData['timeline']
  zone: VerdictData['zone']
  score: number
}

function FlowingTimeline({ events, zone, score }: FlowingTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(0)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDims({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    setDims({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  // Stagger reveal
  useEffect(() => {
    setVisible(0)
    let i = 0
    const tick = () => {
      setVisible(v => v + 1)
      i++
      if (i < events.length) animRef.current = setTimeout(tick, 180)
    }
    animRef.current = setTimeout(tick, 400)
    return () => { if (animRef.current) clearTimeout(animRef.current) }
  }, [events])

  const nodes = dims.w > 0 && dims.h > 0
    ? computeNodes(events, dims.w, dims.h)
    : []

  // Card height is fixed — the canvas height provides the spatial budget
  const cardHeight = 44

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {dims.w > 0 && (
        <>
          <TimelineCanvas
            events={events}
            zone={zone}
            visible={visible}
            nodes={nodes}
            dims={dims}
          />
          {nodes.map((node, i) => (
            <EventCard
              key={events[i].t}
              ev={events[i]}
              node={node}
              index={i}
              isVisible={i < visible}
              zone={zone}
              cardHeight={cardHeight}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ─── Score + Zone header ──────────────────────────────────────────────────────

function ScoreHeader({ score, zone, company }: {
  score: number
  zone: VerdictData['zone']
  company: string
}) {
  const displayed = useCountUp(score)
  const tint = getScoreTint(score)
  return (
    <div
      className="flex items-center justify-between px-8 py-4 border-b border-border"
      style={{ backgroundColor: tint }}
    >
      <div className="flex items-center gap-4">
        <span className="font-sans text-6xl font-light text-white leading-none tabular-nums">
          {displayed}
        </span>
        <div>
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground">Verdict</p>
          <p className={`font-mono text-base tracking-[0.2em] uppercase font-medium ${ZONE_TEXT[zone]}`}>
            {zone}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-sans text-lg font-semibold text-foreground">{company}</p>
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">Subject</p>
      </div>
    </div>
  )
}

// ─── Compact Signals Row ──────────────────────────────────────────────────────

function SignalsRow({ agents }: { agents: VerdictData['agents'] }) {
  return (
    <div className="grid grid-cols-4 border-b border-border">
      {agents.map((a) => {
        const config = AGENTS.find(ag => ag.id === a.id)!
        return (
          <div key={a.id} className="border-r border-border last:border-r-0 px-5 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`font-mono text-[9px] tracking-widest uppercase ${config.colorClass}`}>
                {config.name}
              </span>
              <span className={`font-mono text-sm font-medium tabular-nums ${config.colorClass}`}>
                {a.score}/10
              </span>
            </div>
            <p className="font-sans text-[11px] leading-relaxed text-foreground/80 line-clamp-2">
              {a.summary}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground mt-1.5">
              {a.sourceCount} sources
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Bottom Panel: Pattern Match + Counterfactual ─────────────────────────────

function BottomPanel({ verdict, company }: {
  verdict: VerdictData
  company: string
}) {
  return (
    <div className="grid grid-cols-2 border-t border-border">
      {/* Pattern Match */}
      <div className="border-r border-border px-6 py-5">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Pattern Match
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="border border-[oklch(0.65_0.14_25/0.4)] bg-[oklch(0.65_0.14_25/0.05)] p-3">
            <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.65_0.14_25)] mb-1">Closest Dead</p>
            <p className="font-sans text-sm font-medium text-foreground">{verdict.closestDead.name}</p>
            <p className="font-mono text-[9px] text-muted-foreground my-1">{verdict.closestDead.match}% match</p>
            <p className="font-sans text-[11px] text-foreground/80 leading-snug">{verdict.closestDead.cause}</p>
          </div>
          <div className="border border-[oklch(0.82_0.09_150/0.4)] bg-[oklch(0.82_0.09_150/0.05)] p-3">
            <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.82_0.09_150)] mb-1">Closest Living</p>
            <p className="font-sans text-sm font-medium text-foreground">{verdict.closestAlive.name}</p>
            <p className="font-mono text-[9px] text-muted-foreground my-1">{verdict.closestAlive.match}% match</p>
            <p className="font-sans text-[11px] text-foreground/80 leading-snug">{verdict.closestAlive.what}</p>
          </div>
        </div>
        <p className="font-sans text-xs text-foreground/80 leading-relaxed border-t border-border pt-3">
          {verdict.fork}
        </p>
      </div>

      {/* Counterfactual */}
      <div className="px-6 py-5">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
          Counterfactual
        </p>
        <p className="font-sans text-sm leading-relaxed text-foreground/80">
          {verdict.counterfactual}
        </p>
      </div>
    </div>
  )
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ company, score, zone, verdict, onCompare, onReset }: {
  company: string
  score: number
  zone: VerdictData['zone']
  verdict: VerdictData
  onCompare: (c: string) => void
  onReset: () => void
}) {
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareText, setCompareText] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const inputCls = 'flex-1 bg-muted border border-border px-3 py-2 font-sans text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40'
  const submitCls = 'px-4 py-2 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest whitespace-nowrap hover:bg-foreground/85 transition-colors'
  const btnCls = 'font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-4 py-2 hover:border-foreground/40 whitespace-nowrap'

  return (
    <div className="flex flex-wrap gap-3 items-center px-8 py-4 border-t border-border bg-background">
      {challenging ? (
        <form
          onSubmit={(e) => { e.preventDefault(); setChallenging(false); setChallengeText('') }}
          className="flex gap-2 flex-1 min-w-0"
        >
          <input
            autoFocus
            value={challengeText}
            onChange={e => setChallengeText(e.target.value)}
            placeholder="What signal did we miss?"
            className={inputCls}
          />
          <button type="submit" className={submitCls}>Re-run</button>
        </form>
      ) : (
        <button onClick={() => setChallenging(true)} className={btnCls}>Was I wrong?</button>
      )}

      {comparing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (compareText.trim()) { onCompare(compareText.trim()); setComparing(false); setCompareText('') }
          }}
          className="flex gap-2 flex-1 min-w-0"
        >
          <input
            autoFocus
            value={compareText}
            onChange={e => setCompareText(e.target.value)}
            placeholder="Another company"
            className={inputCls}
          />
          <button type="submit" className={submitCls}>Compare</button>
        </form>
      ) : (
        <button onClick={() => setComparing(true)} className={btnCls}>Compare</button>
      )}

      <button onClick={() => setShareOpen(true)} className={btnCls}>
        Share
      </button>

      <button
        onClick={onReset}
        className="font-mono text-[10px] text-background bg-foreground hover:bg-foreground/85 transition-colors uppercase tracking-widest px-4 py-2 whitespace-nowrap"
      >
        New case
      </button>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        company={company}
        verdict={verdict}
      />
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
    <div className="min-h-screen bg-background flex flex-col gap-12 p-8">

      {/* Score + zone header */}
      <ScoreHeader score={verdict.score} zone={verdict.zone} company={company} />

      {/* Signal cards row */}
      <SignalsRow agents={verdict.agents} />

      {/* ── Central timeline (primary focus) ── */}
      <div className="relative w-full flex-shrink-0" style={{ height: 340 }}>
        <FlowingTimeline
          events={verdict.timeline}
          zone={verdict.zone}
          score={verdict.score}
        />
      </div>

      {/* Pattern match + counterfactual below the timeline */}
      <BottomPanel verdict={verdict} company={company} />

      {/* Spacer that grows to push action bar to bottom */}
      <div className="flex-grow" />

      {/* Action bar */}
      <ActionBar
        company={company}
        score={verdict.score}
        zone={verdict.zone}
        verdict={verdict}
        onReset={onReset}
        onCompare={onCompare}
      />

    </div>
  )
}
