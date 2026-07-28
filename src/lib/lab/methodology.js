/**
 * Public methodology copy for Babel Lab.
 */

import { METHODOLOGY_VERSION_LABEL, RUBRIC_VERSION } from './schema.js'

export const METHODOLOGY = {
  rubricVersion: RUBRIC_VERSION,
  methodologyVersionLabel: METHODOLOGY_VERSION_LABEL,
  title: 'How Babel Lab evaluates cases',
  intro:
    'Babel Lab compares the same decision prompt under three conditions so readers can see where structured multi-model debate helps, where it does not, and what it costs. Scores appear only when a real evaluation was recorded. Missing values are shown as “Not evaluated” or “Not recorded,” never as zero.',
  conditions: [
    {
      id: 'single_model',
      title: 'Single model',
      body: 'One strong model receives the original prompt and produces one normal answer. No debate roles, critique, or synthesis.',
    },
    {
      id: 'side_by_side',
      title: 'Side by side',
      body: 'The same selected models independently answer the same prompt. They do not see or critique each other. No arbiter synthesizes the result.',
    },
    {
      id: 'babel',
      title: 'Babel',
      body: 'The complete Babel flow: independent positions, cross-examination, revision, structured synthesis, and traceable conclusions where available.',
    },
  ],
  scale:
    'When a criterion is evaluated, scores use a 1-5 scale unless a score entry documents otherwise. Do not treat unevaluated criteria as zeros in aggregates.',
  criteria: [
    {
      id: 'central_disagreement',
      title: 'Central disagreement',
      body: 'Does the output identify the underlying assumption or trade-off causing disagreement, rather than merely listing different opinions?',
    },
    {
      id: 'hidden_assumptions',
      title: 'Hidden assumptions',
      body: 'Does the output surface important assumptions that materially affect the recommendation?',
    },
    {
      id: 'dissent_preservation',
      title: 'Dissent preservation',
      body: 'Does the final result retain the strongest credible minority argument rather than flattening it into consensus?',
    },
    {
      id: 'substantive_revision',
      title: 'Substantive revision',
      body: 'Did critique cause a model to meaningfully narrow, revise, or withdraw a claim? Cosmetic wording changes do not count.',
    },
    {
      id: 'evidence_honesty',
      title: 'Evidence honesty',
      body: 'Does the output distinguish cited claims, uncited factual assertions, inferences, unknowns, and unverified model-supplied citations?',
    },
    {
      id: 'actionability',
      title: 'Actionability',
      body: 'Does the output produce a clear next action, decision, experiment, or information request?',
    },
    {
      id: 'traceability',
      title: 'Traceability',
      body: 'Can a reader determine where the conclusion came from (claims, rounds, roles)?',
    },
    {
      id: 'reading_burden',
      title: 'Reading burden',
      body: 'How much effort is required to understand and act? Longer answers are not automatically worse; evaluate unnecessary burden relative to value.',
    },
  ],
  humanEval:
    'Human scores must state evaluator count, blinding (if any), methodology version, and whether the evaluator was the project creator. Prefer wording such as “Creator evaluation using methodology version 1.0” when Leen is the only evaluator. Do not imply independent review when it did not occur.',
  llmJudge:
    'LLM-judge results are labeled “Automated evaluation.” Store judge model identity and prompt version. Use the same judge setup across conditions. Do not present the judge as objective truth. Do not merge human and automated scores without an explicit explanation.',
  deterministic:
    'Duration, call counts, tokens, recorded cost, revision counts, unsupported claim references, and failed stages should be measured by the application, not estimated by an LLM.',
  noCherryPicking: [
    'Published cases remain accessible after publication.',
    'Corrections receive a change note in the case changelog.',
    'Failed runs may be rerun, but the earlier result is retained or documented.',
    'Cases are not removed merely because Babel performed poorly.',
    'Archive status requires a written reason.',
  ],
  privacy: [
    'Only explicitly published evaluation cases appear in the public Lab.',
    'User identifiers, private history IDs, tokens, and secrets are stripped before publish.',
    'Private user debates are never published by default.',
  ],
  currentLimitations: [
    'The Lab never invents scores, latencies, costs, or model outputs.',
    'Aggregate comparisons appear only when enough published, scored cases exist.',
    'Human evaluation may be creator-only; that limitation is stated on the case when it applies.',
    'Private user debates are not published here.',
  ],
}
