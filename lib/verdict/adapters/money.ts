import type { Finding } from '../types'

// Raw shape from davidsharadbhatt/crunchbase-company-scraper (behind this adapter only).
// The actor returns 130+ fields; we read only what the signals need.
export interface CrunchbaseInvestor {
  name: string
}

export interface CrunchbaseRound {
  announced_on: string // ISO date
  series: string
  money_raised?: number
  investors: CrunchbaseInvestor[]
}

export interface CrunchbaseCompany {
  name: string
  operating_status?: 'active' | 'closed' | 'acquired' | string
  funding_rounds: CrunchbaseRound[]
}

export interface MoneyActorInput {
  maxCompanies: number
  operatingStatus: string
  companyType: string
  industry: string[]
  numberOfEmployees: string[]
  funding_type: string[]
  headquartersLocation: string
}

// Third-party scrape, can lag reality, ToS-gray → low provenance (spec: medium-low).
const TIER = 'low' as const

// Known top-tier institutional investors (normalized substrings).
const TOP_TIER = [
  'sequoia',
  'andreessen horowitz',
  'a16z',
  'accel',
  'benchmark',
  'greylock',
  'kleiner perkins',
  'founders fund',
  'lightspeed',
  'khosla',
  'general catalyst',
  'index ventures',
  'bessemer',
  'tiger global',
  'insight partners',
  'thrive capital',
  'coatue',
  'y combinator',
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

function days(fromISO: string, toISO: string): number {
  return (Date.parse(toISO) - Date.parse(fromISO)) / MS_PER_DAY
}

function topTierCount(round: CrunchbaseRound): number {
  return round.investors.filter((i) => {
    const n = i.name.toLowerCase()
    return TOP_TIER.some((t) => n.includes(t))
  }).length
}

export function buildMoneyInput(_company: string): MoneyActorInput {
  // davidsharadbhatt/crunchbase-company-scraper is a bulk filter scraper;
  // it has no single-company name search field. We request a small sample
  // (minimum allowed is 1000) with no additional filters so the fixture
  // captures the real output shape regardless of which companies are returned.
  return {
    maxCompanies: 1000,
    operatingStatus: 'Active',
    companyType: 'For Profit',
    industry: [],
    numberOfEmployees: [],
    funding_type: [],
    headquartersLocation: '',
  }
}

export function mapMoneyDataset(
  company: CrunchbaseCompany,
  asOf: string,
): Finding[] {
  const findings: Finding[] = []

  // money.operating_status — override input when present (actor may not expose it).
  const status = company.operating_status
  if (status === 'closed' || status === 'acquired') {
    findings.push({
      signal_id: 'money.operating_status',
      source_agent: 'money_tracker',
      value: status,
      delta: null,
      direction: 'survival_negative',
      confidence: 0.7,
      provenance_tier: TIER,
      plain_english: `Crunchbase lists operating status as "${status}"`,
      as_of: asOf,
    })
  } else if (status === 'active') {
    findings.push({
      signal_id: 'money.operating_status',
      source_agent: 'money_tracker',
      value: status,
      delta: null,
      direction: 'survival_positive',
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: 'Crunchbase lists operating status as "active"',
      as_of: asOf,
    })
  }

  const rounds = [...company.funding_rounds].sort((a, b) =>
    a.announced_on.localeCompare(b.announced_on),
  )

  // money.round_gap — gap since last round vs prior cadence; widening → negative.
  if (rounds.length >= 2) {
    const priorGaps: number[] = []
    for (let i = 1; i < rounds.length; i++) {
      priorGaps.push(days(rounds[i - 1].announced_on, rounds[i].announced_on))
    }
    const cadence = priorGaps.reduce((a, b) => a + b, 0) / priorGaps.length
    const lastRound = rounds[rounds.length - 1]
    const lastGap = days(lastRound.announced_on, asOf)
    const widening = lastGap > cadence * 1.5
    findings.push({
      signal_id: 'money.round_gap',
      source_agent: 'money_tracker',
      value: Math.round(lastGap),
      delta: Math.round(lastGap - cadence),
      direction: widening ? 'survival_negative' : 'neutral',
      confidence: 0.5,
      provenance_tier: TIER,
      plain_english: widening
        ? `No new round in ~${Math.round(lastGap)}d, well past the ~${Math.round(cadence)}d prior cadence`
        : `Last round ~${Math.round(lastGap)}d ago, within prior ~${Math.round(cadence)}d cadence`,
      as_of: asOf,
    })
  }

  // money.investor_tier — trajectory of investor quality across rounds.
  if (rounds.length >= 2) {
    const latest = rounds[rounds.length - 1]
    const earlier = rounds.slice(0, -1)
    const latestScore = topTierCount(latest)
    const earlierMax = Math.max(...earlier.map(topTierCount))
    let trend: 'up' | 'down' | 'flat'
    let direction: Finding['direction']
    if (latestScore > earlierMax) {
      trend = 'up'
      direction = 'survival_positive'
    } else if (latestScore < earlierMax) {
      trend = 'down'
      direction = 'survival_negative'
    } else {
      trend = 'flat'
      direction = 'neutral'
    }
    findings.push({
      signal_id: 'money.investor_tier',
      source_agent: 'money_tracker',
      value: trend,
      delta: latestScore - earlierMax,
      direction,
      confidence: 0.45,
      provenance_tier: TIER,
      plain_english: `Investor quality trajectory across rounds is trending ${trend}`,
      as_of: asOf,
    })
  }

  return findings
}
