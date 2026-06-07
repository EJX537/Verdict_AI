'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { AgentKey } from '@/lib/verdict/scoring'

const SIGNAL_KEYS: { key: AgentKey; label: string }[] = [
  { key: 'money', label: 'Money Tracker' },
  { key: 'people', label: 'People Watcher' },
  { key: 'press', label: 'Press Room' },
  { key: 'archive', label: 'Archivist' },
]

const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth', 'Late']

const inputCls =
  'w-full border border-border bg-background px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors'

const labelCls = 'block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5'

export function ThesisForm() {
  const router = useRouter()
  const [sectors, setSectors] = useState<string[]>([])
  const [sectorInput, setSectorInput] = useState('')
  const [stage, setStage] = useState('')
  const [geo, setGeo] = useState<string[]>([])
  const [geoInput, setGeoInput] = useState('')
  const [checkMin, setCheckMin] = useState('')
  const [checkMax, setCheckMax] = useState('')
  const [weights, setWeights] = useState<Record<AgentKey, number>>({
    money: 1, people: 1, press: 1, archive: 1,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addSector() {
    const v = sectorInput.trim()
    if (v && !sectors.includes(v)) setSectors(prev => [...prev, v])
    setSectorInput('')
  }

  function addGeo() {
    const v = geoInput.trim()
    if (v && !geo.includes(v)) setGeo(prev => [...prev, v])
    setGeoInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (sectors.length === 0) { setError('Add at least one sector.'); return }
    if (!stage) { setError('Select a stage.'); return }
    if (geo.length === 0) { setError('Add at least one geography.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/theses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectors,
          stage,
          geo,
          checkMin: checkMin ? Number(checkMin) : undefined,
          checkMax: checkMax ? Number(checkMax) : undefined,
          signalWeights: weights,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to create thesis')
      }
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {/* Sectors */}
      <div>
        <label className={labelCls}>Sectors</label>
        <div className="flex gap-2 mb-2">
          <input
            value={sectorInput}
            onChange={e => setSectorInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSector() } }}
            placeholder="e.g. FinTech"
            className={inputCls}
          />
          <button type="button" onClick={addSector}
            className="cursor-pointer px-4 py-2 border border-border bg-card font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-primary/50 transition-colors whitespace-nowrap">
            Add
          </button>
        </div>
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sectors.map(s => (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 font-mono text-[10px] text-primary">
                {s}
                <button type="button" onClick={() => setSectors(prev => prev.filter(x => x !== s))} className="cursor-pointer">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stage */}
      <div>
        <label className={labelCls}>Stage</label>
        <select value={stage} onChange={e => setStage(e.target.value)}
          className={inputCls}>
          <option value="">Select stage…</option>
          {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Geography */}
      <div>
        <label className={labelCls}>Geography</label>
        <div className="flex gap-2 mb-2">
          <input
            value={geoInput}
            onChange={e => setGeoInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGeo() } }}
            placeholder="e.g. US"
            className={inputCls}
          />
          <button type="button" onClick={addGeo}
            className="cursor-pointer px-4 py-2 border border-border bg-card font-mono text-[10px] uppercase tracking-widest text-foreground hover:border-primary/50 transition-colors whitespace-nowrap">
            Add
          </button>
        </div>
        {geo.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {geo.map(g => (
              <span key={g} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 font-mono text-[10px] text-primary">
                {g}
                <button type="button" onClick={() => setGeo(prev => prev.filter(x => x !== g))} className="cursor-pointer">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Check size */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Check Min ($K)</label>
          <input type="number" value={checkMin} onChange={e => setCheckMin(e.target.value)}
            placeholder="e.g. 250" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Check Max ($K)</label>
          <input type="number" value={checkMax} onChange={e => setCheckMax(e.target.value)}
            placeholder="e.g. 2000" className={inputCls} />
        </div>
      </div>

      {/* Signal weights */}
      <div>
        <label className={labelCls}>Signal Weights</label>
        <div className="space-y-3">
          {SIGNAL_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">{label}</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={weights[key]}
                onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="flex-1 accent-primary"
              />
              <span className="font-mono text-[10px] text-foreground w-8 text-right tabular-nums">
                {weights[key].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="font-sans text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="cursor-pointer w-full font-mono text-[11px] uppercase tracking-widest py-3 bg-primary text-white hover:bg-primary/85 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving…' : 'Save thesis'}
      </button>
    </form>
  )
}
