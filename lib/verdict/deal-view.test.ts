import { describe, it, expect } from 'vitest'
import { dealToVerdictData } from './deal-view'
import type { DealRow } from './store'
import type { Verdict } from './types'
import type { ThesisFit } from './thesis-fit'

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeVerdict(overallScore: number): Verdict {
  return {
    overall_score: overallScore,
    zone: 'Stable',
    agent_scores: { money: 7.5, people: 6.0, press: 5.5, archive: 8.0 },
    overrides_fired: [],
    closest_dead: { company: 'Quibi', distance: 3.2, shared_signals: ['press.volume_decline', 'people.exec_churn'] },
    closest_living: { company: 'Brex', distance: 1.8, shared_signals: ['money.runway_healthy', 'archive.corp_stable'] },
    counterfactual: 'Resolving ICP ambiguity would push this into Thriving.',
    confidence: 0.82,
  }
}

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  const base: DealRow = {
    id: 'deal-123',
    thesis_id: 'thesis-abc',
    company: 'Acme Corp',
    company_url: 'https://acme.com',
    founder: null,
    candidate: { sector: 'FinTech', stage: 'Series A', geo: 'US' },
    stage_status: 'ready',
    stage_error: null,
    findings: [
      {
        signal_id: 'money.runway_healthy',
        source_agent: 'money_tracker',
        value: true,
        delta: null,
        direction: 'survival_positive',
        confidence: 0.9,
        provenance_tier: 'high',
        plain_english: 'Healthy 18-month runway.',
        as_of: '2024-01-01T00:00:00Z',
      },
      {
        signal_id: 'people.exec_churn',
        source_agent: 'people_watcher',
        value: 3,
        delta: null,
        direction: 'survival_negative',
        confidence: 0.75,
        provenance_tier: 'medium',
        plain_english: 'Three executives departed in six months.',
        as_of: '2024-01-01T00:00:00Z',
      },
    ],
    verdict: makeVerdict(7.5), // 0..10 scale
    founder_summary: 'Founder retains strong equity and board alignment.',
    thesis_fit: {
      deal_score: 78,
      survival_component: 7.5,
      thesis_match: 0.8,
      rationale: 'Sector matches. Stage matches. Geo matches.',
    } satisfies ThesisFit,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
  }
  return { ...base, ...overrides }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dealToVerdictData', () => {
  it('returns null when verdict is null', () => {
    const deal = makeDeal({ verdict: null })
    expect(dealToVerdictData(deal)).toBeNull()
  })

  it('maps overall_score*10 → score', () => {
    const deal = makeDeal() // verdict.overall_score = 7.5
    const result = dealToVerdictData(deal)
    expect(result).not.toBeNull()
    expect(result!.score).toBe(75)
  })

  it('computes zone via getZone (7.5*10=75 → Stable)', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.zone).toBe('Stable')
  })

  it('returns zone Terminal for a low score (score=2 → 20)', () => {
    const deal = makeDeal({ verdict: makeVerdict(2) })
    const result = dealToVerdictData(deal)!
    expect(result.zone).toBe('Terminal')
    expect(result.score).toBe(20)
  })

  it('returns zone Thriving for a high score (score=9 → 90)', () => {
    const deal = makeDeal({ verdict: makeVerdict(9) })
    const result = dealToVerdictData(deal)!
    expect(result.zone).toBe('Thriving')
    expect(result.score).toBe(90)
  })

  it('includes all four agents in correct order', () => {
    const result = dealToVerdictData(makeDeal())!
    const ids = result.agents.map(a => a.id)
    expect(ids).toEqual(['money_tracker', 'people_watcher', 'press_room', 'archivist'])
  })

  it('maps agent scores from verdict.agent_scores', () => {
    const result = dealToVerdictData(makeDeal())!
    const money = result.agents.find(a => a.id === 'money_tracker')!
    expect(money.score).toBe(7.5) // money key = 7.5
    const archive = result.agents.find(a => a.id === 'archivist')!
    expect(archive.score).toBe(8.0)
  })

  it('counts findings per agent correctly', () => {
    const result = dealToVerdictData(makeDeal())!
    const money = result.agents.find(a => a.id === 'money_tracker')!
    expect(money.sourceCount).toBe(1)
    const people = result.agents.find(a => a.id === 'people_watcher')!
    expect(people.sourceCount).toBe(1)
    const press = result.agents.find(a => a.id === 'press_room')!
    expect(press.sourceCount).toBe(0)
  })

  it('uses founder_summary as fork if present', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.fork).toBe('Founder retains strong equity and board alignment.')
  })

  it('falls back to generated fork when founder_summary is null', () => {
    const deal = makeDeal({ founder_summary: null })
    const result = dealToVerdictData(deal)!
    expect(result.fork).toContain('Acme Corp')
  })

  it('maps counterfactual from verdict.counterfactual', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.counterfactual).toBe('Resolving ICP ambiguity would push this into Thriving.')
  })

  it('maps closestDead.name from verdict.closest_dead.company', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.closestDead.name).toBe('Quibi')
  })

  it('maps closestAlive.name from verdict.closest_living.company', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.closestAlive.name).toBe('Brex')
  })

  it('match% is between 0 and 100 for closestDead', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.closestDead.match).toBeGreaterThanOrEqual(0)
    expect(result.closestDead.match).toBeLessThanOrEqual(100)
  })

  it('match% is between 0 and 100 for closestAlive', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.closestAlive.match).toBeGreaterThanOrEqual(0)
    expect(result.closestAlive.match).toBeLessThanOrEqual(100)
  })

  it('timeline has at least 2 entries', () => {
    const result = dealToVerdictData(makeDeal())!
    expect(result.timeline.length).toBeGreaterThanOrEqual(2)
  })

  it('last timeline entry is "Now" with the deal score', () => {
    const result = dealToVerdictData(makeDeal())!
    const last = result.timeline[result.timeline.length - 1]
    expect(last.label).toBe('Now')
    expect(last.score).toBe(75)
  })

  it('handles empty findings array gracefully', () => {
    const deal = makeDeal({ findings: [] })
    const result = dealToVerdictData(deal)!
    expect(result.agents).toHaveLength(4)
    result.agents.forEach(a => {
      expect(a.sourceCount).toBe(0)
      expect(typeof a.summary).toBe('string')
    })
  })

  it('handles null findings gracefully', () => {
    const deal = makeDeal({ findings: null })
    const result = dealToVerdictData(deal)!
    expect(result.agents).toHaveLength(4)
  })
})
