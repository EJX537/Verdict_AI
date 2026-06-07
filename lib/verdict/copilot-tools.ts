/**
 * copilot-tools.ts
 *
 * Zod-typed tool definitions + server-side executors for the /api/chat route.
 * Executors accept an injectable store so they can be unit-tested with a fake.
 *
 * IMPORTANT: these run entirely server-side. Never call this module from a
 * client component.
 */

import { z } from 'zod'
import { tool } from 'ai'
import type { Store } from './store'
import { dbStore } from './store'
import { orchestrateDeal, defaultDeps } from './orchestrator'
import type { OrchestratorDeps } from './orchestrator'
import type { CandidateProfile, Thesis } from './thesis-fit'
import type { ThesisRow } from './store'

// ─── Injectable deps type (for unit tests) ───────────────────────────────────

export interface CopilotToolDeps {
  store: Store
  orchestrate?: (
    deal: { id: string; company: string; companyUrl: string; candidate: CandidateProfile },
    thesis: Parameters<typeof orchestrateDeal>[1],
    deps?: OrchestratorDeps,
  ) => Promise<void>
}

export const defaultCopilotDeps: CopilotToolDeps = {
  store: dbStore,
  orchestrate: orchestrateDeal,
}

// ─── Helper: map ThesisRow → Thesis ──────────────────────────────────────────

function rowToThesis(row: ThesisRow): Thesis {
  return {
    sectors: row.sectors,
    stage: row.stage,
    geo: row.geo,
    checkMin: row.check_min ?? 0,
    checkMax: row.check_max ?? 0,
    signalWeights: row.signal_weights,
  }
}

// ─── Tool builders ────────────────────────────────────────────────────────────

/**
 * Build all copilot tools bound to the provided deps.
 * Call this once per request handler.
 */
export function buildCopilotTools(deps: CopilotToolDeps = defaultCopilotDeps) {
  const { store } = deps

  // listDeals — no parameters
  const listDeals = tool({
    description: 'List all deals in the pipeline',
    inputSchema: z.object({}),
    execute: async () => {
      const deals = await store.listDeals()
      return {
        deals: deals.map((d) => ({
          id: d.id,
          company: d.company,
          stage: d.stage_status,
          score:
            d.thesis_fit?.deal_score ??
            (d.verdict ? Math.round(d.verdict.overall_score * 10) : null),
          updatedAt: d.updated_at,
        })),
      }
    },
  })

  // getDeal — retrieve full deal by id
  const getDeal = tool({
    description: 'Get full details of a single deal by ID',
    inputSchema: z.object({ id: z.string().describe('The deal UUID') }),
    execute: async ({ id }: { id: string }) => {
      const deal = await store.getDeal(id)
      if (!deal) return { error: `Deal ${id} not found` }
      return { deal }
    },
  })

  // createThesis — create a new investment thesis
  const createThesis = tool({
    description: 'Create a new investment thesis',
    inputSchema: z.object({
      sectors: z.array(z.string()).describe('Target sectors, e.g. ["saas","fintech"]'),
      stage: z.string().describe('Investment stage, e.g. "seed", "series-a"'),
      geo: z.array(z.string()).describe('Geographic focus, e.g. ["us","eu"]'),
      checkMin: z.number().optional().describe('Minimum check size in USD'),
      checkMax: z.number().optional().describe('Maximum check size in USD'),
      signalWeights: z
        .object({
          money: z.number(),
          people: z.number(),
          press: z.number(),
          archive: z.number(),
        })
        .describe('Signal agent weights (relative, not normalised)'),
    }),
    execute: async (params: {
      sectors: string[]
      stage: string
      geo: string[]
      checkMin?: number
      checkMax?: number
      signalWeights: { money: number; people: number; press: number; archive: number }
    }) => {
      const result = await store.createThesis({
        sectors: params.sectors,
        stage: params.stage,
        geo: params.geo,
        checkMin: params.checkMin,
        checkMax: params.checkMax,
        signalWeights: params.signalWeights,
      })
      return { thesisId: result.id, message: `Thesis created: ${result.id}` }
    },
  })

  // diligenceCompany — credit-spending; requires explicit confirm:true
  const diligenceCompany = tool({
    description:
      'Start a full diligence run on a company. Requires confirm:true to proceed — always ask the user to confirm before setting this to true, because it consumes API credits.',
    inputSchema: z.object({
      company: z.string().describe('Company name'),
      companyUrl: z.string().optional().describe('Company website URL'),
      thesisId: z.string().describe('Thesis UUID to evaluate against'),
      confirm: z
        .boolean()
        .describe(
          'Must be true to proceed. If the user has not explicitly confirmed, set to false and explain.',
        ),
    }),
    execute: async ({
      company,
      companyUrl,
      thesisId,
      confirm,
    }: {
      company: string
      companyUrl?: string
      thesisId: string
      confirm: boolean
    }) => {
      if (!confirm) {
        return {
          status: 'needs_confirmation',
          message: `Running a full diligence on "${company}" will consume API credits. Please reply "confirm" to proceed.`,
        }
      }

      // Fetch thesis so orchestrateDeal has signal weights
      const thesisRow = await store.getThesis(thesisId)
      if (!thesisRow) {
        return { status: 'error', message: `Thesis ${thesisId} not found` }
      }

      const thesis = rowToThesis(thesisRow)

      // Create the deal row
      const deal = await store.createDeal({
        thesisId,
        company,
        companyUrl,
      })

      // Fire-and-forget the orchestrator (streaming updates go to the DB)
      const orchestrate = deps.orchestrate ?? orchestrateDeal
      orchestrate(
        {
          id: deal.id,
          company: deal.company,
          companyUrl: deal.company_url ?? '',
          candidate: deal.candidate ?? ({} as CandidateProfile),
        },
        thesis,
      ).catch(console.error)

      return {
        status: 'started',
        dealId: deal.id,
        message: `Diligence started for "${company}" (deal ${deal.id}). Check the pipeline for live progress.`,
      }
    },
  })

  return { listDeals, getDeal, createThesis, diligenceCompany }
}
