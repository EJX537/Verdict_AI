/**
 * /api/outreach — draft and send founder outreach emails.
 *
 * POST {action:'draft', dealId}
 *   → OpenAI personalised founder email grounded in deal.verdict + thesis_fit
 *   → saved as outreach row (status 'draft')
 *   → returns { outreach: OutreachRow }
 *
 * POST {action:'send', outreachId, toEmail, confirm:true}
 *   → requires explicit confirm flag (credit + external send gate)
 *   → tries InsForge emails.send(); falls back to status:'draft-only' if unavailable
 *   → returns { status: 'sent' | 'draft-only' }
 */

export const runtime = 'nodejs'

import { dbStore } from '@/lib/verdict/store'
import { getServerClient } from '@/lib/insforge/server'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const body = await req.json()

  if (body.action === 'draft') {
    return handleDraft(body)
  }

  if (body.action === 'send') {
    return handleSend(body)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ─── Draft ────────────────────────────────────────────────────────────────────

async function handleDraft(body: { dealId: string }) {
  const { dealId } = body
  if (!dealId) {
    return NextResponse.json({ error: 'dealId required' }, { status: 400 })
  }

  const deal = await dbStore.getDeal(dealId)
  if (!deal) {
    return NextResponse.json({ error: `Deal ${dealId} not found` }, { status: 404 })
  }

  // Build context for the LLM
  const verdictSummary = deal.verdict
    ? `Overall score: ${Math.round(deal.verdict.overall_score * 10)}/10. Counterfactual: ${deal.verdict.counterfactual ?? 'N/A'}`
    : 'Verdict not yet available.'

  const thesisFitSummary = deal.thesis_fit
    ? `Thesis fit score: ${deal.thesis_fit.deal_score}/100. Rationale: ${deal.thesis_fit.rationale ?? 'None'}`
    : 'Thesis fit not evaluated.'

  const founderContext = deal.founder_summary ?? 'No founder summary available.'

  const prompt = `You are a VC writing a personalized outreach email to the founder of ${deal.company}.

Context about this company:
- Company: ${deal.company}
- Website: ${deal.company_url ?? 'unknown'}
- ${verdictSummary}
- ${thesisFitSummary}
- Founder context: ${founderContext}

Write a short (3-4 short paragraphs), genuine, personalized outreach email:
1. Open with a specific observation about their company (not generic praise)
2. Briefly explain why it fits our thesis
3. Ask for a 20-minute call
4. Sign off as "the Verdict team"

Format: Subject: [subject line]\n\n[email body]
Do NOT add "Dear [Name]" — keep it direct and conversational.
Never mention scores or numbers from the analysis.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 600,
  })

  const raw = completion.choices[0]?.message?.content ?? ''

  // Parse subject and body
  const lines = raw.split('\n')
  const subjectLine = lines.find((l) => l.startsWith('Subject:'))
  const subject = subjectLine ? subjectLine.replace(/^Subject:\s*/i, '').trim() : `Re: ${deal.company}`

  const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0
  const emailBody = lines.slice(bodyStart).join('\n').trim()

  const outreach = await dbStore.createOutreach({
    dealId,
    subject,
    body: emailBody,
    status: 'draft',
  })

  return NextResponse.json({ outreach })
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function handleSend(body: {
  outreachId: string
  toEmail: string
  confirm?: boolean
}) {
  const { outreachId, toEmail, confirm } = body

  if (!confirm) {
    return NextResponse.json(
      {
        status: 'needs_confirmation',
        message: 'Sending an email is irreversible. Pass confirm:true to proceed.',
      },
      { status: 200 },
    )
  }

  if (!outreachId || !toEmail) {
    return NextResponse.json({ error: 'outreachId and toEmail required' }, { status: 400 })
  }

  // Look up the outreach row directly — we don't have getOutreachById yet,
  // so we query the DB directly.
  const client = getServerClient()

  const { data: rowData, error: rowError } = await client.database
    .from('outreach')
    .select('*')
    .eq('id', outreachId)
  if (rowError) {
    return NextResponse.json({ error: rowError.message }, { status: 500 })
  }
  const row = (rowData as Array<{ id: string; subject: string; body: string; deal_id: string; to_email: string | null; status: string; created_at: string; updated_at: string }>)[0]
  if (!row) {
    return NextResponse.json({ error: `Outreach ${outreachId} not found` }, { status: 404 })
  }

  // Try sending via InsForge emails
  try {
    const { error: sendError } = await client.emails.send({
      to: toEmail,
      subject: row.subject,
      html: `<pre style="white-space:pre-wrap;font-family:sans-serif">${row.body}</pre>`,
    })

    if (sendError) {
      // Tier doesn't support custom email — fall back to draft-only
      console.warn('InsForge emails.send failed (likely tier restriction):', sendError)
      await dbStore.updateOutreach(outreachId, { toEmail, status: 'ready' })
      return NextResponse.json({
        status: 'draft-only',
        message: 'Email send is not available on your InsForge tier. Draft saved as ready.',
      })
    }

    await dbStore.updateOutreach(outreachId, { toEmail, status: 'sent' })
    return NextResponse.json({ status: 'sent' })
  } catch (err: unknown) {
    // Any unexpected error → draft-only, don't break the caller
    const message = err instanceof Error ? err.message : String(err)
    console.warn('emails.send threw:', message)
    await dbStore.updateOutreach(outreachId, { toEmail, status: 'ready' })
    return NextResponse.json({
      status: 'draft-only',
      message: 'Email send unavailable. Draft saved as ready.',
    })
  }

}
