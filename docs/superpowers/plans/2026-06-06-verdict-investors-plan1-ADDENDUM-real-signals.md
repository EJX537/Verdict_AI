# Plan 1 Addendum — Real-Data Signal Set

> Supersedes the signal definitions assumed in the original Plan 1. The original
> adapters were written against fabricated actor shapes. After capturing real
> fixtures (Task 2), the signal set is redefined to what the real actors actually
> return. Approved by the user 2026-06-06.

All scores remain on the 0..10 Verdict scale. Each `Finding` keeps the existing
contract from `lib/verdict/types.ts` (`signal_id`, `source_agent`, `value`, `delta`,
`direction`, `confidence`, `provenance_tier`, `plain_english`, `as_of`).

`delta` is `null` for every v1 signal (no prior-run baseline in v1).

---

## money_tracker — actor `davidsharadbhatt/crunchbase-company-scraper---no-api-limits`

Real output: ONE flat record per company. No nested funding rounds. Investors are
comma-separated strings. Provenance tier: `low`.

Normalized interface (mapped from the flat record in `sources.ts`):
```typescript
export interface CrunchbaseCompany {
  name: string
  operatingStatus?: string      // "Operating Status"  e.g. "active" | "closed" | "acquired"
  totalFundingUsd?: number      // "Total Funding Amount (in USD)"
  lastFundingDate?: string      // "Last Funding Date" (parseable date)
  lastFundingType?: string      // "Last Equity Funding Type"
  topInvestors: string[]        // "Top 5 Investors" split on comma, trimmed
  leadInvestors: string[]       // "Lead Investors" split on comma, trimmed
  foundedDate?: string          // "Founded Date"
  ipoStatus?: string            // "IPO Status"
  acquisitionStatus?: string    // "Acquisition Status"
}
```

Signals (`mapMoneyDataset(company, asOf): Finding[]`):

| signal_id | logic | direction | confidence |
|---|---|---|---|
| `money.operating_status` | `closed`/`acquired` → negative; `active` → positive | neg / pos | 0.7 (closed/acq), 0.4 (active) |
| `money.funding_recency` | days since `lastFundingDate`: `>730` negative; `<=365` positive; else neutral | per rule | 0.5 |
| `money.investor_quality` | count of `TOP_TIER` substrings across `topInvestors ∪ leadInvestors`: `>=1` positive; `0` neutral | pos / neutral | 0.5 |
| `money.total_funding_tier` | `totalFundingUsd >= 50_000_000` positive; `< 2_000_000` negative; else neutral | per rule | 0.4 |

Reuse the existing `TOP_TIER` list from the current `money.ts`. Each signal only emits
when its source field is present.

---

## people_watcher — actor `harvestapi/linkedin-company-employees`

Real output: array of employee profiles, single snapshot, free tier caps ~25 rows.
No `isFounder`/`isCurrent` flags — derive them. Provenance tier: `low`.

Normalized interface (mapped in `sources.ts` from real fields
`firstName`,`lastName`,`headline`,`linkedinUrl`,`currentPosition[]`):
```typescript
export interface LinkedInEmployee {
  name: string         // `${firstName} ${lastName}`.trim()
  title: string        // headline, else currentPosition[0]?.position, else ''
  profileUrl: string   // linkedinUrl
  isCurrent: boolean   // currentPosition array non-empty
  isFounder: boolean   // /founder|co[-\s]?founder/i on title
}
```

Signals (`mapPeopleDataset(current, asOf): Finding[]` — single-snapshot only, no diff
signals in v1):

| signal_id | logic | direction | confidence |
|---|---|---|---|
| `people.founder_present` | any employee `isFounder && isCurrent` → positive; else neutral | pos / neutral | 0.5 |
| `people.leadership_visible` | count of current senior titles (reuse `SENIOR_RE`): `>=2` positive; `<2` neutral | pos / neutral | 0.4 |

Reuse the existing `SENIOR_RE` regex from the current `people.ts`. Remove the old
diff-based `people.exec_departure` / `people.backfill` signals and the
`PeopleMapOptions.previous` parameter (no baseline in v1).

---

## press_room — actors `data_xplorer/google-news-scraper-fast` + `parseforge/pr-newswire-scraper`

The press adapter logic (`mapPressDataset`) and its three signals
(`press.organic_ratio`, `press.last_unprompted`, `press.volume_trend`) are UNCHANGED.
Only the `sources.ts` normalizer changes to map real field names into the existing
`PressData` shape:
- Google News item → `{ title, source, url, publishedAt }` (real fields: `title`,
  `source`, `url`, `publishedAt`).
- PR Newswire item → `{ title, company, url, publishedAt, body }` mapping real
  `headline`→`title`, `companyName`→`company`, `publishedDate`→`publishedAt`,
  `fullText`→`body`.

No changes to `press.ts` itself.

---

## archivist — actor `ryanclinton/wayback-machine-search`

Real output: page snapshots, NOT content diffs. Fields: `timestamp`
(`"YYYYMMDDHHmmss"` string), `statusCode`, `mimeType`, `isRedirect`, `recordType`.
Provenance tier: `high` (archived facts are objective).

Normalized interface (mapped in `sources.ts`; keep only `recordType === 'snapshot'`):
```typescript
export interface WaybackSnapshot {
  timestamp: string          // "YYYYMMDDHHmmss"
  statusCode: number | null  // parse to number; null if absent
  isRedirect: boolean
}
```

Helper: parse `"YYYYMMDDHHmmss"` → `Date` (UTC).

Signals (`mapArchivistDataset(snapshots, asOf): Finding[]`):

| signal_id | logic | direction | confidence |
|---|---|---|---|
| `archive.site_alive` | among snapshots in the last 180d before `asOf`: if any exist and ALL are 4xx/5xx or redirects → negative + `value: false`; if recent 2xx exist → positive + `value: true`; if NO recent snapshots → neutral + `value: null` | per rule | 0.8 (dead), 0.6 (alive), 0.4 (unknown) |
| `archive.longevity` | years between earliest snapshot and `asOf`: `>=5` positive; `<1` neutral; else neutral | pos / neutral | 0.5 |
| `archive.snapshot_cadence` | snapshot count last 365d vs prior 365d: a drop to `< 50%` of prior → negative; else neutral | neg / neutral | 0.4 |

Remove the old `archive.pricing_vanished`, `archive.messaging_shift`,
`archive.scope_shift` signals and the `WaybackChangeEvent` interface.

---

## cases.ts — updated signal universe

`CASES[].signals` must reference only the new signal_ids above. Suggested mapping
(representative signals each archetype exhibits; keep both dead and living):
- Theranos (dead, 0.4): `archive.site_alive`, `people.founder_present`, `press.organic_ratio`
- Quibi (dead, 2.2): `money.funding_recency`, `press.volume_trend`, `archive.snapshot_cadence`
- WeWork (dead, 1.8): `money.investor_quality`, `money.operating_status`, `press.volume_trend`
- Fast (dead, 1.1): `archive.site_alive`, `money.funding_recency`, `people.leadership_visible`
- Stripe (living, 8.8): `money.investor_quality`, `money.total_funding_tier`, `people.founder_present`
- Figma (living, 9.1): `money.investor_quality`, `press.organic_ratio`, `archive.longevity`
- Notion (living, 7.6): `people.founder_present`, `press.last_unprompted`, `archive.longevity`
- Brex (living, 7.2): `money.investor_quality`, `people.leadership_visible`, `press.volume_trend`

---

## scoring.ts — updated overrides

Replace the `archive.messaging_shift` shutdown regex override with a `site_dead`
override. Keep the operating-status override.

```
overrides:
  - if a finding has signal_id === 'money.operating_status' and value is 'closed' or 'acquired'
      → push 'money.operating_status', cap overall <= 1
  - if a finding has signal_id === 'archive.site_alive' and value === false
      → push 'archive.site_dead', cap overall <= 1
```

`zoneFor`, `agentScores`, `matchTwin`, weighting, and `confidence` logic are
unchanged from the original Task 5 spec.
