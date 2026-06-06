'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { ThesisRow } from '@/lib/verdict/store'

interface NewDiligenceDialogProps {
  open: boolean
  onClose: () => void
}

const inputCls =
  'w-full border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors'

const labelCls =
  'block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5'

export function NewDiligenceDialog({ open, onClose }: NewDiligenceDialogProps) {
  const router = useRouter()
  const [company, setCompany] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [thesisId, setThesisId] = useState('')
  const [theses, setTheses] = useState<ThesisRow[]>([])
  const [loadingTheses, setLoadingTheses] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch theses when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadingTheses(true)
    fetch('/api/theses')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load theses')))
      .then((data: ThesisRow[]) => {
        setTheses(data)
        if (data.length > 0 && !thesisId) setThesisId(data[0].id)
      })
      .catch(() => setTheses([]))
      .finally(() => setLoadingTheses(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!company.trim()) { setError('Company name is required.'); return }
    if (!thesisId) { setError('Select a thesis.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thesisId,
          company: company.trim(),
          companyUrl: companyUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to create deal')
      }
      const { dealId } = await res.json()
      onClose()
      router.push(`/deals/${dealId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto bg-card border border-border w-full max-w-md shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-foreground">
              New diligence
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Company */}
            <div>
              <label className={labelCls}>Company</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Acme Corp"
                autoFocus
                className={inputCls}
              />
            </div>

            {/* Company URL */}
            <div>
              <label className={labelCls}>Website (optional)</label>
              <input
                type="url"
                value={companyUrl}
                onChange={e => setCompanyUrl(e.target.value)}
                placeholder="https://acme.com"
                className={inputCls}
              />
            </div>

            {/* Thesis picker */}
            <div>
              <label className={labelCls}>Thesis</label>
              {loadingTheses ? (
                <p className="font-mono text-[10px] text-muted-foreground">Loading theses…</p>
              ) : theses.length === 0 ? (
                <p className="font-mono text-[10px] text-muted-foreground">
                  No theses yet —{' '}
                  <a href="/workspace/thesis" className="text-primary underline">create one first</a>.
                </p>
              ) : (
                <select
                  value={thesisId}
                  onChange={e => setThesisId(e.target.value)}
                  className={inputCls}
                >
                  {theses.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.sectors.join(', ') || 'Thesis'} — {t.stage} — {new Date(t.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && (
              <p className="font-sans text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer flex-1 font-mono text-[10px] uppercase tracking-widest py-2.5 border border-border text-foreground hover:border-foreground/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || theses.length === 0}
                className="cursor-pointer flex-1 font-mono text-[10px] uppercase tracking-widest py-2.5 bg-primary text-white hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Starting…' : 'Run diligence'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
