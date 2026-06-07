'use client'

/**
 * outreach-composer.tsx
 *
 * Draft → review/edit → send (with confirm gate) outreach email composer.
 * Mount on the deal detail page when stage_status === 'ready'.
 */

import { useState } from 'react'
import type { OutreachRow } from '@/lib/verdict/store'

interface OutreachComposerProps {
  dealId: string
}

type ComposerStage = 'idle' | 'generating' | 'editing' | 'confirming' | 'sending' | 'done' | 'error'

export function OutreachComposer({ dealId }: OutreachComposerProps) {
  const [stage, setStage] = useState<ComposerStage>('idle')
  const [outreach, setOutreach] = useState<OutreachRow | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [sendStatus, setSendStatus] = useState<'sent' | 'draft-only' | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function generate() {
    setStage('generating')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'draft', dealId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Draft failed')
      const row = json.outreach as OutreachRow
      setOutreach(row)
      setSubject(row.subject)
      setBody(row.body)
      setStage('editing')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStage('error')
    }
  }

  async function send() {
    if (!outreach) return
    setStage('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          outreachId: outreach.id,
          toEmail,
          confirm: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Send failed')
      setSendStatus(json.status as 'sent' | 'draft-only')
      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setStage('error')
    }
  }

  return (
    <div className="border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-foreground">
          Outreach Composer
        </h3>
        {stage === 'idle' && (
          <button
            onClick={generate}
            className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-border text-foreground hover:border-primary/50 transition-colors"
          >
            Generate draft
          </button>
        )}
      </div>

      {stage === 'generating' && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">Drafting email…</span>
        </div>
      )}

      {(stage === 'editing' || stage === 'confirming') && (
        <div className="space-y-3">
          {/* Subject */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-background border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full bg-background border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/50 resize-y font-sans"
            />
          </div>

          {/* To email */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Recipient email
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="founder@company.com"
              className="w-full bg-background border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>

          {stage === 'editing' && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setStage('confirming')}
                disabled={!toEmail.includes('@')}
                className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
              <button
                onClick={generate}
                className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                Regenerate
              </button>
            </div>
          )}

          {stage === 'confirming' && (
            <div className="border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-600 dark:text-yellow-400">
                Confirm send
              </p>
              <p className="font-sans text-xs text-foreground/80">
                Send email to <strong>{toEmail}</strong>? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={send}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                >
                  Confirm send
                </button>
                <button
                  onClick={() => setStage('editing')}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'sending' && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground">Sending…</span>
        </div>
      )}

      {stage === 'done' && (
        <div className="space-y-2">
          {sendStatus === 'sent' ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Email sent
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  Saved as draft-only
                </span>
              </div>
              <p className="font-sans text-[11px] text-muted-foreground">
                Email send is not available on this tier. The draft has been saved.
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setStage('idle')
              setOutreach(null)
              setSendStatus(null)
            }}
            className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            New draft
          </button>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] text-red-500 uppercase tracking-widest">Error</p>
          <p className="font-sans text-xs text-foreground/80">{errorMsg}</p>
          <button
            onClick={() => setStage('idle')}
            className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
