import type { Finding } from '../types'

// Raw event shape from ryanclinton/wayback-machine-search (behind this adapter only).
export interface WaybackChangeEvent {
  timestamp: string // ISO snapshot date
  url: string
  category: 'pricing' | 'legal' | 'product' | 'layout' | 'messaging' | string
  change_type: 'added' | 'removed' | 'modified'
  diff: string // human-readable diff
}

export interface ArchivistActorInput {
  url: string
}

// Archived snapshots are objective → high provenance.
const TIER = 'high' as const

const SHUTDOWN_RE =
  /shut\s?down|has shut|ceased|acquired|acquisition|winding down|no longer operating|thank you to our customers/i

function byTimestampAsc(a: WaybackChangeEvent, b: WaybackChangeEvent): number {
  return a.timestamp.localeCompare(b.timestamp)
}

function isHomepage(url: string): boolean {
  try {
    const path = new URL(url).pathname
    return path === '/' || path === ''
  } catch {
    return false
  }
}

// Apify input builder — normalizes a company name/domain into an actor run input.
export function buildArchivistInput(company: string): ArchivistActorInput {
  const host = company.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return { url: `https://${host}` }
}

export function mapArchivistDataset(
  events: WaybackChangeEvent[],
  asOf: string,
): Finding[] {
  const findings: Finding[] = []

  // archive.pricing_vanished — pricing page gone and never returned.
  const pricing = events
    .filter((e) => e.category === 'pricing')
    .sort(byTimestampAsc)
  const latestPricing = pricing[pricing.length - 1]
  if (latestPricing && latestPricing.change_type === 'removed') {
    findings.push({
      signal_id: 'archive.pricing_vanished',
      source_agent: 'archivist',
      value: true,
      delta: null,
      direction: 'survival_negative',
      confidence: 0.9,
      provenance_tier: TIER,
      plain_english: `Pricing page disappeared and has not returned (${latestPricing.diff})`,
      as_of: asOf,
    })
  }

  // archive.messaging_shift — homepage positioning change. Negative only when
  // the homepage is replaced with a shutdown / acquisition notice.
  const homepageMessaging = events
    .filter(
      (e) =>
        e.category === 'messaging' &&
        e.change_type === 'modified' &&
        isHomepage(e.url),
    )
    .sort(byTimestampAsc)
  const latestMessaging = homepageMessaging[homepageMessaging.length - 1]
  if (latestMessaging) {
    const isShutdown = SHUTDOWN_RE.test(latestMessaging.diff)
    findings.push({
      signal_id: 'archive.messaging_shift',
      source_agent: 'archivist',
      value: latestMessaging.diff,
      delta: null,
      direction: isShutdown ? 'survival_negative' : 'neutral',
      confidence: isShutdown ? 0.9 : 0.6,
      provenance_tier: TIER,
      plain_english: isShutdown
        ? `Homepage replaced with a shutdown/acquisition notice: ${latestMessaging.diff}`
        : `Homepage positioning changed: ${latestMessaging.diff}`,
      as_of: asOf,
    })
  }

  // archive.scope_shift — visible product/scope pivots. Informational (neutral);
  // feeds case-matching rather than pushing the score directly.
  const productPivots = events
    .filter((e) => e.category === 'product' && e.change_type === 'modified')
    .sort(byTimestampAsc)
  if (productPivots.length > 0) {
    findings.push({
      signal_id: 'archive.scope_shift',
      source_agent: 'archivist',
      value: productPivots.map((e) => e.diff),
      delta: null,
      direction: 'neutral',
      confidence: 0.7,
      provenance_tier: TIER,
      plain_english: `Product/scope pivot detected across ${productPivots.length} snapshot(s)`,
      as_of: asOf,
    })
  }

  return findings
}
