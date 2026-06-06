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
    Terminal: 'text-[oklch(0.65_0.14_25)]',
    Critical: 'text-[oklch(0.72_0.14_30)]',
    Guarded: 'text-[oklch(0.78_0.12_55)]',
    Stable: 'text-[oklch(0.82_0.09_150)]',
    Thriving: 'text-[oklch(0.86_0.06_200)]',
  }

  return (
    <div
      className="p-6 border border-border transition-all duration-1000"
      style={{ backgroundColor: tint }}
    >
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-3">
        Verdict Score
      </p>
      <div className="score-reveal mb-2">
        <span className="font-sans text-5xl font-light text-white leading-none tabular-nums">
          {displayed}
        </span>
      </div>
      <p className={`font-mono text-xs tracking-[0.2em] uppercase ${zoneColors[zone]}`}>
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
    <div className="border border-border">
      {agents.map((a) => {
        const config = AGENTS.find((ag) => ag.id === a.id)!
        return (
          <div key={a.id} className="border-b border-border last:border-b-0 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`font-mono text-[9px] tracking-[0.2em] uppercase ${config.colorClass}`}>
                {config.name}
              </span>
              <span className={`font-mono text-xs font-medium ${config.colorClass}`}>
                {a.score}/10
              </span>
            </div>
            <p className="font-sans text-xs leading-relaxed text-foreground/80">
              {a.summary}
            </p>
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
    <div className="border border-border p-4">
      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Pattern Match
      </p>
      <div className="space-y-3 mb-3 text-sm">
        <div className="border border-[oklch(0.65_0.14_25/0.4)] bg-[oklch(0.65_0.14_25/0.06)] p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.65_0.14_25)] mb-1">
            Closest Dead
          </p>
          <p className="font-sans text-xs font-medium text-foreground mb-0.5">{closestDead.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground mb-1">
            {closestDead.match}% match
          </p>
          <p className="font-sans text-[11px] text-foreground/80 leading-tight">
            {closestDead.cause}
          </p>
        </div>
        <div className="border border-[oklch(0.82_0.09_150/0.4)] bg-[oklch(0.82_0.09_150/0.06)] p-3">
          <p className="font-mono text-[8px] uppercase tracking-wide text-[oklch(0.82_0.09_150)] mb-1">
            Closest Living
          </p>
          <p className="font-sans text-xs font-medium text-foreground mb-0.5">{closestAlive.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground mb-1">
            {closestAlive.match}% match
          </p>
          <p className="font-sans text-[11px] text-foreground/80 leading-tight">
            {closestAlive.what}
          </p>
        </div>
      </div>
      <p className="font-sans text-[11px] text-foreground/80 leading-tight border-t border-border pt-2">
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
    <div className="border border-border p-4">
      <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
        Counterfactual
      </p>
      <p className="font-sans text-xs leading-relaxed text-foreground/80">
        {text}
      </p>
    </div>
  )
}

interface VerticalTimelineProps {
  events: VerdictData['timeline']
}

function VerticalTimeline({ events }: VerticalTimelineProps) {
  const [scrubValue, setScrubValue] = useState(100)
  const maxT = events[events.length - 1]?.t ?? 100
  const visibleUpTo = (scrubValue / 100) * maxT

  return (
    <div className="flex flex-col h-full border border-border p-6 bg-background/50">
      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Timeline
        </p>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          M{Math.round(visibleUpTo)}
        </span>
      </div>

      {/* Vertical event list */}
      <div className="flex-1 relative overflow-y-auto pr-4 mb-6">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

        {/* Events stacked vertically */}
        <div className="space-y-6 relative">
          {events.map((ev) => {
            const visible = ev.t <= visibleUpTo
            return (
              <div
                key={ev.t}
                className={`flex gap-3 items-start transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-30'}`}
              >
                {/* Dot on the left */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <div
                    className={`w-2 h-2 rounded-full border ${
                      ev.critical
                        ? 'border-[oklch(0.65_0.14_25)] bg-[oklch(0.65_0.14_25/0.5)]'
                        : 'border-muted-foreground bg-background'
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <p
                    className={`font-mono text-xs font-medium ${
                      ev.critical ? 'text-[oklch(0.65_0.14_25)]' : 'text-muted-foreground'
                    }`}
                  >
                    {ev.label}
                  </p>
                  {ev.label === 'Now' && (
                    <div className="w-full h-px bg-foreground/40 mt-2" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrubber */}
      <div className="pt-4 border-t border-border">
        <input
          type="range"
          min={0}
          max={100}
          value={scrubValue}
          onChange={(e) => setScrubValue(Number(e.target.value))}
          className="w-full h-1 bg-border appearance-none cursor-pointer"
          style={{
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, oklch(0.55 0 0) ${scrubValue}%, oklch(0.22 0 0) ${scrubValue}%)`,
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
    navigator.clipboard?.writeText(`${company} scored ${score}/100 — ${zone}. Investigated by The Verdict.`)
  }

  return (
    <div className="border-t border-border p-4 space-y-2 text-sm">
      <div className="flex items-start gap-2">
        {/* Challenge */}
        <div className="flex-1">
          {challenging ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setChallenging(false)
                setChallengeText('')
              }}
              className="flex gap-1"
            >
              <input
                autoFocus
                value={challengeText}
                onChange={(e) => setChallengeText(e.target.value)}
                placeholder="What signal did we miss?"
                className="flex-1 bg-muted border border-border px-2 py-1 font-sans text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest whitespace-nowrap"
              >
                Re-run
              </button>
            </form>
          ) : (
            <button
              onClick={() => setChallenging(true)}
              className="font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-2 py-1 hover:border-foreground/40 whitespace-nowrap"
            >
              Was I wrong?
            </button>
          )}
        </div>

        {/* Compare */}
        <div className="flex-1">
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
              className="flex gap-1"
            >
              <input
                autoFocus
                value={compareText}
                onChange={(e) => setCompareText(e.target.value)}
                placeholder="Another company"
                className="flex-1 bg-muted border border-border px-2 py-1 font-sans text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest whitespace-nowrap"
              >
                Compare
              </button>
            </form>
          ) : (
            <button
              onClick={() => setComparing(true)}
              className="font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-2 py-1 hover:border-foreground/40 whitespace-nowrap"
            >
              Compare
            </button>
          )}
        </div>
      </div>

      {/* Share & New case */}
      <div className="flex gap-2 justify-between pt-1">
        <button
          onClick={handleShare}
          className="font-mono text-[9px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest border border-border px-2 py-1 hover:border-foreground/40"
        >
          {shared ? 'Copied' : 'Share'}
        </button>

        <button
          onClick={onReset}
          className="font-mono text-[9px] text-background bg-foreground hover:bg-foreground/80 transition-colors uppercase tracking-widest px-2 py-1 whitespace-nowrap"
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

      {/* Main content: two-column layout */}
      <div className="flex h-[calc(100vh-52px)]">
        {/* Left column: Timeline - full height, larger */}
        <div className="flex-1 border-r border-border overflow-hidden">
          <VerticalTimeline events={verdict.timeline} />
        </div>

        {/* Right column: All other content stacked */}
        <div className="w-80 flex flex-col overflow-hidden bg-background">
          {/* Score block */}
          <div>
            <ScoreBlock score={verdict.score} zone={verdict.zone} />
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto border-b border-border">
            {/* Signal cards */}
            <div className="border-b border-border">
              <SignalCards agents={verdict.agents} />
            </div>

            {/* Pattern match */}
            <div className="border-b border-border">
              <PatternMatch
                closestDead={verdict.closestDead}
                closestAlive={verdict.closestAlive}
                fork={verdict.fork}
              />
            </div>

            {/* Counterfactual */}
            <div>
              <Counterfactual text={verdict.counterfactual} />
            </div>
          </div>

          {/* Action bar - sticky at bottom */}
          <ActionBar
            company={company}
            score={verdict.score}
            zone={verdict.zone}
            onReset={onReset}
            onCompare={onCompare}
          />
        </div>
      </div>
    </div>
  )
}
