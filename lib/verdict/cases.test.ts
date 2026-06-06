import { describe, it, expect } from 'vitest'
import { CASES } from './cases'

const VALID_SIGNALS = new Set([
  'money.operating_status','money.funding_recency','money.investor_quality','money.total_funding_tier',
  'people.founder_present','people.leadership_visible',
  'press.organic_ratio','press.last_unprompted','press.volume_trend',
  'archive.site_alive','archive.longevity','archive.snapshot_cadence',
])

describe('CASES', () => {
  it('has both dead and living companies', () => {
    expect(CASES.some((c) => !c.alive)).toBe(true)
    expect(CASES.some((c) => c.alive)).toBe(true)
  })
  it('every case has a 0..10 score and at least one signal', () => {
    for (const c of CASES) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(10)
      expect(c.signals.length).toBeGreaterThan(0)
    }
  })
  it('every case signal is a known real-data signal_id', () => {
    for (const c of CASES) {
      for (const s of c.signals) {
        expect(VALID_SIGNALS.has(s)).toBe(true)
      }
    }
  })
})
