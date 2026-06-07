/**
 * /api/chat  — AI SDK streaming endpoint for the VC diligence copilot.
 *
 * Uses gpt-4o-mini + server-side tools that call the real dbStore.
 * Never expose admin DB operations to the browser.
 */

export const runtime = 'nodejs'

import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { buildCopilotTools } from '@/lib/verdict/copilot-tools'

const SYSTEM_PROMPT = `You are Verdict Copilot — an expert VC diligence assistant.

Your role:
- Help investors analyse companies, manage their deal pipeline, and surface insights.
- Always ground answers in real tool results. NEVER fabricate verdicts, scores, or findings.
- If a tool call fails, say so clearly and suggest next steps.
- Be concise and direct. Investors are busy.

When the user asks you to run diligence on a company:
1. First ask which thesis to use (call listDeals if they need a reminder, or createThesis if none exist).
2. Explicitly warn that running diligence consumes API credits and confirm before setting confirm:true.

When displaying deals, use their name, stage, and score. Link them by ID.
`

export async function POST(req: Request) {
  const body = await req.json()
  const { messages } = body as { messages: UIMessage[] }

  const tools = buildCopilotTools()

  const modelMessages = await convertToModelMessages(
    messages.map(({ id: _id, ...rest }) => rest),
  )

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
