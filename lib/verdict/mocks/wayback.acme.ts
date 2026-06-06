import type { WaybackSnapshot } from '../adapters/archivist'

// Canned ryanclinton/wayback-machine-search dataset for a healthy, long-lived site.
// Used by the orchestrator in mocks-first mode (no live Apify run).
export const waybackAcme: WaybackSnapshot[] = [
  // Oldest snapshot — establishes 5+ years of longevity (from 2019)
  { timestamp: '20190315120000', statusCode: 200, isRedirect: false },
  // Prior-year snapshots (2024-06-07 .. 2025-06-06)
  { timestamp: '20240801120000', statusCode: 200, isRedirect: false },
  { timestamp: '20241001120000', statusCode: 200, isRedirect: false },
  { timestamp: '20241201120000', statusCode: 200, isRedirect: false },
  { timestamp: '20250201120000', statusCode: 200, isRedirect: false },
  { timestamp: '20250401120000', statusCode: 200, isRedirect: false },
  // Recent snapshots (2025-06-07 .. 2026-06-06) — site alive
  { timestamp: '20250801120000', statusCode: 200, isRedirect: false },
  { timestamp: '20251001120000', statusCode: 200, isRedirect: false },
  { timestamp: '20251201120000', statusCode: 200, isRedirect: false },
  { timestamp: '20260201120000', statusCode: 200, isRedirect: false },
  { timestamp: '20260401120000', statusCode: 200, isRedirect: false },
  { timestamp: '20260501120000', statusCode: 200, isRedirect: false },
]
