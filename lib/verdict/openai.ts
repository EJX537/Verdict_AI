import OpenAI from 'openai'
import type { Finding } from './types'
import type { VerdictCore } from './scoring'

// Injectable so unit tests never hit the network.
export interface ChatCaller {
  complete(system: string, user: string): Promise<string>
}

const MODEL = 'gpt-4o-mini'

export const openaiCaller: ChatCaller = {
  async complete(system, user) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  },
}

function findingsBlock(findings: Finding[]): string {
  return findings.map((f) => `- [${f.signal_id}] ${f.plain_english} (dir=${f.direction}, conf=${f.confidence})`).join('\n')
}

const GROUNDING = 'You are a startup diligence analyst. Use ONLY the findings provided. Do not invent facts, numbers, or events not present in the findings. Be concise and specific.'

export async function writeCounterfactual(
  findings: Finding[],
  core: VerdictCore,
  caller: ChatCaller = openaiCaller,
): Promise<string> {
  const user = [
    `Overall survival score: ${core.overall_score}/10 (zone: ${core.zone}).`,
    `Findings:`,
    findingsBlock(findings),
    '',
    "Write a 2-3 sentence counterfactual: the single highest-leverage intervention that would most improve this company's trajectory, grounded only in the findings above.",
  ].join('\n')
  return caller.complete(GROUNDING, user)
}

export async function writeFounderSummary(
  findings: Finding[],
  caller: ChatCaller = openaiCaller,
): Promise<string> {
  const user = [
    'Findings:',
    findingsBlock(findings),
    '',
    'Write a 1-2 sentence profile of the founding team and leadership, grounded only in the findings above. If founder signals are absent, say so plainly.',
  ].join('\n')
  return caller.complete(GROUNDING, user)
}
