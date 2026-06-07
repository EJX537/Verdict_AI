'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { NewDiligenceDialog } from './new-diligence-dialog'
import { CopilotPanel } from './copilot'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onNewDiligence={() => setDialogOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Right rail — collapsible copilot panel (3c) */}
      <CopilotPanel />

      <NewDiligenceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
