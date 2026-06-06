import { describe, it, expect } from 'vitest'
import { mapArchivistDataset, buildArchivistInput } from './archivist'
import type { WaybackSnapshot } from './archivist'

const AS_OF = '2026-06-06T00:00:00.000Z'

// ─── archive.site_alive ───────────────────────────────────────────────────────

describe('mapArchivistDataset — archive.site_alive', () => {
  it('is survival_positive (value:true) when recent snapshots include a 2xx non-redirect', () => {
    // Within 180 days of 2026-06-06
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20260501120000', statusCode: 200, isRedirect: false },
      { timestamp: '20260401120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.site_alive',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value).toBe(true)
    expect(f!.confidence).toBe(0.6)
    expect(f!.provenance_tier).toBe('high')
    expect(f!.delta).toBeNull()
  })

  it('is survival_negative (value:false) when all recent snapshots are 4xx/5xx or redirects', () => {
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20260501120000', statusCode: 404, isRedirect: false },
      { timestamp: '20260401120000', statusCode: 503, isRedirect: false },
      { timestamp: '20260301120000', statusCode: 301, isRedirect: true },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.site_alive',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.value).toBe(false)
    expect(f!.confidence).toBe(0.8)
  })

  it('is neutral (value:null) when there are no snapshots within 180 days', () => {
    // All snapshots are older than 180 days before 2026-06-06
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20250101120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.site_alive',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBeNull()
    expect(f!.confidence).toBe(0.4)
  })

  it('is neutral when snapshot array is empty', () => {
    const f = mapArchivistDataset([], AS_OF).find(
      (x) => x.signal_id === 'archive.site_alive',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBeNull()
  })

  it('treats a redirect-only recent snapshot as not alive (survival_negative)', () => {
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20260501120000', statusCode: 301, isRedirect: true },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.site_alive',
    )

    expect(f!.direction).toBe('survival_negative')
    expect(f!.value).toBe(false)
  })
})

// ─── archive.longevity ────────────────────────────────────────────────────────

describe('mapArchivistDataset — archive.longevity', () => {
  it('is survival_positive when the earliest snapshot is 5+ years before asOf', () => {
    // Earliest: 2015-07-13, asOf 2026-06-06 → ~10.9 years
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20150713213037', statusCode: 200, isRedirect: false },
      { timestamp: '20260501120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.longevity',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.confidence).toBe(0.5)
    expect(f!.delta).toBeNull()
    expect(f!.value as number).toBeGreaterThanOrEqual(5)
  })

  it('is neutral when the earliest snapshot is less than 5 years before asOf', () => {
    // Earliest: 2024-01-01 → ~2.4 years
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20240101000000', statusCode: 200, isRedirect: false },
      { timestamp: '20260501120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.longevity',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value as number).toBeLessThan(5)
  })

  it('does not emit when there are no snapshots', () => {
    const f = mapArchivistDataset([], AS_OF).find(
      (x) => x.signal_id === 'archive.longevity',
    )
    expect(f).toBeUndefined()
  })
})

// ─── archive.snapshot_cadence ─────────────────────────────────────────────────

describe('mapArchivistDataset — archive.snapshot_cadence', () => {
  it('is survival_negative when recent 365d count is < 50% of prior 365d count', () => {
    // asOf = 2026-06-06
    // prior 365d window: 2024-06-07 .. 2025-06-06
    // recent 365d window: 2025-06-07 .. 2026-06-06
    // prior: 10 snapshots, recent: 4 snapshots (40% → negative)
    const priorSnapshots: WaybackSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: `202407${String(i + 1).padStart(2, '0')}120000`,
      statusCode: 200,
      isRedirect: false,
    }))
    const recentSnapshots: WaybackSnapshot[] = [
      { timestamp: '20251001120000', statusCode: 200, isRedirect: false },
      { timestamp: '20251101120000', statusCode: 200, isRedirect: false },
      { timestamp: '20260101120000', statusCode: 200, isRedirect: false },
      { timestamp: '20260301120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(
      [...priorSnapshots, ...recentSnapshots],
      AS_OF,
    ).find((x) => x.signal_id === 'archive.snapshot_cadence')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.confidence).toBe(0.4)
    expect(f!.delta).toBeNull()
    // value is the recent count
    expect(f!.value).toBe(4)
  })

  it('is neutral when recent count is >= 50% of prior count', () => {
    // prior: 4, recent: 4 (100% → neutral)
    const makeSnap = (ts: string): WaybackSnapshot => ({
      timestamp: ts,
      statusCode: 200,
      isRedirect: false,
    })
    const snapshots: WaybackSnapshot[] = [
      makeSnap('20240901120000'),
      makeSnap('20241101120000'),
      makeSnap('20250101120000'),
      makeSnap('20250301120000'),
      makeSnap('20250901120000'),
      makeSnap('20251101120000'),
      makeSnap('20260101120000'),
      makeSnap('20260301120000'),
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.snapshot_cadence',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
  })

  it('is neutral when prior count is zero (no prior data to compare against)', () => {
    // All snapshots are in the recent window only
    const snapshots: WaybackSnapshot[] = [
      { timestamp: '20260101120000', statusCode: 200, isRedirect: false },
      { timestamp: '20260301120000', statusCode: 200, isRedirect: false },
    ]

    const f = mapArchivistDataset(snapshots, AS_OF).find(
      (x) => x.signal_id === 'archive.snapshot_cadence',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
  })
})

// ─── buildArchivistInput ──────────────────────────────────────────────────────

describe('buildArchivistInput', () => {
  it('builds an actor input targeting the company domain', () => {
    const input = buildArchivistInput('acme.com')
    expect(input.url).toContain('acme.com')
  })

  it('strips the https:// prefix before reconstructing the URL', () => {
    const input = buildArchivistInput('https://notion.so')
    expect(input.url).toBe('https://notion.so')
  })
})
