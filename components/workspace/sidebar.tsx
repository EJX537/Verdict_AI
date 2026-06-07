'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, BookOpen, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Pipeline', icon: LayoutGrid },
  { href: '/thesis', label: 'Theses', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col h-full w-56 border-r border-border bg-white/70 backdrop-blur-md">
      {/* Logo / wordmark */}
      <div className="px-5 py-5 border-b border-border">
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-primary font-medium">
          Verdict
        </span>
        <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
          {' '}for Investors
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-sm font-sans text-sm transition-colors ${
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/70 hover:text-foreground hover:bg-card'
              }`}
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase">
          Verdict AI
        </p>
      </div>
    </aside>
  )
}
