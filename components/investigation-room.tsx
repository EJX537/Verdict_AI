'use client'

import { TopBar } from './top-bar'
import { AgentGrid } from './agent-grid'
import { EvidenceFeed } from './evidence-feed'
import { SignalGraph } from './signal-graph'
import type { AgentState, EvidenceItem, SignalPoint } from '@/lib/mock-data'

interface InvestigationRoomProps {
  company: string
  status: 'investigating' | 'filing' | 'complete' | 'ready'
  agents: AgentState[]
  evidence: EvidenceItem[]
  signalPoints: SignalPoint[]
  onConfirmVerdict: () => void
}

export function InvestigationRoom({
  company,
  status,
  agents,
  evidence,
  signalPoints,
  onConfirmVerdict,
}: InvestigationRoomProps) {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar company={company} status={status} />

      {/* Body: left (chart + agents) | right (report feed) */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">

        {/* Left column — chart primary, agents below */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Signal chart: takes the lion's share of height */}
          <div className="flex-1 min-h-0">
            <SignalGraph points={signalPoints} />
          </div>

          {/* Agent cards pinned below the chart */}
          <AgentGrid agents={agents} evidence={evidence} />
        </div>

        {/* Right column — incoming report, full height, no scrollbar */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-border h-full overflow-hidden">
          <EvidenceFeed items={evidence} />
        </div>

        {/* Confirmation overlay — appears when all agents are done */}
        {status === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-6 border border-border bg-background p-10 max-w-sm w-full">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  Investigation complete
                </span>
                <h2 className="font-sans text-2xl font-light text-foreground tracking-tight">
                  {company}
                </h2>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed mt-1">
                  All four agents have filed their reports. Ready to render the verdict.
                </p>
              </div>
              <button
                onClick={onConfirmVerdict}
                className="w-full font-mono text-xs tracking-[0.2em] uppercase bg-foreground text-background py-3 px-6 hover:bg-foreground/90 transition-colors"
              >
                Render verdict
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
