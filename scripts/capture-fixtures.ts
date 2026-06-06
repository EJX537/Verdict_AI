import { writeFileSync, mkdirSync } from 'node:fs'
import { apifyRunner } from '../lib/verdict/apify'
import { buildMoneyInput } from '../lib/verdict/adapters/money'
import { buildPeopleInput } from '../lib/verdict/adapters/people'
import { buildNewsInput, buildPrNewswireInput } from '../lib/verdict/adapters/press'
import { buildArchivistInput } from '../lib/verdict/adapters/archivist'

const COMPANY = process.argv[2] ?? 'Notion'
const ONLY = process.argv[3] // optional: run only this fixture name

const DIR = 'lib/verdict/fixtures'
mkdirSync(DIR, { recursive: true })

async function capture(name: string, actorId: string, input: Record<string, unknown>) {
  if (ONLY && ONLY !== name) {
    console.log(`[${name}] skipped (only running "${ONLY}")`)
    return
  }
  console.log(`[${name}] running ${actorId} ...`)
  console.log(`[${name}] input: ${JSON.stringify(input)}`)
  const items = await apifyRunner(actorId, input)
  writeFileSync(`${DIR}/${name}.sample.json`, JSON.stringify(items.slice(0, 50), null, 2))
  console.log(`[${name}] wrote ${items.length} items (capped 50)`)
}

async function main() {
  await capture('crunchbase', 'davidsharadbhatt/crunchbase-company-scraper', buildMoneyInput(COMPANY) as unknown as Record<string, unknown>)
  await capture('linkedin', 'harvestapi/linkedin-company-employees', buildPeopleInput(COMPANY) as unknown as Record<string, unknown>)
  await capture('googlenews', 'data_xplorer/google-news-scraper-fast', buildNewsInput(COMPANY) as unknown as Record<string, unknown>)
  await capture('prnewswire', 'parseforge/pr-newswire-scraper', buildPrNewswireInput(COMPANY) as unknown as Record<string, unknown>)
  await capture('wayback', 'ryanclinton/wayback-machine-search', buildArchivistInput('https://notion.so') as unknown as Record<string, unknown>)
}

main().catch((err) => { console.error(err); process.exit(1) })
