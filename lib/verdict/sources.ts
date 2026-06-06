/**
 * sources.ts — Apify actor wiring for Verdict for Investors.
 *
 * Each fetcher:
 *   1. Builds the actor input via the corresponding adapter builder.
 *   2. Calls `run(actorId, input)` (defaults to the real apifyRunner).
 *   3. Normalises the raw dataset rows into the adapter's typed interface.
 *   4. Passes the normalized data to the adapter's map function.
 *   5. Returns Finding[].
 *
 * Normalizer functions are exported so tests can assert on them directly.
 */

import type { ActorRunner } from './apify'
import { apifyRunner } from './apify'
import type { Finding } from './types'

import {
  buildMoneyInput,
  mapMoneyDataset,
  type CrunchbaseCompany,
} from './adapters/money'

import {
  buildPeopleInput,
  mapPeopleDataset,
  type LinkedInEmployee,
} from './adapters/people'

import {
  buildNewsInput,
  buildPrNewswireInput,
  mapPressDataset,
  type GoogleNewsItem,
  type PRNewswireItem,
  type PressData,
} from './adapters/press'

import {
  buildArchivistInput,
  mapArchivistDataset,
  type WaybackSnapshot,
} from './adapters/archivist'

// ─── Actor IDs ────────────────────────────────────────────────────────────────

export const ACTORS = {
  money: 'davidsharadbhatt/crunchbase-company-scraper---no-api-limits',
  people: 'harvestapi/linkedin-company-employees',
  news: 'data_xplorer/google-news-scraper-fast',
  pr: 'parseforge/pr-newswire-scraper',
  archive: 'ryanclinton/wayback-machine-search',
} as const

// ─── Normalizers ─────────────────────────────────────────────────────────────

/**
 * Normalize a raw Crunchbase flat record (from the Apify actor) into
 * CrunchbaseCompany.  The actor emits human-readable string keys.
 *
 * Field-map corrections vs. spec (confirmed against crunchbase.sample.json):
 *   - lastFundingType  ← "Last Equity Funding Type"  (spec said same ✓)
 *   - lastFundingDate  ← "Last Funding Date"          (spec said same ✓)
 *   - totalFundingUsd  ← "Total Funding Amount (in USD)" — value is already a
 *     number in the fixture (343199697); kept safe parse for strings too.
 *   - topInvestors     ← "Top 5 Investors"  (comma-split)
 *   - leadInvestors    ← "Lead Investors"   (comma-split)
 */
export function normalizeCrunchbaseRecord(raw: Record<string, unknown>): CrunchbaseCompany {
  function str(key: string): string | undefined {
    const v = raw[key]
    if (v === null || v === undefined || v === '') return undefined
    return String(v)
  }

  function parseAmount(v: unknown): number | undefined {
    if (v === null || v === undefined || v === '') return undefined
    if (typeof v === 'number') return isNaN(v) ? undefined : v
    // Strip commas/$ from string representations
    const n = Number(String(v).replace(/[$,]/g, ''))
    return isNaN(n) ? undefined : n
  }

  function splitList(key: string): string[] {
    const v = raw[key]
    if (!v || typeof v !== 'string' || v.trim() === '') return []
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }

  return {
    name: str('Organization Name') ?? '',
    operatingStatus: str('Operating Status'),
    totalFundingUsd: parseAmount(raw['Total Funding Amount (in USD)']),
    lastFundingDate: str('Last Funding Date'),
    lastFundingType: str('Last Equity Funding Type'),
    foundedDate: str('Founded Date'),
    ipoStatus: str('IPO Status'),
    acquisitionStatus: str('Acquisition Status'),
    topInvestors: splitList('Top 5 Investors'),
    leadInvestors: splitList('Lead Investors'),
  }
}

/**
 * Normalize a raw LinkedIn employee row into LinkedInEmployee.
 *
 * Confirmed against linkedin.sample.json:
 *   - name       ← `${firstName} ${lastName}`.trim()
 *   - title      ← headline, else currentPosition[0].position, else ''
 *   - profileUrl ← linkedinUrl
 *   - isCurrent  ← Array.isArray(currentPosition) && currentPosition.length > 0
 *   - isFounder  ← /founder|co[-\s]?founder/i on title
 */
export function normalizeLinkedInRow(raw: Record<string, unknown>): LinkedInEmployee {
  const firstName = typeof raw.firstName === 'string' ? raw.firstName : ''
  const lastName = typeof raw.lastName === 'string' ? raw.lastName : ''
  const name = `${firstName} ${lastName}`.trim()

  const headline = typeof raw.headline === 'string' ? raw.headline : ''

  let posTitle = ''
  const cp = raw.currentPosition
  if (Array.isArray(cp) && cp.length > 0) {
    const first = cp[0] as Record<string, unknown>
    if (typeof first.position === 'string') posTitle = first.position
  }

  const title = headline || posTitle

  const profileUrl =
    typeof raw.linkedinUrl === 'string' ? raw.linkedinUrl : ''

  const isCurrent = Array.isArray(raw.currentPosition) && (raw.currentPosition as unknown[]).length > 0

  const isFounder = /founder|co[-\s]?founder/i.test(title)

  return { name, title, profileUrl, isCurrent, isFounder }
}

/**
 * Normalize a raw Google News row into GoogleNewsItem.
 *
 * Confirmed against googlenews.sample.json:
 *   - title       ← title
 *   - source      ← source (fixture uses "source"; "publisher" is fallback)
 *   - url         ← url (fixture uses "url"; "link" is fallback)
 *   - publishedAt ← publishedAt (fixture uses "publishedAt"; "date" is fallback)
 */
export function normalizeGoogleNewsRow(raw: Record<string, unknown>): GoogleNewsItem {
  function str(...keys: string[]): string {
    for (const k of keys) {
      const v = raw[k]
      if (typeof v === 'string' && v.trim() !== '') return v
    }
    return ''
  }
  return {
    title: str('title'),
    source: str('source', 'publisher'),
    url: str('url', 'link'),
    publishedAt: str('publishedAt', 'date'),
  }
}

/**
 * Normalize a raw PR Newswire row into PRNewswireItem.
 *
 * Confirmed against prnewswire.sample.json:
 *   - title       ← headline || title  (fixture has both; they are equal)
 *   - company     ← companyName || company  (fixture has "companyName")
 *   - url         ← url  (fixture has "url"; "link" is fallback)
 *   - publishedAt ← publishedDate || publishedAt  (fixture uses "publishedDate")
 *   - body        ← fullText || body  (fixture uses "fullText")
 */
export function normalizePRNewswireRow(raw: Record<string, unknown>): PRNewswireItem {
  function str(...keys: string[]): string {
    for (const k of keys) {
      const v = raw[k]
      if (typeof v === 'string' && v.trim() !== '') return v
    }
    return ''
  }
  function optStr(...keys: string[]): string | undefined {
    for (const k of keys) {
      const v = raw[k]
      if (typeof v === 'string' && v.trim() !== '') return v
    }
    return undefined
  }
  return {
    title: str('headline', 'title'),
    company: str('companyName', 'company'),
    url: str('url', 'link'),
    publishedAt: str('publishedDate', 'publishedAt'),
    body: optStr('fullText', 'body'),
  }
}

/**
 * Normalize a raw Wayback Machine row into WaybackSnapshot.
 * Only rows with recordType === 'snapshot' are kept (filter happens in fetchArchive).
 *
 * Confirmed against wayback.sample.json:
 *   - timestamp  ← timestamp  (e.g. "20150713213037")
 *   - statusCode ← parse statusCode string to number; null if absent/non-numeric/"-"
 *   - isRedirect ← Boolean(isRedirect)  (fixture stores actual booleans and null)
 *
 * Correction vs spec: the fixture statusCode is a string ("302", "200", "-"),
 * not already a number.  parseInt is applied with null-fallback.
 */
export function normalizeWaybackRow(raw: Record<string, unknown>): WaybackSnapshot {
  const timestamp = typeof raw.timestamp === 'string' ? raw.timestamp : ''

  let statusCode: number | null = null
  const rawStatus = raw.statusCode
  if (rawStatus !== null && rawStatus !== undefined) {
    const n = parseInt(String(rawStatus), 10)
    statusCode = isNaN(n) ? null : n
  }

  const isRedirect = Boolean(raw.isRedirect)

  return { timestamp, statusCode, isRedirect }
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/**
 * Fetch Crunchbase funding/status data for a company and map to Findings.
 * @param company  Crunchbase org URL, slug, or plain company name.
 * @param asOf     ISO timestamp for the "as of" field on each Finding.
 * @param run      Actor runner (defaults to apifyRunner).
 */
export async function fetchMoney(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const input = buildMoneyInput(company)
  const rows = await run(ACTORS.money, input as unknown as Record<string, unknown>)

  // The actor returns one row per company; take the first if multiple arrive.
  const raw = rows[0] as Record<string, unknown> | undefined
  if (!raw) return []

  const normalized = normalizeCrunchbaseRecord(raw)
  return mapMoneyDataset(normalized, asOf)
}

/**
 * Fetch LinkedIn employee data for a company and map to Findings.
 * @param company  Company name as it appears on LinkedIn.
 * @param asOf     ISO timestamp.
 * @param run      Actor runner (defaults to apifyRunner).
 */
export async function fetchPeople(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const input = buildPeopleInput(company)
  const rows = await run(ACTORS.people, input as unknown as Record<string, unknown>)

  const employees: LinkedInEmployee[] = (rows as Record<string, unknown>[]).map(
    normalizeLinkedInRow,
  )
  // Only pass employees that are currently active (isCurrent).
  const current = employees.filter((e) => e.isCurrent)
  return mapPeopleDataset(current, asOf)
}

/**
 * Fetch Google News + PR Newswire coverage for a company and map to Findings.
 * The two actor calls run in parallel.
 * @param company  Company name for keyword search.
 * @param asOf     ISO timestamp.
 * @param run      Actor runner (defaults to apifyRunner).
 */
export async function fetchPress(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const newsInput = buildNewsInput(company)
  const prInput = buildPrNewswireInput(company)

  const [newsRows, prRows] = await Promise.all([
    run(ACTORS.news, newsInput as unknown as Record<string, unknown>),
    run(ACTORS.pr, prInput as unknown as Record<string, unknown>),
  ])

  const news: GoogleNewsItem[] = (newsRows as Record<string, unknown>[]).map(
    normalizeGoogleNewsRow,
  )
  const pr: PRNewswireItem[] = (prRows as Record<string, unknown>[]).map(
    normalizePRNewswireRow,
  )

  const data: PressData = { news, pr }
  return mapPressDataset(data, asOf)
}

/**
 * Fetch Wayback Machine snapshots for a company URL and map to Findings.
 * @param companyUrl  The company's website URL or domain.
 * @param asOf        ISO timestamp.
 * @param run         Actor runner (defaults to apifyRunner).
 */
export async function fetchArchive(
  companyUrl: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const input = buildArchivistInput(companyUrl)
  const rows = await run(ACTORS.archive, input as unknown as Record<string, unknown>)

  // Only keep rows where recordType === 'snapshot'.
  const snapshots: WaybackSnapshot[] = (rows as Record<string, unknown>[])
    .filter((r) => r.recordType === 'snapshot')
    .map(normalizeWaybackRow)

  return mapArchivistDataset(snapshots, asOf)
}
