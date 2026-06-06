'use client'

import { useEffect, useState } from 'react'

interface TopBarProps {
  company: string
  status: 'investigating' | 'filing' | 'complete'
}

export function TopBar({ company, status }: TopBarProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  const statusLabel =
    status === 'investigating'
      ? 'Investigating...'
      : status === 'filing'
      ? 'Filing verdict...'
      : 'Verdict filed'

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50">
          Case
        </span>
        <h1 className="font-sans text-base font-semibold text-foreground tracking-tight">
          {company}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          {status !== 'complete' && (
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 agent-pulse" />
          )}
          <span className="font-mono text-xs text-muted-foreground tracking-wide">
            {statusLabel}
          </span>
        </div>

        {/* Elapsed */}
        <div className="font-mono text-xs text-muted-foreground/60 tabular-nums">
          {mm}:{ss}
        </div>
      </div>
    </div>
  )
}
