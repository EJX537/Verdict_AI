'use client'

import { useState, useRef } from 'react'
import { RECENT_CASES } from '@/lib/mock-data'

interface EntryPageProps {
  onSubmit: (company: string) => void
}

export function EntryPage({ onSubmit }: EntryPageProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main centered input */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Wordmark */}
        <div className="mb-16 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground uppercase mb-4">
            Intelligence Report
          </p>
          <h1 className="font-sans text-5xl font-light tracking-tight text-foreground leading-none">
            The Verdict
          </h1>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div
            className={`relative border transition-colors duration-200 ${
              focused
                ? 'border-foreground/40'
                : 'border-border'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Company name or URL"
              className="w-full bg-transparent px-5 py-4 font-sans text-base text-foreground placeholder:text-muted-foreground focus:outline-none pr-36"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="cursor-pointer absolute right-0 top-0 bottom-0 px-5 font-mono text-xs tracking-widest uppercase text-background bg-foreground disabled:bg-muted disabled:text-muted-foreground transition-colors duration-150 hover:bg-foreground/90"
            >
              Open the case
            </button>
          </div>
          <p className="mt-3 font-mono text-[11px] tracking-widest uppercase text-muted-foreground text-center">
            Four agents. Real signals. One verdict.
          </p>
        </form>
      </div>

      {/* Recent cases ticker */}
      <div className="border-t border-border py-3 overflow-hidden">
        <div className="flex items-center gap-3 mb-1 px-6">
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Recent cases
          </span>
        </div>
        <div className="overflow-hidden">
          <div className="ticker-track flex gap-0 whitespace-nowrap">
            {[...RECENT_CASES, ...RECENT_CASES].map((c, i) => (
              <button
                key={i}
                onClick={() => onSubmit(c.company)}
                className="cursor-pointer inline-flex items-center gap-3 px-6 py-1.5 group"
              >
                <span className="font-sans text-sm font-medium text-foreground/70 group-hover:text-foreground transition-colors">
                  {c.company}
                </span>
                <span
                  className={`font-mono text-xs ${
                    c.zone === 'Terminal' || c.zone === 'Critical'
                      ? 'text-[oklch(0.58_0.14_25)]'
                      : c.zone === 'Guarded'
                      ? 'text-[oklch(0.72_0.12_55)]'
                      : c.zone === 'Stable'
                      ? 'text-[oklch(0.78_0.09_150)]'
                      : 'text-[oklch(0.82_0.06_200)]'
                  }`}
                >
                  {c.score}
                </span>
                <span className="text-border text-xs">·</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
