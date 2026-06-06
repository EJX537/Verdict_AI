# Verdict for Investors — VC Workspace (Plan 3) Design

**Date:** 2026-06-06
**Status:** Approved (direction); decomposed into sub-plans 3a/3b/3c

## Summary

Plan 3 builds the VC-facing UI on top of the Plan 1 diligence core and Plan 2
orchestration/persistence. It is a **dashboard + copilot**: a calm light-green
workspace where a VC sets a thesis, watches a deal pipeline, and opens a deal into the
(reused) verdict/investigation view that streams live via InsForge realtime — with an
assistant-ui **copilot rail** that can drive the agent through tools.

Stack is unchanged: **Next.js 16 / React 19 / Tailwind v4**. The shared LinkFlow prompt
(Vite/React18/Tailwind3.4) informs *aesthetic only* — palette, fonts, glassy nav — not
the stack. The ACRU reference informs the card-based dashboard layout.

## Locked decisions

| Decision | Choice |
|---|---|
| assistant-ui role | Dashboard + copilot side panel (dashboard is source of truth) |
| Visual direction | Light-green throughout, aligned to existing UI/UX (recolor, not rebuild) |
| Copilot runtime | assistant-ui + `@assistant-ui/react-ai-sdk`, `/api/chat` (OpenAI) with server-side tools |
| Deal detail | Reuse existing `investigation-room`/`signal-graph`/`agent-grid`/`evidence-feed`/`verdict-page`, recolored, realtime-driven |
| Auth | None in v1 (single VC), consistent with Plans 1-2 |

## Visual system

The existing theme (`app/globals.css`) is **dark-only but token-driven**: components use
semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `--border`, `--signal`,
`--agent-*`, zone colors). Recoloring is therefore mostly a `:root` token swap.

- New light-green `:root`: `--background` near-white `oklch(0.98 0.005 130)`, `--foreground`
  `#1f2a1d`, `--card` white, `--primary` `#336443`, `--accent` `#85AB8B`, body text
  `#4b5b47`; retune `--signal`, `--agent-{archivist,money,people,press}`, and zone colors
  (`--danger/guarded/stable/thriving`) for legibility on light.
- Hand-fix inline colors that bypass tokens: `lib/mock-data.ts` `getScoreTint`/`getZone`
  tints, and any inline `oklch(...)` in `verdict-page.tsx`/`signal-graph.tsx`. Audit all
  `oklch(0.0–0.2 ...)` dark literals.
- Components: card system (rounded, soft shadow, hairline border) per ACRU reference;
  glassy pill nav (`bg-white/70 backdrop-blur-md border border-white/60`) per LinkFlow.
- Fonts: **Inter** primary (already wired via `next/font`). Optional **Neue Haas Grotesk
  Display** for large headings via the provided CDN `<link>`s in `app/layout.tsx`.
- `lucide-react` already installed.

## Architecture

- **App shell:** left sidebar nav (Pipeline · Theses · Settings), top bar (search +
  actions), **collapsible right copilot rail**.
- **Routes:** `/` → Pipeline; `/thesis` → thesis setup; `/deals/[id]` → deal detail.
  Coexists with the teammate's `/verdict` page + `/api/share-image`.
- Data via the Plan 2 API routes (`/api/theses`, `/api/deals`, `/api/deals/[id]`) and
  InsForge realtime through `lib/insforge/client.ts` (browser anon client), channel
  pattern `deal:%`.

## Screens

- **Thesis setup** (`/thesis`): form for sectors, stage, geo, check size, and signal-weight
  sliders (money/people/press/archive) → `POST /api/theses`.
- **Pipeline** (`/`): filterable card/table of deals — company, deal score, zone chip,
  stage_status, updated_at. Subscribes to realtime so stages/scores update live. "New
  diligence" CTA → create a deal against a thesis (`POST /api/deals`).
- **Deal detail** (`/deals/[id]`): reuses the existing investigation/verdict components,
  recolored, fed by realtime on `deal:{id}` as the deal advances queued→sourcing→
  profiling→scoring→ready; shows the final `verdict`, `thesis_fit`, `founder_summary`,
  and the evidence/findings.

## Copilot (right rail)

- `@assistant-ui/react` + `@assistant-ui/react-ai-sdk` installed manually (project has
  `components.json`, so `init` aborts; use `npx shadcn add https://r.assistant-ui.com/thread.json`
  + `npm install`).
- `/api/chat` (OpenAI via AI SDK) with **server-side tools** that call `dbStore` /
  orchestrator: `diligenceCompany({company, companyUrl, thesisId})`, `listDeals`,
  `getDeal(id)`, `createThesis(...)`. `makeAssistantToolUI` renders results (deal cards,
  pipeline rows) inline in the thread.
- Rail is collapsible; dashboard remains the source of truth.

## Decomposition (each its own plan → execution cycle)

1. **Plan 3a — Theme system:** light-green `:root` tokens + inline-color audit/fix +
   shared card/nav primitives. Existing components recolor with no structural change.
   Verifiable: existing app renders light; `pnpm build` green; visual check.
2. **Plan 3b — Dashboard workflow:** app shell + nav + thesis setup + pipeline + deal
   detail wired to Plan 2 routes + InsForge realtime. The core VC loop, no copilot.
3. **Plan 3c — Copilot + outreach:** assistant-ui rail + `/api/chat` + tools + generative
   UI; outreach composer + send (InsForge `emails.send()`), closing the Raisi-inverse loop.

## Risks / notes

- **Recolor regressions:** dark-tuned `--agent-*`/zone colors may read poorly on light;
  budget a contrast pass (WCAG AA on text). Inline oklch literals are the main trap.
- **Realtime in the browser:** confirm `@insforge/sdk` realtime subscribe works with the
  anon key + channel `deal:%` (registered in Plan 2). Fall back to polling `/api/deals/[id]`
  if subscribe is flaky.
- **Copilot tool safety:** `diligenceCompany` spends Apify/OpenAI credits — require an
  explicit confirm step in the tool UI before kicking a run (mirrors the no-bulk-send rule).
- **Email tier:** InsForge custom `emails.send()` needs a paid plan; project is NANO tier —
  verify before 3c outreach-send, else fall back to draft-only.
