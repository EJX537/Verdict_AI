// Browser client — uses the anon key (public).
// Safe to import in client components. Used by Plan 3 realtime subscriptions.

import { createClient } from '@insforge/sdk'

export const browserClient = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
})
