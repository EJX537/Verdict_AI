'use client'

import { AGENTS } from '@/lib/mock-data'
import type { EvidenceItem } from '@/lib/mock-data'

interface EvidenceFeedProps {
  items: EvidenceItem[]
}

export function EvidenceFeed({ items }: EvidenceFeedProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Evidence Feed
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </div>

      {/* Items — full height, scrollbar hidden */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Awaiting signals
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item, idx) => {
              const config = AGENTS.find((a) => a.id === item.agent)!
              const isHigh = item.confidence === 'high'
              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 evidence-in ${isHigh ? 'bg-foreground/[0.02]' : ''}`}
                  style={{ animationDelay: '0ms' }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Agent color dot */}
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: config.chartColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-mono text-[10px] uppercase tracking-wide ${config.colorClass}`}>
                          {config.name}
                        </span>
                        {/* Delta badge */}
                        <span
                          className={`font-mono text-[10px] tabular-nums ${
                            item.delta > 0
                              ? 'text-[oklch(0.78_0.09_150)]'
                              : 'text-[oklch(0.58_0.14_25)]'
                          }`}
                        >
                          {item.delta > 0 ? '+' : ''}{item.delta}
                        </span>
                        {isHigh && (
                          <span className="font-mono text-[9px] uppercase tracking-wider text-foreground/50">
                            confirmed
                          </span>
                        )}
                      </div>
                      <p className={`font-sans text-xs leading-relaxed ${isHigh ? 'text-foreground' : 'text-foreground/80'}`}>
                        {item.finding}
                      </p>
                      <a
                        href={item.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors truncate block mt-0.5"
                        title={item.source}
                      >
                        {new URL(item.source).hostname}
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
