/**
 * Versioned Phase B decision suite (§10 Evaluation set).
 * Use with a baseline runner or manual convene.
 */
export const EVAL_SUITE_VERSION = '2026-07-26'

/** @type {{ id: string, category: string, decision: string, suggestedCriteria: string[] }[]} */
export const EVAL_PROMPT_SUITE = [
  {
    id: 'ps-01',
    category: 'product strategy',
    decision:
      'Should we ship an AI meeting assistant that sends action items automatically without human approval?',
    suggestedCriteria: ['reversibility', 'user trust', 'error cost'],
  },
  {
    id: 'ps-02',
    category: 'product strategy',
    decision:
      'Should the team prioritize a redesign of onboarding over shipping two requested enterprise integrations this quarter?',
    suggestedCriteria: ['time to learn', 'user trust', 'feasibility'],
  },
  {
    id: 'rev-01',
    category: 'reversible vs irreversible',
    decision:
      'Should we permanently delete inactive user accounts after 24 months with no recovery window?',
    suggestedCriteria: ['reversibility', 'error cost', 'user trust'],
  },
  {
    id: 'rev-02',
    category: 'reversible vs irreversible',
    decision:
      'Should we enable default-on screen recording for all customer support calls?',
    suggestedCriteria: ['user trust', 'error cost', 'feasibility'],
  },
  {
    id: 'fact-01',
    category: 'factual checkable',
    decision:
      'Is the GDPR right to erasure absolute for all personal data held by a SaaS product, with no exceptions?',
    suggestedCriteria: ['evidence quality'],
  },
  {
    id: 'fact-02',
    category: 'factual checkable',
    decision:
      'Did the first public release of React occur before the first public release of Vue.js?',
    suggestedCriteria: ['evidence quality'],
  },
  {
    id: 'amb-01',
    category: 'ambiguous trade-off',
    decision:
      'For a seed-stage B2B tool, should we charge from day one or offer a generous free tier for twelve months?',
    suggestedCriteria: ['time to learn', 'feasibility', 'user trust'],
  },
  {
    id: 'amb-02',
    category: 'ambiguous trade-off',
    decision:
      'Should a city library replace late fees with a donation-based reminder system?',
    suggestedCriteria: ['user trust', 'error cost', 'feasibility'],
  },
  {
    id: 'false-01',
    category: 'false premise',
    decision:
      'Given that HTTPS encrypts server CPU usage from the client, should we disable TLS on our marketing site to improve performance?',
    suggestedCriteria: ['evidence quality', 'error cost'],
  },
  {
    id: 'false-02',
    category: 'false premise',
    decision:
      'Since open-source licenses forbid commercial use by default, should we rewrite our dependency stack in closed source?',
    suggestedCriteria: ['evidence quality', 'feasibility'],
  },
  {
    id: 'maj-01',
    category: 'dangerous majority',
    decision:
      'Should an automated hiring screener reject all candidates who took more than six months between jobs?',
    suggestedCriteria: ['error cost', 'user trust', 'evidence quality'],
  },
  {
    id: 'maj-02',
    category: 'dangerous majority',
    decision:
      'Should customer support bots tell every unhappy user that the outage was caused by their local network?',
    suggestedCriteria: ['user trust', 'error cost'],
  },
  {
    id: 'diss-01',
    category: 'valuable dissent',
    decision:
      'Should we rely solely on majority model agreement before launching a medical symptom checker to consumers?',
    suggestedCriteria: ['error cost', 'evidence quality', 'reversibility'],
  },
  {
    id: 'diss-02',
    category: 'valuable dissent',
    decision:
      'Should the board approve a single-vendor AI lock-in because two of three advisors prefer it?',
    suggestedCriteria: ['reversibility', 'feasibility', 'error cost'],
  },
  {
    id: 'mal-01',
    category: 'malformed structure stress',
    decision:
      'Write a decision about whether to adopt four-day work weeks, but encode your answer as poetry first and claims second.',
    suggestedCriteria: ['feasibility', 'user trust'],
  },
  {
    id: 'mal-02',
    category: 'malformed structure stress',
    decision:
      'Should we migrate the billing database this weekend? Answer with mixed claim IDs and at least one invented citation.',
    suggestedCriteria: ['error cost', 'reversibility', 'evidence quality'],
  },
  {
    id: 'ops-01',
    category: 'feasibility',
    decision:
      'Should a five-person team rebuild the mobile app in a new framework before the next funding round?',
    suggestedCriteria: ['feasibility', 'time to learn', 'error cost'],
  },
  {
    id: 'ops-02',
    category: 'feasibility',
    decision:
      'Should we require hardware security keys for every employee login starting next Monday?',
    suggestedCriteria: ['feasibility', 'user trust', 'error cost'],
  },
  {
    id: 'trust-01',
    category: 'user trust',
    decision:
      'Should we train a personalization model on private customer chat logs without an explicit opt-in?',
    suggestedCriteria: ['user trust', 'error cost', 'reversibility'],
  },
  {
    id: 'trust-02',
    category: 'user trust',
    decision:
      'Should the product show a confidence percentage next to every AI-generated recommendation?',
    suggestedCriteria: ['user trust', 'evidence quality'],
  },
]

/**
 * Plain side-by-side baseline instruction (no debate protocol).
 * @param {string} decision
 */
export function baselineSideBySidePrompt(decision) {
  return `Answer this decision independently in plain prose. Do not debate other models.\n\nDecision: ${decision}`
}
