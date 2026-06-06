import { describe, it, expect } from 'vitest'
import {
  mapPressDataset,
  buildNewsInput,
  buildPrNewswireInput,
} from './press'
import type { GoogleNewsItem, PRNewswireItem } from './press'

const AS_OF = '2026-06-06T00:00:00.000Z'

function news(
  title: string,
  publishedAt: string,
  source = 'TechCrunch',
): GoogleNewsItem {
  return { title, source, url: 'https://x/' + title, publishedAt }
}
function pr(title: string, publishedAt: string): PRNewswireItem {
  return { title, company: 'Acme', url: 'https://pr/' + title, publishedAt }
}

describe('mapPressDataset — press.organic_ratio', () => {
  it('is survival_negative when most coverage is owned PR (low organic ratio)', () => {
    const f = mapPressDataset(
      {
        news: [news('Acme ships feature', '2026-05-01')],
        pr: [
          pr('Acme announces round', '2026-05-02'),
          pr('Acme partners with X', '2026-05-03'),
          pr('Acme hires exec', '2026-05-04'),
          pr('Acme wins award', '2026-05-05'),
        ],
      },
      AS_OF,
    ).find((x) => x.signal_id === 'press.organic_ratio')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(typeof f!.value).toBe('number')
    expect(f!.value as number).toBeLessThan(0.4)
  })

  it('discounts syndicated wire copies that merely echo a PR release title', () => {
    // 2 genuine organic + 1 syndicated copy of the PR; ratio should treat copy as non-organic.
    const f = mapPressDataset(
      {
        news: [
          news('Acme ships feature', '2026-05-01'),
          news('Acme grows revenue', '2026-05-02'),
          news('Acme announces round', '2026-05-03', 'PR Newswire'),
        ],
        pr: [pr('Acme announces round', '2026-05-02')],
      },
      AS_OF,
    ).find((x) => x.signal_id === 'press.organic_ratio')

    expect(f).toBeDefined()
    // trueOrganic = 2, total = 2 + 1 pr = 3 → ratio = 0.666...
    expect(f!.value as number).toBeCloseTo(2 / 3, 5)
  })
})

describe('mapPressDataset — press.last_unprompted', () => {
  it('is survival_negative when the last unprompted third-party mention is stale', () => {
    const f = mapPressDataset(
      {
        news: [news('Acme old story', '2025-09-01')], // ~9 months before asOf
        pr: [pr('Acme recent release', '2026-05-01')],
      },
      AS_OF,
    ).find((x) => x.signal_id === 'press.last_unprompted')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.value as number).toBeGreaterThan(60)
  })
})

describe('mapPressDataset — press.volume_trend', () => {
  it('is survival_negative when recent-period coverage volume falls vs the prior period', () => {
    const f = mapPressDataset(
      {
        news: [
          // prior 90d window (2025-12-09 .. 2026-03-08): 4 items
          news('p1', '2026-01-01'),
          news('p2', '2026-01-15'),
          news('p3', '2026-02-01'),
          news('p4', '2026-02-20'),
          // recent 90d window (2026-03-08 .. 2026-06-06): 1 item
          news('r1', '2026-05-01'),
        ],
        pr: [],
      },
      AS_OF,
    ).find((x) => x.signal_id === 'press.volume_trend')

    expect(f).toBeDefined()
    expect(f!.direction).toBe('survival_negative')
    expect(f!.delta!).toBeLessThan(0)
  })
})

describe('press input builders', () => {
  it('buildNewsInput passes the company as a keyword', () => {
    const input = buildNewsInput('Acme')
    expect(input.keywords).toEqual(['Acme'])
    expect(input.maxArticles).toBe(50)
  })
  it('buildPrNewswireInput passes the company keyword', () => {
    expect(buildPrNewswireInput('Acme').keyword).toBe('Acme')
  })
})
