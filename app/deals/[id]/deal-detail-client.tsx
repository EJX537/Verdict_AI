'use client'

import { useRouter } from 'next/navigation'
import { useDealRealtime } from '@/lib/verdict/use-deal-realtime'
import { dealToVerdictData } from '@/lib/verdict/deal-view'
import { VerdictPage } from '@/components/verdict-page'
import { ZoneChip } from '@/components/workspace/zone-chip'
import { OutreachComposer } from '@/components/workspace/outreach-composer'
import { getZone } from '@/lib/mock-data'

const STAGE_MESSAGES: Record<string, string> = {
  queued:      'Queued — diligence will start shortly…',
  running:     'Agents are investigating…',
  scoring:     'Scoring findings…',
  summarizing: 'Writing founder summary…',
}

interface Props {
  dealId: string
}

export function DealDetailClient({ dealId }: Props) {
  const router = useRouter()
  const { deal, loading, error } = useDealRealtime(dealId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-mono text-[11px] text-muted-foreground tracking-widest uppercase">
            Loading…
          </p>
        </div>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-background">
        <div className="text-center max-w-sm">
          <p className="font-mono text-[11px] text-muted-foreground tracking-widest uppercase mb-3">
            Error
          </p>
          <p className="font-sans text-sm text-foreground/80">{error ?? 'Deal not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 cursor-pointer font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-border text-foreground hover:border-primary/50 transition-colors"
          >
            Back to pipeline
          </button>
        </div>
      </div>
    )
  }

  // Error stage
  if (deal.stage_status === 'error') {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-background">
        <div className="text-center max-w-sm">
          <p className="font-mono text-[11px] text-red-500 tracking-widest uppercase mb-3">
            Investigation failed
          </p>
          <p className="font-sans text-sm text-foreground/80">{deal.stage_error ?? 'Unknown error'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 cursor-pointer font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-border text-foreground hover:border-primary/50 transition-colors"
          >
            Back to pipeline
          </button>
        </div>
      </div>
    )
  }

  // Not ready yet — show investigating view
  if (deal.stage_status !== 'ready') {
    const stageMsg = STAGE_MESSAGES[deal.stage_status] ?? `${deal.stage_status}…`
    const findingCount = deal.findings?.length ?? 0

    return (
      <div className="min-h-screen bg-background p-8">
        {/* Back link */}
        <button
          onClick={() => router.push('/')}
          className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8 inline-flex items-center gap-2"
        >
          ← Pipeline
        </button>

        <div className="max-w-md">
          <h1 className="font-sans text-xl font-semibold text-foreground mb-1">
            {deal.company}
          </h1>
          {deal.company_url && (
            <a
              href={deal.company_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {deal.company_url}
            </a>
          )}

          <div className="mt-8 space-y-4">
            {/* Stage indicator */}
            <div className="border border-border bg-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                  {stageMsg}
                </span>
              </div>

              {findingCount > 0 && (
                <div className="mt-3">
                  <p className="font-mono text-[10px] text-muted-foreground mb-2">
                    {findingCount} signal{findingCount !== 1 ? 's' : ''} collected so far
                  </p>
                  <div className="space-y-1">
                    {(deal.findings ?? []).slice(-3).map(f => (
                      <div key={f.signal_id} className="flex items-start gap-2">
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${f.direction === 'survival_positive' ? 'bg-emerald-500' : f.direction === 'survival_negative' ? 'bg-red-500' : 'bg-muted-foreground'}`} />
                        <p className="font-sans text-[11px] text-foreground/80">{f.plain_english}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="font-mono text-[10px] text-muted-foreground">
              This page refreshes automatically every 3 seconds.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Ready — render VerdictPage
  const verdictData = dealToVerdictData(deal)

  if (!verdictData) {
    // Shouldn't happen (stage_status=ready implies verdict), but handle gracefully
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-background">
        <p className="font-mono text-[11px] text-muted-foreground">Verdict data unavailable.</p>
      </div>
    )
  }

  return (
    <div>
      <VerdictPage
        company={deal.company}
        verdict={verdictData}
        onReset={() => router.push('/')}
        onCompare={(company) => {
          // Navigate to pipeline and open new diligence with company pre-filled
          // (simplified: just navigate to pipeline)
          router.push('/')
        }}
      />
      {/* Outreach composer — only shown when verdict is ready */}
      <div className="max-w-xl mx-auto px-6 pb-12">
        <OutreachComposer dealId={dealId} />
      </div>
    </div>
  )
}
