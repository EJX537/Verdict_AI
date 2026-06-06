export type AgentId = 'archivist' | 'money_tracker' | 'people_watcher' | 'press_room'

export interface AgentConfig {
  id: AgentId
  name: string
  colorClass: string
  bgClass: string
  borderClass: string
  chartColor: string
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'archivist',
    name: 'Archivist',
    colorClass: 'text-[oklch(0.72_0.08_220)]',
    bgClass: 'bg-[oklch(0.72_0.08_220/0.08)]',
    borderClass: 'border-[oklch(0.72_0.08_220/0.3)]',
    chartColor: 'oklch(0.72 0.08 220)',
  },
  {
    id: 'money_tracker',
    name: 'Money Tracker',
    colorClass: 'text-[oklch(0.74_0.12_55)]',
    bgClass: 'bg-[oklch(0.74_0.12_55/0.08)]',
    borderClass: 'border-[oklch(0.74_0.12_55/0.3)]',
    chartColor: 'oklch(0.74 0.12 55)',
  },
  {
    id: 'people_watcher',
    name: 'People Watcher',
    colorClass: 'text-[oklch(0.68_0.12_340)]',
    bgClass: 'bg-[oklch(0.68_0.12_340/0.08)]',
    borderClass: 'border-[oklch(0.68_0.12_340/0.3)]',
    chartColor: 'oklch(0.68 0.12 340)',
  },
  {
    id: 'press_room',
    name: 'Press Room',
    colorClass: 'text-[oklch(0.72_0.1_160)]',
    bgClass: 'bg-[oklch(0.72_0.1_160/0.08)]',
    borderClass: 'border-[oklch(0.72_0.1_160/0.3)]',
    chartColor: 'oklch(0.72 0.1 160)',
  },
]

export interface AgentState {
  id: AgentId
  task: string
  signalCount: number
  score: number | null
  active: boolean
  complete: boolean
  pulseKey: number
}

export interface EvidenceItem {
  id: string
  agent: AgentId
  finding: string
  delta: number
  source: string
  timestamp: number
  confidence: 'high' | 'medium' | 'low'
}

export interface SignalPoint {
  t: number
  archivist: number
  money_tracker: number
  people_watcher: number
  press_room: number
}

export interface VerdictData {
  score: number
  zone: 'Terminal' | 'Critical' | 'Guarded' | 'Stable' | 'Thriving'
  agents: {
    id: AgentId
    score: number
    summary: string
    sourceCount: number
  }[]
  closestDead: { name: string; match: number; cause: string }
  closestAlive: { name: string; match: number; what: string }
  fork: string
  counterfactual: string
  timeline: { t: number; label: string; score: number; critical?: boolean }[]
}

export function getZone(score: number): VerdictData['zone'] {
  if (score < 30) return 'Terminal'
  if (score < 50) return 'Critical'
  if (score < 65) return 'Guarded'
  if (score < 80) return 'Stable'
  return 'Thriving'
}

export function getScoreTint(score: number): string {
  // Cool blue-grey (low) → neutral dark (mid) → warm dark (high)
  if (score < 30) return 'oklch(0.16 0.025 260)'
  if (score < 50) return 'oklch(0.16 0.02 30)'
  if (score < 65) return 'oklch(0.15 0.008 60)'
  if (score < 80) return 'oklch(0.15 0 0)'
  return 'oklch(0.16 0.012 90)'
}

export const RECENT_CASES = [
  { company: 'Theranos', score: 4, zone: 'Terminal' },
  { company: 'WeWork', score: 18, zone: 'Terminal' },
  { company: 'Juicero', score: 22, zone: 'Critical' },
  { company: 'Quibi', score: 29, zone: 'Critical' },
  { company: 'Figma', score: 91, zone: 'Thriving' },
  { company: 'Stripe', score: 88, zone: 'Thriving' },
  { company: 'Notion', score: 76, zone: 'Stable' },
  { company: 'Clubhouse', score: 41, zone: 'Guarded' },
  { company: 'Robinhood', score: 48, zone: 'Guarded' },
  { company: 'Brex', score: 72, zone: 'Stable' },
  { company: 'Fast.co', score: 11, zone: 'Terminal' },
  { company: 'Bolt', score: 34, zone: 'Guarded' },
]

// Simulate investigation events for a given company
export function generateMockInvestigation(company: string) {
  const seed = company.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = (min: number, max: number, offset = 0) => {
    const x = Math.sin(seed + offset) * 10000
    return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min
  }

  const finalScore = rand(15, 85, 1)

  const events: Array<
    | { type: 'agent_update'; delay: number; agent: AgentId; task: string }
    | { type: 'evidence'; delay: number; agent: AgentId; finding: string; delta: number; source: string; confidence: 'high' | 'medium' | 'low' }
    | { type: 'agent_complete'; delay: number; agent: AgentId; final_score: number }
    | { type: 'verdict_ready'; delay: number }
  > = []

  const tasksByAgent: Record<AgentId, string[]> = {
    archivist: [
      'Pulling incorporation records',
      'Cross-referencing patent filings since 2019',
      'Scanning SEC filings for material changes',
      'Verifying registered addresses and subsidiaries',
      'Indexing historical web snapshots',
    ],
    money_tracker: [
      'Fetching Crunchbase funding history',
      'Checking runway estimates from last 10-Q',
      'Scanning for insider sales and vesting cliffs',
      'Comparing burn rate to sector benchmarks',
      'Tracing Series C wire transfers',
    ],
    people_watcher: [
      'Scanning executive departures since 2021',
      'Cross-referencing LinkedIn tenure data',
      'Flagging board resignations',
      'Checking Glassdoor rating trajectory',
      'Mapping org chart changes in last 6 months',
    ],
    press_room: [
      'Indexing press mentions last 90 days',
      'Sentiment analysis on tech press coverage',
      'Checking for product recall notices',
      'Scanning regulatory filings for fines',
      'Monitoring social media volume and tone',
    ],
  }

  const evidenceByAgent: Record<AgentId, Array<{ finding: string; delta: number; source: string; confidence: 'high' | 'medium' | 'low' }>> = {
    archivist: [
      { finding: 'Registered agent changed twice in 14 months', delta: -6, source: 'https://sec.gov/cgi-bin/browse-edgar', confidence: 'high' },
      { finding: 'Three subsidiary shell companies dissolved in 2023', delta: -4, source: 'https://opencorporates.com', confidence: 'medium' },
      { finding: 'Delaware C-corp in good standing since founding', delta: 3, source: 'https://icis.corp.delaware.gov', confidence: 'high' },
      { finding: 'Patent portfolio expanded 40% YoY', delta: 7, source: 'https://patents.google.com', confidence: 'medium' },
    ],
    money_tracker: [
      { finding: `Series B closed — $75M at $420M valuation`, delta: 8, source: 'https://crunchbase.com/organization', confidence: 'high' },
      { finding: 'CFO exercised 85% of vested options in Q3', delta: -9, source: 'https://sec.gov/cgi-bin/browse-edgar', confidence: 'high' },
      { finding: 'Estimated 14-month runway at current burn', delta: 5, source: 'https://pitchbook.com', confidence: 'medium' },
      { finding: 'Revenue grew 180% YoY per leaked board deck', delta: 12, source: 'https://twitter.com/verified_leak', confidence: 'low' },
    ],
    people_watcher: [
      { finding: 'CTO departed without successor named', delta: -11, source: 'https://linkedin.com/in/ex-cto', confidence: 'high' },
      { finding: 'Glassdoor rating dropped from 4.1 to 2.8 in 8 months', delta: -8, source: 'https://glassdoor.com', confidence: 'high' },
      { finding: 'Founder still holds 34% equity — alignment intact', delta: 6, source: 'https://sec.gov/cgi-bin/browse-edgar', confidence: 'high' },
      { finding: '6 of 12 senior engineers left in last 90 days', delta: -10, source: 'https://linkedin.com/jobs', confidence: 'medium' },
    ],
    press_room: [
      { finding: 'TechCrunch piece on product pivot went viral', delta: -5, source: 'https://techcrunch.com', confidence: 'high' },
      { finding: 'FTC opened preliminary inquiry per Reuters', delta: -14, source: 'https://reuters.com/technology', confidence: 'high' },
      { finding: 'Named in Fast Company "Most Innovative" list', delta: 4, source: 'https://fastcompany.com', confidence: 'medium' },
      { finding: 'Press volume down 62% vs prior quarter', delta: -6, source: 'https://mention.com', confidence: 'medium' },
    ],
  }

  const agentOrder: AgentId[] = ['archivist', 'money_tracker', 'people_watcher', 'press_room']
  let t = 0

  agentOrder.forEach((agent, i) => {
    const tasks = tasksByAgent[agent]
    const evidence = evidenceByAgent[agent]
    const startDelay = i * 800 + rand(200, 600, i * 10)

    tasks.forEach((task, j) => {
      events.push({ type: 'agent_update', delay: startDelay + j * rand(1400, 2200, i * 100 + j), agent, task })
    })

    evidence.forEach((ev, j) => {
      events.push({ type: 'evidence', delay: startDelay + rand(2000, 8000, i * 50 + j), agent, ...ev })
    })

    const completionDelay = startDelay + rand(10000, 16000, i * 7)
    events.push({ type: 'agent_complete', delay: completionDelay, agent, final_score: rand(2, 10, i * 33 + seed) })
    t = Math.max(t, completionDelay)
  })

  events.push({ type: 'verdict_ready', delay: t + 1200 })
  events.sort((a, b) => a.delay - b.delay)

  const verdict: VerdictData = {
    score: finalScore,
    zone: getZone(finalScore),
    agents: [
      {
        id: 'archivist',
        score: rand(1, 10, 11),
        summary: `Corporate records show ${finalScore > 60 ? 'consistent good standing with clear legal structure and no pending liabilities' : 'multiple structural anomalies and dissolved subsidiaries that suggest financial engineering'}.`,
        sourceCount: rand(6, 14, 21),
      },
      {
        id: 'money_tracker',
        score: rand(1, 10, 22),
        summary: `Funding trajectory is ${finalScore > 60 ? 'healthy with strong institutional backing and no insider liquidation pressure' : 'concerning — insider selling and compressed runway point to a capital crisis within 12 months'}.`,
        sourceCount: rand(4, 11, 32),
      },
      {
        id: 'people_watcher',
        score: rand(1, 10, 33),
        summary: `Talent signals are ${finalScore > 60 ? 'positive — low attrition, strong founder equity, and board stability indicate organizational health' : 'alarming — CTO departure, cascading engineer exits, and Glassdoor collapse are the canonical pre-failure pattern'}.`,
        sourceCount: rand(5, 13, 43),
      },
      {
        id: 'press_room',
        score: rand(1, 10, 44),
        summary: `Media posture is ${finalScore > 60 ? 'controlled and positive — coverage is growing and regulatory exposure is minimal' : 'deteriorating — regulatory scrutiny and declining press volume create a credibility vacuum'}.`,
        sourceCount: rand(7, 16, 54),
      },
    ],
    closestDead: finalScore < 50
      ? { name: 'Quibi', match: rand(71, 89, 61), cause: 'product-market misalignment and talent exodus' }
      : { name: 'WeWork', match: rand(42, 58, 61), cause: 'governance collapse and unsustainable burn' },
    closestAlive: finalScore >= 50
      ? { name: 'Brex', match: rand(68, 82, 71), what: 'pivoting ICP before burn forced the question' }
      : { name: 'Notion', match: rand(38, 52, 71), what: 'maintaining product discipline through leadership turbulence' },
    fork: finalScore < 50
      ? `Where ${company} diverged from its living twin: talent retention collapsed 8 months before the financial signals became visible.`
      : `${company} mirrors its living twin most closely in capital discipline — the divergence point is product clarity, which remains unresolved.`,
    counterfactual: finalScore < 50
      ? `If the CTO had been retained — or replaced within 60 days — the engineering exodus likely does not happen, the product pivot is executed cleanly, and the runway extends by 18+ months. The single highest-leverage intervention was a $600K retention package that was never offered.`
      : `Resolving the ICP ambiguity — specifically committing to either enterprise or SMB, not both — would likely push this score into the Thriving band. The cost of indecision is estimated at 40% of available market capture.`,
    timeline: (() => {
      const rawEvents = [
        { t: 0,  label: 'Founded',                critical: false },
        { t: 18, label: 'Seed round closes',       critical: false },
        { t: 30, label: 'Series A — $22M',         critical: false },
        { t: 42, label: 'Product launch',          critical: false },
        { t: 50, label: 'Series B — $75M',         critical: finalScore < 50 },
        { t: 56, label: 'CTO departure',           critical: true },
        { t: 62, label: 'FTC inquiry opened',      critical: finalScore < 60 },
        { t: 68, label: 'Engineering exodus',      critical: finalScore < 50 },
        { t: 72, label: 'Product pivot announced', critical: false },
        { t: 78, label: 'Glassdoor collapse',      critical: finalScore < 55 },
        { t: 84, label: 'Now',                     critical: false },
      ]
      const maxT = rawEvents[rawEvents.length - 1].t
      // Interpolate health score per event: start at 72 (healthy birth),
      // arc toward finalScore. Critical events drag score down by 15–25 pts.
      let running = 72
      return rawEvents.map(({ t, label, critical }) => {
        const progress = t / maxT
        // Linear interpolation target at this time point
        const target = 72 + (finalScore - 72) * progress
        // Snap running score toward target
        running = running * 0.55 + target * 0.45
        // Critical events inflict a sharp penalty
        if (critical) running = Math.max(5, running - rand(15, 25, t))
        const score = Math.round(Math.max(3, Math.min(100, running)))
        return { t, label, score, ...(critical ? { critical: true } : {}) }
      })
    })(),
  }

  return { events, verdict, finalScore }
}
