// Pure mapper: DealRow → VerdictData.
// This is the integration seam between the Plan 2 backend and the VerdictPage UI.
// Returns null if the deal has no verdict yet (still processing / error / queued).

import type { DealRow } from './store'
import type { Finding } from './types'
import { type VerdictData, getZone } from '@/lib/mock-data'
import type { AgentId } from '@/lib/mock-data'

// Maps scoring agent keys → AgentId used by VerdictPage
const AGENT_ID_MAP: Record<string, AgentId> = {
  money: 'money_tracker',
  people: 'people_watcher',
  press: 'press_room',
  archive: 'archivist',
}

// Maps source_agent on Finding → AgentId
const SOURCE_TO_AGENT_ID: Record<string, AgentId> = {
  money_tracker: 'money_tracker',
  people_watcher: 'people_watcher',
  press_room: 'press_room',
  archivist: 'archivist',
}

const AGENT_LABELS: Record<AgentId, string> = {
  money_tracker: 'Money Tracker',
  people_watcher: 'People Watcher',
  press_room: 'Press Room',
  archivist: 'Archivist',
}

// Build a short summary for an agent from its findings
function agentSummary(agentId: AgentId, findings: Finding[]): string {
  const mine = findings.filter(f => f.source_agent === agentId)
  if (mine.length === 0) return `No signals recorded for ${AGENT_LABELS[agentId]}.`
  // Pick the highest-confidence positive and negative finding for a readable summary
  const pos = mine.filter(f => f.direction === 'survival_positive').sort((a, b) => b.confidence - a.confidence)[0]
  const neg = mine.filter(f => f.direction === 'survival_negative').sort((a, b) => b.confidence - a.confidence)[0]
  const parts: string[] = []
  if (pos) parts.push(pos.plain_english)
  if (neg) parts.push(neg.plain_english)
  return parts.join(' ') || mine[0].plain_english
}

// Derive a coarse timeline from available data
// We synthesize a minimal set of events from the deal's creation and verdict
function buildTimeline(deal: DealRow, score: number): VerdictData['timeline'] {
  const created = new Date(deal.created_at).getTime()
  const updated = new Date(deal.updated_at).getTime()
  const ageDays = Math.max(0, Math.round((updated - created) / 86400000))

  return [
    { t: 0, label: 'Diligence started', score: 72 },
    { t: Math.max(1, Math.round(ageDays * 0.4)), label: 'Signals collected', score: Math.round((72 + score) / 2) },
    { t: Math.max(2, ageDays), label: 'Now', score },
  ]
}

export function dealToVerdictData(deal: DealRow): VerdictData | null {
  if (!deal.verdict) return null

  const { verdict, findings } = deal
  const overallScore = Math.round(verdict.overall_score * 10) // 0..10 → 0..100
  const zone = getZone(overallScore)

  const allFindings: Finding[] = findings ?? []

  // Per-agent scores and summaries
  const agentOrder: AgentId[] = ['money_tracker', 'people_watcher', 'press_room', 'archivist']
  const agentScoreKeys: Record<AgentId, keyof typeof verdict.agent_scores> = {
    money_tracker: 'money',
    people_watcher: 'people',
    press_room: 'press',
    archivist: 'archive',
  }

  const agents: VerdictData['agents'] = agentOrder.map(agentId => {
    const scoreKey = agentScoreKeys[agentId]
    const rawScore = verdict.agent_scores[scoreKey] ?? 5
    return {
      id: agentId,
      score: Number(rawScore.toFixed(1)),
      summary: agentSummary(agentId, allFindings),
      sourceCount: allFindings.filter(f => f.source_agent === agentId).length,
    }
  })

  // Closest dead / alive from verdict
  const closestDead: VerdictData['closestDead'] = {
    name: verdict.closest_dead.company || 'Unknown',
    match: Math.round((1 - Math.min(1, Math.max(0, verdict.closest_dead.distance / 10))) * 100),
    cause: verdict.closest_dead.shared_signals.slice(0, 3).join(', ') || 'structural similarities',
  }

  const closestAlive: VerdictData['closestAlive'] = {
    name: verdict.closest_living.company || 'Unknown',
    match: Math.round((1 - Math.min(1, Math.max(0, verdict.closest_living.distance / 10))) * 100),
    what: verdict.closest_living.shared_signals.slice(0, 3).join(', ') || 'shared positive signals',
  }

  // Fork: use founder_summary if available, else fall back to counterfactual preamble
  const fork =
    deal.founder_summary ||
    `${deal.company} diverges from its living twin on ${verdict.closest_living.shared_signals[0] ?? 'key growth signals'}.`

  const timeline = buildTimeline(deal, overallScore)

  return {
    score: overallScore,
    zone,
    agents,
    closestDead,
    closestAlive,
    fork,
    counterfactual: verdict.counterfactual,
    timeline,
  }
}
