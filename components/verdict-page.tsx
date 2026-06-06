'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENTS, getScoreTint } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

interface ScoreBlockProps {
  score: number
  zone: VerdictData['zone']
}

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

function ScoreBlock({ score, zone }: ScoreBlockProps) {
  const displayed = useCountUp(score)
  const tint = getScoreTint(score)

  const zoneColors: Record<VerdictData['zone'], string> = {
    Terminal: 'text-[oklch(0.58_0.14_25)]',
    Critical: 'text-[oklch(0.68_0.14_30)]',
    Guarded: 'text-[oklch(0.72_0.12_55)]',
    Stable: 'text-[oklch(0.78_0.09_150)]',
    Thriving: 'text-[oklch(0.82_0.06_200)]',
  }

  return (
    <div
      className="text-center py-16 transition-all duration-1000"
      style={{ backgroundColor: tint }}
    >
      <p className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground/50 mb-6">
        Verdict
      </p>
      <div className="score-reveal">
        <span className="font-sans text-[9rem] font-light text-foreground leading-none tabular-nums">
          {displayed}
        </span>
      </div>
      <p className={`font-mono text-sm tracking-[0.25em] uppercase mt-4 ${zoneColors[zone]}`}>
        {zone}
      </p>
    </div>
  )
}

interface SignalCardsProps {
  agents: VerdictData['agents']
}

function SignalCards({ agents }: SignalCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      {agents.map((a) => {
        const config = AGENTS.find((ag) => ag.id === a.id)!
        return (
          <div key={a.id} className="bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${config.colorClass}`}>
                {config.name}
              </span>
              <span className={`font-mono text-sm font-medium ${config.colorClass}`}>
                {a.score}/10
              </span>
            </div>
            <p className="font-sans text-xs leading-relaxed text-foreground/65 mb-3">
              {a.summary}
            </p>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              {a.sourceCount} sources
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface PatternMatchProps {
  closestDead: VerdictData['closestDead']
  closestAlive: VerdictData['closestAlive']
  fork: string
}

function PatternMatch({ closestDead, closestAlive, fork }: PatternMatchProps) {
  return (
    <div className="border border-border p-6">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50 mb-5">
        Pattern Match
      </p>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-[oklch(0.58_0.14_25/0.25)] bg-[oklch(0.58_0.14_25/0.04)] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[oklch(0.58_0.14_25)] mb-2">
            Closest Dead
          </p>
          <p className="font-sans text-sm font-medium text-foreground/80 mb-1">{closestDead.name}</p>
          <p className="font-mono text-xs text-muted-foreground/50 mb-2">
            {closestDead.match}% match
          </p>
          <p className="font-sans text-xs text-muted-foreground/60 leading-relaxed">
            Cause: {closestDead.cause}
          </p>
        </div>
        <div className="border border-[oklch(0.78_0.09_150/0.25)] bg-[oklch(0.78_0.09_150/0.04)] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wide text-[oklch(0.78_0.09_150)] mb-2">
            Closest Living
          </p>
          <p className="font-sans text-sm font-medium text-foreground/80 mb-1">{closestAlive.name}</p>
          <p className="font-mono text-xs text-muted-foreground/50 mb-2">
            {closestAlive.match}% match
          </p>
          <p className="font-sans text-xs text-muted-foreground/60 leading-relaxed">
            Saved by: {closestAlive.what}
          </p>
        </div>
      </div>
      <p className="font-sans text-sm text-foreground/60 leading-relaxed border-t border-border pt-4">
        {fork}
      </p>
    </div>
  )
}

interface CounterfactualProps {
  text: string
}

function Counterfactual({ text }: CounterfactualProps) {
  return (
    <div className="border border-border p-6">
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50 mb-4">
        Counterfactual
      </p>
      <p className="font-sans text-sm leading-relaxed text-foreground/65">
        {text}
      </p>
    </div>
  )
}

interface TimelineScrubberProps {
  events: VerdictData['timeline']
}

function TimelineScrubber({ events }: TimelineScrubberProps) {
  const [scrubValue, setScrubValue] = useState(100)
  const maxT = events[events.length - 1]?.t ?? 100
  const visibleUpTo = (scrubValue / 100) * maxT

  return (
    <div className="border border-border p-6">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
          Timeline
        </p>
        <span className="font-mono text-[10px] text-muted-foreground/40">
          Month {Math.round(visibleUpTo)}
        </span>
      </div>

      {/* Event track */}
      <div className="relative mb-4">
        <div className="h-px bg-border w-full" />
        {events.map((ev) => {
          const pct = (ev.t / maxT) * 100
          const visible = ev.t <= visibleUpTo
          return (
            <div
              key={ev.t}
              className={`absolute top-0 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-20'}`}
              style={{ left: `${pct}%` }}
            >
              <div
                className={`w-2 h-2 rounded-full border ${ev.critical ? 'border-[oklch(0.58_0.14_25)] bg-[oklch(0.58_0.14_25/0.5)]' : 'border-foreground/30 bg-background'}`}
              />
              <div
                className={`absolute top-3 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] ${
                  ev.critical ? 'text-[oklch(0.58_0.14_25)]' : 'text-muted-foreground/40'
                }`}
                style={{ left: '50%' }}
              >
                {ev.label}
              </div>
              {ev.label === 'Now' && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 h-4 w-px bg-foreground/30" />
              )}
            </div>
          )
        })}
      </div>

      {/* Scrubber */}
      <div className="mt-8">
        <input
          type="range"
          min={0}
          max={100}
          value={scrubValue}
          onChange={(e) => setScrubValue(Number(e.target.value))}
          className="w-full accent-foreground h-px bg-border appearance-none cursor-pointer"
          style={{
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, oklch(0.45 0 0) ${scrubValue}%, oklch(0.22 0 0) ${scrubValue}%)`,
          }}
        />
      </div>
    </div>
  )
}

interface ActionBarProps {
  company: string
  score: number
  zone: VerdictData['zone']
  onCompare: (company: string) => void
  onReset: () => void
}

function ActionBar({ company, score, zone, onCompare, onReset }: ActionBarProps) {
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareText, setCompareText] = useState('')
  const [shared, setShared] = useState(false)

  const handleShare = () => {
    setShared(true)
    setTimeout(() => setShared(false), 2000)
    // In a real app, generate and copy a share URL
    navigator.clipboard?.writeText(`${company} scored ${score}/100 — ${zone}. Investigated by The Verdict.`)
  }

  return (
    <div className="border-t border-border p-6">
      <div className="flex items-start gap-3">
        {/* Challenge */}
        <div className="flex-1">
          {challenging ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setChallenging(false)
                setChallengeText('')
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={challengeText}
                onChange={(e) => setChallengeText(e.target.value)}
                placeholder="What signal did we miss?"
                className="flex-1 bg-muted border border-border px-3 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-foreground text-background font-mono text-[10px] uppercase tracking-widest"
              >
                Re-run
              </button>
              <button
                type="button"
                onClick={() => setChallenging(false)}
                className="px-3 py-1.5 border border-border font-mono text-[10px] text-muted-foreground uppercase tracking-widest"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setChallenging(true)}
              className="font-mono text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors uppercase tracking-widest border border-border/50 px-4 py-2 hover:border-border"
            >
              Was I wrong?
            </button>
          )}
        </div>

        {/* Compare */}
        <div>
          {comparing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (compareText.trim()) {
                  onCompare(compareText.trim())
                  setComparing(false)
                  setCompareText('')
                }
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={compareText}
                onChange={(e) => setCompareText(e.target.value)}
                placeholder="Another company"
                className="w-40 bg-muted border border-border px-3 py-1.5 font-sans text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-foreground text-background font-mono text-[10px] uppercase tracking-widest"
              >
                Compare
              </button>
              <button
                type="button"
                onClick={() => setComparing(false)}
                className="px-3 py-1.5 border border-border font-mono text-[10px] text-muted-foreground uppercase tracking-widest"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => setComparing(true)}
              className="font-mono text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors uppercase tracking-widest border border-border/50 px-4 py-2 hover:border-border"
            >
              Compare another
            </button>
          )}
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          className="font-mono text-xs text-muted-foreground/60 hover:text-foreground/80 transition-colors uppercase tracking-widest border border-border/50 px-4 py-2 hover:border-border"
        >
          {shared ? 'Copied' : 'Share'}
        </button>

        {/* New case */}
        <button
          onClick={onReset}
          className="font-mono text-xs text-background bg-foreground/80 hover:bg-foreground transition-colors uppercase tracking-widest px-4 py-2 ml-auto"
        >
          New case
        </button>
      </div>
    </div>
  )
}

interface VerdictPageProps {
  company: string
  verdict: VerdictData
  onReset: () => void
  onCompare: (company: string) => void
}

export function VerdictPage({ company, verdict, onReset, onCompare }: VerdictPageProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
            Verdict
          </span>
          <span className="font-sans text-base font-semibold text-foreground">{company}</span>
        </div>
        <button
          onClick={onReset}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground/80 transition-colors"
        >
          New case
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-0 verdict-slide">
        {/* Score block */}
        <ScoreBlock score={verdict.score} zone={verdict.zone} />

        {/* Signal cards */}
        <div className="mt-px">
          <SignalCards agents={verdict.agents} />
        </div>

        {/* Pattern match */}
        <div className="mt-4">
          <PatternMatch
            closestDead={verdict.closestDead}
            closestAlive={verdict.closestAlive}
            fork={verdict.fork}
          />
        </div>

        {/* Counterfactual */}
        <div className="mt-4">
          <Counterfactual text={verdict.counterfactual} />
        </div>

        {/* Timeline */}
        <div className="mt-4">
          <TimelineScrubber events={verdict.timeline} />
        </div>

        {/* Action bar */}
        <ActionBar
          company={company}
          score={verdict.score}
          zone={verdict.zone}
          onReset={onReset}
          onCompare={onCompare}
        />
      </div>
    </div>
  )
}
