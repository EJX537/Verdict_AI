'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { EntryPage } from '@/components/entry-page'
import { InvestigationRoom } from '@/components/investigation-room'
import { VerdictPage } from '@/components/verdict-page'
import {
  generateMockInvestigation,
  AGENTS,
  type AgentId,
  type AgentState,
  type EvidenceItem,
  type SignalPoint,
  type VerdictData,
} from '@/lib/mock-data'

type AppView = 'entry' | 'investigation' | 'verdict'

const INITIAL_AGENT_STATES: AgentState[] = AGENTS.map((a) => ({
  id: a.id,
  task: 'Queued',
  signalCount: 0,
  score: null,
  active: false,
  complete: false,
  pulseKey: 0,
}))

const INITIAL_SIGNAL_POINT: SignalPoint = {
  t: 0,
  archivist: 5,
  money_tracker: 5,
  people_watcher: 5,
  press_room: 5,
}

export default function App() {
  const [view, setView] = useState<AppView>('entry')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<'investigating' | 'filing' | 'complete'>('investigating')
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENT_STATES)
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [signalPoints, setSignalPoints] = useState<SignalPoint[]>([INITIAL_SIGNAL_POINT])
  const [verdict, setVerdict] = useState<VerdictData | null>(null)

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const signalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const agentScoresRef = useRef<Record<AgentId, number>>({
    archivist: 5,
    money_tracker: 5,
    people_watcher: 5,
    press_room: 5,
  })
  const pointCountRef = useRef(0)

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (signalTimerRef.current) {
      clearInterval(signalTimerRef.current)
      signalTimerRef.current = null
    }
  }, [])

  const startInvestigation = useCallback(
    (companyName: string) => {
      clearAll()
      setCompany(companyName)
      setStatus('investigating')
      setAgents(INITIAL_AGENT_STATES)
      setEvidence([])
      setVerdict(null)
      agentScoresRef.current = { archivist: 5, money_tracker: 5, people_watcher: 5, press_room: 5 }
      pointCountRef.current = 0
      setSignalPoints([INITIAL_SIGNAL_POINT])
      setView('investigation')

      const { events, verdict: verdictData } = generateMockInvestigation(companyName)

      // Jitter timer — adds noise between real events to keep the graph breathing
      signalTimerRef.current = setInterval(() => {
        pointCountRef.current += 1
        const t = pointCountRef.current
        setSignalPoints((prev) => {
          const jitter = (id: AgentId) => {
            const base = agentScoresRef.current[id]
            const noise = (Math.random() - 0.5) * 0.3
            return Math.max(0, Math.min(10, base + noise))
          }
          return [
            ...prev,
            {
              t,
              archivist: jitter('archivist'),
              money_tracker: jitter('money_tracker'),
              people_watcher: jitter('people_watcher'),
              press_room: jitter('press_room'),
            },
          ]
        })
      }, 800)

      // Schedule all events
      events.forEach((event) => {
        const tid = setTimeout(() => {
          if (event.type === 'agent_update') {
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, task: event.task, active: true, pulseKey: a.pulseKey + 1 }
                  : a
              )
            )
          } else if (event.type === 'evidence') {
            const item: EvidenceItem = {
              id: `${event.agent}-${Date.now()}-${Math.random()}`,
              agent: event.agent,
              finding: event.finding,
              delta: event.delta,
              source: event.source,
              timestamp: Date.now(),
              confidence: event.confidence,
            }
            setEvidence((prev) => [item, ...prev])
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, signalCount: a.signalCount + 1, pulseKey: a.pulseKey + 1 }
                  : a
              )
            )
            // Update running score for the agent
            const agentId = event.agent as AgentId
            agentScoresRef.current[agentId] = Math.max(
              0,
              Math.min(10, agentScoresRef.current[agentId] + event.delta * 0.15)
            )
          } else if (event.type === 'agent_complete') {
            agentScoresRef.current[event.agent as AgentId] = event.final_score
            setAgents((prev) =>
              prev.map((a) =>
                a.id === event.agent
                  ? { ...a, active: false, complete: true, score: event.final_score }
                  : a
              )
            )
          } else if (event.type === 'verdict_ready') {
            setStatus('filing')
            const filingTid = setTimeout(() => {
              clearAll()
              setVerdict(verdictData)
              setStatus('complete')
              setView('verdict')
            }, 1800)
            timeoutsRef.current.push(filingTid)
          }
        }, event.delay)
        timeoutsRef.current.push(tid)
      })
    },
    [clearAll]
  )

  const handleReset = useCallback(() => {
    clearAll()
    setView('entry')
    setCompany('')
    setVerdict(null)
    setAgents(INITIAL_AGENT_STATES)
    setEvidence([])
    setSignalPoints([INITIAL_SIGNAL_POINT])
  }, [clearAll])

  // Clean up on unmount
  useEffect(() => () => clearAll(), [clearAll])

  if (view === 'entry') {
    return <EntryPage onSubmit={startInvestigation} />
  }

  if (view === 'investigation') {
    return (
      <InvestigationRoom
        company={company}
        status={status}
        agents={agents}
        evidence={evidence}
        signalPoints={signalPoints}
      />
    )
  }

  if (view === 'verdict' && verdict) {
    return (
      <VerdictPage
        company={company}
        verdict={verdict}
        onReset={handleReset}
        onCompare={(c) => startInvestigation(c)}
      />
    )
  }

  return null
}
