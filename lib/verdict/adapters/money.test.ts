import { describe, it, expect } from 'vitest'
import { mapMoneyDataset, buildMoneyInput } from './money'
import type { CrunchbaseCompany } from './money'

const AS_OF = '2026-06-06T00:00:00.000Z'

function company(partial: Partial<CrunchbaseCompany>): CrunchbaseCompany {
  return { name: 'Acme', topInvestors: [], leadInvestors: [], ...partial }
}

// ─── money.operating_status ──────────────────────────────────────────────────

describe('mapMoneyDataset — money.operating_status', () => {
  it('emits survival_negative when operatingStatus is closed', () => {
    const f = mapMoneyDataset(
      company({ operatingStatus: 'closed' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.operating_status')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.confidence).toBe(0.7)
    expect(f!.provenance_tier).toBe('low')
    expect(f!.delta).toBeNull()
  })

  it('emits survival_negative when operatingStatus is acquired', () => {
    const f = mapMoneyDataset(
      company({ operatingStatus: 'acquired' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.operating_status')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.confidence).toBe(0.7)
  })

  it('emits survival_positive when operatingStatus is active', () => {
    const f = mapMoneyDataset(
      company({ operatingStatus: 'active' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.operating_status')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.confidence).toBe(0.4)
  })

  it('does not emit operating_status when the field is absent', () => {
    const f = mapMoneyDataset(company({}), AS_OF).find(
      (x) => x.signal_id === 'money.operating_status',
    )
    expect(f).toBeUndefined()
  })
})

// ─── money.funding_recency ────────────────────────────────────────────────────

describe('mapMoneyDataset — money.funding_recency', () => {
  it('is survival_negative when lastFundingDate is more than 730 days before asOf', () => {
    // ~900 days before 2026-06-06
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2023-12-01' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.confidence).toBe(0.5)
    expect(f!.delta).toBeNull()
    expect(typeof f!.value).toBe('number')
    expect(f!.value as number).toBeGreaterThan(730)
  })

  it('is survival_positive when lastFundingDate is within 365 days of asOf', () => {
    // ~120 days before 2026-06-06
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2026-02-06' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value as number).toBeLessThanOrEqual(365)
  })

  it('is neutral when lastFundingDate is between 365 and 730 days', () => {
    // ~550 days before 2026-06-06
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2024-12-01' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
  })

  it('does not emit when lastFundingDate is absent', () => {
    const f = mapMoneyDataset(company({}), AS_OF).find(
      (x) => x.signal_id === 'money.funding_recency',
    )
    expect(f).toBeUndefined()
  })

  it('does not emit when lastFundingDate is non-parseable (e.g. "N/A")', () => {
    const findings = mapMoneyDataset(company({ lastFundingDate: 'N/A' }), AS_OF)
    const recency = findings.find((x) => x.signal_id === 'money.funding_recency')
    expect(recency).toBeUndefined()
    // Other signals (investor_quality) are still emitted
    const investorQuality = findings.find((x) => x.signal_id === 'money.investor_quality')
    expect(investorQuality).toBeDefined()
  })
})

// ─── money.investor_quality ───────────────────────────────────────────────────

describe('mapMoneyDataset — money.investor_quality', () => {
  it('is survival_positive when at least one TOP_TIER investor is found', () => {
    const f = mapMoneyDataset(
      company({
        topInvestors: ['Sequoia Capital', 'Some Angel'],
        leadInvestors: [],
      }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.investor_quality')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.confidence).toBe(0.5)
    expect(f!.value as number).toBeGreaterThanOrEqual(1)
    expect(f!.delta).toBeNull()
  })

  it('counts leadInvestors as well as topInvestors (case-insensitive)', () => {
    const f = mapMoneyDataset(
      company({
        topInvestors: [],
        leadInvestors: ['ANDREESSEN HOROWITZ'],
      }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.investor_quality')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value as number).toBe(1)
  })

  it('is neutral when no TOP_TIER investors are found', () => {
    const f = mapMoneyDataset(
      company({
        topInvestors: ['Local Angel Fund'],
        leadInvestors: ['Unknown Family Office'],
      }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.investor_quality')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value as number).toBe(0)
  })

  it('does not emit when both topInvestors and leadInvestors are empty and field truly absent (still emits from empty arrays)', () => {
    // Even with empty arrays the signal still fires — both arrays present
    const f = mapMoneyDataset(
      company({ topInvestors: [], leadInvestors: [] }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.investor_quality')
    // The spec says "emits only when its source field is present"; empty arrays count as present
    expect(f).toBeDefined()
  })
})

// ─── money.total_funding_tier ─────────────────────────────────────────────────

describe('mapMoneyDataset — money.total_funding_tier', () => {
  it('is survival_positive when totalFundingUsd >= 50_000_000', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 100_000_000 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.confidence).toBe(0.4)
    expect(f!.value).toBe(100_000_000)
    expect(f!.delta).toBeNull()
  })

  it('is survival_negative when totalFundingUsd < 2_000_000', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 500_000 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.value).toBe(500_000)
  })

  it('is neutral when totalFundingUsd is between 2_000_000 and 50_000_000', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 10_000_000 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
  })

  it('does not emit when totalFundingUsd is absent', () => {
    const f = mapMoneyDataset(company({}), AS_OF).find(
      (x) => x.signal_id === 'money.total_funding_tier',
    )
    expect(f).toBeUndefined()
  })
})

// ─── boundary tests ──────────────────────────────────────────────────────────

describe('mapMoneyDataset — money.funding_recency (boundary)', () => {
  // asOf = 2026-06-06T00:00:00.000Z
  // day 730 = 2024-06-06  (exactly 730 days before asOf → NOT >730 → neutral)
  // day 731 = 2024-06-05  (exactly 731 days before asOf → >730 → negative)
  // day 365 = 2025-06-06  (exactly 365 days before asOf → <=365 → positive)
  // day 366 = 2025-06-05  (exactly 366 days before asOf → NOT <=365 → neutral)

  it('is neutral at exactly 730 days (boundary: 730 is NOT >730)', () => {
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2024-06-06' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.value).toBe(730)
    expect(f!.direction).toBe('neutral')
  })

  it('is survival_negative at exactly 731 days (boundary: 731 IS >730)', () => {
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2024-06-05' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.value).toBe(731)
    expect(f!.direction).toBe('survival_negative')
  })

  it('is survival_positive at exactly 365 days (boundary: 365 IS <=365)', () => {
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2025-06-06' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.value).toBe(365)
    expect(f!.direction).toBe('survival_positive')
  })

  it('is neutral at exactly 366 days (boundary: 366 is NOT <=365)', () => {
    const f = mapMoneyDataset(
      company({ lastFundingDate: '2025-06-05' }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.funding_recency')

    expect(f).toBeDefined()
    expect(f!.value).toBe(366)
    expect(f!.direction).toBe('neutral')
  })
})

describe('mapMoneyDataset — money.total_funding_tier (boundary)', () => {
  it('is survival_positive at exactly 50_000_000 (boundary: >=50M IS positive)', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 50_000_000 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.value).toBe(50_000_000)
    expect(f!.direction).toBe('survival_positive')
  })

  it('is neutral at 49_999_999 (boundary: just below 50M → NOT positive)', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 49_999_999 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.value).toBe(49_999_999)
    expect(f!.direction).toBe('neutral')
  })

  it('is neutral at 2_000_000 (boundary: 2M is NOT <2M)', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 2_000_000 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.value).toBe(2_000_000)
    expect(f!.direction).toBe('neutral')
  })

  it('is survival_negative at 1_999_999 (boundary: just below 2M IS negative)', () => {
    const f = mapMoneyDataset(
      company({ totalFundingUsd: 1_999_999 }),
      AS_OF,
    ).find((x) => x.signal_id === 'money.total_funding_tier')

    expect(f).toBeDefined()
    expect(f!.value).toBe(1_999_999)
    expect(f!.direction).toBe('survival_negative')
  })
})

// ─── buildMoneyInput ──────────────────────────────────────────────────────────

describe('buildMoneyInput', () => {
  it('returns a urlList for a full Crunchbase URL', () => {
    const input = buildMoneyInput('https://www.crunchbase.com/organization/notion-so')
    expect(input.urlList).toBe('https://www.crunchbase.com/organization/notion-so')
  })

  it('constructs a Crunchbase URL from a plain company slug', () => {
    const input = buildMoneyInput('notion-so')
    expect(input.urlList).toContain('crunchbase.com/organization/notion-so')
  })
})
