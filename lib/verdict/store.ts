import { serverClient } from '@/lib/insforge/server'
import type { AgentKey } from './scoring'
import type { Finding, Verdict } from './types'
import type { ThesisFit, CandidateProfile } from './thesis-fit'

// ─── Row types (mirror the InsForge DB schema) ────────────────────────────────

export interface ThesisRow {
  id: string
  sectors: string[]
  stage: string
  geo: string[]
  check_min: number | null
  check_max: number | null
  signal_weights: Record<AgentKey, number>
  created_at: string
}

export interface DealRow {
  id: string
  thesis_id: string | null
  company: string
  company_url: string | null
  founder: string | null
  candidate: CandidateProfile | null
  stage_status: string
  stage_error: string | null
  findings: Finding[] | null
  verdict: Verdict | null
  founder_summary: string | null
  thesis_fit: ThesisFit | null
  created_at: string
  updated_at: string
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateThesisInput {
  sectors: string[]
  stage: string
  geo: string[]
  checkMin?: number
  checkMax?: number
  signalWeights: Record<AgentKey, number>
}

export interface CreateDealInput {
  thesisId: string
  company: string
  companyUrl?: string
  candidate?: CandidateProfile
}

// ─── Store interface (injectable for tests) ──────────────────────────────────

export interface Store {
  createThesis(t: CreateThesisInput): Promise<{ id: string }>
  getThesis(id: string): Promise<ThesisRow | null>
  createDeal(input: CreateDealInput): Promise<DealRow>
  getDeal(id: string): Promise<DealRow | null>
  listDeals(): Promise<DealRow[]>
  updateDealStage(id: string, stage: string, patch?: Partial<Pick<DealRow, 'findings'>>): Promise<void>
  saveDealResult(id: string, r: { findings: Finding[]; verdict: Verdict; founderSummary: string; thesisFit: ThesisFit }): Promise<void>
  failDeal(id: string, message: string): Promise<void>
}

// ─── DB implementation ────────────────────────────────────────────────────────

export const dbStore: Store = {
  async createThesis(t) {
    const { data, error } = await serverClient.database
      .from('theses')
      .insert([
        {
          sectors: t.sectors,
          stage: t.stage,
          geo: t.geo,
          check_min: t.checkMin ?? null,
          check_max: t.checkMax ?? null,
          signal_weights: t.signalWeights,
        },
      ])
      .select()
    if (error) throw new Error(`createThesis: ${error.message}`)
    const row = (data as ThesisRow[])[0]
    return { id: row.id }
  },

  async getThesis(id) {
    const { data, error } = await serverClient.database
      .from('theses')
      .select('*')
      .eq('id', id)
    if (error) throw new Error(`getThesis: ${error.message}`)
    const rows = data as ThesisRow[]
    return rows.length > 0 ? rows[0] : null
  },

  async createDeal(input) {
    const { data, error } = await serverClient.database
      .from('deals')
      .insert([
        {
          thesis_id: input.thesisId,
          company: input.company,
          company_url: input.companyUrl ?? null,
          candidate: input.candidate ?? null,
          stage_status: 'queued',
        },
      ])
      .select()
    if (error) throw new Error(`createDeal: ${error.message}`)
    return (data as DealRow[])[0]
  },

  async getDeal(id) {
    const { data, error } = await serverClient.database
      .from('deals')
      .select('*')
      .eq('id', id)
    if (error) throw new Error(`getDeal: ${error.message}`)
    const rows = data as DealRow[]
    return rows.length > 0 ? rows[0] : null
  },

  async listDeals() {
    const { data, error } = await serverClient.database
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`listDeals: ${error.message}`)
    return (data as DealRow[]) ?? []
  },

  async updateDealStage(id, stage, patch) {
    const payload: Record<string, unknown> = { stage_status: stage }
    if (patch?.findings !== undefined) payload.findings = patch.findings
    const { error } = await serverClient.database
      .from('deals')
      .update(payload)
      .eq('id', id)
      .select()
    if (error) throw new Error(`updateDealStage: ${error.message}`)
  },

  async saveDealResult(id, r) {
    const { error } = await serverClient.database
      .from('deals')
      .update({
        findings: r.findings,
        verdict: r.verdict,
        founder_summary: r.founderSummary,
        thesis_fit: r.thesisFit,
      })
      .eq('id', id)
      .select()
    if (error) throw new Error(`saveDealResult: ${error.message}`)
  },

  async failDeal(id, message) {
    const { error } = await serverClient.database
      .from('deals')
      .update({ stage_status: 'error', stage_error: message })
      .eq('id', id)
      .select()
    if (error) throw new Error(`failDeal: ${error.message}`)
  },
}
