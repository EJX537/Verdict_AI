import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orchestrateDeal, type OrchestratorDeps } from './orchestrator'
import type { Finding } from './types'
import type { Thesis } from './thesis-fit'
import type { Store } from './store'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const THESIS: Thesis = {
  sectors: ['saas'],
  stage: 'seed',
  geo: ['us'],
  checkMin: 500_000,
  checkMax: 2_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}

const DEAL = {
  id: 'deal-001',
  company: 'Acme Corp',
  companyUrl: 'https://acme.com',
  candidate: { sector: 'saas', stage: 'seed', geo: 'us' },
}

function makeFinding(id: string): Finding {
  return {
    signal_id: id,
    source_agent: 'money_tracker',
    value: 'ok',
    delta: null,
    direction: 'survival_positive',
    confidence: 0.8,
    provenance_tier: 'high',
    plain_english: `Finding ${id}`,
    as_of: new Date().toISOString(),
  }
}

// ─── Fake store factory ───────────────────────────────────────────────────────

function makeFakeStore(): Pick<Store, 'updateDealStage' | 'saveDealResult' | 'failDeal'> & {
  stages: string[]
  savedResult: Parameters<Store['saveDealResult']>[1] | null
  failedWith: string | null
} {
  const stages: string[] = []
  let savedResult: Parameters<Store['saveDealResult']>[1] | null = null
  let failedWith: string | null = null

  return {
    stages,
    savedResult: null as Parameters<Store['saveDealResult']>[1] | null,
    failedWith: null as string | null,

    async updateDealStage(_id: string, stage: string) {
      stages.push(stage)
    },

    async saveDealResult(_id: string, r: Parameters<Store['saveDealResult']>[1]) {
      savedResult = r
      // Update the reference on the outer object (closure trick)
      store.savedResult = r
    },

    async failDeal(_id: string, message: string) {
      failedWith = message
      store.failedWith = message
    },
  }

  // eslint-disable-next-line no-var
  var store = {
    stages,
    savedResult,
    failedWith,
    async updateDealStage(_id: string, stage: string) {
      stages.push(stage)
    },
    async saveDealResult(_id: string, r: Parameters<Store['saveDealResult']>[1]) {
      store.savedResult = r
    },
    async failDeal(_id: string, message: string) {
      store.failedWith = message
    },
  }
  return store
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('orchestrateDeal — happy path', () => {
  let storeStages: string[]
  let storedResult: Parameters<Store['saveDealResult']>[1] | null
  let storedFailure: string | null
  let deps: OrchestratorDeps

  beforeEach(async () => {
    storeStages = []
    storedResult = null
    storedFailure = null

    const fakeStore = {
      async updateDealStage(_id: string, stage: string) {
        storeStages.push(stage)
      },
      async saveDealResult(_id: string, r: Parameters<Store['saveDealResult']>[1]) {
        storedResult = r
      },
      async failDeal(_id: string, message: string) {
        storedFailure = message
      },
    }

    const fakeCaller = {
      async complete(_system: string, user: string): Promise<string> {
        if (user.includes('counterfactual')) return 'Fake counterfactual text.'
        return 'Fake founder summary.'
      },
    }

    deps = {
      store: fakeStore,
      fetchMoney: async () => [makeFinding('money.round_gap')],
      fetchPeople: async () => [makeFinding('people.headcount_shrink')],
      fetchPress: async () => [makeFinding('press.coverage_gap')],
      fetchArchive: async () => [makeFinding('archive.site_alive')],
      caller: fakeCaller,
    }

    await orchestrateDeal(DEAL, THESIS, deps)
  })

  it('executes stages in order: sourcing → profiling → scoring → ready', () => {
    expect(storeStages).toEqual(['sourcing', 'profiling', 'scoring', 'ready'])
  })

  it('does NOT call failDeal on success', () => {
    expect(storedFailure).toBeNull()
  })

  it('saves a verdict that includes a counterfactual string', () => {
    expect(storedResult).not.toBeNull()
    expect(typeof storedResult!.verdict.counterfactual).toBe('string')
    expect(storedResult!.verdict.counterfactual.length).toBeGreaterThan(0)
  })

  it('saves a thesisFit with a deal_score number', () => {
    expect(typeof storedResult!.thesisFit.deal_score).toBe('number')
  })

  it('saves a non-empty founderSummary', () => {
    expect(typeof storedResult!.founderSummary).toBe('string')
    expect(storedResult!.founderSummary.length).toBeGreaterThan(0)
  })

  it('saves findings array', () => {
    expect(Array.isArray(storedResult!.findings)).toBe(true)
    expect(storedResult!.findings.length).toBe(4)
  })
})

describe('orchestrateDeal — failure path', () => {
  it('calls failDeal when a fetcher throws, without reaching ready stage', async () => {
    const storeStages: string[] = []
    let failedWith: string | null = null

    const fakeStore = {
      async updateDealStage(_id: string, stage: string) {
        storeStages.push(stage)
      },
      async saveDealResult() {
        // should not be called
      },
      async failDeal(_id: string, message: string) {
        failedWith = message
      },
    }

    const deps: OrchestratorDeps = {
      store: fakeStore,
      fetchMoney: async () => { throw new Error('Apify unavailable') },
      fetchPeople: async () => [],
      fetchPress: async () => [],
      fetchArchive: async () => [],
      caller: { async complete() { return '' } },
    }

    await orchestrateDeal(DEAL, THESIS, deps)

    // 'sourcing' was the last stage before the crash
    expect(storeStages).toContain('sourcing')
    // 'ready' must NOT appear
    expect(storeStages).not.toContain('ready')
    // failDeal was called with the error message
    expect(failedWith).toMatch(/Apify unavailable/)
  })
})
