import type { Finding } from '../types'

// Normalized interface — raw→normalized mapping happens in sources.ts.
// Real actor: harvestapi/linkedin-company-employees
// Real fields: firstName, lastName, headline, linkedinUrl, currentPosition[]
export interface LinkedInEmployee {
  name: string       // `${firstName} ${lastName}`.trim()
  title: string      // headline, else currentPosition[0]?.position, else ''
  profileUrl: string // linkedinUrl
  isCurrent: boolean // currentPosition array non-empty
  isFounder: boolean // /founder|co[-\s]?founder/i on title
}

export interface PeopleActorInput {
  companies: string[]
  maxItems?: number
}

// LinkedIn is anti-automation; data is inferred and point-in-time → low provenance.
const TIER = 'low' as const

export const SENIOR_RE =
  /chief|c[eofti]o\b|founder|president|vp\b|vice president|head of/i

export function buildPeopleInput(company: string): PeopleActorInput {
  return { companies: [company], maxItems: 50 }
}

export function mapPeopleDataset(
  current: LinkedInEmployee[],
  asOf: string,
): Finding[] {
  const findings: Finding[] = []

  // people.founder_present — any employee with isFounder && isCurrent.
  const founderPresent = current.some((e) => e.isFounder && e.isCurrent)
  findings.push({
    signal_id: 'people.founder_present',
    source_agent: 'people_watcher',
    value: founderPresent,
    delta: null,
    direction: founderPresent ? 'survival_positive' : 'neutral',
    confidence: 0.5,
    provenance_tier: TIER,
    plain_english: founderPresent
      ? 'At least one founder is still active at the company'
      : 'No founder is currently listed as active at the company',
    as_of: asOf,
  })

  // people.leadership_visible — count of current senior-titled employees.
  const seniorCount = current.filter(
    (e) => e.isCurrent && SENIOR_RE.test(e.title),
  ).length
  findings.push({
    signal_id: 'people.leadership_visible',
    source_agent: 'people_watcher',
    value: seniorCount,
    delta: null,
    direction: seniorCount >= 2 ? 'survival_positive' : 'neutral',
    confidence: 0.4,
    provenance_tier: TIER,
    plain_english:
      seniorCount >= 2
        ? `${seniorCount} senior leaders are currently visible on LinkedIn`
        : `Only ${seniorCount} senior leader(s) visible — leadership bench appears thin`,
    as_of: asOf,
  })

  return findings
}
