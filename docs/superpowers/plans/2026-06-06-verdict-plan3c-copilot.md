# Verdict VC Workspace — Plan 3c: Copilot + Outreach

> REQUIRED SUB-SKILL: subagent-driven-development. Condensed (time-boxed). Builds on 3a
> (theme) + 3b (dashboard shell with a right-rail slot) + Plan 2 backend.

**Goal:** An assistant-ui copilot in the right rail that drives the agent via tools and
renders results inline, plus an outreach composer (draft + send) on the deal page —
closing the Raisi-inverse loop.

**Architecture:** assistant-ui (`@assistant-ui/react` + `@assistant-ui/react-ai-sdk`)
installed manually (project has `components.json`, so CLI `init` aborts). `/api/chat`
(AI SDK + OpenAI) exposes server-side tools that call `dbStore`/orchestrator. Outreach
uses OpenAI for the draft and InsForge `emails.send()` for delivery (draft-only fallback
if the NANO tier blocks custom email).

**Tech Stack:** `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, `ai`, `@ai-sdk/openai`, `zod`.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/api/chat/route.ts` | AI SDK `streamText` with server tools; `toUIMessageStreamResponse()` |
| `lib/verdict/copilot-tools.ts` | Tool defs (zod schemas) + executors calling `dbStore`/orchestrator |
| `components/workspace/copilot.tsx` | `AssistantRuntimeProvider` + `Thread`, mounted in the shell right rail |
| `components/assistant-ui/*` | From `npx shadcn add https://r.assistant-ui.com/thread.json` |
| `components/workspace/deal-card-tool.tsx` | `makeAssistantToolUI` rendering deal results inline |
| `app/api/outreach/route.ts` | POST: `draft` (OpenAI) and `send` (InsForge emails) actions |
| `components/workspace/outreach-composer.tsx` | Draft → review → send UI on the deal page |
| `lib/verdict/store.ts` | (extend) `createOutreach`, `updateOutreach`, `getOutreachByDeal` |

---

## Tasks

### Task 1 — assistant-ui install
`npm install @assistant-ui/react @assistant-ui/react-ai-sdk @assistant-ui/react-markdown ai @ai-sdk/openai zod` then `npx shadcn@latest add https://r.assistant-ui.com/thread.json`. Verify build.

### Task 2 — copilot tools
`lib/verdict/copilot-tools.ts`: zod-typed tools with server executors —
- `listDeals()` → `dbStore.listDeals()`
- `getDeal({id})` → `dbStore.getDeal(id)`
- `createThesis({sectors,stage,geo,checkMin,checkMax,signalWeights})` → `dbStore.createThesis`
- `diligenceCompany({company, companyUrl, thesisId})` → `dbStore.createDeal` + schedule `orchestrateDeal` (returns dealId). **Requires a confirm flag** (`confirm:true`) before spending credits — without it, return a "needs confirmation" message.

### Task 3 — /api/chat
`app/api/chat/route.ts` (`runtime='nodejs'`): `streamText({ model: openai('gpt-4o-mini'), system, messages: convertToModelMessages(messages), tools })` using the Task 2 tools; return `result.toUIMessageStreamResponse()`. System prompt: a VC diligence copilot grounded in our data; never fabricate verdicts.

### Task 4 — copilot rail UI
`components/workspace/copilot.tsx`: `useChatRuntime({ transport: new AssistantChatTransport({ api: '/api/chat' }) })` + `AssistantRuntimeProvider` + `<Thread/>`. Mount in the shell's right-rail slot (collapsible). `deal-card-tool.tsx`: `makeAssistantToolUI({ toolName:'getDeal'|'diligenceCompany', render })` → render a deal card (reuse `deal-card`/`zone-chip`). Register globally.

### Task 5 — outreach
Extend `store.ts` with outreach CRUD. `app/api/outreach/route.ts`: `POST {action:'draft', dealId}` → OpenAI personalized founder email grounded in the deal's verdict+thesis_fit → save `outreach` row (status 'draft'); `POST {action:'send', outreachId, toEmail}` → require explicit per-message confirm → `insforge.emails.send(...)` → status 'sent'. If `emails.send` unavailable on NANO tier, return 'draft-only' + keep status 'ready'. `outreach-composer.tsx` on the deal page: generate → edit → send (with confirm), shows status.

### Task 6 — verify
`pnpm vitest run` (tool executors unit-tested with injected store; outreach draft mockable), `pnpm build`. Smoke the copilot: "list my deals", "diligence Stripe" (confirm gate).

---

## Notes / risks
- **Credit/safety:** `diligenceCompany` + outreach `send` are credit/outward-facing → explicit confirm gates (mirrors Plan 1/2 rules). No bulk send.
- **Email tier:** verify InsForge custom email on the project tier; fall back to draft-only.
- Tools run server-side in `/api/chat` (they touch admin `dbStore`) — never expose as frontend tools.
