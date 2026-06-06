'use client'

import { useRef, useState } from 'react'
import { AGENTS } from '@/lib/mock-data'
import type { VerdictData } from '@/lib/mock-data'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  company: string
  verdict: VerdictData
}

const ZONE_COLOR: Record<VerdictData['zone'], string> = {
  Terminal: '#e05252',
  Critical: '#e07c38',
  Guarded: '#c9a227',
  Stable: '#4a9e6b',
  Thriving: '#4a86c8',
}

const W = 600
const H = 380

function VerdictSVG({ company, verdict, provocativeConfig, provocativeAgent }: {
  company: string
  verdict: VerdictData
  provocativeConfig: typeof AGENTS[number] | undefined
  provocativeAgent: VerdictData['agents'][number]
}) {
  const zoneCol = ZONE_COLOR[verdict.zone]
  // Agent score bars
  const barW = 80
  const barH = 4
  const agents = verdict.agents

  // Wrap long text for SVG
  const wrap = (text: string, maxChars: number): string[] => {
    const words = text.split(' ')
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        if (cur) lines.push(cur.trim())
        cur = w
      } else {
        cur = (cur + ' ' + w).trim()
      }
    }
    if (cur) lines.push(cur.trim())
    return lines
  }

  const summaryLines = wrap(provocativeAgent.summary, 62)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      {/* Background */}
      <rect width={W} height={H} fill="#0a0a0a" />

      {/* Left accent strip */}
      <rect x={0} y={0} width={3} height={H} fill={zoneCol} />

      {/* Score */}
      <text x={40} y={90} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={72} fontWeight={300} fill="#ffffff" letterSpacing={-2}>
        {verdict.score}
      </text>

      {/* Zone label */}
      <text x={42} y={116} fontFamily="ui-monospace, monospace" fontSize={12} fill={zoneCol} letterSpacing={4} textAnchor="start">
        {verdict.zone.toUpperCase()}
      </text>

      {/* Divider */}
      <line x1={40} y1={128} x2={W - 40} y2={128} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {/* Agent score rows — name on left, bar in middle, score on right */}
      {agents.map((a, i) => {
        const cfg = AGENTS.find(ag => ag.id === a.id)
        const rowY = 144 + i * 18
        const trackX = 130
        const trackW = W - 40 - trackX - 48
        const fillW = (a.score / 10) * trackW
        return (
          <g key={a.id}>
            <text x={40} y={rowY} fontFamily="ui-monospace, monospace" fontSize={8} fill="rgba(255,255,255,0.45)" letterSpacing={1} dominantBaseline="middle">
              {(cfg?.name ?? a.id).toUpperCase()}
            </text>
            {/* Track */}
            <rect x={trackX} y={rowY - 2} width={trackW} height={4} rx={1} fill="rgba(255,255,255,0.08)" dominantBaseline="middle" />
            {/* Fill */}
            <rect x={trackX} y={rowY - 2} width={fillW} height={4} rx={1} fill={cfg?.chartColor ?? '#fff'} />
            {/* Score value right-aligned */}
            <text x={W - 40} y={rowY} fontFamily="ui-monospace, monospace" fontSize={12} fontWeight={600} fill="rgba(255,255,255,0.8)" textAnchor="end" dominantBaseline="middle">
              {a.score.toFixed(1)}
            </text>
          </g>
        )
      })}

      {/* Divider */}
      <line x1={40} y1={248} x2={W - 40} y2={248} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {/* Pattern match columns — improved layout */}
      {/* Closest dead */}
      <text x={40} y={258} fontFamily="ui-monospace, monospace" fontSize={7} fill="rgba(255,255,255,0.35)" letterSpacing={3}>
        CLOSEST DEAD
      </text>
      <text x={40} y={278} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={15} fontWeight={700} fill="#ffffff">
        {verdict.closestDead.name}
      </text>
      <text x={40} y={295} fontFamily="ui-monospace, monospace" fontSize={10} fontWeight={600} fill="rgba(255,255,255,0.55)">
        {verdict.closestDead.match}% match
      </text>

      {/* Closest living */}
      <text x={300} y={258} fontFamily="ui-monospace, monospace" fontSize={7} fill="rgba(255,255,255,0.35)" letterSpacing={3}>
        CLOSEST LIVING
      </text>
      <text x={300} y={278} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={15} fontWeight={700} fill="#ffffff">
        {verdict.closestAlive.name}
      </text>
      <text x={300} y={295} fontFamily="ui-monospace, monospace" fontSize={10} fontWeight={600} fill="rgba(255,255,255,0.55)">
        {verdict.closestAlive.match}% match
      </text>

      {/* Divider */}
      <line x1={40} y1={312} x2={W - 40} y2={312} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

      {/* Provocative agent header */}
      <rect x={40} y={326} width={16} height={1} fill={provocativeConfig?.chartColor ?? '#fff'} />
      <text x={62} y={326} fontFamily="ui-monospace, monospace" fontSize={8} fill={provocativeConfig?.chartColor ?? '#fff'} letterSpacing={2} dominantBaseline="middle">
        {(provocativeConfig?.name ?? provocativeAgent.id).toUpperCase()}
      </text>

      {/* Agent summary lines */}
      {summaryLines.slice(0, 2).map((line, i) => (
        <text key={i} x={40} y={344 + i * 16} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={11} fill="rgba(255,255,255,0.75)">
          {line}
        </text>
      ))}

      {/* Company — top right */}
      <text x={W - 40} y={52} fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize={20} fontWeight={700} fill="#ffffff" textAnchor="end" letterSpacing={1}>
        {company.toUpperCase()}
      </text>
    </svg>
  )
}

export function ShareModal({ isOpen, onClose, company, verdict }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)

  if (!isOpen) return null

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verdict?id=${encodeURIComponent(company)}`
  // Most provocative agent = furthest from median
  const scores = verdict.agents.map(a => a.score)
  const sortedScores = [...scores].sort((a, b) => a - b)
  const mid = Math.floor(sortedScores.length / 2)
  const median = sortedScores.length % 2 !== 0
    ? sortedScores[mid]
    : (sortedScores[mid - 1] + sortedScores[mid]) / 2
  const provocativeAgent = [...verdict.agents].sort(
    (a, b) => Math.abs(b.score - median) - Math.abs(a.score - median)
  )[0]
  const provocativeConfig = AGENTS.find(a => a.id === provocativeAgent.id)

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Convert the SVG element to a PNG Blob via canvas
  const svgToPngBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const svgEl = svgRef.current
      if (!svgEl) return resolve(null)
      const svgData = new XMLSerializer().serializeToString(svgEl)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = W * 2
        canvas.height = H * 2
        const ctx = canvas.getContext('2d')!
        ctx.scale(2, 2)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        canvas.toBlob(resolve, 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
      img.src = url
    })
  }

  const handleDownload = async () => {
    const blob = await svgToPngBlob()
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `verdict-${company.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  }

  // Copy image to clipboard — user pastes directly into Twitter/LinkedIn composer
  const handleCopyImage = async () => {
    const blob = await svgToPngBlob()
    if (!blob) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 2500)
    } catch {
      // Fallback: download instead
      handleDownload()
    }
  }

  // Open Twitter/LinkedIn with prefilled text — user pastes the copied image in the composer
  const handleShare = (platform: 'twitter' | 'linkedin') => {
    const text = `I ran ${company} through The Verdict — scored ${verdict.score}/100 (${verdict.zone}). Closest dead: ${verdict.closestDead.name}. Closest living: ${verdict.closestAlive.name}.`
    const intentUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    }
    if (intentUrls[platform]) window.open(intentUrls[platform], '_blank', 'width=600,height=400')
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-mono text-xs uppercase tracking-widest text-foreground">Share verdict</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* SVG visual artifact */}
          <div className="border border-foreground/10 overflow-hidden">
            <VerdictSVG
              company={company}
              verdict={verdict}
              provocativeConfig={provocativeConfig}
              provocativeAgent={provocativeAgent}
            />
          </div>

          {/* Download PNG */}
          <div className="hidden">
            {/* Hidden SVG used for PNG export at 2x */}
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
            >
              <VerdictSVG
                company={company}
                verdict={verdict}
                provocativeConfig={provocativeConfig}
                provocativeAgent={provocativeAgent}
              />
      {/* THE VERDICT — bottom right */}
      <text x={W - 40} y={H - 16} fontFamily="ui-monospace, monospace" fontSize={10} fill="rgba(255,255,255,0.4)" textAnchor="end" letterSpacing={4} fontWeight={600}>
        THE VERDICT
      </text>
    </svg>
          </div>

          {/* Verdict URL */}
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Verdict URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-muted border border-border px-3 py-2 font-mono text-xs text-foreground"
              />
              <button
                onClick={handleCopyUrl}
                className="cursor-pointer px-4 py-2 bg-foreground text-background font-mono text-[9px] uppercase tracking-widest hover:bg-foreground/85 transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Step 1: Copy image */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Step 1 — Copy image to clipboard
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCopyImage}
                className="cursor-pointer flex-1 px-4 py-2 bg-foreground text-background font-mono text-[10px] uppercase tracking-widest hover:bg-foreground/85 transition-colors"
              >
                {copiedImage ? 'Copied — paste into tweet' : 'Copy image'}
              </button>
              <button
                onClick={handleDownload}
                className="cursor-pointer px-4 py-2 border border-border text-foreground hover:border-foreground/40 font-mono text-[10px] uppercase tracking-widest transition-colors"
              >
                Download PNG
              </button>
            </div>
          </div>

          {/* Step 2: Open composer */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Step 2 — Open composer and paste
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleShare('twitter')}
                className="cursor-pointer flex-1 px-4 py-2 border border-border text-foreground hover:border-foreground/40 font-mono text-[10px] uppercase tracking-widest transition-colors"
              >
                Open Twitter
              </button>
              <button
                onClick={() => handleShare('linkedin')}
                className="cursor-pointer flex-1 px-4 py-2 border border-border text-foreground hover:border-foreground/40 font-mono text-[10px] uppercase tracking-widest transition-colors"
              >
                Open LinkedIn
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
