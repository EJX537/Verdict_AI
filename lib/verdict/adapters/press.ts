import type { Finding } from '../types'

// Raw shapes from the two press actors (behind this adapter only).
// data_xplorer/google-news-scraper-fast → organic coverage.
export interface GoogleNewsItem {
  title: string
  source: string
  url: string
  publishedAt: string // ISO date
}

// parseforge/pr-newswire-scraper → owned/paid releases.
export interface PRNewswireItem {
  title: string
  company: string
  url: string
  publishedAt: string // ISO date
  body?: string
}

export interface PressData {
  news: GoogleNewsItem[]
  pr: PRNewswireItem[]
}

export interface NewsActorInput {
  keywords: string[]
  maxArticles?: number
}
export interface PrNewswireActorInput {
  keyword: string
}

// Google News medium, PR Newswire medium-high; the blended press tier is medium.
const TIER = 'medium' as const
const MS_PER_DAY = 1000 * 60 * 60 * 24
const WIRE_RE = /pr newswire|prnewswire|business ?wire|globe ?newswire/i

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ')
}

function days(fromISO: string, toISO: string): number {
  return (Date.parse(toISO) - Date.parse(fromISO)) / MS_PER_DAY
}

export function buildNewsInput(company: string): NewsActorInput {
  return { keywords: [company], maxArticles: 50 }
}
export function buildPrNewswireInput(company: string): PrNewswireActorInput {
  return { keyword: company }
}

// A news item is syndicated (not truly organic) if its source is a wire, or its
// title echoes a PR release title.
function trueOrganic(data: PressData): GoogleNewsItem[] {
  const prTitles = new Set(data.pr.map((p) => normTitle(p.title)))
  return data.news.filter(
    (n) => !WIRE_RE.test(n.source) && !prTitles.has(normTitle(n.title)),
  )
}

export function mapPressDataset(data: PressData, asOf: string): Finding[] {
  const findings: Finding[] = []
  const organic = trueOrganic(data)

  // press.organic_ratio — organic ÷ (organic + owned PR).
  const total = organic.length + data.pr.length
  if (total > 0) {
    const ratio = organic.length / total
    const direction: Finding['direction'] =
      ratio < 0.4 ? 'survival_negative' : ratio > 0.7 ? 'survival_positive' : 'neutral'
    findings.push({
      signal_id: 'press.organic_ratio',
      source_agent: 'press_room',
      value: ratio,
      delta: null,
      direction,
      confidence: 0.55,
      provenance_tier: TIER,
      plain_english: `Organic coverage is ${(ratio * 100).toFixed(0)}% of total (${organic.length} organic vs ${data.pr.length} owned PR)`,
      as_of: asOf,
    })
  }

  // press.last_unprompted — days since the last non-PR third-party mention.
  const latestOrganic = organic
    .map((n) => n.publishedAt)
    .sort((a, b) => b.localeCompare(a))[0]
  if (latestOrganic) {
    const d = Math.round(days(latestOrganic, asOf))
    findings.push({
      signal_id: 'press.last_unprompted',
      source_agent: 'press_room',
      value: d,
      delta: null,
      direction: d > 60 ? 'survival_negative' : d <= 14 ? 'survival_positive' : 'neutral',
      confidence: 0.55,
      provenance_tier: TIER,
      plain_english: `${d} days since the last unprompted third-party mention`,
      as_of: asOf,
    })
  } else {
    findings.push({
      signal_id: 'press.last_unprompted',
      source_agent: 'press_room',
      value: null,
      delta: null,
      direction: 'survival_negative',
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: 'No unprompted third-party coverage found',
      as_of: asOf,
    })
  }

  // press.volume_trend — total coverage volume, recent 90d vs prior 90d.
  const allDates = [
    ...data.news.map((n) => n.publishedAt),
    ...data.pr.map((p) => p.publishedAt),
  ]
  const recent = allDates.filter((d) => days(d, asOf) <= 90).length
  const prior = allDates.filter((d) => {
    const ago = days(d, asOf)
    return ago > 90 && ago <= 180
  }).length
  if (recent + prior > 0) {
    const delta = recent - prior
    findings.push({
      signal_id: 'press.volume_trend',
      source_agent: 'press_room',
      value: recent,
      delta,
      direction:
        delta < 0 ? 'survival_negative' : delta > 0 ? 'survival_positive' : 'neutral',
      confidence: 0.5,
      provenance_tier: TIER,
      plain_english: `Coverage volume ${recent} in the last 90d vs ${prior} in the prior 90d`,
      as_of: asOf,
    })
  }

  return findings
}
