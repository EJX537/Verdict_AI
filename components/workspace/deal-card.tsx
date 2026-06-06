import Link from 'next/link'
import type { DealRow } from '@/lib/verdict/store'
import { ZoneChip } from './zone-chip'
import { getZone } from '@/lib/mock-data'

const STAGE_LABEL: Record<string, string> = {
  queued:      'Queued',
  running:     'Investigating',
  scoring:     'Scoring',
  summarizing: 'Summarizing',
  ready:       'Ready',
  error:       'Error',
}

const STAGE_DOT: Record<string, string> = {
  queued:      'bg-muted-foreground',
  running:     'bg-yellow-400 animate-pulse',
  scoring:     'bg-yellow-400 animate-pulse',
  summarizing: 'bg-yellow-400 animate-pulse',
  ready:       'bg-emerald-500',
  error:       'bg-red-500',
}

interface DealCardProps {
  deal: DealRow
}

export function DealCard({ deal }: DealCardProps) {
  const score = deal.thesis_fit?.deal_score ?? (deal.verdict ? Math.round(deal.verdict.overall_score * 10) : null)
  const zone = score !== null ? getZone(score) : null
  const stageLabel = STAGE_LABEL[deal.stage_status] ?? deal.stage_status
  const stageDot = STAGE_DOT[deal.stage_status] ?? 'bg-muted-foreground'

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors p-4 group"
    >
      {/* Company name + score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-sans text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
          {deal.company}
        </h3>
        {score !== null && (
          <span className="font-mono text-lg font-light text-foreground tabular-nums shrink-0">
            {score}
          </span>
        )}
      </div>

      {/* Zone chip */}
      {zone && (
        <div className="mb-2">
          <ZoneChip zone={zone} />
        </div>
      )}

      {/* Stage status */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageDot}`} />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
          {stageLabel}
        </span>
      </div>

      {/* Updated at */}
      <p className="font-mono text-[9px] text-muted-foreground/60 mt-2">
        {new Date(deal.updated_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })}
      </p>
    </Link>
  )
}
