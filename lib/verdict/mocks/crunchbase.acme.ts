import type { CrunchbaseCompany } from '../adapters/money'

// Canned davidsharadbhatt/crunchbase-company-scraper result for a well-funded active company.
export const crunchbaseAcme: CrunchbaseCompany = {
  name: 'Acme',
  operatingStatus: 'active',
  totalFundingUsd: 66_000_000,
  lastFundingDate: '2024-09-01',
  lastFundingType: 'Series B',
  topInvestors: ['Andreessen Horowitz', 'Accel'],
  leadInvestors: ['Andreessen Horowitz'],
  foundedDate: '2019-01-01',
  ipoStatus: 'private',
  acquisitionStatus: null as unknown as undefined,
}
