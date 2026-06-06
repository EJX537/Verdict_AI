# Verdict VC Workspace — Plan 3a: Light-Green Theme System

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Recolor the existing dark, token-driven UI to a cohesive light-green design system without changing any component structure or behavior.

**Architecture:** The theme is token-driven (`app/globals.css` `:root` + Tailwind v4 `@theme` maps). Recoloring is mostly a `:root` swap; the remaining work is replacing inline `oklch`/hex literals in five components with semantic token utilities. The share-modal SVG export stays dark (intentional branded asset). Verification is build + visual screenshots (CSS isn't unit-testable).

**Tech Stack:** Tailwind v4, Next 16, existing components, Playwright (via the `browse`/playwright skill) for visual checks.

---

## File Structure

| File | Change |
|---|---|
| `app/globals.css` | Replace dark `:root` tokens with light-green palette |
| `app/layout.tsx` | (optional) add Neue Haas Grotesk Display `<link>` for headings |
| `lib/mock-data.ts` | `AGENTS` color classes → token utilities; `getScoreTint` → light tints |
| `components/verdict-page.tsx` | Replace dark inline `bg/text/border` literals with tokens |
| `components/signal-graph.tsx` | `bg-black` → `bg-card`; keep tuned chart colors |
| `components/evidence-feed.tsx` | delta pos/neg text literals → `text-stable`/`text-danger` |
| `components/entry-page.tsx` | zone text literals → zone token utilities |

Out of scope: `components/share-modal.tsx` SVG export (stays dark by design; its form controls use tokens and recolor automatically).

The existing 116+ vitest tests must stay green (no logic touched).

---

## Task 1 — Light-green `:root` tokens

**Files:** Modify `app/globals.css:41-70` (the `:root` block).

- [ ] **Step 1: Replace the `:root` block** with the light palette (keep the `@theme inline` block above it unchanged):

```css
:root {
  /* Base palette — light green */
  --background: oklch(0.985 0.006 130);
  --foreground: oklch(0.27 0.03 145);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.27 0.03 145);
  --border: oklch(0.90 0.012 140);
  --input: oklch(0.94 0.008 140);
  --ring: oklch(0.55 0.08 150);
  --muted: oklch(0.96 0.006 140);
  --muted-foreground: oklch(0.48 0.03 145);
  --accent: oklch(0.92 0.03 145);
  --accent-foreground: oklch(0.30 0.04 145);
  --primary: oklch(0.46 0.09 150);
  --primary-foreground: oklch(0.99 0 0);

  /* Signal zones — tuned for legibility on light */
  --danger: oklch(0.55 0.18 25);
  --guarded: oklch(0.62 0.13 65);
  --stable: oklch(0.52 0.12 150);
  --thriving: oklch(0.52 0.10 205);

  /* Agent colors — ~0.55 L so they read as text on white */
  --agent-archivist: oklch(0.55 0.12 235);
  --agent-money: oklch(0.58 0.13 65);
  --agent-people: oklch(0.55 0.16 350);
  --agent-press: oklch(0.52 0.13 160);

  --radius: 0.25rem;
}
```

- [ ] **Step 2: Build** — `pnpm build` → Compiled successfully.
- [ ] **Step 3: Commit**
```bash
git add app/globals.css
git commit -m "feat(3a): light-green :root token palette"
```

---

## Task 2 — Recolor `lib/mock-data.ts`

**Files:** Modify `lib/mock-data.ts:12-45` (AGENTS) and `:99-106` (getScoreTint).

- [ ] **Step 1: Replace each AGENTS entry's color classes** with token utilities (Tailwind v4 generates `text-agent-*`/`bg-agent-*`/`border-agent-*` from the `@theme` map). Keep `chartColor` as a CONCRETE light oklch literal (matching the new `--agent-*` token values) so canvas `fillStyle`/`strokeStyle` work without resolving `var()`. Apply to all four:

```ts
  {
    id: 'archivist',
    name: 'Archivist',
    colorClass: 'text-agent-archivist',
    bgClass: 'bg-agent-archivist/10',
    borderClass: 'border-agent-archivist/30',
    chartColor: 'oklch(0.55 0.12 235)',
  },
```
money_tracker → `text-agent-money` / `bg-agent-money/10` / `border-agent-money/30` / `chartColor: 'oklch(0.58 0.13 65)'`.
people_watcher → `text-agent-people` / `bg-agent-people/10` / `border-agent-people/30` / `chartColor: 'oklch(0.55 0.16 350)'`.
press_room → `text-agent-press` / `bg-agent-press/10` / `border-agent-press/30` / `chartColor: 'oklch(0.52 0.13 160)'`.

- [ ] **Step 2: Replace `getScoreTint`** (currently dark tints) with light tints:
```ts
export function getScoreTint(score: number): string {
  if (score < 30) return 'oklch(0.97 0.02 25)'
  if (score < 50) return 'oklch(0.975 0.02 65)'
  if (score < 65) return 'oklch(0.98 0.012 90)'
  if (score < 80) return 'oklch(0.98 0.012 150)'
  return 'oklch(0.97 0.02 150)'
}
```

- [ ] **Step 3: Tests + build** — `pnpm vitest run` (still green; no test asserts these strings) and `pnpm build`.
- [ ] **Step 4: Commit**
```bash
git add lib/mock-data.ts
git commit -m "feat(3a): recolor agent palette + score tints for light"
```

> NOTE: `chartColor` changed from a literal `oklch(...)` string to `var(--agent-*)`. Canvas `fillStyle`/`strokeStyle` accept CSS `var()` only when resolved; if any canvas code assigns `chartColor` directly to a 2d context (check `signal-graph.tsx`/`verdict-page.tsx` canvas draws), resolve it via `getComputedStyle(document.documentElement).getPropertyValue('--agent-...')` OR keep `chartColor` as a concrete light oklch literal instead. Verify in Task 3.

---

## Task 3 — Recolor inline literals in components

**Files:** Modify `components/verdict-page.tsx`, `components/signal-graph.tsx`, `components/evidence-feed.tsx`, `components/entry-page.tsx`.

- [ ] **Step 1: `verdict-page.tsx`** — replace dark surface literals with tokens:
  - `bg-[oklch(0.17_0_0)]` and `bg-[oklch(0.16_0_0)]` (lines ~323-326) → `bg-card`.
  - `text-white` on the score number (line ~437) → `text-foreground`.
  - `border-t-[oklch(0.4_0.1_250)]` (line ~326) → `border-t-border`.
  - Leave `ZONE_COLORS` (oklch ~0.65-0.86 L) and `ZONE_HEX` as-is (they read on light). Leave the closest-dead/living tint literals (`/0.05`, `/0.4`) — they are faint red/green tints that still work on white.
  - The canvas gradient hex (`#e67e22`, `#d4ac0d`, `DANGER_HEX`) are zone fills on the score gauge — keep.

- [ ] **Step 2: `signal-graph.tsx`** — `bg-black` (line ~132) → `bg-card`. Keep `AGENT_COLORS` hex (bright lines on a white chart read fine) and the faint zone-band `bg-[oklch(...)]` overlays (opacity 0.02-0.04 — negligible on light; safe to keep).

- [ ] **Step 3: `evidence-feed.tsx`** — the delta sign colors (lines ~57-58): `text-[oklch(0.78_0.09_150)]` → `text-stable`; `text-[oklch(0.58_0.14_25)]` → `text-danger`.

- [ ] **Step 4: `entry-page.tsx`** — zone text literals (lines ~93-98): map by zone to token utilities — `text-[oklch(0.58_0.14_25)]`→`text-danger`, `text-[oklch(0.72_0.12_55)]`→`text-guarded`, `text-[oklch(0.78_0.09_150)]`→`text-stable`, `text-[oklch(0.82_0.06_200)]`→`text-thriving`.

- [ ] **Step 5: Tests + build** — `pnpm vitest run` green, `pnpm build` success.
- [ ] **Step 6: Commit**
```bash
git add components/verdict-page.tsx components/signal-graph.tsx components/evidence-feed.tsx components/entry-page.tsx
git commit -m "feat(3a): recolor verdict/signal/evidence/entry inline literals to tokens"
```

---

## Task 4 — Visual verification (build + screenshots)

**No code change unless a regression is found.**

- [ ] **Step 1: Start dev server** — `pnpm dev` (background); wait for ready.
- [ ] **Step 2: Screenshot the three states** via the Playwright/browse tooling:
  - `/` entry page (company input) — confirm light bg, dark-green text, legible.
  - Run an investigation (enter a company) — confirm investigation-room / signal-graph / agent-grid / evidence-feed render light + agent colors legible (not washed out).
  - The verdict page — confirm score, zone color, closest-twin cards, counterfactual all readable on light; score number is dark (not white-on-white).
- [ ] **Step 3: Contrast spot-check** — verify body text (`--muted-foreground` on `--background`) and agent label text meet WCAG AA (~4.5:1). If any agent/zone color is too light, darken its `--agent-*`/zone token in `globals.css` (lower L by ~0.05) and re-screenshot.
- [ ] **Step 4: Canvas check** — confirm the signal-graph chart lines and the verdict score gauge actually render (catches the `chartColor` `var()` caveat from Task 2). If lines vanished, set `chartColor` back to concrete light oklch literals in `mock-data.ts` (e.g. `oklch(0.55 0.12 235)` etc.) and re-verify.
- [ ] **Step 5: Stop dev server.** Commit any contrast fixes:
```bash
git add app/globals.css lib/mock-data.ts
git commit -m "fix(3a): contrast + canvas color adjustments from visual pass"
```

---

## Self-Review

**Spec coverage (3a portion of the design):** light `:root` tokens ✓ (T1); inline-literal audit/fix across the 5 files ✓ (T2-T3); share-modal export excluded ✓ (documented); visual/contrast verification ✓ (T4). Card/nav primitives + fonts are deferred to 3b (shell) — 3a only establishes the color system; the Neue Haas `<link>` is optional in T1's layout note. (If desired now, add the two `<link>` tags from the design's font CDN to `app/layout.tsx` head.)

**Placeholder scan:** concrete token values + exact literal→token mappings given; no TBD. Canvas-color caveat is an explicit conditional fix, not a placeholder.

**Type consistency:** no type changes; only class strings + CSS values. `AGENTS[].chartColor` stays a `string` (now `var(--...)`); the canvas caveat in T2/T4 handles the runtime consequence.
