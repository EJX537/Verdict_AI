import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Store, DealRow, ThesisRow, OutreachRow } from './store'
import type { AgentKey } from './scoring'

// ─── Minimal fake store ───────────────────────────────────────────────────────

function makeFakeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'deal-test-1',
    thesis_id: 'thesis-test-1',
    company: 'Acme',
    company_url: 'https://acme.io',
    founder: null,
    candidate: null,
    stage_status: 'queued',
    stage_error: null,
    findings: null,
    verdict: null,
    founder_summary: null,
    thesis_fit: null,
    created_at: '2026-06-06T00:00:00Z',
    updated_at: '2026-06-06T00:00:00Z',
    ...overrides,
  }
}

function makeFakeThesis(overrides: Partial<ThesisRow> = {}): ThesisRow {
  const weights: Record<AgentKey, number> = { money: 1, people: 1, press: 1, archive: 1 }
  return {
    id: 'thesis-test-1',
    sectors: ['saas'],
    stage: 'seed',
    geo: ['us'],
    check_min: null,
    check_max: null,
    signal_weights: weights,
    created_at: '2026-06-06T00:00:00Z',
    ...overrides,
  }
}

function makeFakeStore(overrides: Partial<Store> = {}): Store {
  return {
    createThesis: vi.fn().mockResolvedValue({ id: 'thesis-new' }),
    getThesis: vi.fn().mockResolvedValue(makeFakeThesis()),
    listTheses: vi.fn().mockResolvedValue([]),
    createDeal: vi.fn().mockResolvedValue(makeFakeDeal()),
    getDeal: vi.fn().mockResolvedValue(makeFakeDeal()),
    listDeals: vi.fn().mockResolvedValue([makeFakeDeal()]),
    updateDealStage: vi.fn().mockResolvedValue(undefined),
    saveDealResult: vi.fn().mockResolvedValue(undefined),
    failDeal: vi.fn().mockResolvedValue(undefined),
    createOutreach: vi.fn().mockResolvedValue({} as OutreachRow),
    getOutreachByDeal: vi.fn().mockResolvedValue([]),
    updateOutreach: vi.fn().mockResolvedValue({} as OutreachRow),
    ...overrides,
  }
}

// Import after defining fakes so we don't need live DB
import { buildCopilotTools } from './copilot-tools'

const TOOL_OPTIONS = { toolCallId: 'tc-test', messages: [] as [] }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildCopilotTools — listDeals', () => {
  it('returns a deals array via the injected store', async () => {
    const fakeStore = makeFakeStore()
    const { listDeals } = buildCopilotTools({ store: fakeStore })

    // execute is always present (we always pass an execute fn), cast to avoid TS noise
    const execute = listDeals.execute!
    const result = await execute({}, TOOL_OPTIONS)

    expect(fakeStore.listDeals).toHaveBeenCalledOnce()
    expect(result).toHaveProperty('deals')
    expect(Array.isArray((result as { deals: unknown[] }).deals)).toBe(true)
  })
})

describe('buildCopilotTools — getDeal', () => {
  it('returns deal data when found', async () => {
    const fakeStore = makeFakeStore()
    const { getDeal } = buildCopilotTools({ store: fakeStore })

    const execute = getDeal.execute!
    const result = await execute({ id: 'deal-test-1' }, TOOL_OPTIONS)

    expect(fakeStore.getDeal).toHaveBeenCalledWith('deal-test-1')
    expect(result).toHaveProperty('deal')
  })

  it('returns error when deal not found', async () => {
    const fakeStore = makeFakeStore({ getDeal: vi.fn().mockResolvedValue(null) })
    const { getDeal } = buildCopilotTools({ store: fakeStore })

    const execute = getDeal.execute!
    const result = await execute({ id: 'missing' }, TOOL_OPTIONS)

    expect(result).toHaveProperty('error')
  })
})

describe('buildCopilotTools — diligenceCompany (confirm gate)', () => {
  let fakeStore: Store
  const fakeOrchestrate = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    fakeStore = makeFakeStore()
    fakeOrchestrate.mockResolvedValue(undefined)
    // The server credit-spend gate must be explicitly enabled; on for these tests.
    process.env.COPILOT_DILIGENCE_ENABLED = 'true'
  })

  it('does NOT create a deal when confirm is false', async () => {
    const { diligenceCompany } = buildCopilotTools({
      store: fakeStore,
      orchestrate: fakeOrchestrate,
    })

    const execute = diligenceCompany.execute!
    const result = await execute(
      { company: 'Stripe', thesisId: 'thesis-test-1', confirm: false },
      TOOL_OPTIONS,
    )

    // Must NOT have touched the DB
    expect(fakeStore.createDeal).not.toHaveBeenCalled()
    expect(fakeOrchestrate).not.toHaveBeenCalled()

    // Must return a confirmation-required message
    expect((result as { status: string }).status).toBe('needs_confirmation')
  })

  it('creates a deal and fires orchestrateDeal when confirm is true', async () => {
    const { diligenceCompany } = buildCopilotTools({
      store: fakeStore,
      orchestrate: fakeOrchestrate,
    })

    const execute = diligenceCompany.execute!
    const result = await execute(
      {
        company: 'Stripe',
        companyUrl: 'https://stripe.com',
        thesisId: 'thesis-test-1',
        confirm: true,
      },
      TOOL_OPTIONS,
    )

    expect(fakeStore.getThesis).toHaveBeenCalledWith('thesis-test-1')
    expect(fakeStore.createDeal).toHaveBeenCalledOnce()

    // Give the fire-and-forget a tick to settle
    await new Promise((r) => setTimeout(r, 0))
    expect(fakeOrchestrate).toHaveBeenCalledOnce()

    expect((result as { status: string }).status).toBe('started')
    expect((result as { dealId: string }).dealId).toBe('deal-test-1')
  })

  it('does NOT create a deal when the server gate is disabled (even with confirm:true)', async () => {
    delete process.env.COPILOT_DILIGENCE_ENABLED
    const { diligenceCompany } = buildCopilotTools({
      store: fakeStore,
      orchestrate: fakeOrchestrate,
    })

    const execute = diligenceCompany.execute!
    const result = await execute(
      { company: 'Stripe', thesisId: 'thesis-test-1', confirm: true },
      TOOL_OPTIONS,
    )

    expect(fakeStore.createDeal).not.toHaveBeenCalled()
    expect(fakeOrchestrate).not.toHaveBeenCalled()
    expect((result as { status: string }).status).toBe('disabled')
  })

  it('returns error when thesis not found', async () => {
    const fakeStore2 = makeFakeStore({ getThesis: vi.fn().mockResolvedValue(null) })
    const { diligenceCompany } = buildCopilotTools({
      store: fakeStore2,
      orchestrate: fakeOrchestrate,
    })

    const execute = diligenceCompany.execute!
    const result = await execute(
      { company: 'Stripe', thesisId: 'bad-thesis', confirm: true },
      TOOL_OPTIONS,
    )

    expect(fakeStore2.createDeal).not.toHaveBeenCalled()
    expect((result as { status: string }).status).toBe('error')
  })
})

describe('buildCopilotTools — createThesis', () => {
  it('calls store.createThesis with the right args', async () => {
    const fakeStore = makeFakeStore()
    const { createThesis } = buildCopilotTools({ store: fakeStore })

    const execute = createThesis.execute!
    const result = await execute(
      {
        sectors: ['fintech'],
        stage: 'series-a',
        geo: ['us'],
        checkMin: 1_000_000,
        checkMax: 5_000_000,
        signalWeights: { money: 2, people: 1, press: 1, archive: 1 },
      },
      TOOL_OPTIONS,
    )

    expect(fakeStore.createThesis).toHaveBeenCalledWith(
      expect.objectContaining({ sectors: ['fintech'], stage: 'series-a' }),
    )
    expect((result as { thesisId: string }).thesisId).toBe('thesis-new')
  })
})
