import { describe, it, expect } from 'vitest'
import { profileCompany, type ProfileDeps } from './profile'
import type { Thesis } from './thesis-fit'
import type { ChatCaller } from './openai'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const thesis: Thesis = {
  sectors: ['saas'], stage: 'series_a', geo: ['us'],
  checkMin: 1_000_000, checkMax: 10_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}
const finding = (signal_id: string, source_agent: Finding['source_agent'], direction: Finding['direction']): Finding => ({
  signal_id, source_agent, value: null, delta: null, direction,
  confidence: 0.6, provenance_tier: 'low', plain_english: `${signal_id} fired`, as_of: ASOF,
})
const caller: ChatCaller = { complete: async (_s, u) => (u.toLowerCase().includes('counterfactual') ? 'CF text' : 'Founder text') }
const deps: ProfileDeps = {
  fetchMoney: async () => [finding('money.investor_quality', 'money_tracker', 'survival_positive')],
  fetchPeople: async () => [finding('people.founder_present', 'people_watcher', 'survival_positive')],
  fetchPress: async () => [finding('press.organic_ratio', 'press_room', 'survival_positive')],
  fetchArchive: async () => [],
  caller,
}

describe('profileCompany', () => {
  it('assembles a full DealProfile', async () => {
    const result = await profileCompany(
      { company: 'Acme', companyUrl: 'https://acme.com', candidate: { sector: 'saas', stage: 'series_a', geo: 'us' }, asOf: ASOF },
      thesis,
      deps,
    )
    expect(result.findings.length).toBe(3)
    expect(result.verdict.counterfactual).toBe('CF text')
    expect(result.founderSummary).toBe('Founder text')
    expect(result.thesisFit.deal_score).toBeGreaterThan(0)
    expect(result.verdict.zone).toBeTruthy()
  })
})
