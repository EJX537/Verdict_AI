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

      {/* Confirmation banner — slides in when ready, sits between topbar and chart */}
      {status === 'ready' && (
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-foreground/20 bg-foreground/5">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
            <span className="font-mono text-xs tracking-widest uppercase text-foreground">
              All agents filed — ready to render verdict
            </span>
          </div>
          <button
            onClick={onConfirmVerdict}
            className="font-mono text-xs tracking-[0.2em] uppercase bg-foreground text-background px-5 py-1.5 hover:bg-foreground/90 transition-colors"
          >
            Render verdict
          </button>
        </div>
      )}

      {/* Body: left (chart + agents) | right (report feed) */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left column — chart primary, agents below */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Signal chart: takes the lion's share of height */}
          <div className="flex-1 min-h-0">
            <SignalGraph points={signalPoints} evidence={evidence} />
          </div>

          {/* Agent cards pinned below the chart */}
          <AgentGrid agents={agents} evidence={evidence} />
        </div>

        {/* Right column — incoming report, full height, no scrollbar */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-border h-full overflow-hidden">
          <EvidenceFeed items={evidence} />
        </div>

      </div>
    </div>
  )
}
