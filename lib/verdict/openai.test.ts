import { describe, it, expect, vi } from 'vitest'
import { writeCounterfactual, writeFounderSummary, type ChatCaller } from './openai'
import { scoreVerdict } from './scoring'
import type { Finding } from './types'

const ASOF = '2026-06-06T00:00:00.000Z'
const findings: Finding[] = [
  { signal_id: 'people.leadership_visible', source_agent: 'people_watcher', value: 1, delta: null, direction: 'survival_negative', confidence: 0.5, provenance_tier: 'low', plain_english: 'Only 1 senior leader visible', as_of: ASOF },
]

describe('openai prose', () => {
  it('writeCounterfactual passes findings to the caller and returns its text', async () => {
    const complete = vi.fn().mockResolvedValue('If a second senior leader were hired...')
    const caller: ChatCaller = { complete }
    const core = scoreVerdict(findings)
    const out = await writeCounterfactual(findings, core, caller)
    expect(out).toBe('If a second senior leader were hired...')
    const userPrompt = complete.mock.calls[0][1] as string
    expect(userPrompt).toContain('Only 1 senior leader visible')
    expect(userPrompt.toLowerCase()).toContain('counterfactual')
  })

  it('writeFounderSummary returns the caller text', async () => {
    const complete = vi.fn().mockResolvedValue('Leadership bench is thin.')
    const caller: ChatCaller = { complete }
    const out = await writeFounderSummary(findings, caller)
    expect(out).toContain('Leadership')
  })
})
