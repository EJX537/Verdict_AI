# Verdict for Investors — v1 Thin Slice Design

**Date:** 2026-06-06
**Status:** Approved (design); pending implementation plan

## Summary

Verdict AI today is a forensic startup-profiling engine: a user enters a company,
four data agents (Money Tracker, People Watcher, Press Room, Archivist) emit scored
`Finding[]`, and a Scoring Agent fuses them into a `Verdict` (0–10 score, zone,
closest dead/living twin, counterfactual). Logic lives in `lib/verdict/`; data is
currently mocked.

This project inverts Raisi.ai (a founder-side fundraising platform) to the
**investor/VC side**, using Verdict's engine as the diligence core. A VC defines an
investment thesis; an agent **sources** a startup, **profiles** it and its founder on
real data, **scores thesis-fit**, and **drafts + sends** a personalized founder
outreach.

v1 is a **thin full vertical slice**: one honest path through the entire loop, shallow
in breadth. It proves the whole mechanism end-to-end on real data before expanding any
single stage.

## Decisions (locked)

| Decision | Choice |
|---|---|
| v1 scope | Thin full vertical slice (thesis → 1 sourced startup → profiled → ranked → outreach sent) |
| Data | Real end-to-end |
| Sourcing + evidence | Apify actors |
| Generation (counterfactual, founder summary, outreach) | OpenAI API |
| Email | Draft + send |
| Persistence/backend | Next API routes (hold secrets) + InsForge (Postgres, realtime, functions, email) — project `dc475b6a-574e-43e8-a57b-c7ae26e311ea` |
| Orchestration | Approach B — async job + stage machine, InsForge realtime drives UI |
| Auth | Single VC, no login in v1 (multi-tenant is a fast-follow) |

## Stack

- **Frontend:** existing Next.js 16 / React 19 Verdict UI (reused).
- **Backend:** Next.js API routes hold all secrets and orchestrate; InsForge provides
  durable Postgres state, realtime subscriptions, and email send.
- **Core diligence logic:** `lib/verdict/` reused as-is. Existing adapters
  (`adapters/money.ts`, `people.ts`, `press.ts`, `archivist.ts`) already define input
  builders + dataset mappers; v1 wires them to real Apify actors.
- **Sourcing + evidence:** Apify actors.
- **Generation:** OpenAI API (server-side only).

## Architecture (Approach B — async job + realtime)

Apify scrapes take minutes, so the pipeline cannot run inside one held HTTP request.
Instead:

1. A Next API route creates a `deal` row in InsForge and kicks off Apify actor runs,
   storing run IDs.
2. Apify completion is handled via webhook (`/api/apify/webhook`) which advances the
   deal's stage and persists scraped datasets.
3. The Verdict adapters map datasets → `Finding[]`; deterministic scoring produces the
   `Verdict`; OpenAI writes the prose fields.
4. The UI subscribes to InsForge realtime on the `deals` row and recreates the live
   investigation-room experience (agent grid, signal graph, evidence feed) without
   holding a connection. State survives refresh.

**Stage machine (per deal):**
`queued → sourcing → profiling → scoring → ready → drafted → sent`

## The 5-step loop

1. **Thesis.** VC enters sectors, stage, geography, check size, and signal weights
   (which agents matter most for this thesis). Persisted to `theses`.
2. **Source.** Thesis drives an Apify discovery/directory actor returning candidate
   startups; v1 surfaces top N and the VC confirms one.
   *Fallback (see Risks): VC pastes a seed company; full discovery is a fast-follow.*
3. **Profile.** The four existing agents run on real Apify scrapes → `Finding[]` →
   deterministic `Verdict` (score, zone, twins). Founder analysis is folded into
   People Watcher for v1 (no separate 5th agent — YAGNI). OpenAI writes the
   counterfactual and a founder summary, grounded only in the findings.
4. **Rank.** A new **thesis-fit layer** combines the Verdict survival score with a
   thesis-match score (sector / stage / check fit) into a single **deal score** plus a
   short rationale. Stored as `thesis_fit` jsonb on the deal.
5. **Pipeline + outreach.** The profiled deal lands in the pipeline. "Draft" calls
   OpenAI to generate a personalized founder email grounded in the profile + thesis.
   The VC reviews and **sends** via InsForge email. Send-state persisted.

## Components

**New UI**
- Thesis setup screen.
- Pipeline / deal-list view.
- Deal detail: wraps the existing `VerdictPage`, adds a thesis-fit panel and an
  outreach composer (draft → review → send).

**Reused UI** (`components/`)
- `investigation-room`, `signal-graph`, `agent-grid`, `evidence-feed`, `verdict-page` —
  animate the sourcing + profiling stages, fed by InsForge realtime instead of the
  current in-memory mock timer.

**New backend**
- API routes: `/api/thesis`, `/api/source`, `/api/profile`, `/api/outreach/draft`,
  `/api/outreach/send`, `/api/apify/webhook`.
- Apify client, OpenAI client, InsForge SDK wiring, email send.

## Data model (InsForge / Postgres)

- `theses` — `sectors[]`, `stage`, `geo`, `check_min`, `check_max`,
  `signal_weights jsonb`, `created_at`.
- `deals` — `thesis_id`, `company`, `founder`, `stage_status`, `verdict jsonb`,
  `findings jsonb`, `thesis_fit jsonb`, `created_at`.
- `apify_runs` — `deal_id`, `actor`, `run_id`, `status`, `dataset_id`.
- `outreach` — `deal_id`, `draft`, `status`, `to_email`, `sent_at`.

Findings are stored as jsonb on `deals` for v1; normalize to a dedicated table later if
query needs arise.

## Risks & constraints

- **Sourcing is the weakest link.** "Find startups matching a thesis" via Apify is
  limited. v1 ships with a VC-provided seed-company fallback; richer discovery is a
  fast-follow. The slice must remain valuable even if discovery returns one candidate.
- **Apify latency + cost.** Runs take minutes and cost credits per run. Orchestration
  is webhook-driven and async; never synchronous.
- **Cold founder email is outward-facing.** Deliverability and consent/CAN-SPAM apply.
  v1 requires explicit per-message VC confirmation before any send; no bulk or
  automated sending. Messages include required sender identity / unsubscribe affordance.
- **Secrets.** Apify, OpenAI, and email credentials live only in Next server routes /
  InsForge — never shipped to the client.
- **Auth.** Single VC, no login in v1. Multi-tenant isolation is a fast-follow.

## Out of scope for v1 (fast-follows)

- Rich thesis-driven discovery / large candidate sets.
- Multi-tenant auth and per-VC data isolation.
- Bulk / sequenced outreach campaigns and follow-up automation.
- Normalized findings table; analytics on pipeline performance.
- A dedicated founder agent (5th agent).
