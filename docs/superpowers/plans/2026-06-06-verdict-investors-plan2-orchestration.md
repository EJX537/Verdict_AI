# Verdict for Investors — Plan 2: InsForge + Orchestration (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans.

**Goal:** Persist theses + deals in InsForge, run the Plan 1 diligence pipeline as a durable async stage machine that streams progress to InsForge realtime, exposed via Next API routes. **Backend only — UI/subscribe side is Plan 3.**

**Architecture:** Next API routes hold secrets and orchestrate. InsForge (project **The Verdict**, org **Verdict AI**, host `hc6882dz.us-east.insforge.app`) stores theses/deals/apify_runs/outreach and publishes realtime events on deal stage changes via a DB trigger. The orchestrator reuses Plan 1's `lib/verdict` compute (`fetchMoney/People/Press/Archive`, `scoreVerdict`, OpenAI prose, `scoreThesisFit`) step-by-step, persisting each stage transition. Background work runs via Next's `after()` so the POST returns immediately.

**Tech Stack:** `@insforge/sdk`, InsForge Postgres + realtime, Next 16 route handlers + `after()`, Vitest.

**Stage machine (deal.stage_status):** `queued → sourcing → profiling → scoring → ready` (+ `error`). Outreach stages (`drafted → sent`) are Plan 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `insforge/migrations/*_plan2_schema.sql` | Tables, indexes, updated_at + realtime triggers, channel pattern |
| `lib/insforge/server.ts` | Server InsForge client (admin key, server-only) |
| `lib/insforge/client.ts` | Browser InsForge client (anon key) — for Plan 3 realtime subscribe |
| `lib/verdict/store.ts` | Typed CRUD over theses/deals/apify_runs/outreach |
| `lib/verdict/orchestrator.ts` | `orchestrateDeal(dealId, thesis, deps)` stage machine |
| `app/api/theses/route.ts` | POST create thesis |
| `app/api/deals/route.ts` | POST create deal + kick orchestration; GET list |
| `app/api/deals/[id]/route.ts` | GET one deal |

Secrets (`.env.local`, gitignored): `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `INSFORGE_API_KEY` (admin, server-only).

---

## Task 1 — Schema migration (applied via insforge-cli)

Tables: `theses`, `deals`, `apify_runs`, `outreach`. Realtime trigger publishes to channel `deal:{id}` on insert/update of `deals`. Channel pattern `deal:%` registered + enabled. RLS left disabled (single-VC v1; server uses admin key; anon may subscribe). Applied with `npx @insforge/cli db migrations new` + `... up`. Verified with `db tables`.

## Task 2 — InsForge clients
`lib/insforge/server.ts`: `createClient({ baseUrl: NEXT_PUBLIC_INSFORGE_URL, anonKey: INSFORGE_API_KEY })` — admin, server-only, never imported by client components. `lib/insforge/client.ts`: anon client for the browser (Plan 3). Each a thin singleton.

## Task 3 — Store (typed CRUD)
`lib/verdict/store.ts` exports an injectable `Store` interface + a `dbStore` impl backed by the server client:
- `createThesis(t): Promise<{ id: string }>`
- `getThesis(id): Promise<ThesisRow | null>`
- `createDeal(input): Promise<DealRow>` (stage_status 'queued')
- `getDeal(id)`, `listDeals()`
- `updateDealStage(id, stage, patch?)` — sets stage_status (+ optional fields), bumps updated_at via trigger
- `saveDealResult(id, { findings, verdict, founderSummary, thesisFit })`
- `failDeal(id, message)` — stage 'error' + stage_error
Inserts use array form per SDK. All return `{ data, error }` unwrapped; throw on error.

## Task 4 — Orchestrator (stage machine)
`lib/verdict/orchestrator.ts`:
```
orchestrateDeal(dealId, thesis, deps): Promise<void>
  try:
    updateDealStage(dealId, 'sourcing')
    findings = await all 4 fetch* (deps.sources)
    updateDealStage(dealId, 'profiling', { findings })
    core = scoreVerdict(findings, { weights: thesis.signalWeights })
    updateDealStage(dealId, 'scoring')
    counterfactual + founderSummary via deps.caller
    thesisFit = scoreThesisFit(core, candidate, thesis)
    saveDealResult(dealId, { findings, verdict:{...core,counterfactual}, founderSummary, thesisFit })
    updateDealStage(dealId, 'ready')
  catch e: failDeal(dealId, message)
```
Deps injected (store + source fetchers + caller + candidate/companyUrl from the deal) so it unit-tests offline.

## Task 5 — API routes
- `POST /api/theses` → `createThesis`, 201 `{ id }`.
- `POST /api/deals` → validate body `{ thesisId, company, companyUrl, candidate }`; `createDeal`; schedule `after(() => orchestrateDeal(...))`; 202 `{ dealId }`.
- `GET /api/deals` → `listDeals`. `GET /api/deals/[id]` → `getDeal` (404 if absent).
Routes import only the **server** client. Use `export const runtime = 'nodejs'`.

## Task 6 — Tests
- `orchestrator.test.ts`: inject a fake store (records stage transitions) + fake sources + fake caller; assert the stage sequence `sourcing→profiling→scoring→ready`, that `saveDealResult` got a verdict with counterfactual + a thesisFit, and that a throwing source drives `failDeal`/`error`.
- `store.test.ts`: light — mock the server client's `database.from().insert/select/update` chain; assert correct table + payload shape + error propagation.
- Route handlers: a smoke test that `POST /api/deals` returns 202 with a dealId using injected/mocked store + a no-op orchestrator.

## Task 7 — Live smoke (costs credits)
Create a thesis + deal against real InsForge, let orchestration run (real Apify+OpenAI), poll `GET /api/deals/[id]` until `ready`, confirm persisted verdict + thesis_fit and that a realtime event fired (check `realtime` or rely on the trigger). Use a clean-slug company (e.g. Stripe).

## Risks / notes
- **Prod durability:** `after()` runs post-response in the same invocation; fine for `next dev` and Vercel within function limits, but a multi-minute Apify run may exceed serverless limits. v1 accepts this; a durable queue / InsForge scheduled poller is a Plan 2.5 follow-up.
- **No auth (v1):** server uses admin key; anon may read/subscribe. Per-VC isolation + RLS is a later milestone. The share-image endpoint auth gap (Plan 1) is the same theme.
- **Realtime confirmed** available on backend 1.0.0 (`realtime.publish` + `realtime.channels` present).
