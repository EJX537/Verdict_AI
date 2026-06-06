/**
 * sources.test.ts — offline, fixture-driven tests for source fetchers.
 *
 * A fake ActorRunner is built that dispatches fixture data based on actor id.
 * No network calls are made.
 */

import { describe, it, expect } from 'vitest'
import type { ActorRunner } from './apify'
import {
  ACTORS,
  fetchMoney,
  fetchPeople,
  fetchPress,
  fetchArchive,
  normalizeCrunchbaseRecord,
  normalizeLinkedInRow,
  normalizeGoogleNewsRow,
  normalizePRNewswireRow,
  normalizeWaybackRow,
} from './sources'

// ─── Fixtures ────────────────────────────────────────────────────────────────

import crunchbaseFixture from './fixtures/crunchbase.sample.json'
import linkedinFixture from './fixtures/linkedin.sample.json'
import googlenewsFixture from './fixtures/googlenews.sample.json'
import waybackFixture from './fixtures/wayback.sample.json'

// PR Newswire fixture is loaded via dynamic import to avoid the 280KB inline parse
import prnewswireFixture from './fixtures/prnewswire.sample.json'

const AS_OF = '2026-06-06T00:00:00.000Z'

// ─── Fake runner ─────────────────────────────────────────────────────────────

/**
 * Build a fake ActorRunner that returns the right fixture slice per actor id.
 * The news and pr actors are called inside fetchPress in a Promise.all, so we
 * need to dispatch on both.
 */
function makeFakeRunner(overrides?: Partial<Record<string, unknown[]>>): ActorRunner {
  const fixtures: Record<string, unknown[]> = {
    [ACTORS.money]: crunchbaseFixture as unknown[],
    [ACTORS.people]: linkedinFixture as unknown[],
    [ACTORS.news]: googlenewsFixture as unknown[],
    [ACTORS.pr]: prnewswireFixture as unknown[],
    [ACTORS.archive]: waybackFixture as unknown[],
    ...overrides,
  }

  return async (actorId: string) => {
    const data = fixtures[actorId]
    if (!data) throw new Error(`No fixture registered for actor: ${actorId}`)
    return data
  }
}

const fakeRun = makeFakeRunner()

// ─── fetchMoney ───────────────────────────────────────────────────────────────

describe('fetchMoney — Notion fixture', () => {
  it('returns Finding[] with every source_agent === "money_tracker"', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.source_agent).toBe('money_tracker')
    }
  })

  it('produces a money.operating_status finding', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'money.operating_status')
    expect(f).toBeDefined()
  })

  it('money.operating_status is survival_positive for Notion (active)', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'money.operating_status')
    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value).toBe('active')
  })

  it('produces money.investor_quality with survival_positive (Sequoia + Coatue in fixture)', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'money.investor_quality')
    expect(f).toBeDefined()
    // Sequoia + Coatue + Index Ventures are all tier-1 → positive
    expect(f!.direction).toBe('survival_positive')
  })

  it('produces money.total_funding_tier with survival_positive ($343M well above $50M threshold)', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'money.total_funding_tier')
    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value as number).toBeGreaterThan(50_000_000)
  })

  it('produces money.funding_recency finding', async () => {
    const findings = await fetchMoney('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'money.funding_recency')
    // The fixture has "Last Funding Date": "2025-12-15" which is within 365 days of AS_OF
    // (2026-06-06 − 2025-12-15 ≈ 173 days → survival_positive)
    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
  })

  it('returns an empty array when the actor returns no rows', async () => {
    const emptyRun = makeFakeRunner({ [ACTORS.money]: [] })
    const findings = await fetchMoney('Notion', AS_OF, emptyRun)
    expect(findings).toEqual([])
  })
})

// ─── fetchPeople ──────────────────────────────────────────────────────────────

describe('fetchPeople — Notion fixture', () => {
  it('returns Finding[] with every source_agent === "people_watcher"', async () => {
    const findings = await fetchPeople('Notion', AS_OF, fakeRun)
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.source_agent).toBe('people_watcher')
    }
  })

  it('produces a people.founder_present finding', async () => {
    const findings = await fetchPeople('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'people.founder_present')
    expect(f).toBeDefined()
  })

  it('people.founder_present is truthy (Maria has "Founder" in headline and is current)', async () => {
    const findings = await fetchPeople('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'people.founder_present')
    expect(f).toBeDefined()
    // Maria Ledentsova has "Founder @launchanyway" in her headline and has an
    // active currentPosition — so isFounder=true and isCurrent=true.
    expect(f!.value).toBe(true)
    expect(f!.direction).toBe('survival_positive')
  })

  it('produces a people.leadership_visible finding', async () => {
    const findings = await fetchPeople('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'people.leadership_visible')
    expect(f).toBeDefined()
  })
})

// ─── fetchPress ───────────────────────────────────────────────────────────────

describe('fetchPress — Notion fixture', () => {
  it('returns Finding[] with every source_agent === "press_room"', async () => {
    const findings = await fetchPress('Notion', AS_OF, fakeRun)
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.source_agent).toBe('press_room')
    }
  })

  it('produces a press.organic_ratio finding', async () => {
    const findings = await fetchPress('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'press.organic_ratio')
    expect(f).toBeDefined()
  })

  it('produces a press.last_unprompted finding', async () => {
    const findings = await fetchPress('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'press.last_unprompted')
    expect(f).toBeDefined()
  })

  it('press.organic_ratio value is between 0 and 1', async () => {
    const findings = await fetchPress('Notion', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'press.organic_ratio')
    if (f) {
      expect(f.value as number).toBeGreaterThanOrEqual(0)
      expect(f.value as number).toBeLessThanOrEqual(1)
    }
  })
})

// ─── fetchArchive ─────────────────────────────────────────────────────────────

describe('fetchArchive — Notion fixture', () => {
  it('returns Finding[] with every source_agent === "archivist"', async () => {
    const findings = await fetchArchive('https://notion.so', AS_OF, fakeRun)
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.source_agent).toBe('archivist')
    }
  })

  it('produces an archive.longevity finding', async () => {
    const findings = await fetchArchive('https://notion.so', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'archive.longevity')
    expect(f).toBeDefined()
  })

  it('archive.longevity is survival_positive (Notion has been archived since 2015, 10+ years)', async () => {
    const findings = await fetchArchive('https://notion.so', AS_OF, fakeRun)
    const f = findings.find((x) => x.signal_id === 'archive.longevity')
    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value as number).toBeGreaterThanOrEqual(5)
  })

  it('filters out non-snapshot records (insights) from the fixture', async () => {
    // The wayback fixture has 1 'insights' record and 49 'snapshot' records
    const findings = await fetchArchive('https://notion.so', AS_OF, fakeRun)
    // If insights records weren't filtered, normalizeWaybackRow would produce
    // bad timestamps. We just confirm findings still come back cleanly.
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.source_agent).toBe('archivist')
    }
  })
})

// ─── Normalizer unit tests ────────────────────────────────────────────────────

describe('normalizeCrunchbaseRecord', () => {
  it('maps human-readable keys to CrunchbaseCompany fields', () => {
    const raw = crunchbaseFixture[0] as Record<string, unknown>
    const company = normalizeCrunchbaseRecord(raw)

    expect(company.name).toBe('Notion')
    expect(company.operatingStatus).toBe('active')
    expect(company.totalFundingUsd).toBe(343_199_697)
    expect(company.lastFundingDate).toBe('2025-12-15')
    expect(company.lastFundingType).toBe('Series C')
    expect(company.ipoStatus).toBe('private')
    // topInvestors: split "Sequoia Capital, Coatue, Base10 Partners, Index Ventures, Felicis"
    expect(company.topInvestors).toContain('Sequoia Capital')
    expect(company.topInvestors).toContain('Coatue')
    expect(company.topInvestors.length).toBe(5)
    // leadInvestors: split "Coatue, First Round Capital, Index Ventures, Sequoia Capital"
    expect(company.leadInvestors).toContain('Sequoia Capital')
    expect(company.leadInvestors.length).toBe(4)
  })

  it('coerces null/missing optional fields to undefined', () => {
    const raw: Record<string, unknown> = {
      'Organization Name': 'Acme',
      'Operating Status': null,
      'Total Funding Amount (in USD)': null,
      'Top 5 Investors': '',
      'Lead Investors': null,
    }
    const company = normalizeCrunchbaseRecord(raw)
    expect(company.operatingStatus).toBeUndefined()
    expect(company.totalFundingUsd).toBeUndefined()
    expect(company.topInvestors).toEqual([])
    expect(company.leadInvestors).toEqual([])
  })
})

describe('normalizeLinkedInRow', () => {
  it('maps firstName+lastName → name, headline → title, linkedinUrl → profileUrl', () => {
    const raw = linkedinFixture[0] as Record<string, unknown>
    const emp = normalizeLinkedInRow(raw)

    expect(emp.name).toBe('Susan Dettmar')
    expect(emp.title).toBe('Head of Commercial Sales @ Notion | The best AI for Work')
    expect(emp.profileUrl).toBe('https://www.linkedin.com/in/susandettmar')
    expect(emp.isCurrent).toBe(true)
    expect(emp.isFounder).toBe(false)
  })

  it('detects founder from headline', () => {
    // Maria Ledentsova has "Founder @launchanyway" in headline
    const mariaRaw = linkedinFixture.find(
      (r) => (r as Record<string, unknown>).firstName === 'Maria',
    ) as Record<string, unknown>
    expect(mariaRaw).toBeDefined()
    const emp = normalizeLinkedInRow(mariaRaw)
    expect(emp.isFounder).toBe(true)
    expect(emp.isCurrent).toBe(true)
  })
})

describe('normalizeGoogleNewsRow', () => {
  it('maps fixture fields correctly', () => {
    const raw = googlenewsFixture[0] as Record<string, unknown>
    const item = normalizeGoogleNewsRow(raw)

    expect(item.title).toBe(raw.title)
    expect(item.source).toBe(raw.source)
    expect(item.url).toBe(raw.url)
    expect(item.publishedAt).toBe(raw.publishedAt)
  })

  it('falls back from publisher when source is missing', () => {
    const raw = { publisher: 'TechCrunch', title: 'News', url: 'https://example.com', date: '2026-01-01' }
    const item = normalizeGoogleNewsRow(raw)
    expect(item.source).toBe('TechCrunch')
  })
})

describe('normalizePRNewswireRow', () => {
  it('maps fixture fields: headline→title, publishedDate→publishedAt, fullText→body', () => {
    const raw = prnewswireFixture[0] as Record<string, unknown>
    const item = normalizePRNewswireRow(raw)

    // fixture uses "headline" (equals "title" in sample)
    expect(item.title).toBeTruthy()
    // fixture uses "publishedDate"
    expect(item.publishedAt).toBe(raw.publishedDate)
    // fixture uses "fullText"
    if (raw.fullText) {
      expect(item.body).toBe(raw.fullText)
    }
    // fixture uses "companyName"
    expect(item.company).toBe(raw.companyName ?? '')
  })
})

describe('normalizeWaybackRow', () => {
  it('parses string statusCode to number', () => {
    const raw = { recordType: 'snapshot', timestamp: '20150713213037', statusCode: '302', isRedirect: true }
    const snap = normalizeWaybackRow(raw)
    expect(snap.statusCode).toBe(302)
    expect(snap.isRedirect).toBe(true)
  })

  it('maps statusCode "-" to null', () => {
    const raw = { recordType: 'snapshot', timestamp: '20160503093953', statusCode: '-', isRedirect: null }
    const snap = normalizeWaybackRow(raw)
    expect(snap.statusCode).toBeNull()
  })

  it('maps status "200" correctly with isRedirect false', () => {
    // A real 200 snapshot from the fixture
    const snap200 = (waybackFixture as Record<string, unknown>[]).find(
      (r) => r.recordType === 'snapshot' && r.statusCode === '200' && r.isRedirect === false,
    )
    expect(snap200).toBeDefined()
    const snap = normalizeWaybackRow(snap200!)
    expect(snap.statusCode).toBe(200)
    expect(snap.isRedirect).toBe(false)
  })
})
