import type { Store } from './store'
import type { Finding } from './types'
import type { ChatCaller } from './openai'
import type { Thesis, CandidateProfile } from './thesis-fit'
import { scoreVerdict } from './scoring'
import { writeCounterfactual, writeFounderSummary, openaiCaller } from './openai'
import { scoreThesisFit } from './thesis-fit'
import { fetchMoney, fetchPeople, fetchPress, fetchArchive } from './sources'
import { dbStore } from './store'

// ─── Dependency surface ───────────────────────────────────────────────────────

export interface OrchestratorDeps {
  store: Pick<Store, 'updateDealStage' | 'saveDealResult' | 'failDeal'>
  fetchMoney: typeof fetchMoney
  fetchPeople: typeof fetchPeople
  fetchPress: typeof fetchPress
  fetchArchive: typeof fetchArchive
  caller: ChatCaller
}

// ─── Default deps (real network) ──────────────────────────────────────────────

export const defaultDeps: OrchestratorDeps = {
  store: dbStore,
  fetchMoney,
  fetchPeople,
  fetchPress,
  fetchArchive,
  caller: openaiCaller,
}

// ─── Stage machine ────────────────────────────────────────────────────────────

export async function orchestrateDeal(
  deal: {
    id: string
    company: string
    companyUrl: string
    candidate: CandidateProfile
  },
  thesis: Thesis,
  deps: OrchestratorDeps = defaultDeps,
): Promise<void> {
  try {
    const asOf = new Date().toISOString()

    // 1. sourcing
    await deps.store.updateDealStage(deal.id, 'sourcing')

    // 2. fetch all 4 sources in parallel
    const [money, people, press, archive] = await Promise.all([
      deps.fetchMoney(deal.company, asOf),
      deps.fetchPeople(deal.company, asOf),
      deps.fetchPress(deal.company, asOf),
      deps.fetchArchive(deal.companyUrl, asOf),
    ])
    const findings: Finding[] = [...money, ...people, ...press, ...archive]

    // 3. profiling (persist findings)
    await deps.store.updateDealStage(deal.id, 'profiling', { findings })

    // 4. score
    const core = scoreVerdict(findings, { weights: thesis.signalWeights })

    // 5. scoring stage
    await deps.store.updateDealStage(deal.id, 'scoring')

    // 6. LLM prose in parallel
    const [counterfactual, founderSummary] = await Promise.all([
      writeCounterfactual(findings, core, deps.caller),
      writeFounderSummary(findings, deps.caller),
    ])

    // 7. thesis fit
    const thesisFit = scoreThesisFit(core, deal.candidate, thesis)

    // 8. persist result
    await deps.store.saveDealResult(deal.id, {
      findings,
      verdict: { ...core, counterfactual },
      founderSummary,
      thesisFit,
    })

    // 9. ready
    await deps.store.updateDealStage(deal.id, 'ready')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await deps.store.failDeal(deal.id, message)
  }
}
