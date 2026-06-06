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
      <TopBar company={company} status={status} onConfirmVerdict={onConfirmVerdict} />

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
