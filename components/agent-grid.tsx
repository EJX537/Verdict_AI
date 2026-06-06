'use client'

import { AGENTS } from '@/lib/mock-data'
import type { AgentId, AgentState } from '@/lib/mock-data'

interface AgentTileProps {
  agent: AgentState
}

function AgentTile({ agent }: AgentTileProps) {
  const config = AGENTS.find((a) => a.id === agent.id)!

  return (
    <div
      className={`relative border ${config.borderClass} bg-card p-4 flex flex-col gap-3 overflow-hidden transition-all duration-300 ${
        agent.active && !agent.complete ? 'border-opacity-60' : 'border-opacity-20'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {agent.active && !agent.complete && (
              <span className={`w-1.5 h-1.5 rounded-full agent-pulse`} style={{ backgroundColor: `var(--agent-${agent.id.replace('_', '-')})` }} />
            )}
            {agent.complete && (
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
            )}
            {!agent.active && !agent.complete && (
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
            )}
            <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${config.colorClass}`}>
              {config.name}
            </span>
          </div>
        </div>

        {/* Signal count */}
        <div className="text-right">
          <span className="font-mono text-lg font-medium text-foreground/80 tabular-nums">
            {agent.signalCount}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/50 ml-1 uppercase tracking-wide">
            signals
          </span>
        </div>
      </div>

      {/* Current task */}
      <div className={`font-sans text-xs leading-relaxed transition-colors duration-300 ${
        agent.complete
          ? 'text-muted-foreground/40 line-through'
          : agent.active
          ? 'text-foreground/70'
          : 'text-muted-foreground/30'
      }`}>
        {agent.complete
          ? 'Complete'
          : agent.active
          ? agent.task
          : 'Queued'}
      </div>

      {/* Browser stream mock */}
      <div className={`h-20 border ${config.borderClass} border-opacity-20 bg-muted/30 flex items-center justify-center overflow-hidden relative`}>
        {agent.active && !agent.complete ? (
          <div className="w-full h-full flex flex-col gap-1 p-2 opacity-50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 bg-foreground/10 rounded-sm"
                style={{
                  width: `${55 + ((i * 17 + agent.signalCount * 3) % 40)}%`,
                  opacity: 0.4 + (i * 0.15),
                }}
              />
            ))}
            <div className="mt-1 flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-1.5 w-8 bg-foreground/10 rounded-sm" />
              ))}
            </div>
          </div>
        ) : agent.complete ? (
          <span className={`font-mono text-xs ${config.colorClass} opacity-60`}>
            Score filed
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
            Standby
          </span>
        )}
      </div>

      {/* Completed score badge */}
      {agent.complete && agent.score !== null && (
        <div className={`absolute bottom-3 right-3 font-mono text-xs ${config.colorClass}`}>
          {agent.score}/10
        </div>
      )}
    </div>
  )
}

interface AgentGridProps {
  agents: AgentState[]
}

export function AgentGrid({ agents }: AgentGridProps) {
  return (
    <div className="grid grid-cols-2 gap-px bg-border flex-1 min-h-0">
      {agents.map((agent) => (
        <AgentTile key={agent.id} agent={agent} />
      ))}
    </div>
  )
}
