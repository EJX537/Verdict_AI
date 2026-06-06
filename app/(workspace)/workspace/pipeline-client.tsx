'use client'

import { useEffect, useRef, useState } from 'react'
import type { DealRow } from '@/lib/verdict/store'
import { DealCard } from '@/components/workspace/deal-card'
import { NewDiligenceDialog } from '@/components/workspace/new-diligence-dialog'

interface PipelineClientProps {
  initialDeals: DealRow[]
}

// Poll the /api/deals list every 5s to catch in-flight updates to stage_status.
// Individual deal pages use useDealRealtime for tighter polling (3s).
const POLL_MS = 5000
const IN_FLIGHT_STAGES = new Set(['queued', 'running', 'scoring', 'summarizing'])

export function PipelineClient({ initialDeals }: PipelineClientProps) {
  const [deals, setDeals] = useState<DealRow[]>(initialDeals)
  const [dialogOpen, setDialogOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    function hasInFlight(list: DealRow[]) {
      return list.some(d => IN_FLIGHT_STAGES.has(d.stage_status))
    }

    async function poll() {
      try {
        const res = await fetch('/api/deals')
        if (res.ok) {
          const fresh: DealRow[] = await res.json()
          if (mountedRef.current) {
            setDeals(fresh)
            if (hasInFlight(fresh)) {
              timerRef.current = setTimeout(poll, POLL_MS)
            }
          }
        }
      } catch {
        // swallow — pipeline is best-effort
      }
    }

    if (hasInFlight(initialDeals)) {
      timerRef.current = setTimeout(poll, POLL_MS)
    }

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sans text-xl font-semibold text-foreground">Pipeline</h1>
          <p className="font-mono text-[10px] text-muted-foreground tracking-wide uppercase mt-0.5">
            {deals.length} deal{deals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-4 py-2 bg-primary text-white hover:bg-primary/85 transition-colors"
        >
          + New diligence
        </button>
      </div>

      {/* Grid */}
      {deals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="font-sans text-base text-foreground/60 mb-2">No deals yet.</p>
          <p className="font-mono text-[11px] text-muted-foreground mb-6">
            Start by running diligence on a company.
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-6 py-3 border border-border text-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            + New diligence
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      <NewDiligenceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
