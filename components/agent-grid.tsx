'use client'

import { useEffect, useState } from 'react'
import { AGENTS } from '@/lib/mock-data'
import type { AgentState, EvidenceItem } from '@/lib/mock-data'

const AGENT_CHART_COLORS: Record<string, string> = {
  archivist:      '#5b9cf6',
  money_tracker:  '#f5a623',
  people_watcher: '#e879a0',
  press_room:     '#4ade80',
}

interface AgentCardProps {
  agent: AgentState
  latestFinding: EvidenceItem | null
}

function AgentCard({ agent, latestFinding }: AgentCardProps) {
  const config = AGENTS.find((a) => a.id === agent.id)!
  const color = AGENT_CHART_COLORS[agent.id]
  const [flash, setFlash] = useState(false)
  const [displayedFinding, setDisplayedFinding] = useState<EvidenceItem | null>(null)

  // Flash the card and update finding whenever a new one arrives
  useEffect(() => {
    if (!latestFinding) return
    setFlash(true)
    setDisplayedFinding(latestFinding)
    const t = setTimeout(() => setFlash(false), 600)
    return () => clearTimeout(t)
  }, [latestFinding?.id])

  const isActive = agent.active && !agent.complete

  return (
    <div
      className="relative border border-border bg-card flex flex-col gap-2 p-3 overflow-hidden transition-colors duration-150"
      style={{
        borderTopColor: color,
        borderTopWidth: 2,
        backgroundColor: flash ? `${color}0d` : undefined,
      }}
    >
      {/* Header: name + pulse + score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span
              className="w-1.5 h-1.5 rounded-full agent-pulse flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          )}
          {agent.complete && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: 0.5 }} />
          )}
          {!agent.active && !agent.complete && (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
          )}
          <span
            className="font-mono text-[10px] tracking-[0.15em] uppercase font-medium"
            style={{ color }}
          >
            {config.name}
          </span>
        </div>

        {/* Score: shows live signal count while running, final score when done */}
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-lg font-semibold tabular-nums leading-none text-foreground">
            {agent.complete && agent.score !== null
              ? agent.score
              : agent.signalCount}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            {agent.complete ? '/10' : 'sig'}
          </span>
        </div>
      </div>

      {/* Flashing finding or task */}
      <div className="min-h-[2.5rem]">
        {displayedFinding ? (
          <p
            className="font-sans text-[11px] leading-snug text-foreground/80 line-clamp-2"
            style={{ color: flash ? color : undefined, transition: 'color 0.3s' }}
          >
            {displayedFinding.finding}
          </p>
        ) : (
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {isActive ? agent.task : agent.complete ? 'Complete' : 'Standby'}
          </p>
        )}
      </div>
    </div>
  )
}

interface AgentGridProps {
  agents: AgentState[]
  evidence: EvidenceItem[]
}

export function AgentGrid({ agents, evidence }: AgentGridProps) {
  // For each agent, find the most recent evidence item
  const latestByAgent = (id: string): EvidenceItem | null => {
    const items = evidence.filter((e) => e.agent === id)
    return items.length > 0 ? items[items.length - 1] : null
  }

  return (
    <div className="grid grid-cols-2 gap-px bg-border flex-shrink-0">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          latestFinding={latestByAgent(agent.id)}
        />
      ))}
    </div>
  )
}
