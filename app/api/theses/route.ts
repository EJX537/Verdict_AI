import { NextResponse, type NextRequest } from 'next/server'
import { dbStore } from '@/lib/verdict/store'

export async function GET() {
  try {
    const theses = await dbStore.listTheses()
    return NextResponse.json(theses)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  if (
    !b.sectors || !Array.isArray(b.sectors) ||
    typeof b.stage !== 'string' || !b.stage ||
    !b.geo || !Array.isArray(b.geo) ||
    !b.signalWeights || typeof b.signalWeights !== 'object'
  ) {
    return NextResponse.json(
      { error: 'Required fields: sectors (array), stage (string), geo (array), signalWeights (object)' },
      { status: 400 },
    )
  }

  try {
    const result = await dbStore.createThesis({
      sectors: b.sectors as string[],
      stage: b.stage as string,
      geo: b.geo as string[],
      checkMin: typeof b.checkMin === 'number' ? b.checkMin : undefined,
      checkMax: typeof b.checkMax === 'number' ? b.checkMax : undefined,
      signalWeights: b.signalWeights as Record<string, number>,
    })
    return NextResponse.json({ id: result.id }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
