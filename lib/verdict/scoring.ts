import type { Finding, Verdict, Zone, CaseMatch, SourceAgent } from './types'
import { CASES, type CaseCompany } from './cases'

export type VerdictCore = Omit<Verdict, 'counterfactual'>
export type AgentKey = 'money' | 'people' | 'press' | 'archive'

export const AGENT_OF: Record<SourceAgent, AgentKey> = {
  money_tracker: 'money',
  people_watcher: 'people',
  press_room: 'press',
  archivist: 'archive',
}

export interface ScoreOptions {
  weights?: Record<AgentKey, number>
}

const DEFAULT_WEIGHTS: Record<AgentKey, number> = { money: 1, people: 1, press: 1, archive: 1 }
const NEUTRAL = 5
const STEP = 2.5
const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, n))

function sign(d: Finding['direction']): number {
  if (d === 'survival_positive') return 1
  if (d === 'survival_negative') return -1
  return 0
}

function zoneFor(score: number): Zone {
  if (score < 2) return 'Deadpool'
  if (score < 4) return 'Distressed'
  if (score < 6) return 'Watch'
  if (score < 8) return 'Stable'
  return 'Thriving'
}

function agentScores(findings: Finding[]): Record<AgentKey, number> {
  const scores: Record<AgentKey, number> = { money: NEUTRAL, people: NEUTRAL, press: NEUTRAL, archive: NEUTRAL }
  for (const f of findings) {
    const key = AGENT_OF[f.source_agent]
    scores[key] = clamp(scores[key] + sign(f.direction) * f.confidence * STEP)
  }
  return scores
}

function matchTwin(findings: Finding[], overall: number, alive: boolean): CaseMatch {
  const present = new Set(findings.map((f) => f.signal_id))
  const pool = CASES.filter((c) => c.alive === alive)
  const scored = pool.map((c: CaseCompany) => {
    const shared = c.signals.filter((s) => present.has(s))
    const distance = Math.abs(c.score - overall) - shared.length * 0.5
    return { c, shared, distance }
  })
  scored.sort((a, b) => a.distance - b.distance)
  const best = scored[0]
  return { company: best.c.company, distance: Number(best.distance.toFixed(2)), shared_signals: best.shared }
}

export function scoreVerdict(findings: Finding[], opts: ScoreOptions = {}): VerdictCore {
  const weights = opts.weights ?? DEFAULT_WEIGHTS
  const scores = agentScores(findings)

  const keys: AgentKey[] = ['money', 'people', 'press', 'archive']
  const weightSum = keys.reduce((a, k) => a + weights[k], 0) || 1
  let overall = keys.reduce((a, k) => a + scores[k] * weights[k], 0) / weightSum

  const overrides_fired: string[] = []
  const dead = findings.find(
    (f) => f.signal_id === 'money.operating_status' && (f.value === 'closed' || f.value === 'acquired'),
  )
  if (dead) {
    overrides_fired.push('money.operating_status')
    overall = Math.min(overall, 1)
  }
  const siteDead = findings.find(
    (f) => f.signal_id === 'archive.site_alive' && f.value === false,
  )
  if (siteDead) {
    overrides_fired.push('archive.site_dead')
    overall = Math.min(overall, 1)
  }

  overall = clamp(overall)
  const confidences = findings.map((f) => f.confidence)
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.3

  return {
    overall_score: Number(overall.toFixed(2)),
    zone: zoneFor(overall),
    agent_scores: scores,
    overrides_fired,
    closest_dead: matchTwin(findings, overall, false),
    closest_living: matchTwin(findings, overall, true),
    confidence: Number(confidence.toFixed(2)),
  }
}
