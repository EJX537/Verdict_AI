import type { VerdictCore, AgentKey } from './scoring'

export interface Thesis {
  sectors: string[]
  stage: string
  geo: string[]
  checkMin: number
  checkMax: number
  signalWeights: Record<AgentKey, number>
}

export interface CandidateProfile {
  sector?: string
  stage?: string
  geo?: string
}

export interface ThesisFit {
  deal_score: number          // 0..100
  survival_component: number  // 0..10 (Verdict overall)
  thesis_match: number        // 0..1
  rationale: string
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

export function scoreThesisFit(
  core: VerdictCore,
  candidate: CandidateProfile,
  thesis: Thesis,
): ThesisFit {
  const sectorHit = candidate.sector ? thesis.sectors.map(norm).includes(norm(candidate.sector)) : false
  const stageHit = candidate.stage ? norm(candidate.stage) === norm(thesis.stage) : false
  const geoHit = candidate.geo ? thesis.geo.map(norm).includes(norm(candidate.geo)) : false

  const thesis_match = (sectorHit ? 0.5 : 0) + (stageHit ? 0.3 : 0) + (geoHit ? 0.2 : 0)

  const survival = core.overall_score * 10 // 0..100
  const deal_score = Math.round(survival * 0.6 + thesis_match * 100 * 0.4)

  const parts: string[] = []
  parts.push(`Survival ${core.overall_score}/10 (${core.zone}).`)
  parts.push(sectorHit ? 'Sector matches thesis.' : 'Sector off-thesis.')
  parts.push(stageHit ? 'Stage matches thesis.' : 'Stage off-thesis.')
  parts.push(geoHit ? 'Geo matches thesis.' : 'Geo off-thesis.')

  return {
    deal_score,
    survival_component: core.overall_score,
    thesis_match: Number(thesis_match.toFixed(2)),
    rationale: parts.join(' '),
  }
}
