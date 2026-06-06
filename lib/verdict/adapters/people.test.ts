import { describe, it, expect } from 'vitest'
import { mapPeopleDataset, buildPeopleInput } from './people'
import type { LinkedInEmployee } from './people'

const AS_OF = '2026-06-06T00:00:00.000Z'

// ── fixtures ─────────────────────────────────────────────────────────────────

const founderCurrent: LinkedInEmployee = {
  name: 'Alice Founder',
  title: 'Chief Executive Officer',
  profileUrl: 'https://linkedin.com/in/alice',
  isCurrent: true,
  isFounder: true,
}

const founderGone: LinkedInEmployee = {
  name: 'Alice Founder',
  title: 'Chief Executive Officer',
  profileUrl: 'https://linkedin.com/in/alice',
  isCurrent: false,
  isFounder: true,
}

const cto: LinkedInEmployee = {
  name: 'Bob CTO',
  title: 'Chief Technology Officer',
  profileUrl: 'https://linkedin.com/in/bob',
  isCurrent: true,
  isFounder: false,
}

const ic: LinkedInEmployee = {
  name: 'Carol Eng',
  title: 'Software Engineer',
  profileUrl: 'https://linkedin.com/in/carol',
  isCurrent: true,
  isFounder: false,
}

const vpSales: LinkedInEmployee = {
  name: 'Dan VP',
  title: 'VP Sales',
  profileUrl: 'https://linkedin.com/in/dan',
  isCurrent: true,
  isFounder: false,
}

// ── people.founder_present ────────────────────────────────────────────────────

describe('mapPeopleDataset — people.founder_present', () => {
  it('is survival_positive when an isFounder+isCurrent employee exists', () => {
    const f = mapPeopleDataset([founderCurrent, cto], AS_OF).find(
      (x) => x.signal_id === 'people.founder_present',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value).toBe(true)
    expect(f!.confidence).toBe(0.5)
    expect(f!.provenance_tier).toBe('low')
    expect(f!.delta).toBeNull()
  })

  it('is neutral when no founder is present in the roster', () => {
    const f = mapPeopleDataset([cto, ic], AS_OF).find(
      (x) => x.signal_id === 'people.founder_present',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBe(false)
  })

  it('is neutral when founder exists but isCurrent is false', () => {
    // founder exists in the dataset but has left the role
    const f = mapPeopleDataset([founderGone, cto], AS_OF).find(
      (x) => x.signal_id === 'people.founder_present',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBe(false)
  })

  it('always emits the signal (even on an empty roster)', () => {
    const f = mapPeopleDataset([], AS_OF).find(
      (x) => x.signal_id === 'people.founder_present',
    )
    expect(f).toBeDefined()
    expect(f!.value).toBe(false)
  })
})

// ── people.leadership_visible ─────────────────────────────────────────────────

describe('mapPeopleDataset — people.leadership_visible', () => {
  it('is survival_positive when >=2 current senior-titled employees exist', () => {
    // ceo(founder) + cto → 2 senior titles → positive
    const f = mapPeopleDataset([founderCurrent, cto, ic], AS_OF).find(
      (x) => x.signal_id === 'people.leadership_visible',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value as number).toBe(2)
    expect(f!.confidence).toBe(0.4)
    expect(f!.delta).toBeNull()
  })

  it('is neutral when only 1 current senior-titled employee exists (boundary)', () => {
    const f = mapPeopleDataset([cto, ic], AS_OF).find(
      (x) => x.signal_id === 'people.leadership_visible',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBe(1)
  })

  it('is neutral when no senior-titled employees exist', () => {
    const f = mapPeopleDataset([ic], AS_OF).find(
      (x) => x.signal_id === 'people.leadership_visible',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBe(0)
  })

  it('counts exactly 2 when two distinct senior titles are present (>=2 boundary)', () => {
    const f = mapPeopleDataset([cto, vpSales], AS_OF).find(
      (x) => x.signal_id === 'people.leadership_visible',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_positive')
    expect(f!.value).toBe(2)
  })

  it('does not count non-current senior employees', () => {
    const formerCto: LinkedInEmployee = { ...cto, isCurrent: false }
    const f = mapPeopleDataset([formerCto, ic], AS_OF).find(
      (x) => x.signal_id === 'people.leadership_visible',
    )

    expect(f).toBeDefined()
    expect(f!.direction).toBe('neutral')
    expect(f!.value).toBe(0)
  })
})

// ── buildPeopleInput ──────────────────────────────────────────────────────────

describe('buildPeopleInput', () => {
  it('wraps the company name in the actor input shape', () => {
    const input = buildPeopleInput('Acme')
    expect(input.companies).toEqual(['Acme'])
    expect(input.maxItems).toBe(50)
  })
})
