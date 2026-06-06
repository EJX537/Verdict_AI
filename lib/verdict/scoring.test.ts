import { describe, it, expect } from 'vitest'
import { scoreVerdict, AGENT_OF } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'

function f(partial: Partial<Finding> & Pick<Finding, 'signal_id' | 'source_agent' | 'direction'>): Finding {
  return {
    value: null, delta: null, confidence: 0.5, provenance_tier: 'medium',
    plain_english: '', as_of: ASOF, ...partial,
  }
}

describe('scoreVerdict', () => {
  it('returns neutral 5 per agent and overall when there are no findings', () => {
    const v = scoreVerdict([])
    expect(v.agent_scores).toEqual({ money: 5, people: 5, press: 5, archive: 5 })
    expect(v.overall_score).toBeCloseTo(5, 5)
  })

  it('positive findings raise an agent score, negative lower it', () => {
    const v = scoreVerdict([
      f({ signal_id: 'money.investor_quality', source_agent: 'money_tracker', direction: 'survival_positive', confidence: 1 }),
      f({ signal_id: 'people.founder_present', source_agent: 'people_watcher', direction: 'survival_negative', confidence: 1 }),
    ])
    expect(v.agent_scores.money).toBeGreaterThan(5)
    expect(v.agent_scores.people).toBeLessThan(5)
  })

  it('weights shift the overall score toward the weighted agent', () => {
    const findings = [
      f({ signal_id: 'people.founder_present', source_agent: 'people_watcher', direction: 'survival_negative', confidence: 1 }),
    ]
    const heavyPeople = scoreVerdict(findings, { weights: { money: 0, people: 1, press: 0, archive: 0 } })
    const heavyMoney = scoreVerdict(findings, { weights: { money: 1, people: 0, press: 0, archive: 0 } })
    expect(heavyPeople.overall_score).toBeLessThan(heavyMoney.overall_score)
  })

  it('fires the operating_status override and forces Deadpool', () => {
    const v = scoreVerdict([
      f({ signal_id: 'money.operating_status', source_agent: 'money_tracker', direction: 'survival_negative', value: 'closed', confidence: 0.7 }),
    ])
    expect(v.overrides_fired).toContain('money.operating_status')
    expect(v.zone).toBe('Deadpool')
    expect(v.overall_score).toBeLessThanOrEqual(1)
  })

  it('fires the site_dead override when archive.site_alive is false', () => {
    const v = scoreVerdict([
      f({ signal_id: 'archive.site_alive', source_agent: 'archivist', direction: 'survival_negative', value: false, confidence: 0.8 }),
    ])
    expect(v.overrides_fired).toContain('archive.site_dead')
    expect(v.zone).toBe('Deadpool')
    expect(v.overall_score).toBeLessThanOrEqual(1)
  })

  it('picks a closest dead and closest living twin', () => {
    const v = scoreVerdict([
      f({ signal_id: 'money.investor_quality', source_agent: 'money_tracker', direction: 'survival_positive', confidence: 1 }),
    ])
    expect(v.closest_dead.company).toBeTruthy()
    expect(v.closest_living.company).toBeTruthy()
    expect(AGENT_OF.money_tracker).toBe('money')
  })

  it('all-zero weights with no findings yields ~5 overall (neutral) and not Deadpool', () => {
    const zeroWeights = { money: 0, people: 0, press: 0, archive: 0 }
    const v = scoreVerdict([], { weights: zeroWeights })
    expect(v.overall_score).toBeCloseTo(5, 5)
    expect(v.zone).not.toBe('Deadpool')
  })

  it('all-zero weights produce the same result as equal/default weights for the same findings', () => {
    const findings = [
      f({ signal_id: 'money.investor_quality', source_agent: 'money_tracker', direction: 'survival_positive', confidence: 0.8 }),
      f({ signal_id: 'people.founder_present', source_agent: 'people_watcher', direction: 'survival_negative', confidence: 0.6 }),
    ]
    const zeroWeights = { money: 0, people: 0, press: 0, archive: 0 }
    const vZero = scoreVerdict(findings, { weights: zeroWeights })
    const vDefault = scoreVerdict(findings)
    expect(vZero.overall_score).toBeCloseTo(vDefault.overall_score, 5)
    expect(vZero.zone).toBe(vDefault.zone)
  })
})
