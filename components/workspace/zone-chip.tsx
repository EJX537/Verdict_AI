'use client'

import type { VerdictData } from '@/lib/mock-data'

const ZONE_STYLES: Record<VerdictData['zone'], string> = {
  Terminal: 'bg-[oklch(0.65_0.14_25/0.12)] text-[oklch(0.55_0.18_25)] border border-[oklch(0.65_0.14_25/0.3)]',
  Critical: 'bg-[oklch(0.72_0.14_30/0.12)] text-[oklch(0.60_0.18_30)] border border-[oklch(0.72_0.14_30/0.3)]',
  Guarded:  'bg-[oklch(0.78_0.12_55/0.12)] text-[oklch(0.62_0.14_55)] border border-[oklch(0.78_0.12_55/0.3)]',
  Stable:   'bg-[oklch(0.82_0.09_150/0.12)] text-[oklch(0.55_0.14_150)] border border-[oklch(0.82_0.09_150/0.3)]',
  Thriving: 'bg-[oklch(0.86_0.06_200/0.12)] text-[oklch(0.50_0.12_200)] border border-[oklch(0.86_0.06_200/0.3)]',
}

interface ZoneChipProps {
  zone: VerdictData['zone']
  className?: string
}

export function ZoneChip({ zone, className = '' }: ZoneChipProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase rounded-sm ${ZONE_STYLES[zone]} ${className}`}
    >
      {zone}
    </span>
  )
}
