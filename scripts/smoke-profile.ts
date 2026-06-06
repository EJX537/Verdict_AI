import { profileCompany } from '../lib/verdict/profile'
import type { Thesis } from '../lib/verdict/thesis-fit'

const thesis: Thesis = {
  sectors: ['fintech', 'payments', 'saas'],
  stage: 'series_c',
  geo: ['us'],
  checkMin: 5_000_000,
  checkMax: 50_000_000,
  signalWeights: { money: 1, people: 1, press: 1, archive: 1 },
}

async function main() {
  const result = await profileCompany(
    { company: 'Stripe', companyUrl: 'https://stripe.com', candidate: { sector: 'fintech', stage: 'series_c', geo: 'us' } },
    thesis,
  )
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
