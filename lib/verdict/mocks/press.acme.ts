import type { PressData } from '../adapters/press'

// Canned Google News + PR Newswire datasets for a company going quiet:
// coverage declining, mostly owned PR, last unprompted mention stale.
export const pressAcme: PressData = {
  news: [
    { title: 'Acme raises Series B', source: 'TechCrunch', url: 'https://tc/1', publishedAt: '2025-08-01' },
    { title: 'Acme product review', source: 'The Verge', url: 'https://verge/1', publishedAt: '2025-09-15' },
    { title: 'Acme announces layoffs', source: 'PR Newswire', url: 'https://pr/echo', publishedAt: '2026-02-10' },
  ],
  pr: [
    { title: 'Acme announces layoffs', company: 'Acme', url: 'https://pr/1', publishedAt: '2026-02-10' },
    { title: 'Acme launches enterprise tier', company: 'Acme', url: 'https://pr/2', publishedAt: '2026-04-01' },
    { title: 'Acme partners with BigCo', company: 'Acme', url: 'https://pr/3', publishedAt: '2026-05-01' },
  ],
}
