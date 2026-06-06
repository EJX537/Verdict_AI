'use client'

import { TopBar } from './top-bar'
import { AgentGrid } from './agent-grid'
import { EvidenceFeed } from './evidence-feed'
import { SignalGraph } from './signal-graph'
import type { AgentState, EvidenceItem, SignalPoint } from '@/lib/mock-data'

interface InvestigationRoomProps {
  company: string
  status: 'investigating' | 'filing' | 'complete'
  agents: AgentState[]
  evidence: EvidenceItem[]
  signalPoints: SignalPoint[]
}

export function InvestigationRoom({
  company,
  status,
  agents,
  evidence,
  signalPoints,
}: InvestigationRoomProps) {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar company={company} status={status} />

      {/* Main layout: left panel + right panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left — Agent grid */}
        <div className="w-[55%] flex flex-col min-h-0">
          <AgentGrid agents={agents} />
        </div>

        {/* Right — Evidence feed */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <EvidenceFeed items={evidence} />
        </div>
      </div>

      {/* Bottom — Signal graph */}
      <SignalGraph points={signalPoints} />
    </div>
  )
}
