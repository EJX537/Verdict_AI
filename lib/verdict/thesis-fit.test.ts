import { describe, it, expect } from 'vitest'
import { scoreThesisFit, type Thesis } from './thesis-fit'
import { scoreVerdict } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const thesis: Thesis = {
  sectors: ['fintech', 'saas'], stage: 'series_a', geo: ['us'],
  checkMin: 1_000_000, checkMax: 10_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}
const goodFindings: Finding[] = [
  { signal_id: 'money.investor_quality', source_agent: 'money_tracker', value: 2, delta: null, direction: 'survival_positive', confidence: 1, provenance_tier: 'low', plain_english: '', as_of: ASOF },
]

describe('scoreThesisFit', () => {
  it('returns a 0..100 deal score and a rationale', () => {
    const core = scoreVerdict(goodFindings, { weights: thesis.signalWeights })
    const fit = scoreThesisFit(core, { sector: 'fintech', stage: 'series_a', geo: 'us' }, thesis)
    expect(fit.deal_score).toBeGreaterThanOrEqual(0)
    expect(fit.deal_score).toBeLessThanOrEqual(100)
    expect(fit.rationale.length).toBeGreaterThan(0)
    expect(fit.thesis_match).toBeGreaterThan(0.5)
  })
  it('penalizes a sector/stage mismatch', () => {
    const core = scoreVerdict(goodFindings, { weights: thesis.signalWeights })
    const onThesis = scoreThesisFit(core, { sector: 'fintech', stage: 'series_a', geo: 'us' }, thesis)
    const offThesis = scoreThesisFit(core, { sector: 'biotech', stage: 'seed', geo: 'eu' }, thesis)
    expect(offThesis.deal_score).toBeLessThan(onThesis.deal_score)
  })
})
