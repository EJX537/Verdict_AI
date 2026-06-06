import type { Finding } from '../types'

// Normalized shape from davidsharadbhatt/crunchbase-company-scraper---no-api-limits.
// The actor returns one flat record per company; investors are comma-separated strings.
export interface CrunchbaseCompany {
  name: string
  operatingStatus?: string      // "Operating Status"  e.g. active | closed | acquired
  totalFundingUsd?: number      // "Total Funding Amount (in USD)"
  lastFundingDate?: string      // "Last Funding Date" (parseable date)
  lastFundingType?: string      // "Last Equity Funding Type"
  topInvestors: string[]        // "Top 5 Investors" split on comma, trimmed
  leadInvestors: string[]       // "Lead Investors" split on comma, trimmed
  foundedDate?: string          // "Founded Date"
  ipoStatus?: string            // "IPO Status"
  acquisitionStatus?: string    // "Acquisition Status"
}

export interface MoneyActorInput {
  // davidsharadbhatt/crunchbase-company-scraper---no-api-limits accepts a
  // newline-separated string of Crunchbase organization URLs.
  urlList: string
}

// Third-party scrape, can lag reality, ToS-gray → low provenance.
const TIER = 'low' as const

// Known top-tier institutional investors (normalized substrings).
export const TOP_TIER = [
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

function daysSince(dateISO: string, asOf: string): number {
  return (Date.parse(asOf) - Date.parse(dateISO)) / MS_PER_DAY
}

export function buildMoneyInput(company: string): MoneyActorInput {
  // davidsharadbhatt/crunchbase-company-scraper---no-api-limits accepts a
  // newline-separated string of Crunchbase organization URLs (field: urlList).
  //
  // `company` may be:
  //   • A full Crunchbase URL  → used as-is
  //   • A bare org slug        → prefixed with the Crunchbase base URL
  //   • A plain company name   → lower-cased + spaces → hyphens (best-effort slug)
  const url = company.startsWith('https://')
    ? company
    : `https://www.crunchbase.com/organization/${company.toLowerCase().replace(/\s+/g, '-')}`
  return { urlList: url }
}

export function mapMoneyDataset(
  company: CrunchbaseCompany,
  asOf: string,
): Finding[] {
  const findings: Finding[] = []

  // money.operating_status — closed/acquired → negative; active → positive.
  // Emits only when operatingStatus is present.
  const status = company.operatingStatus
  if (status !== undefined) {
    if (status === 'closed' || status === 'acquired') {
      findings.push({
        signal_id: 'money.operating_status',
        source_agent: 'money_tracker',
        value: status,
        delta: null,
        direction: 'survival_negative',
        confidence: 0.7,
        provenance_tier: TIER,
        plain_english: `Crunchbase lists the company as "${status}" — no longer operating independently`,
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
        plain_english: 'Crunchbase lists the company as "active"',
        as_of: asOf,
      })
    }
  }

  // money.funding_recency — days since lastFundingDate vs asOf.
  // Emits only when lastFundingDate is present.
  if (company.lastFundingDate !== undefined) {
    const dayCount = Math.round(daysSince(company.lastFundingDate, asOf))
    let direction: Finding['direction']
    let description: string
    if (dayCount > 730) {
      direction = 'survival_negative'
      description = `Last funding was ${dayCount} days ago — more than two years with no new round`
    } else if (dayCount <= 365) {
      direction = 'survival_positive'
      description = `Last funding was ${dayCount} days ago — raised within the past year`
    } else {
      direction = 'neutral'
      description = `Last funding was ${dayCount} days ago — between one and two years`
    }
    findings.push({
      signal_id: 'money.funding_recency',
      source_agent: 'money_tracker',
      value: dayCount,
      delta: null,
      direction,
      confidence: 0.5,
      provenance_tier: TIER,
      plain_english: description,
      as_of: asOf,
    })
  }

  // money.investor_quality — count of TOP_TIER substrings across topInvestors ∪ leadInvestors.
  // Emits when topInvestors and leadInvestors fields are present (even if empty).
  const allInvestors = [...company.topInvestors, ...company.leadInvestors]
  const tierCount = allInvestors.filter((name) => {
    const lower = name.toLowerCase()
    return TOP_TIER.some((t) => lower.includes(t))
  }).length
  findings.push({
    signal_id: 'money.investor_quality',
    source_agent: 'money_tracker',
    value: tierCount,
    delta: null,
    direction: tierCount >= 1 ? 'survival_positive' : 'neutral',
    confidence: 0.5,
    provenance_tier: TIER,
    plain_english:
      tierCount >= 1
        ? `${tierCount} top-tier institutional investor(s) identified among known backers`
        : 'No top-tier institutional investors identified among known backers',
    as_of: asOf,
  })

  // money.total_funding_tier — absolute funding scale.
  // Emits only when totalFundingUsd is present.
  if (company.totalFundingUsd !== undefined) {
    const amount = company.totalFundingUsd
    let direction: Finding['direction']
    let description: string
    if (amount >= 50_000_000) {
      direction = 'survival_positive'
      description = `Total funding of $${(amount / 1_000_000).toFixed(0)}M indicates well-capitalised scale`
    } else if (amount < 2_000_000) {
      direction = 'survival_negative'
      description = `Total funding of $${(amount / 1_000).toFixed(0)}K is below the $2M threshold — pre-scale risk`
    } else {
      direction = 'neutral'
      description = `Total funding of $${(amount / 1_000_000).toFixed(1)}M is between early-stage and scale benchmarks`
    }
    findings.push({
      signal_id: 'money.total_funding_tier',
      source_agent: 'money_tracker',
      value: amount,
      delta: null,
      direction,
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: description,
      as_of: asOf,
    })
  }

  return findings
}
