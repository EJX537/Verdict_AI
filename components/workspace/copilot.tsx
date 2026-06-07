'use client'

/**
 * copilot.tsx
 *
 * Collapsible right-rail copilot panel.
 * Mount inside AppShell — the panel occupies a fixed-width right rail when open.
 */

import { useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime, AssistantChatTransport } from '@assistant-ui/react-ai-sdk'
import { Thread } from '@/components/assistant-ui/thread'
import { GetDealToolUI, DiligenceCompanyToolUI } from './deal-card-tool'
import { ChevronRightIcon, BotIcon } from 'lucide-react'

// ─── Inner component: renders tool registration components inside the provider ─

function CopilotInner() {
  return (
    <>
      {/* Render these zero-output components to register tool UIs */}
      <GetDealToolUI />
      <DiligenceCompanyToolUI />
      <Thread />
    </>
  )
}

// ─── Exported panel ───────────────────────────────────────────────────────────

export function CopilotPanel() {
  const [open, setOpen] = useState(false)

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: '/api/chat' }),
  })

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-1 bg-card border border-border border-r-0 rounded-l-md px-1.5 py-3 hover:bg-muted transition-colors cursor-pointer"
        aria-label={open ? 'Close copilot' : 'Open copilot'}
      >
        <BotIcon className="w-4 h-4 text-muted-foreground" />
        {open ? (
          <ChevronRightIcon className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="w-3 h-3 text-muted-foreground rotate-180" />
        )}
      </button>

      {/* Right rail panel */}
      {open && (
        <aside className="fixed right-0 top-0 h-screen w-[360px] z-30 border-l border-border bg-background flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <BotIcon className="w-4 h-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                Verdict Copilot
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-xs"
              aria-label="Close copilot"
            >
              ✕
            </button>
          </div>

          {/* Thread */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AssistantRuntimeProvider runtime={runtime}>
              <CopilotInner />
            </AssistantRuntimeProvider>
          </div>
        </aside>
      )}
    </>
  )
}
