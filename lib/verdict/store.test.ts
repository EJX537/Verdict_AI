import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock @insforge/sdk ───────────────────────────────────────────────────────
// We mock @insforge/sdk so serverClient never hits the network.
// The fluent query builder is a thenable (Promise-like) chain where every
// method returns the chain itself, and `await chain` resolves via `.then()`.

function makeChain(returnData: unknown[], returnError: null | { message: string } = null) {
  const resolved = { data: returnData, error: returnError }

  // Make the chain a thenable so `await chain` works without an explicit .select()
  const chain: Record<string, unknown> = {
    then: (resolve: (v: typeof resolved) => unknown) => Promise.resolve(resolved).then(resolve),
    catch: (reject: (r: unknown) => unknown) => Promise.resolve(resolved).catch(reject),
  }

  // All builder methods return the chain itself
  const self = () => chain
  chain.select = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.order = vi.fn(self)
  chain.insert = vi.fn(self)
  chain.update = vi.fn(self)

  return chain
}

const mockFrom = vi.fn()

vi.mock('@insforge/sdk', () => ({
  createAdminClient: vi.fn(() => ({
    database: { from: mockFrom },
    auth: {},
    storage: {},
    realtime: {},
  })),
  createClient: vi.fn(() => ({
    database: { from: mockFrom },
    auth: {},
    storage: {},
    realtime: {},
  })),
}))

// Import AFTER mocking so the module picks up the mock
import { dbStore } from './store'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dbStore.createDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls from("deals").insert([...]).select() with snake_case payload', async () => {
    const fakeRow = {
      id: 'deal-uuid-123',
      thesis_id: 'thesis-uuid-456',
      company: 'Stripe',
      company_url: 'https://stripe.com',
      founder: null,
      candidate: { sector: 'fintech' },
      stage_status: 'queued',
      stage_error: null,
      findings: null,
      verdict: null,
      founder_summary: null,
      thesis_fit: null,
      created_at: '2026-06-06T00:00:00Z',
      updated_at: '2026-06-06T00:00:00Z',
    }

    const chain = makeChain([fakeRow])
    mockFrom.mockReturnValue(chain)

    const result = await dbStore.createDeal({
      thesisId: 'thesis-uuid-456',
      company: 'Stripe',
      companyUrl: 'https://stripe.com',
      candidate: { sector: 'fintech' },
    })

    // Table name
    expect(mockFrom).toHaveBeenCalledWith('deals')

    // Insert called with snake_case array
    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        thesis_id: 'thesis-uuid-456',
        company: 'Stripe',
        company_url: 'https://stripe.com',
        candidate: { sector: 'fintech' },
        stage_status: 'queued',
      }),
    ])

    // .select() was called to return the row
    expect(chain.select).toHaveBeenCalled()

    // Returns the DB row
    expect(result.id).toBe('deal-uuid-123')
  })

  it('throws when the SDK returns an error', async () => {
    const chain = makeChain([], { message: 'duplicate key' })
    mockFrom.mockReturnValue(chain)

    await expect(
      dbStore.createDeal({ thesisId: 't1', company: 'Boom' }),
    ).rejects.toThrow('duplicate key')
  })
})

describe('dbStore.createThesis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps camelCase input to snake_case columns', async () => {
    const fakeRow = {
      id: 'thesis-uuid-789',
      sectors: ['saas'],
      stage: 'seed',
      geo: ['us'],
      check_min: 500000,
      check_max: 2000000,
      signal_weights: { money: 1, people: 1, press: 1, archive: 1 },
      created_at: '2026-06-06T00:00:00Z',
    }

    const chain = makeChain([fakeRow])
    mockFrom.mockReturnValue(chain)

    const result = await dbStore.createThesis({
      sectors: ['saas'],
      stage: 'seed',
      geo: ['us'],
      checkMin: 500000,
      checkMax: 2000000,
      signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
    })

    expect(mockFrom).toHaveBeenCalledWith('theses')
    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        sectors: ['saas'],
        stage: 'seed',
        geo: ['us'],
        check_min: 500000,
        check_max: 2000000,
        signal_weights: { money: 1, people: 1, press: 1, archive: 1 },
      }),
    ])
    expect(result.id).toBe('thesis-uuid-789')
  })
})

describe('dbStore.getDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no rows returned', async () => {
    const chain = makeChain([])
    mockFrom.mockReturnValue(chain)

    const result = await dbStore.getDeal('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns the row when found', async () => {
    const fakeRow = {
      id: 'deal-abc',
      thesis_id: null,
      company: 'Test',
      company_url: null,
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
    }
    const chain = makeChain([fakeRow])
    mockFrom.mockReturnValue(chain)

    const result = await dbStore.getDeal('deal-abc')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('deal-abc')
  })

  it('throws when the SDK returns an error', async () => {
    const chain = makeChain([], { message: 'not found' })
    mockFrom.mockReturnValue(chain)

    await expect(dbStore.getDeal('bad-id')).rejects.toThrow('not found')
  })
})

describe('dbStore.updateDealStage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls update with stage_status and optional findings', async () => {
    const chain = makeChain([])
    mockFrom.mockReturnValue(chain)

    const findings = [
      {
        signal_id: 'money.round_gap',
        source_agent: 'money_tracker' as const,
        value: 'ok',
        delta: null,
        direction: 'neutral' as const,
        confidence: 0.5,
        provenance_tier: 'medium' as const,
        plain_english: 'test',
        as_of: '2026-06-06T00:00:00Z',
      },
    ]

    await dbStore.updateDealStage('deal-001', 'profiling', { findings })

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ stage_status: 'profiling', findings }),
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'deal-001')
  })
})
