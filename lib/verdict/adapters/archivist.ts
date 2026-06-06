import type { Finding } from '../types'

// Normalized shape from ryanclinton/wayback-machine-search (behind this adapter only).
// The actor returns per-snapshot records; only recordType === 'snapshot' is kept.
export interface WaybackSnapshot {
  timestamp: string          // "YYYYMMDDHHmmss"
  statusCode: number | null  // parsed to number; null if absent
  isRedirect: boolean
}

export interface ArchivistActorInput {
  url: string
}

// Archived snapshots are objective → high provenance.
const TIER = 'high' as const

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MS_PER_YEAR = MS_PER_DAY * 365.25

/** Parse a Wayback "YYYYMMDDHHmmss" string to a UTC Date. */
export function parseWaybackTimestamp(ts: string): Date {
  const year = parseInt(ts.slice(0, 4), 10)
  const month = parseInt(ts.slice(4, 6), 10) - 1 // 0-indexed
  const day = parseInt(ts.slice(6, 8), 10)
  const hour = parseInt(ts.slice(8, 10), 10)
  const minute = parseInt(ts.slice(10, 12), 10)
  const second = parseInt(ts.slice(12, 14), 10)
  return new Date(Date.UTC(year, month, day, hour, minute, second))
}

// Apify input builder — normalizes a company name/domain into an actor run input.
export function buildArchivistInput(company: string): ArchivistActorInput {
  const host = company.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return { url: `https://${host}` }
}

function is2xxNonRedirect(snap: WaybackSnapshot): boolean {
  return (
    !snap.isRedirect &&
    snap.statusCode !== null &&
    snap.statusCode >= 200 &&
    snap.statusCode < 300
  )
}

function isErrorOrRedirect(snap: WaybackSnapshot): boolean {
  if (snap.isRedirect) return true
  if (snap.statusCode !== null && snap.statusCode >= 400) return true
  return false
}

export function mapArchivistDataset(
  snapshots: WaybackSnapshot[],
  asOf: string,
): Finding[] {
  const findings: Finding[] = []
  const asOfMs = Date.parse(asOf)

  // ─── archive.site_alive ───────────────────────────────────────────────────
  // Among snapshots within 180 days before asOf:
  //   - any 2xx non-redirect → positive (value: true, conf 0.6)
  //   - some exist but ALL are 4xx/5xx or redirects → negative (value: false, conf 0.8)
  //   - NO recent snapshots → neutral (value: null, conf 0.4)
  const recentCutoffMs = asOfMs - 180 * MS_PER_DAY
  const recentSnaps = snapshots.filter((s) => {
    const tsMs = parseWaybackTimestamp(s.timestamp).getTime()
    return tsMs > recentCutoffMs && tsMs <= asOfMs
  })

  if (recentSnaps.length === 0) {
    findings.push({
      signal_id: 'archive.site_alive',
      source_agent: 'archivist',
      value: null,
      delta: null,
      direction: 'neutral',
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: 'No archived snapshots found in the last 180 days — site status unknown',
      as_of: asOf,
    })
  } else if (recentSnaps.some(is2xxNonRedirect)) {
    findings.push({
      signal_id: 'archive.site_alive',
      source_agent: 'archivist',
      value: true,
      delta: null,
      direction: 'survival_positive',
      confidence: 0.6,
      provenance_tier: TIER,
      plain_english: 'Recent archived snapshots confirm the site is live and returning 2xx responses',
      as_of: asOf,
    })
  } else if (recentSnaps.every(isErrorOrRedirect)) {
    findings.push({
      signal_id: 'archive.site_alive',
      source_agent: 'archivist',
      value: false,
      delta: null,
      direction: 'survival_negative',
      confidence: 0.8,
      provenance_tier: TIER,
      plain_english: 'Recent archived snapshots show only error or redirect responses — site may be down',
      as_of: asOf,
    })
  } else {
    // Recent snapshots exist but none qualify as 2xx-alive or error/redirect
    // (e.g. all have statusCode: null) — status unknown, emit neutral.
    findings.push({
      signal_id: 'archive.site_alive',
      source_agent: 'archivist',
      value: null,
      delta: null,
      direction: 'neutral',
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: 'Recent archived snapshots have no readable status codes — site status unknown',
      as_of: asOf,
    })
  }

  // ─── archive.longevity ────────────────────────────────────────────────────
  // Years between earliest snapshot and asOf: >=5 positive; else neutral.
  // Emits only when there is at least one snapshot.
  if (snapshots.length > 0) {
    const earliestMs = Math.min(
      ...snapshots.map((s) => parseWaybackTimestamp(s.timestamp).getTime()),
    )
    const years = (asOfMs - earliestMs) / MS_PER_YEAR
    const roundedYears = Math.floor(years * 10) / 10

    findings.push({
      signal_id: 'archive.longevity',
      source_agent: 'archivist',
      value: roundedYears,
      delta: null,
      direction: roundedYears >= 5 ? 'survival_positive' : 'neutral',
      confidence: 0.5,
      provenance_tier: TIER,
      plain_english:
        roundedYears >= 5
          ? `Site has been archived for ${roundedYears.toFixed(1)} years — long-standing web presence`
          : `Site has been archived for ${roundedYears.toFixed(1)} years — relatively recent web presence`,
      as_of: asOf,
    })
  }

  // ─── archive.snapshot_cadence ─────────────────────────────────────────────
  // Count snapshots in last 365d vs prior 365d (before asOf).
  // If recent < 50% of prior (and prior > 0) → negative; else neutral.
  // Emits when there are any snapshots in either window.
  const recentWindowStart = asOfMs - 365 * MS_PER_DAY
  const priorWindowStart = asOfMs - 730 * MS_PER_DAY

  const recentCount = snapshots.filter((s) => {
    const tsMs = parseWaybackTimestamp(s.timestamp).getTime()
    return tsMs > recentWindowStart && tsMs <= asOfMs
  }).length

  const priorCount = snapshots.filter((s) => {
    const tsMs = parseWaybackTimestamp(s.timestamp).getTime()
    return tsMs > priorWindowStart && tsMs <= recentWindowStart
  }).length

  if (recentCount > 0 || priorCount > 0) {
    const isDrop = priorCount > 0 && recentCount < priorCount * 0.5
    findings.push({
      signal_id: 'archive.snapshot_cadence',
      source_agent: 'archivist',
      value: recentCount,
      delta: null,
      direction: isDrop ? 'survival_negative' : 'neutral',
      confidence: 0.4,
      provenance_tier: TIER,
      plain_english: isDrop
        ? `Archive activity dropped: ${recentCount} snapshots in the last year vs ${priorCount} in the prior year`
        : `Archive activity steady: ${recentCount} snapshots in the last year vs ${priorCount} in the prior year`,
      as_of: asOf,
    })
  }

  return findings
}
