# Verdict for Investors — Plan 1: Backend Diligence Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given a seed company + a VC thesis, fetch real evidence via Apify, produce a deterministic `Verdict`, add OpenAI-written prose, and compute a thesis-fit deal score — all as plain async functions with unit tests.

**Architecture:** Pure compute + thin, injectable network clients. No InsForge, no Next API routes, no UI (those are Plans 2 and 3). Existing adapters in `lib/verdict/adapters/` are reused unchanged; this plan adds the runner, scoring agent, prose generation, thesis-fit, and a top-level `profileCompany` orchestrator. Network clients (Apify, OpenAI) are passed in as injectable dependencies so every unit test runs offline against fixtures.

**Tech Stack:** TypeScript, Vitest (already configured), `apify-client`, `openai`. Node `process.env` for secrets (`APIFY_TOKEN`, `OPENAI_API_KEY` — already in `.env.local`).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/verdict/apify.ts` | Wrap `apify-client`: run an actor, return dataset items. Exposes injectable `ActorRunner`. |
| `lib/verdict/sources.ts` | Per-agent fetch+normalize+map glue → `Finding[]`. Holds actor IDs. |
| `lib/verdict/cases.ts` | Static case library (dead + living companies) for twin-matching. |
| `lib/verdict/scoring.ts` | Deterministic scoring agent: `Finding[]` → `VerdictCore` (everything except counterfactual). |
| `lib/verdict/openai.ts` | Injectable `ChatCaller` + `writeCounterfactual`, `writeFounderSummary`. |
| `lib/verdict/thesis-fit.ts` | `Thesis` type + `scoreThesisFit` → deal score + rationale. |
| `lib/verdict/profile.ts` | `profileCompany(company, thesis)` orchestrator → `DealProfile`. |
| `lib/verdict/fixtures/*.json` | Pinned real actor outputs (one sample per source), captured during execution. |

All test files sit beside their module as `*.test.ts` (matches existing `adapters/*.test.ts` convention).

---

## Task 1: Apify client wrapper

**Files:**
- Create: `lib/verdict/apify.ts`
- Test: `lib/verdict/apify.test.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
pnpm add apify-client openai
```
Expected: both added to `package.json` dependencies, no errors.

- [ ] **Step 2: Write the failing test**

`lib/verdict/apify.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { makeRunner } from './apify'

describe('makeRunner', () => {
  it('calls the actor with input and returns dataset items', async () => {
    const listItems = vi.fn().mockResolvedValue({ items: [{ a: 1 }, { a: 2 }] })
    const dataset = vi.fn().mockReturnValue({ listItems })
    const call = vi.fn().mockResolvedValue({ defaultDatasetId: 'ds1' })
    const actor = vi.fn().mockReturnValue({ call })
    const fakeClient = { actor, dataset } as unknown as import('apify-client').ApifyClient

    const run = makeRunner(fakeClient)
    const items = await run('user/actor', { query: 'Acme' })

    expect(actor).toHaveBeenCalledWith('user/actor')
    expect(call).toHaveBeenCalledWith({ query: 'Acme' })
    expect(dataset).toHaveBeenCalledWith('ds1')
    expect(items).toEqual([{ a: 1 }, { a: 2 }])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/apify.test.ts`
Expected: FAIL — `makeRunner` not exported.

- [ ] **Step 4: Write minimal implementation**

`lib/verdict/apify.ts`:
```typescript
import { ApifyClient } from 'apify-client'

// A runner takes an actor id + input and returns raw dataset items.
// Injectable so callers (and tests) can swap the real network for fixtures.
export type ActorRunner = (
  actorId: string,
  input: Record<string, unknown>,
) => Promise<unknown[]>

// Build a runner backed by a concrete ApifyClient.
export function makeRunner(client: ApifyClient): ActorRunner {
  return async (actorId, input) => {
    const run = await client.actor(actorId).call(input)
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    return items
  }
}

// Default runner using APIFY_TOKEN from the environment.
export const apifyRunner: ActorRunner = (actorId, input) =>
  makeRunner(new ApifyClient({ token: process.env.APIFY_TOKEN }))(actorId, input)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/apify.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/verdict/apify.ts lib/verdict/apify.test.ts
git commit -m "feat(verdict): add injectable Apify actor runner"
```

---

## Task 2: Pin real actor output fixtures

Real actor outputs differ from the clean adapter interfaces. Capture one real sample per actor so the normalizers in Task 3 are written against true shapes, not guesses. This task costs Apify credits and takes several minutes per actor.

**Files:**
- Create: `scripts/capture-fixtures.ts`
- Create: `lib/verdict/fixtures/{crunchbase,linkedin,googlenews,prnewswire,wayback}.sample.json`

- [ ] **Step 1: Write the capture script**

`scripts/capture-fixtures.ts`:
```typescript
import { writeFileSync, mkdirSync } from 'node:fs'
import { apifyRunner } from '../lib/verdict/apify'
import {
  buildMoneyInput,
} from '../lib/verdict/adapters/money'
import { buildPeopleInput } from '../lib/verdict/adapters/people'
import { buildNewsInput, buildPrNewswireInput } from '../lib/verdict/adapters/press'
import { buildArchivistInput } from '../lib/verdict/adapters/archivist'

const COMPANY = process.argv[2] ?? 'Notion'
const DIR = 'lib/verdict/fixtures'
mkdirSync(DIR, { recursive: true })

async function capture(name: string, actorId: string, input: Record<string, unknown>) {
  console.log(`[${name}] running ${actorId} ...`)
  const items = await apifyRunner(actorId, input)
  writeFileSync(`${DIR}/${name}.sample.json`, JSON.stringify(items.slice(0, 50), null, 2))
  console.log(`[${name}] wrote ${items.length} items (capped 50)`)
}

await capture('crunchbase', 'davidsharadbhatt/crunchbase-company-scraper', buildMoneyInput(COMPANY) as unknown as Record<string, unknown>)
await capture('linkedin', 'harvestapi/linkedin-company-employees', buildPeopleInput(COMPANY) as unknown as Record<string, unknown>)
await capture('googlenews', 'data_xplorer/google-news-scraper-fast', buildNewsInput(COMPANY) as unknown as Record<string, unknown>)
await capture('prnewswire', 'parseforge/pr-newswire-scraper', buildPrNewswireInput(COMPANY) as unknown as Record<string, unknown>)
await capture('wayback', 'ryanclinton/wayback-machine-search', buildArchivistInput('https://notion.so') as unknown as Record<string, unknown>)
```

- [ ] **Step 2: Run the capture**

Run: `pnpm dlx tsx scripts/capture-fixtures.ts Notion`
Expected: five `*.sample.json` files written under `lib/verdict/fixtures/`. Open each and confirm it contains real data.

> If an actor's input field names differ from the adapter's `build*Input`, fix the `build*Input` function in the relevant adapter file to match the actor's documented input schema, then re-run. Note the corrected field names — Task 3 depends on them.

- [ ] **Step 3: Commit fixtures**

```bash
git add scripts/capture-fixtures.ts lib/verdict/fixtures/
git commit -m "chore(verdict): pin real actor output fixtures"
```

---

## Task 3: Source fetchers (normalize raw → Finding[])

For each source, normalize the captured raw shape into the adapter's input interface, then call the existing mapper. Field accessors below assume common shapes; **adjust each normalizer to match the fixture captured in Task 2** before writing its test assertions.

**Files:**
- Create: `lib/verdict/sources.ts`
- Test: `lib/verdict/sources.test.ts`

- [ ] **Step 1: Write the failing test (fixture-driven)**

`lib/verdict/sources.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { fetchMoney, fetchPeople, fetchPress, fetchArchive } from './sources'
import type { ActorRunner } from './apify'
import crunchbase from './fixtures/crunchbase.sample.json'
import linkedin from './fixtures/linkedin.sample.json'
import googlenews from './fixtures/googlenews.sample.json'
import prnewswire from './fixtures/prnewswire.sample.json'
import wayback from './fixtures/wayback.sample.json'

const ASOF = '2026-06-06T00:00:00.000Z'

function runnerFor(byActor: Record<string, unknown[]>): ActorRunner {
  return async (actorId) => byActor[actorId] ?? []
}

describe('source fetchers', () => {
  it('fetchMoney returns money_tracker findings', async () => {
    const run = runnerFor({ 'davidsharadbhatt/crunchbase-company-scraper': crunchbase })
    const findings = await fetchMoney('Notion', ASOF, run)
    expect(Array.isArray(findings)).toBe(true)
    expect(findings.every((f) => f.source_agent === 'money_tracker')).toBe(true)
  })

  it('fetchPeople returns people_watcher findings', async () => {
    const run = runnerFor({ 'harvestapi/linkedin-company-employees': linkedin })
    const findings = await fetchPeople('Notion', ASOF, run)
    expect(findings.every((f) => f.source_agent === 'people_watcher')).toBe(true)
  })

  it('fetchPress returns press_room findings', async () => {
    const run = runnerFor({
      'data_xplorer/google-news-scraper-fast': googlenews,
      'parseforge/pr-newswire-scraper': prnewswire,
    })
    const findings = await fetchPress('Notion', ASOF, run)
    expect(findings.every((f) => f.source_agent === 'press_room')).toBe(true)
  })

  it('fetchArchive returns archivist findings', async () => {
    const run = runnerFor({ 'ryanclinton/wayback-machine-search': wayback })
    const findings = await fetchArchive('https://notion.so', ASOF, run)
    expect(findings.every((f) => f.source_agent === 'archivist')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/sources.test.ts`
Expected: FAIL — `./sources` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/sources.ts`:
```typescript
import type { Finding } from './types'
import { apifyRunner, type ActorRunner } from './apify'
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
} from './adapters/press'
import {
  buildArchivistInput,
  mapArchivistDataset,
  type WaybackChangeEvent,
} from './adapters/archivist'

export const ACTORS = {
  money: 'davidsharadbhatt/crunchbase-company-scraper',
  people: 'harvestapi/linkedin-company-employees',
  news: 'data_xplorer/google-news-scraper-fast',
  pr: 'parseforge/pr-newswire-scraper',
  archive: 'ryanclinton/wayback-machine-search',
} as const

// --- Normalizers: raw actor row -> adapter interface. ---
// ADJUST field accessors to match the Task 2 fixtures.

function toCrunchbaseCompany(rows: unknown[]): CrunchbaseCompany {
  const r = (rows[0] ?? {}) as Record<string, any>
  return {
    name: r.name ?? r.company_name ?? '',
    operating_status: r.operating_status ?? r.status,
    funding_rounds: (r.funding_rounds ?? r.fundingRounds ?? []).map((fr: any) => ({
      announced_on: fr.announced_on ?? fr.announcedOn ?? fr.date,
      series: fr.series ?? fr.round ?? '',
      money_raised: fr.money_raised ?? fr.amount,
      investors: (fr.investors ?? []).map((i: any) => ({
        name: typeof i === 'string' ? i : i.name ?? '',
      })),
    })),
  }
}

function toEmployees(rows: unknown[]): LinkedInEmployee[] {
  return (rows as Record<string, any>[]).map((r) => ({
    name: r.name ?? r.fullName ?? '',
    title: r.title ?? r.position ?? '',
    profileUrl: r.profileUrl ?? r.url ?? r.linkedinUrl ?? '',
    isCurrent: r.isCurrent ?? true,
    isFounder: /founder/i.test(r.title ?? r.position ?? ''),
    location: r.location,
  }))
}

function toNews(rows: unknown[]): GoogleNewsItem[] {
  return (rows as Record<string, any>[]).map((r) => ({
    title: r.title ?? '',
    source: r.source ?? r.publisher ?? '',
    url: r.url ?? r.link ?? '',
    publishedAt: r.publishedAt ?? r.date ?? r.published ?? '',
  }))
}

function toPr(rows: unknown[]): PRNewswireItem[] {
  return (rows as Record<string, any>[]).map((r) => ({
    title: r.title ?? '',
    company: r.company ?? '',
    url: r.url ?? r.link ?? '',
    publishedAt: r.publishedAt ?? r.date ?? '',
    body: r.body ?? r.text,
  }))
}

function toWayback(rows: unknown[]): WaybackChangeEvent[] {
  return (rows as Record<string, any>[]).map((r) => ({
    timestamp: r.timestamp ?? r.snapshotDate ?? '',
    url: r.url ?? r.original ?? '',
    category: r.category ?? 'layout',
    change_type: r.change_type ?? 'modified',
    diff: r.diff ?? r.summary ?? '',
  }))
}

export async function fetchMoney(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const rows = await run(ACTORS.money, buildMoneyInput(company) as unknown as Record<string, unknown>)
  return mapMoneyDataset(toCrunchbaseCompany(rows), asOf)
}

export async function fetchPeople(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const rows = await run(ACTORS.people, buildPeopleInput(company) as unknown as Record<string, unknown>)
  return mapPeopleDataset(toEmployees(rows), asOf)
}

export async function fetchPress(
  company: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const [news, pr] = await Promise.all([
    run(ACTORS.news, buildNewsInput(company) as unknown as Record<string, unknown>),
    run(ACTORS.pr, buildPrNewswireInput(company) as unknown as Record<string, unknown>),
  ])
  return mapPressDataset({ news: toNews(news), pr: toPr(pr) }, asOf)
}

export async function fetchArchive(
  companyUrl: string,
  asOf: string,
  run: ActorRunner = apifyRunner,
): Promise<Finding[]> {
  const rows = await run(ACTORS.archive, buildArchivistInput(companyUrl) as unknown as Record<string, unknown>)
  return mapArchivistDataset(toWayback(rows), asOf)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/sources.test.ts`
Expected: PASS. If a normalizer produces zero findings because a field name is wrong, fix the accessor to match the fixture and re-run.

- [ ] **Step 5: Commit**

```bash
git add lib/verdict/sources.ts lib/verdict/sources.test.ts
git commit -m "feat(verdict): add Apify source fetchers wiring adapters to real actors"
```

---

## Task 4: Case library

**Files:**
- Create: `lib/verdict/cases.ts`
- Test: `lib/verdict/cases.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/verdict/cases.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { CASES } from './cases'

describe('CASES', () => {
  it('has both dead and living companies', () => {
    expect(CASES.some((c) => !c.alive)).toBe(true)
    expect(CASES.some((c) => c.alive)).toBe(true)
  })
  it('every case has a 0..10 score and signal ids', () => {
    for (const c of CASES) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(10)
      expect(c.signals.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/cases.test.ts`
Expected: FAIL — `./cases` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/cases.ts`:
```typescript
// Static reference cases for twin-matching. Signals are representative
// signal_ids the company strongly exhibited. Scores on the 0..10 Verdict scale.
export interface CaseCompany {
  company: string
  alive: boolean
  score: number
  signals: string[]
}

export const CASES: CaseCompany[] = [
  // Dead
  { company: 'Theranos', alive: false, score: 0.4, signals: ['archive.messaging_shift', 'people.exec_departure', 'press.organic_ratio'] },
  { company: 'Quibi', alive: false, score: 2.2, signals: ['archive.scope_shift', 'press.volume_trend', 'money.round_gap'] },
  { company: 'WeWork', alive: false, score: 1.8, signals: ['money.investor_tier', 'people.exec_departure', 'money.round_gap'] },
  { company: 'Fast', alive: false, score: 1.1, signals: ['money.round_gap', 'people.exec_departure', 'archive.pricing_vanished'] },
  // Living
  { company: 'Stripe', alive: true, score: 8.8, signals: ['money.investor_tier', 'people.founder_status', 'press.volume_trend'] },
  { company: 'Figma', alive: true, score: 9.1, signals: ['money.investor_tier', 'press.organic_ratio', 'people.backfill'] },
  { company: 'Notion', alive: true, score: 7.6, signals: ['people.founder_status', 'press.organic_ratio', 'press.last_unprompted'] },
  { company: 'Brex', alive: true, score: 7.2, signals: ['money.investor_tier', 'people.backfill', 'press.volume_trend'] },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/cases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/verdict/cases.ts lib/verdict/cases.test.ts
git commit -m "feat(verdict): add reference case library for twin-matching"
```

---

## Task 5: Scoring agent

Deterministic fusion of `Finding[]` into a `VerdictCore` (every `Verdict` field except `counterfactual`).

**Files:**
- Create: `lib/verdict/scoring.ts`
- Test: `lib/verdict/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/verdict/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { scoreVerdict, AGENT_OF } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'

function f(partial: Partial<Finding> & Pick<Finding, 'signal_id' | 'source_agent' | 'direction'>): Finding {
  return {
    value: null,
    delta: null,
    confidence: 0.5,
    provenance_tier: 'medium',
    plain_english: '',
    as_of: ASOF,
    ...partial,
  }
}

describe('scoreVerdict', () => {
  it('returns neutral 5 per agent and overall when there are no findings', () => {
    const v = scoreVerdict([])
    expect(v.agent_scores).toEqual({ money: 5, people: 5, press: 5, archive: 5 })
    expect(v.overall_score).toBeCloseTo(5, 5)
  })

  it('positive findings raise an agent score, negative lower it', () => {
    const v = scoreVerdict([
      f({ signal_id: 'money.investor_tier', source_agent: 'money_tracker', direction: 'survival_positive', confidence: 1 }),
      f({ signal_id: 'people.exec_departure', source_agent: 'people_watcher', direction: 'survival_negative', confidence: 1 }),
    ])
    expect(v.agent_scores.money).toBeGreaterThan(5)
    expect(v.agent_scores.people).toBeLessThan(5)
  })

  it('weights shift the overall score toward the weighted agent', () => {
    const findings = [
      f({ signal_id: 'people.exec_departure', source_agent: 'people_watcher', direction: 'survival_negative', confidence: 1 }),
    ]
    const heavyPeople = scoreVerdict(findings, { weights: { money: 0, people: 1, press: 0, archive: 0 } })
    const heavyMoney = scoreVerdict(findings, { weights: { money: 1, people: 0, press: 0, archive: 0 } })
    expect(heavyPeople.overall_score).toBeLessThan(heavyMoney.overall_score)
  })

  it('fires a shutdown override and forces Deadpool', () => {
    const v = scoreVerdict([
      f({
        signal_id: 'archive.messaging_shift',
        source_agent: 'archivist',
        direction: 'survival_negative',
        confidence: 0.9,
        plain_english: 'Homepage replaced with a shutdown/acquisition notice: ...',
      }),
    ])
    expect(v.overrides_fired).toContain('archive.shutdown_notice')
    expect(v.zone).toBe('Deadpool')
    expect(v.overall_score).toBeLessThanOrEqual(1)
  })

  it('picks a closest dead and closest living twin', () => {
    const v = scoreVerdict([
      f({ signal_id: 'money.investor_tier', source_agent: 'money_tracker', direction: 'survival_positive', confidence: 1 }),
    ])
    expect(v.closest_dead.company).toBeTruthy()
    expect(v.closest_living.company).toBeTruthy()
    expect(AGENT_OF.money_tracker).toBe('money')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/scoring.test.ts`
Expected: FAIL — `./scoring` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/scoring.ts`:
```typescript
import type { Finding, Verdict, Zone, CaseMatch, SourceAgent } from './types'
import { CASES, type CaseCompany } from './cases'

// Everything in a Verdict except the LLM-written counterfactual.
export type VerdictCore = Omit<Verdict, 'counterfactual'>

export type AgentKey = 'money' | 'people' | 'press' | 'archive'

export const AGENT_OF: Record<SourceAgent, AgentKey> = {
  money_tracker: 'money',
  people_watcher: 'people',
  press_room: 'press',
  archivist: 'archive',
}

export interface ScoreOptions {
  weights?: Record<AgentKey, number>
}

const DEFAULT_WEIGHTS: Record<AgentKey, number> = { money: 1, people: 1, press: 1, archive: 1 }
const NEUTRAL = 5
const STEP = 2.5

const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, n))

function sign(d: Finding['direction']): number {
  if (d === 'survival_positive') return 1
  if (d === 'survival_negative') return -1
  return 0
}

function zoneFor(score: number): Zone {
  if (score < 2) return 'Deadpool'
  if (score < 4) return 'Distressed'
  if (score < 6) return 'Watch'
  if (score < 8) return 'Stable'
  return 'Thriving'
}

const SHUTDOWN_RE = /shut\s?down|acquisition|ceased|winding down|no longer operating/i

function agentScores(findings: Finding[]): Record<AgentKey, number> {
  const scores: Record<AgentKey, number> = { money: NEUTRAL, people: NEUTRAL, press: NEUTRAL, archive: NEUTRAL }
  for (const f of findings) {
    const key = AGENT_OF[f.source_agent]
    scores[key] = clamp(scores[key] + sign(f.direction) * f.confidence * STEP)
  }
  return scores
}

function matchTwin(findings: Finding[], overall: number, alive: boolean): CaseMatch {
  const present = new Set(findings.map((f) => f.signal_id))
  const pool = CASES.filter((c) => c.alive === alive)
  const scored = pool.map((c: CaseCompany) => {
    const shared = c.signals.filter((s) => present.has(s))
    // Lower distance = closer. Score gap dominates; shared signals pull closer.
    const distance = Math.abs(c.score - overall) - shared.length * 0.5
    return { c, shared, distance }
  })
  scored.sort((a, b) => a.distance - b.distance)
  const best = scored[0]
  return {
    company: best.c.company,
    distance: Number(best.distance.toFixed(2)),
    shared_signals: best.shared,
  }
}

export function scoreVerdict(findings: Finding[], opts: ScoreOptions = {}): VerdictCore {
  const weights = opts.weights ?? DEFAULT_WEIGHTS
  const scores = agentScores(findings)

  const keys: AgentKey[] = ['money', 'people', 'press', 'archive']
  const weightSum = keys.reduce((a, k) => a + weights[k], 0) || 1
  let overall = keys.reduce((a, k) => a + scores[k] * weights[k], 0) / weightSum

  // Overrides — hard survival-negative signals cap the score regardless of weights.
  const overrides_fired: string[] = []
  const shutdown = findings.find(
    (f) => f.signal_id === 'archive.messaging_shift' && SHUTDOWN_RE.test(f.plain_english),
  )
  if (shutdown) {
    overrides_fired.push('archive.shutdown_notice')
    overall = Math.min(overall, 1)
  }
  const dead = findings.find(
    (f) => f.signal_id === 'money.operating_status' && (f.value === 'closed' || f.value === 'acquired'),
  )
  if (dead) {
    overrides_fired.push('money.operating_status')
    overall = Math.min(overall, 1)
  }

  overall = clamp(overall)
  const confidences = findings.map((f) => f.confidence)
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.3

  return {
    overall_score: Number(overall.toFixed(2)),
    zone: zoneFor(overall),
    agent_scores: scores,
    overrides_fired,
    closest_dead: matchTwin(findings, overall, false),
    closest_living: matchTwin(findings, overall, true),
    confidence: Number(confidence.toFixed(2)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/scoring.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add lib/verdict/scoring.ts lib/verdict/scoring.test.ts
git commit -m "feat(verdict): add deterministic scoring agent"
```

---

## Task 6: OpenAI prose (counterfactual + founder summary)

**Files:**
- Create: `lib/verdict/openai.ts`
- Test: `lib/verdict/openai.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/verdict/openai.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { writeCounterfactual, writeFounderSummary, type ChatCaller } from './openai'
import { scoreVerdict } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const findings: Finding[] = [
  { signal_id: 'people.exec_departure', source_agent: 'people_watcher', value: null, delta: 1, direction: 'survival_negative', confidence: 0.5, provenance_tier: 'low', plain_english: 'CTO departed with no backfill', as_of: ASOF },
]

describe('openai prose', () => {
  it('writeCounterfactual passes findings to the caller and returns its text', async () => {
    const complete = vi.fn().mockResolvedValue('If the CTO had been retained...')
    const caller: ChatCaller = { complete }
    const core = scoreVerdict(findings)
    const out = await writeCounterfactual(findings, core, caller)
    expect(out).toBe('If the CTO had been retained...')
    const userPrompt = complete.mock.calls[0][1] as string
    expect(userPrompt).toContain('CTO departed with no backfill')
  })

  it('writeFounderSummary returns the caller text', async () => {
    const complete = vi.fn().mockResolvedValue('Founder-led, technical, second-time founder.')
    const caller: ChatCaller = { complete }
    const out = await writeFounderSummary(findings, caller)
    expect(out).toContain('Founder')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/openai.test.ts`
Expected: FAIL — `./openai` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/openai.ts`:
```typescript
import OpenAI from 'openai'
import type { Finding } from './types'
import type { VerdictCore } from './scoring'

// Injectable so unit tests never hit the network.
export interface ChatCaller {
  complete(system: string, user: string): Promise<string>
}

const MODEL = 'gpt-4o-mini'

export const openaiCaller: ChatCaller = {
  async complete(system, user) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  },
}

function findingsBlock(findings: Finding[]): string {
  return findings.map((f) => `- [${f.signal_id}] ${f.plain_english} (dir=${f.direction}, conf=${f.confidence})`).join('\n')
}

const GROUNDING = 'You are a startup diligence analyst. Use ONLY the findings provided. Do not invent facts, numbers, or events not present in the findings. Be concise and specific.'

export async function writeCounterfactual(
  findings: Finding[],
  core: VerdictCore,
  caller: ChatCaller = openaiCaller,
): Promise<string> {
  const user = [
    `Overall survival score: ${core.overall_score}/10 (zone: ${core.zone}).`,
    `Findings:`,
    findingsBlock(findings),
    '',
    'Write a 2-3 sentence counterfactual: the single highest-leverage intervention that would most improve this company\'s trajectory, grounded only in the findings above.',
  ].join('\n')
  return caller.complete(GROUNDING, user)
}

export async function writeFounderSummary(
  findings: Finding[],
  caller: ChatCaller = openaiCaller,
): Promise<string> {
  const user = [
    'Findings:',
    findingsBlock(findings),
    '',
    'Write a 1-2 sentence profile of the founding team and leadership, grounded only in the findings above. If founder signals are absent, say so plainly.',
  ].join('\n')
  return caller.complete(GROUNDING, user)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/openai.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/verdict/openai.ts lib/verdict/openai.test.ts
git commit -m "feat(verdict): add OpenAI counterfactual + founder summary (injectable caller)"
```

---

## Task 7: Thesis-fit scoring

**Files:**
- Create: `lib/verdict/thesis-fit.ts`
- Test: `lib/verdict/thesis-fit.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/verdict/thesis-fit.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { scoreThesisFit, type Thesis } from './thesis-fit'
import { scoreVerdict } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const thesis: Thesis = {
  sectors: ['fintech', 'saas'],
  stage: 'series_a',
  geo: ['us'],
  checkMin: 1_000_000,
  checkMax: 10_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}

const goodFindings: Finding[] = [
  { signal_id: 'money.investor_tier', source_agent: 'money_tracker', value: 'up', delta: 1, direction: 'survival_positive', confidence: 1, provenance_tier: 'low', plain_english: '', as_of: ASOF },
]

describe('scoreThesisFit', () => {
  it('returns a 0..100 deal score and a rationale', () => {
    const core = scoreVerdict(goodFindings, { weights: thesis.signalWeights })
    const fit = scoreThesisFit(core, { sector: 'fintech', stage: 'series_a', geo: 'us' }, thesis)
    expect(fit.deal_score).toBeGreaterThanOrEqual(0)
    expect(fit.deal_score).toBeLessThanOrEqual(100)
    expect(fit.rationale.length).toBeGreaterThan(0)
    expect(fit.thesis_match).toBeGreaterThan(0.5)
  })

  it('penalizes a sector/stage mismatch', () => {
    const core = scoreVerdict(goodFindings, { weights: thesis.signalWeights })
    const onThesis = scoreThesisFit(core, { sector: 'fintech', stage: 'series_a', geo: 'us' }, thesis)
    const offThesis = scoreThesisFit(core, { sector: 'biotech', stage: 'seed', geo: 'eu' }, thesis)
    expect(offThesis.deal_score).toBeLessThan(onThesis.deal_score)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/thesis-fit.test.ts`
Expected: FAIL — `./thesis-fit` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/thesis-fit.ts`:
```typescript
import type { VerdictCore, AgentKey } from './scoring'

export interface Thesis {
  sectors: string[]
  stage: string
  geo: string[]
  checkMin: number
  checkMax: number
  signalWeights: Record<AgentKey, number>
}

// What we know about the candidate company for matching.
export interface CandidateProfile {
  sector?: string
  stage?: string
  geo?: string
}

export interface ThesisFit {
  deal_score: number // 0..100
  survival_component: number // 0..10 (Verdict overall)
  thesis_match: number // 0..1
  rationale: string
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

export function scoreThesisFit(
  core: VerdictCore,
  candidate: CandidateProfile,
  thesis: Thesis,
): ThesisFit {
  const sectorHit = candidate.sector
    ? thesis.sectors.map(norm).includes(norm(candidate.sector))
    : false
  const stageHit = candidate.stage ? norm(candidate.stage) === norm(thesis.stage) : false
  const geoHit = candidate.geo ? thesis.geo.map(norm).includes(norm(candidate.geo)) : false

  // Weighted match: sector 0.5, stage 0.3, geo 0.2.
  const thesis_match = (sectorHit ? 0.5 : 0) + (stageHit ? 0.3 : 0) + (geoHit ? 0.2 : 0)

  // Deal score = survival (0..10 -> 0..100) blended with thesis match.
  const survival = core.overall_score * 10 // 0..100
  const deal_score = Math.round(survival * 0.6 + thesis_match * 100 * 0.4)

  const parts: string[] = []
  parts.push(`Survival ${core.overall_score}/10 (${core.zone}).`)
  parts.push(sectorHit ? 'Sector matches thesis.' : 'Sector off-thesis.')
  parts.push(stageHit ? 'Stage matches thesis.' : 'Stage off-thesis.')
  parts.push(geoHit ? 'Geo matches thesis.' : 'Geo off-thesis.')

  return {
    deal_score,
    survival_component: core.overall_score,
    thesis_match: Number(thesis_match.toFixed(2)),
    rationale: parts.join(' '),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/thesis-fit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/verdict/thesis-fit.ts lib/verdict/thesis-fit.test.ts
git commit -m "feat(verdict): add thesis-fit deal scoring"
```

---

## Task 8: Profile orchestrator

Ties the pieces together: fetch all sources → score → write prose → thesis-fit. Network deps are injected so the test runs offline.

**Files:**
- Create: `lib/verdict/profile.ts`
- Test: `lib/verdict/profile.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/verdict/profile.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { profileCompany, type ProfileDeps } from './profile'
import type { Thesis } from './thesis-fit'
import type { ChatCaller } from './openai'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const thesis: Thesis = {
  sectors: ['saas'], stage: 'series_a', geo: ['us'],
  checkMin: 1_000_000, checkMax: 10_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}

const finding = (signal_id: string, source_agent: Finding['source_agent'], direction: Finding['direction']): Finding => ({
  signal_id, source_agent, value: null, delta: null, direction,
  confidence: 0.6, provenance_tier: 'low', plain_english: `${signal_id} fired`, as_of: ASOF,
})

const caller: ChatCaller = { complete: async (_s, u) => (u.includes('counterfactual') ? 'CF text' : 'Founder text') }

const deps: ProfileDeps = {
  fetchMoney: async () => [finding('money.investor_tier', 'money_tracker', 'survival_positive')],
  fetchPeople: async () => [finding('people.founder_status', 'people_watcher', 'survival_positive')],
  fetchPress: async () => [finding('press.organic_ratio', 'press_room', 'survival_positive')],
  fetchArchive: async () => [],
  caller,
}

describe('profileCompany', () => {
  it('assembles a full DealProfile', async () => {
    const result = await profileCompany(
      { company: 'Acme', companyUrl: 'https://acme.com', candidate: { sector: 'saas', stage: 'series_a', geo: 'us' }, asOf: ASOF },
      thesis,
      deps,
    )
    expect(result.findings.length).toBe(3)
    expect(result.verdict.counterfactual).toBe('CF text')
    expect(result.founderSummary).toBe('Founder text')
    expect(result.thesisFit.deal_score).toBeGreaterThan(0)
    expect(result.verdict.zone).toBeTruthy()
  })
})
```

> The test relies on the user prompt for the counterfactual containing the word "counterfactual" — confirm the prompt in `openai.ts` Task 6 includes it (it does: "Write a 2-3 sentence counterfactual:").

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/verdict/profile.test.ts`
Expected: FAIL — `./profile` not found.

- [ ] **Step 3: Write the implementation**

`lib/verdict/profile.ts`:
```typescript
import type { Finding, Verdict } from './types'
import { scoreVerdict } from './scoring'
import { writeCounterfactual, writeFounderSummary, openaiCaller, type ChatCaller } from './openai'
import { scoreThesisFit, type Thesis, type ThesisFit, type CandidateProfile } from './thesis-fit'
import { fetchMoney, fetchPeople, fetchPress, fetchArchive } from './sources'

export interface ProfileInput {
  company: string
  companyUrl: string
  candidate: CandidateProfile
  asOf?: string
}

export interface ProfileDeps {
  fetchMoney: (company: string, asOf: string) => Promise<Finding[]>
  fetchPeople: (company: string, asOf: string) => Promise<Finding[]>
  fetchPress: (company: string, asOf: string) => Promise<Finding[]>
  fetchArchive: (companyUrl: string, asOf: string) => Promise<Finding[]>
  caller: ChatCaller
}

export interface DealProfile {
  company: string
  findings: Finding[]
  verdict: Verdict
  founderSummary: string
  thesisFit: ThesisFit
  asOf: string
}

const defaultDeps: ProfileDeps = {
  fetchMoney,
  fetchPeople,
  fetchPress,
  fetchArchive,
  caller: openaiCaller,
}

export async function profileCompany(
  input: ProfileInput,
  thesis: Thesis,
  deps: ProfileDeps = defaultDeps,
): Promise<DealProfile> {
  const asOf = input.asOf ?? new Date().toISOString()

  const [money, people, press, archive] = await Promise.all([
    deps.fetchMoney(input.company, asOf),
    deps.fetchPeople(input.company, asOf),
    deps.fetchPress(input.company, asOf),
    deps.fetchArchive(input.companyUrl, asOf),
  ])
  const findings = [...money, ...people, ...press, ...archive]

  const core = scoreVerdict(findings, { weights: thesis.signalWeights })
  const [counterfactual, founderSummary] = await Promise.all([
    writeCounterfactual(findings, core, deps.caller),
    writeFounderSummary(findings, deps.caller),
  ])

  const verdict: Verdict = { ...core, counterfactual }
  const thesisFit = scoreThesisFit(core, input.candidate, thesis)

  return { company: input.company, findings, verdict, founderSummary, thesisFit, asOf }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/verdict/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm vitest run`
Expected: all tests pass (existing adapter tests + the seven new modules).

- [ ] **Step 6: Commit**

```bash
git add lib/verdict/profile.ts lib/verdict/profile.test.ts
git commit -m "feat(verdict): add profileCompany orchestrator"
```

---

## Task 9: Live smoke check (manual, costs credits)

Confirms the whole core works against real Apify + OpenAI before Plan 2 wires it to InsForge.

**Files:**
- Create: `scripts/smoke-profile.ts`

- [ ] **Step 1: Write the smoke script**

`scripts/smoke-profile.ts`:
```typescript
import { profileCompany } from '../lib/verdict/profile'
import type { Thesis } from '../lib/verdict/thesis-fit'

const thesis: Thesis = {
  sectors: ['saas', 'productivity'],
  stage: 'series_c',
  geo: ['us'],
  checkMin: 5_000_000,
  checkMax: 50_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}

const result = await profileCompany(
  { company: 'Notion', companyUrl: 'https://notion.so', candidate: { sector: 'saas', stage: 'series_c', geo: 'us' } },
  thesis,
)
console.log(JSON.stringify(result, null, 2))
```

- [ ] **Step 2: Run the smoke check**

Run: `pnpm dlx tsx scripts/smoke-profile.ts`
Expected: a full `DealProfile` JSON — non-empty `findings`, a `verdict` with `zone` + `counterfactual`, a `founderSummary`, and a `thesisFit.deal_score`. If a source returns zero findings, revisit that source's normalizer in `sources.ts` against its fixture.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-profile.ts
git commit -m "chore(verdict): add live profile smoke script"
```

---

## Self-Review

**Spec coverage (Plan 1 portion):**
- Real-data profiling via Apify ✓ (Tasks 1–3)
- Existing 4 agents reused on real data ✓ (Task 3 calls existing mappers)
- Deterministic Verdict ✓ (Task 5)
- Founder folded into People Watcher ✓ (`people.founder_status` already in `adapters/people.ts`; founder summary in Task 6)
- OpenAI counterfactual + founder summary ✓ (Task 6)
- Thesis-fit deal score + rationale ✓ (Task 7)
- End-to-end orchestrator on real data ✓ (Tasks 8–9)

Out of Plan 1 scope (Plan 2/3): InsForge schema, stage machine, API routes, Apify webhook, realtime, all UI, outreach draft/send.

**Type consistency:** `VerdictCore = Omit<Verdict,'counterfactual'>` defined in `scoring.ts`; `profile.ts` adds `counterfactual` to build a full `Verdict`. `AgentKey`, `ActorRunner`, `ChatCaller`, `Thesis`, `ThesisFit`, `CandidateProfile`, `ProfileDeps`, `DealProfile` referenced consistently across tasks. `AGENT_OF` maps `SourceAgent` → `AgentKey`.

**Placeholder scan:** Source normalizers (Task 3) carry explicit "ADJUST to fixture" instructions backed by the Task 2 fixture-capture step — intentional, not a placeholder. No TBD/TODO left.
