import type { Finding } from '../types'

// Raw shape from harvestapi/linkedin-company-employees (behind this adapter only).
export interface LinkedInEmployee {
  name: string
  title: string
  profileUrl: string // stable identity across runs
  isCurrent?: boolean // still lists this company as current
  isFounder?: boolean
  location?: string
}

export interface PeopleActorInput {
  companies: string[]
  maxItems?: number
}

export interface PeopleMapOptions {
  previous?: LinkedInEmployee[] // prior run's roster; absent on first run
}

// LinkedIn is anti-automation; data is inferred and point-in-time → low provenance.
const TIER = 'low' as const

const SENIOR_RE =
  /chief|c[eofti]o\b|founder|president|vp\b|vice president|head of/i

function isSenior(e: LinkedInEmployee): boolean {
  return SENIOR_RE.test(e.title)
}

function normTitle(title: string): string {
  return title.trim().toLowerCase()
}

export function buildPeopleInput(company: string): PeopleActorInput {
  return { companies: [company], maxItems: 50 }
}

export function mapPeopleDataset(
  current: LinkedInEmployee[],
  asOf: string,
  opts: PeopleMapOptions = {},
): Finding[] {
  const findings: Finding[] = []
  const { previous } = opts

  // people.founder_status — detectable from a single roster.
  const founder = current.find((e) => e.isFounder)
  if (founder) {
    const stillHere = founder.isCurrent !== false
    findings.push({
      signal_id: 'people.founder_status',
      source_agent: 'people_watcher',
      value: stillHere ? 'present' : 'moved_on',
      delta: null,
      direction: stillHere ? 'survival_positive' : 'survival_negative',
      confidence: 0.5,
      provenance_tier: TIER,
      plain_english: stillHere
        ? `Founder ${founder.name} still lists the company as current`
        : `Founder ${founder.name} no longer lists the company as current`,
      as_of: asOf,
    })
  }

  // Diff-based signals require a prior baseline (spec: active from run 2).
  if (previous) {
    const currentIds = new Set(current.map((e) => e.profileUrl))
    const currentSeniorTitles = new Set(
      current.filter(isSenior).map((e) => normTitle(e.title)),
    )

    const departedSeniors = previous
      .filter(isSenior)
      .filter((e) => !currentIds.has(e.profileUrl))

    const unbackfilled = departedSeniors.filter(
      (e) => !currentSeniorTitles.has(normTitle(e.title)),
    )
    const backfilled = departedSeniors.filter((e) =>
      currentSeniorTitles.has(normTitle(e.title)),
    )

    if (unbackfilled.length > 0) {
      findings.push({
        signal_id: 'people.exec_departure',
        source_agent: 'people_watcher',
        value: unbackfilled.map((e) => ({ name: e.name, title: e.title })),
        delta: unbackfilled.length,
        direction: 'survival_negative',
        confidence: 0.5,
        provenance_tier: TIER,
        plain_english: `${unbackfilled.length} senior departure(s) with no backfill: ${unbackfilled
          .map((e) => e.title)
          .join(', ')}`,
        as_of: asOf,
      })
    }

    if (backfilled.length > 0) {
      findings.push({
        signal_id: 'people.backfill',
        source_agent: 'people_watcher',
        value: backfilled.map((e) => e.title),
        delta: backfilled.length,
        direction: 'survival_positive',
        confidence: 0.5,
        provenance_tier: TIER,
        plain_english: `${backfilled.length} vacated senior role(s) backfilled: ${backfilled
          .map((e) => e.title)
          .join(', ')}`,
        as_of: asOf,
      })
    }
  }

  return findings
}
