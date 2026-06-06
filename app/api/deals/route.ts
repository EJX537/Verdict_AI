import { after } from 'next/server'
import { NextResponse, type NextRequest } from 'next/server'
import { dbStore } from '@/lib/verdict/store'
import { orchestrateDeal, defaultDeps } from '@/lib/verdict/orchestrator'
import type { Thesis } from '@/lib/verdict/thesis-fit'
import type { ThesisRow } from '@/lib/verdict/store'

export const runtime = 'nodejs'

function thesisFromRow(row: ThesisRow): Thesis {
  return {
    sectors: row.sectors,
    stage: row.stage,
    geo: row.geo,
    checkMin: row.check_min ?? 0,
    checkMax: row.check_max ?? 0,
    signalWeights: row.signal_weights,
  }
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  if (typeof b.thesisId !== 'string' || !b.thesisId || typeof b.company !== 'string' || !b.company) {
    return NextResponse.json(
      { error: 'Required fields: thesisId (string), company (string)' },
      { status: 400 },
    )
  }

  try {
    const thesisRow = await dbStore.getThesis(b.thesisId as string)
    if (!thesisRow) {
      return NextResponse.json({ error: 'Thesis not found' }, { status: 404 })
    }

    const deal = await dbStore.createDeal({
      thesisId: b.thesisId as string,
      company: b.company as string,
      companyUrl: typeof b.companyUrl === 'string' ? b.companyUrl : undefined,
      candidate: b.candidate as Record<string, string> | undefined,
    })

    const thesis = thesisFromRow(thesisRow)

    after(() =>
      orchestrateDeal(
        {
          id: deal.id,
          company: deal.company,
          companyUrl: deal.company_url ?? '',
          candidate: deal.candidate ?? {},
        },
        thesis,
        defaultDeps,
      ),
    )

    return NextResponse.json({ dealId: deal.id }, { status: 202 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const deals = await dbStore.listDeals()
    return NextResponse.json(deals)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
