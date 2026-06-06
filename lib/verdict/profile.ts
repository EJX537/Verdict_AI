import type { Finding, Verdict } from './types'
import { scoreVerdict } from './scoring'
import { writeCounterfactual, writeFounderSummary, openaiCaller, type ChatCaller } from './openai'
import { scoreThesisFit, type Thesis, type ThesisFit, type CandidateProfile } from './thesis-fit'
import { fetchMoney, fetchPeople, fetchPress, fetchArchive } from './sources'

export interface ProfileInput {
  company: string
  companyUrl: string
  candidate: CandidateProfile
  asOf?: string
}

export interface ProfileDeps {
  fetchMoney: (company: string, asOf: string) => Promise<Finding[]>
  fetchPeople: (company: string, asOf: string) => Promise<Finding[]>
  fetchPress: (company: string, asOf: string) => Promise<Finding[]>
  fetchArchive: (companyUrl: string, asOf: string) => Promise<Finding[]>
  caller: ChatCaller
}

export interface DealProfile {
  company: string
  findings: Finding[]
  verdict: Verdict
  founderSummary: string
  thesisFit: ThesisFit
  asOf: string
}

const defaultDeps: ProfileDeps = {
  fetchMoney,
  fetchPeople,
  fetchPress,
  fetchArchive,
  caller: openaiCaller,
}

export async function profileCompany(
  input: ProfileInput,
  thesis: Thesis,
  deps: ProfileDeps = defaultDeps,
): Promise<DealProfile> {
  const asOf = input.asOf ?? new Date().toISOString()

  const [money, people, press, archive] = await Promise.all([
    deps.fetchMoney(input.company, asOf),
    deps.fetchPeople(input.company, asOf),
    deps.fetchPress(input.company, asOf),
    deps.fetchArchive(input.companyUrl, asOf),
  ])
  const findings = [...money, ...people, ...press, ...archive]

  const core = scoreVerdict(findings, { weights: thesis.signalWeights })
  const [counterfactual, founderSummary] = await Promise.all([
    writeCounterfactual(findings, core, deps.caller),
    writeFounderSummary(findings, deps.caller),
  ])

  const verdict: Verdict = { ...core, counterfactual }
  const thesisFit = scoreThesisFit(core, input.candidate, thesis)

  return { company: input.company, findings, verdict, founderSummary, thesisFit, asOf }
}
