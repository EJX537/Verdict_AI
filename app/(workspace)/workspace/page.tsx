import { dbStore } from '@/lib/verdict/store'
import { PipelineClient } from './pipeline-client'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage() {
  let initialDeals = await dbStore.listDeals().catch(() => [])

  return <PipelineClient initialDeals={initialDeals} />
}
