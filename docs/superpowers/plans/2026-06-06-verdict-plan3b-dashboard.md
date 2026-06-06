# Verdict VC Workspace — Plan 3b: Dashboard Workflow

> REQUIRED SUB-SKILL: subagent-driven-development. Condensed (time-boxed) — relies on the
> design spec `docs/superpowers/specs/2026-06-06-verdict-vc-workspace-design.md` and the
> Plan 2 API (`/api/theses`, `/api/deals`, `/api/deals/[id]`) + InsForge realtime.

**Goal:** A light-green VC dashboard — app shell, thesis setup, deal pipeline, and a deal-detail view that reuses the existing verdict/investigation components, all wired to the Plan 2 backend + InsForge realtime. No copilot (that's 3c).

**Architecture:** New workspace mounted at `/workspace` (pipeline) + `/workspace/thesis` + `/deals/[id]`, leaving the existing `/` investigation demo and teammate `/verdict` intact (less invasive for the time box). Browser data via `lib/insforge/client.ts` (anon) for realtime + the Plan 2 REST routes for reads/writes.

**Tech Stack:** Next 16 App Router, React 19, Tailwind v4 (3a tokens), `@insforge/sdk` realtime, lucide-react.

---

## File Structure

| File | Responsibility |
|---|---|
| `components/workspace/app-shell.tsx` | Sidebar + top bar + content slot + collapsible right rail slot |
| `components/workspace/sidebar.tsx` | Nav: Pipeline, Theses, (Settings). Glassy/clean, lucide icons |
| `components/workspace/topbar.tsx` | Search + "New diligence" CTA + account stub |
| `components/workspace/zone-chip.tsx` | Colored zone pill (uses zone tokens) |
| `components/workspace/deal-card.tsx` | One deal: company, deal_score, zone chip, stage_status, updated_at |
| `components/workspace/thesis-form.tsx` | Sectors, stage, geo, check min/max, signal-weight sliders |
| `components/workspace/new-diligence-dialog.tsx` | company + companyUrl + thesis picker → POST /api/deals |
| `lib/verdict/deal-view.ts` | Map a real `DealRow` (Plan 2) → the `VerdictData` shape `verdict-page` expects |
| `app/(workspace)/layout.tsx` | Wrap children in `<AppShell>` |
| `app/(workspace)/workspace/page.tsx` | Pipeline (server fetch list + client realtime) |
| `app/(workspace)/workspace/thesis/page.tsx` | Thesis setup |
| `app/deals/[id]/page.tsx` | Deal detail (realtime-driven) |
| `lib/verdict/use-deal-realtime.ts` | Client hook: subscribe `deal:{id}` (or `deal:%`) via browserClient, return live deal state |

---

## Tasks

### Task 1 — App shell + nav (light-green)
Build `app-shell.tsx` (CSS grid: `[sidebar] [main] [rail?]`), `sidebar.tsx`, `topbar.tsx`, `zone-chip.tsx` using 3a tokens (`bg-background`, `bg-card`, `text-foreground`, `--primary`, glassy `bg-white/70 backdrop-blur-md` nav). Right-rail slot is an empty collapsible placeholder (filled in 3c). `app/(workspace)/layout.tsx` renders `<AppShell>{children}</AppShell>`. Verify `pnpm build`.

### Task 2 — Pipeline page
`app/(workspace)/workspace/page.tsx`: server component fetches `GET /api/deals` (or calls `dbStore.listDeals()` server-side) and renders a grid of `deal-card.tsx`. A client wrapper subscribes via `use-deal-realtime` to `deal:%` and merges live `stage_status`/`verdict.overall_score`/`thesis_fit.deal_score` updates into the list. Empty state + "New diligence" CTA (opens `new-diligence-dialog`). `deal-card` links to `/deals/[id]`.

### Task 3 — Thesis setup
`thesis-form.tsx` + `app/(workspace)/workspace/thesis/page.tsx`: controlled form; sectors (multi-input/chips), stage (select), geo (multi), checkMin/checkMax (number), four signal-weight sliders (0–1) for money/people/press/archive. Submit → `POST /api/theses` → toast + redirect to pipeline. Client component.

### Task 4 — New diligence dialog
`new-diligence-dialog.tsx`: fields company, companyUrl, thesis picker (fetch theses — add `GET /api/theses` list route if missing, else a simple select of recent theses via a new `dbStore.listTheses()` + `GET /api/theses`). Submit → `POST /api/deals` → 202 `{ dealId }` → router.push(`/deals/${dealId}`).
(If adding `GET /api/theses` + `listTheses`, keep it tiny and mirror `listDeals`.)

### Task 5 — Deal detail (realtime)
`lib/verdict/deal-view.ts`: pure mapper `dealToVerdictData(deal: DealRow): VerdictData | null` translating the real `Verdict` (`lib/verdict/types.ts`) + `thesis_fit` + `founder_summary` into the `VerdictData` shape `components/verdict-page.tsx` consumes (score 0–100 from `overall_score*10`, zone via existing `getZone`, agent summaries from findings, closest dead/living from `verdict.closest_dead/living`, counterfactual). Unit-test this mapper (it's pure).
`app/deals/[id]/page.tsx`: fetch `GET /api/deals/[id]`; if `stage_status !== 'ready'`, show a live "investigating" view (reuse `investigation-room` driven by stage) and subscribe `deal:{id}` via `use-deal-realtime`; when `ready`, render `<VerdictPage>` with `dealToVerdictData(deal)`. Handle `error` stage with a message.

### Task 6 — Verify
`pnpm vitest run` (deal-view mapper test green + existing green), `pnpm build` success. Smoke: dev server, open `/workspace`, create a thesis, kick a diligence, watch the deal page advance (realtime). (Skip if time-boxed; build + mapper test is the gate.)

---

## Notes / risks
- Keep the existing `/` demo + `/verdict` untouched.
- Realtime subscribe shape: confirm `browserClient.realtime` `connect/subscribe/on` per @insforge/sdk; fall back to polling `GET /api/deals/[id]` every 3s if subscribe is flaky.
- `dealToVerdictData` is the integration seam — unit-test it so the detail page is reliable.
