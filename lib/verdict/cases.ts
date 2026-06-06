// Static reference cases for twin-matching. Signals are representative
// real-data signal_ids the company strongly exhibited. Scores on the 0..10 Verdict scale.
export interface CaseCompany {
  company: string
  alive: boolean
  score: number
  signals: string[]
}

export const CASES: CaseCompany[] = [
  // Dead
  { company: 'Theranos', alive: false, score: 0.4, signals: ['archive.site_alive', 'people.founder_present', 'press.organic_ratio'] },
  { company: 'Quibi', alive: false, score: 2.2, signals: ['money.funding_recency', 'press.volume_trend', 'archive.snapshot_cadence'] },
  { company: 'WeWork', alive: false, score: 1.8, signals: ['money.investor_quality', 'money.operating_status', 'press.volume_trend'] },
  { company: 'Fast', alive: false, score: 1.1, signals: ['archive.site_alive', 'money.funding_recency', 'people.leadership_visible'] },
  // Living
  { company: 'Stripe', alive: true, score: 8.8, signals: ['money.investor_quality', 'money.total_funding_tier', 'people.founder_present'] },
  { company: 'Figma', alive: true, score: 9.1, signals: ['money.investor_quality', 'press.organic_ratio', 'archive.longevity'] },
  { company: 'Notion', alive: true, score: 7.6, signals: ['people.founder_present', 'press.last_unprompted', 'archive.longevity'] },
  { company: 'Brex', alive: true, score: 7.2, signals: ['money.investor_quality', 'people.leadership_visible', 'press.volume_trend'] },
]
