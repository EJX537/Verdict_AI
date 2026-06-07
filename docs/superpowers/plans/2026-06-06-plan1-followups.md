# Plan 1 — Follow-ups (data quality + input layer)

Plan 1 (backend diligence core) is complete: real Apify data → deterministic Verdict
→ OpenAI prose → thesis-fit, 116 unit tests green, live smoke check passed (Stripe →
Stable 7.0/10, deal_score 82/100). The pipeline is sound. These are data-source /
input-layer issues to address in Plan 2 (orchestration/input) or a Plan 1.5 polish
pass — none are pipeline bugs.

## Data-quality follow-ups (from live smoke check)

1. **Wayback returns oldest snapshots.** `ryanclinton/wayback-machine-search` with the
   default query returns the OLDEST ~500 snapshots (1996-era), so `archive.site_alive`
   reads neutral and `archive.longevity` is wrong (e.g. 29y for stripe.com). Fix: pass a
   recent-first / `from=` / `sort=reverse` parameter (verify the actor's input schema)
   so the 180-day window and cadence signals see current snapshots. **Highest-impact
   archive fix.**

2. **PR Newswire keyword bleed.** `parseforge/pr-newswire-scraper` keyword="stripe"
   returns releases that merely contain the word "stripe", tanking `press.organic_ratio`
   for common-word company names. Fix: tighten the query (exact-name / company filter)
   or post-filter PR items by company-name match before `mapPressDataset`.

3. **LinkedIn free-tier cap (25 employees).** `harvestapi/linkedin-company-employees`
   free tier caps at ~25 rows, so founders (e.g. the Collisons for Stripe) may be absent
   → `people.founder_present` neutral. A paid tier or a founder-specific lookup would
   make the founder signal reliable.

4. **Crunchbase slug derivation is fragile.** `buildMoneyInput` slugifies the company
   name → `crunchbase.com/organization/<slug>`. Collisions happen ("Notion" → wrong org;
   needs `notion-so`). Plan 2's input layer should let the VC supply/confirm the
   Crunchbase URL (or resolve the slug via search) rather than guessing from the name.

## Known intentional v1 limitations

- Diff-based people signals (exec_departure / backfill) are out — they need a prior-run
  baseline that v1 doesn't persist. Revisit once InsForge stores run history (Plan 2).
- Archive signals are snapshot-based (alive / longevity / cadence), not content-diff —
  the wayback actor provides no page diffs.

## Carried forward to Plan 2 / 3

- InsForge schema + stage machine + API routes + Apify webhook + realtime (Plan 2).
- VC UI: thesis setup, pipeline, deal detail, outreach composer + send (Plan 3).
- **Security:** rotate the Apify + OpenAI keys that were shared in plaintext during the
  Plan 1 session.

## Plan 2 follow-ups (from live orchestration smoke)

- **Apify free-tier memory cap (8192 MB).** Each actor run requests ~2 GB; two deals
  orchestrated concurrently exceed the cap and the second fails with a memory-limit
  error. v1 works fine serially. Fix: serialize Apify runs (a queue / concurrency gate
  in the orchestrator) or move to a higher Apify tier before allowing parallel deals.
- **`after()` durability.** Sourcing takes ~20+ minutes (blocking Apify `.call()` per
  actor). `after()` keeps the work alive post-response in `next dev` and within Vercel
  function limits, but a 20-min run will exceed serverless limits in production. Move
  orchestration to a durable worker (InsForge scheduled poller hitting an advance
  endpoint, or a queue) — already noted as Plan 2.5.
- **Intermediate stage visibility.** `sourcing` dominates wall-clock; `profiling →
  scoring → ready` complete in <1s, so HTTP polling misses them. Each `updateDealStage`
  fires its own realtime event, so the Plan 3 realtime UI will render every transition;
  no change needed for the realtime path. If polling is ever the primary consumer,
  consider finer per-agent stages.
- **Async Apify (webhook) rework** remains the cleaner long-term model vs the current
  blocking `apifyRunner` inside `after()` — pairs with the durable-worker follow-up.

## Plan 3 security — auth is the root fix (Plan 3.5)

v1 has **no user auth** and the API routes are browser-reachable. Mitigations applied so
nothing is abuse-by-default; the residual items below are all closed properly only by
multi-tenant auth + ownership checks (Plan 3.5):

- **Applied:** `/api/outreach` send refused unless `OUTREACH_SEND_TOKEN` set + matching
  `x-outreach-token` header (was an open email relay); email body HTML-escaped. Copilot
  `diligenceCompany` requires server-side `COPILOT_DILIGENCE_ENABLED=true` (LLM `confirm`
  is prompt-injectable) — disabled by default.
- **Residual (deferred to Plan 3.5 auth):** IDOR on `/api/outreach` draft + `/api/deals`
  + `/api/chat` (no per-user ownership filter); `toEmail` taken from the request rather
  than a verified founder email captured during diligence; per-user rate limiting;
  scoping copilot tool queries to the authenticated tenant. **Not exploitable
  cross-tenant in single-VC v1** (only one VC's data exists), but must be fixed before
  multi-tenant. When auth lands: verify session at the top of each route, bind
  deals/theses/outreach to `owner_id`, filter every query by it, and derive `toEmail`
  from the deal's founder record.
- Also still open from earlier: **rotate the Apify + OpenAI keys** shared in plaintext.
