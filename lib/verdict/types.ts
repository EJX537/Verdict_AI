// The Verdict — shared contract types.
// Every data agent emits Finding[]; the Scoring Agent fuses them into a Verdict.
// Scores are on a 0..10 scale (10 = healthy, 0 = deadpool).

export type SourceAgent =
  | 'money_tracker'
  | 'people_watcher'
  | 'press_room'
  | 'archivist'

export type Direction =
  | 'survival_positive'
  | 'survival_negative'
  | 'neutral'

export type ProvenanceTier = 'high' | 'medium' | 'low'

export type Zone =
  | 'Thriving'
  | 'Stable'
  | 'Watch'
  | 'Distressed'
  | 'Deadpool'

// The contract: a single scored signal emitted by a data agent.
export interface Finding {
  signal_id: string // stable id, e.g. "money.round_gap"
  source_agent: SourceAgent
  value: unknown // raw measured value
  delta: number | null // change vs previous run / prior period
  direction: Direction
  confidence: number // 0..1, provenance_tier × data completeness
  provenance_tier: ProvenanceTier
  plain_english: string // human-readable finding for the UI
  as_of: string // ISO timestamp
}

export interface CaseMatch {
  company: string
  distance: number
  shared_signals: string[]
}

// The fused output produced by the Scoring Agent.
export interface Verdict {
  overall_score: number // 0..10
  zone: Zone
  agent_scores: {
    money: number
    people: number
    press: number
    archive: number
  }
  overrides_fired: string[]
  closest_dead: CaseMatch
  closest_living: CaseMatch
  counterfactual: string // LLM-written, grounded ONLY in the findings
  confidence: number // 0..1
}
