'use client'

/**
 * deal-card-tool.tsx
 *
 * Registers assistant-ui tool UIs so getDeal / diligenceCompany results are
 * rendered as DealCard-style panels inside the Thread, instead of raw JSON.
 */

import { makeAssistantToolUI } from '@assistant-ui/react'
import { ZoneChip } from './zone-chip'
import { getZone } from '@/lib/mock-data'
import type { DealRow } from '@/lib/verdict/store'

// ─── getDeal tool UI ──────────────────────────────────────────────────────────

type GetDealResult = { deal: DealRow } | { error: string }

export const GetDealToolUI = makeAssistantToolUI<{ id: string }, GetDealResult>({
  toolName: 'getDeal',
  render({ result }) {
    if (!result) return <span className="text-muted-foreground text-xs animate-pulse">Loading deal…</span>

    if ('error' in result) {
      return (
        <div className="border border-destructive/40 bg-destructive/10 rounded p-3 text-xs text-destructive">
          {result.error}
        </div>
      )
    }

    return <InlineDealCard deal={result.deal} />
  },
})

// ─── diligenceCompany tool UI ─────────────────────────────────────────────────

type DiligenceResult =
  | { status: 'needs_confirmation'; message: string }
  | { status: 'started'; dealId: string; message: string }
  | { status: 'error'; message: string }

export const DiligenceCompanyToolUI = makeAssistantToolUI<
  { company: string; companyUrl?: string; thesisId: string; confirm: boolean },
  DiligenceResult
>({
  toolName: 'diligenceCompany',
  render({ args, result }) {
    if (!result) {
      return (
        <span className="text-muted-foreground text-xs animate-pulse">
          Starting diligence for {args.company}…
        </span>
      )
    }

    if (result.status === 'needs_confirmation') {
      return (
        <div className="border border-yellow-500/40 bg-yellow-500/10 rounded p-3 text-xs text-yellow-600 dark:text-yellow-400">
          {result.message}
        </div>
      )
    }

    if (result.status === 'error') {
      return (
        <div className="border border-destructive/40 bg-destructive/10 rounded p-3 text-xs text-destructive">
          {result.message}
        </div>
      )
    }

    return (
      <div className="border border-emerald-500/40 bg-emerald-500/10 rounded p-3 text-xs space-y-1">
        <p className="font-mono uppercase tracking-widest text-[10px] text-emerald-600 dark:text-emerald-400">
          Diligence started
        </p>
        <p className="text-foreground/80">{result.message}</p>
      </div>
    )
  },
})

// ─── Shared inline deal card ──────────────────────────────────────────────────

function InlineDealCard({ deal }: { deal: DealRow }) {
  const score =
    deal.thesis_fit?.deal_score ??
    (deal.verdict ? Math.round(deal.verdict.overall_score * 10) : null)
  const zone = score !== null ? getZone(score) : null

  const STAGE_DOT: Record<string, string> = {
    queued: 'bg-muted-foreground',
    running: 'bg-yellow-400 animate-pulse',
    scoring: 'bg-yellow-400 animate-pulse',
    summarizing: 'bg-yellow-400 animate-pulse',
    ready: 'bg-emerald-500',
    error: 'bg-red-500',
  }
  const stageDot = STAGE_DOT[deal.stage_status] ?? 'bg-muted-foreground'

  return (
    <a
      href={`/deals/${deal.id}`}
      className="block border border-border bg-card hover:border-primary/40 rounded p-3 transition-colors text-sm group"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-foreground group-hover:text-primary truncate">
          {deal.company}
        </span>
        {score !== null && (
          <span className="font-mono text-base tabular-nums shrink-0">{score}</span>
        )}
      </div>

      {zone && (
        <div className="mb-1.5">
          <ZoneChip zone={zone} />
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageDot}`} />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
          {deal.stage_status}
        </span>
      </div>
    </a>
  )
}
