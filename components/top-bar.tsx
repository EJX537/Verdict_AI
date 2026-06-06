'use client'

import { useEffect, useState } from 'react'

interface TopBarProps {
  company: string
  status: 'investigating' | 'filing' | 'complete' | 'ready'
  onConfirmVerdict?: () => void
}

export function TopBar({ company, status, onConfirmVerdict }: TopBarProps) {
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
      : status === 'ready'
      ? 'Awaiting confirmation'
      : 'Verdict filed'

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Case
        </span>
        <h1 className="font-sans text-base font-semibold text-foreground tracking-tight">
          {company}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Ready — confirm button lives inline in the top bar */}
        {status === 'ready' && onConfirmVerdict && (
          <button
            onClick={onConfirmVerdict}
            className="font-mono text-xs tracking-[0.2em] uppercase bg-foreground text-background px-4 py-1.5 hover:bg-foreground/90 transition-colors"
          >
            Render verdict
          </button>
        )}

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
        <div className="font-mono text-xs text-muted-foreground tabular-nums">
          {mm}:{ss}
        </div>
      </div>
    </div>
  )
}
