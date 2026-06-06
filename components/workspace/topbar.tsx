'use client'

import { Search } from 'lucide-react'

interface TopbarProps {
  onNewDiligence?: () => void
}

export function Topbar({ onNewDiligence }: TopbarProps) {
  return (
    <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-white/70 backdrop-blur-md">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-sm border border-border bg-card px-3 py-2">
        <Search size={13} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search deals…"
          className="flex-1 bg-transparent font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="flex-1" />

      {/* Account stub */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground tracking-wide uppercase">
          VC Workspace
        </span>
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="font-mono text-[10px] text-primary font-medium">V</span>
        </div>
      </div>

      {/* New diligence CTA */}
      <button
        onClick={onNewDiligence}
        className="cursor-pointer font-mono text-[10px] uppercase tracking-widest px-4 py-2 bg-primary text-white hover:bg-primary/85 transition-colors whitespace-nowrap"
      >
        + New diligence
      </button>
    </header>
  )
}
