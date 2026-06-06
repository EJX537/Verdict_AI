import { useState } from 'react'
import { AGENTS } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  company: string
  verdict: VerdictData
}

export function ShareModal({ isOpen, onClose, company, verdict }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [copiedVisual, setCopiedVisual] = useState(false)

  if (!isOpen) return null

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verdict?id=${encodeURIComponent(company)}`
  const zoneColor: Record<VerdictData['zone'], string> = {
    Terminal: '#c0392b',
    Critical: '#e67e22',
    Guarded: '#d4ac0d',
    Stable: '#27ae60',
    Thriving: '#2980b9',
  }

  // Generate visual grid like Wordle (emoji-based)
  const zoneEmoji: Record<VerdictData['zone'], string> = {
    Terminal: '🔴',
    Critical: '🟠',
    Guarded: '🟡',
    Stable: '🟢',
    Thriving: '🔵',
  }

  // Create a 5x2 grid showing the score and agents
  const generateVisualGrid = () => {
    const scoreStr = verdict.score.toString()
    const zoneEmoji_ = zoneEmoji[verdict.zone]
    const agentScores = verdict.agents.map(a => Math.round(a.score))

    // Row 1: Score and zone
    let grid = `${scoreStr}\n`
    grid += `${zoneEmoji_} ${verdict.zone}\n\n`

    // Row 2: Agent scores as colored squares
    grid += agentScores.map((score) => {
      if (score >= 8) return '🟢'
      if (score >= 6) return '🟡'
      if (score >= 4) return '🟠'
      return '🔴'
    }).join(' ')
    grid += '\n\n'

    // Company name
    grid += `${company}\nThe Verdict`

    return grid
  }

  const visualGrid = generateVisualGrid()

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyVisual = () => {
    navigator.clipboard?.writeText(visualGrid)
    setCopiedVisual(true)
    setTimeout(() => setCopiedVisual(false), 2000)
  }

  const handleShare = (platform: 'twitter' | 'linkedin') => {
    const text = `${visualGrid}\n\n${shareUrl}`
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(visualGrid)}`,
    }
    if (urls[platform]) window.open(urls[platform], '_blank', 'width=600,height=400')
  }

  // Most provocative agent = furthest absolute distance from the median score
  const scores = verdict.agents.map(a => a.score)
  const sorted = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const provocativeAgent = [...verdict.agents].sort(
    (a, b) => Math.abs(b.score - median) - Math.abs(a.score - median)
  )[0]
  const provocativeConfig = AGENTS.find(a => a.id === provocativeAgent.id)

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-mono text-sm uppercase tracking-widest text-foreground">Share verdict</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Visual artifact preview */}
        <div className="p-6">
          <div className="bg-black rounded border border-foreground/10 p-6 mb-6">
            {/* Score display */}
            <div className="text-center mb-6">
              <div className="font-sans text-5xl font-light text-foreground mb-2">
                {verdict.score}
              </div>
              <div
                className="font-mono text-xs uppercase tracking-[0.3em] mb-2"
                style={{ color: zoneColor[verdict.zone] }}
              >
                {verdict.zone}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {company}
              </div>
            </div>

            {/* Pattern match */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-foreground/10">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Closest dead
                </div>
                <div className="font-sans text-sm text-foreground font-medium">
                  {verdict.closestDead.name}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground mt-1">
                  {verdict.closestDead.match}% match
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                  Closest living
                </div>
                <div className="font-sans text-sm text-foreground font-medium">
                  {verdict.closestAlive.name}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground mt-1">
                  {verdict.closestAlive.match}% match
                </div>
              </div>
            </div>

            {/* Most provocative agent */}
            <div className="pt-4 border-t border-foreground/10 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-4 h-px"
                  style={{ backgroundColor: provocativeConfig?.chartColor ?? '#fff' }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: provocativeConfig?.chartColor ?? '#fff' }}
                >
                  {provocativeConfig?.name ?? provocativeAgent.id}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                  {provocativeAgent.score}/10
                </span>
              </div>
              <p className="font-sans text-xs text-foreground/80 leading-relaxed">
                {provocativeAgent.summary}
              </p>
            </div>
          </div>

          {/* Share URL */}
          <div className="mb-6">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Verdict URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-muted border border-border px-3 py-2 font-mono text-xs text-foreground rounded"
              />
              <button
                onClick={handleCopyUrl}
                className="cursor-pointer px-4 py-2 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest hover:bg-foreground/85 transition-colors rounded whitespace-nowrap"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Visual grid preview */}
          <div className="mb-6">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Share visual
            </label>
            <div className="bg-muted border border-border rounded p-4 mb-3 font-mono text-sm whitespace-pre-wrap text-foreground text-center">
              {visualGrid}
            </div>
            <button
              onClick={handleCopyVisual}
              className="w-full cursor-pointer px-4 py-2 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest hover:bg-foreground/85 transition-colors rounded whitespace-nowrap"
            >
              {copiedVisual ? 'Copied visual' : 'Copy visual'}
            </button>
          </div>

          {/* Social share buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleShare('twitter')}
              className="cursor-pointer flex-1 px-4 py-2 border border-border text-foreground hover:border-foreground/40 font-mono text-[10px] uppercase tracking-widest transition-colors rounded"
            >
              Open Twitter
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              className="cursor-pointer flex-1 px-4 py-2 border border-border text-foreground hover:border-foreground/40 font-mono text-[10px] uppercase tracking-widest transition-colors rounded"
            >
              Open LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
