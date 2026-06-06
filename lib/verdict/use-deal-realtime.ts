'use client'

// NOTE: Polling implementation (not InsForge realtime WebSocket).
// Rationale: browserClient.realtime.connect() is async and needs NEXT_PUBLIC_INSFORGE_URL
// at runtime in a browser context; the channel pattern for deals is `deal:{id}` but the
// InsForge realtime `subscribe` call requires await + error handling that couples to the
// component lifecycle in complex ways. Polling every 3 s is reliable, simple, and
// sufficient for the current UX (deal detail page progress tracking).
// Replace with browserClient.realtime when the channel RLS policy is confirmed.

import { useEffect, useRef, useState } from 'react'
import type { DealRow } from './store'

const POLL_INTERVAL_MS = 3000
const TERMINAL_STAGES = new Set(['ready', 'error'])

export interface UseDealRealtimeResult {
  deal: DealRow | null
  loading: boolean
  error: string | null
}

export function useDealRealtime(dealId: string): UseDealRealtimeResult {
  const [deal, setDeal] = useState<DealRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function poll() {
      try {
        const res = await fetch(`/api/deals/${dealId}`)
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        const fresh: DealRow = await res.json()
        if (!mountedRef.current) return

        setDeal(fresh)
        setLoading(false)
        setError(null)

        // Stop polling once terminal
        if (!TERMINAL_STAGES.has(fresh.stage_status)) {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (!mountedRef.current) return
        setError(err instanceof Error ? err.message : 'Polling error')
        setLoading(false)
        // Back-off: retry after 6s on error
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS * 2)
      }
    }

    poll()

    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dealId])

  return { deal, loading, error }
}
