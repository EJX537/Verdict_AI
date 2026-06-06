import 'server-only'
// server-only — uses the admin API key.
// NEVER import this module in client components or browser bundles.
// It gives full DB access without RLS restrictions.

import { createAdminClient } from '@insforge/sdk'
import type { InsForgeClient } from '@insforge/sdk'

let _client: InsForgeClient | undefined

export function getServerClient(): InsForgeClient {
  if (!_client) {
    _client = createAdminClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      apiKey: process.env.INSFORGE_API_KEY!,
    })
  }
  return _client
}

// Convenience singleton for non-test usage
export const serverClient = {
  get database() {
    return getServerClient().database
  },
  get auth() {
    return getServerClient().auth
  },
  get storage() {
    return getServerClient().storage
  },
  get realtime() {
    return getServerClient().realtime
  },
}
