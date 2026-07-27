import {
  avgSubscoresForTarget,
  normModelKey,
} from '../lib/crossReviewCompetition.js'
import SectionHeading from './SectionHeading.jsx'

/**
 * @param {'gpt' | 'phi' | 'mistral'} target
 * @param {{
 *   gpt: { scores: unknown[] },
 *   phi: { scores: unknown[] },
 *   mistral: { scores: unknown[] },
 * }} evaluations
 */
function combinedEvaluatorNote(target, evaluations) {
  const keys = /** @type {const} */ (['gpt', 'phi', 'mistral'])
  const parts = []
  for (const ev of keys) {
    if (ev === target) continue
    const list = evaluations[ev]?.scores
    if (!Array.isArray(list)) continue
    const row = list.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        normModelKey(/** @type {Record<string, unknown>} */ (item).model) ===
          target
    )
    const note =
      row && typeof row === 'object'
        ? /** @type {Record<string, unknown>} */ (row).note
        : null
    if (typeof note === 'string' && note.trim()) parts.push(note.trim())
  }
  return parts.join('; ')
}

/**
 * @param {{
 *   synthesisWinner: {
 *     winner: string,
 *     scores: { gpt: number, phi: number, mistral: number },
 *     evaluations: {
 *       gpt: { scores: unknown[] },
 *       phi: { scores: unknown[] },
 *       mistral: { scores: unknown[] },
 *     },
 *   },
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 * }} props
 */
export default function CompetitionResults({ synthesisWinner, config }) {
  if (!synthesisWinner || typeof synthesisWinner !== 'object') return null

  const { winner, scores, evaluations } = synthesisWinner
  const w = String(winner || 'gpt').toLowerCase()

  const slots = [
    {
      key: 'gpt',
      name: config.agentA.name,
      color: config.agentA.color,
      score: scores.gpt,
    },
    {
      key: 'phi',
      name: config.agentB.name,
      color: config.agentB.color,
      score: scores.phi,
    },
    {
      key: 'mistral',
      name: config.agentC.name,
      color: config.agentC.color,
      score: scores.mistral,
    },
  ]

  return (
    <section
      className="mx-auto w-full max-w-4xl rounded-[6px] border border-[var(--line)] bg-[var(--plaster)] px-4 py-6 shadow-forge-card md:px-8"
      aria-label="Cross-review competition results"
    >
      <SectionHeading
        eyebrow="Peer judgment"
        title="Cross-review scores"
        lede="Each model scored the other two on specificity and accuracy. The highest scorer synthesizes."
      />

      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        {slots.map((s) => {
          const isWinner = s.key === w
          const subs = avgSubscoresForTarget(
            /** @type {'gpt' | 'phi' | 'mistral'} */ (s.key),
            evaluations
          )
          const note = combinedEvaluatorNote(
            /** @type {'gpt' | 'phi' | 'mistral'} */ (s.key),
            evaluations
          )
          const scoreDisp =
            typeof s.score === 'number' && Number.isFinite(s.score)
              ? s.score.toFixed(1)
              : '-'
          const specStr =
            subs.specificity != null ? subs.specificity.toFixed(1) : '-'
          const accStr =
            subs.accuracy != null ? subs.accuracy.toFixed(1) : '-'

          return (
            <div
              key={s.key}
              className={`relative rounded-[6px] border bg-[#F8F3E8] px-4 py-5 ${
                isWinner
                  ? 'border-2 border-[#D4A017] shadow-sm'
                  : 'border border-[var(--border)]'
              }`}
            >
              {isWinner ? (
                <div className="mb-3 inline-block rounded-[4px] bg-[#FEF3C7] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-wide text-[#B45309]">
                  Earns synthesis
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span
                  className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[var(--text-primary)]"
                >
                  {s.name}
                </span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-mono)] text-3xl font-semibold tabular-nums text-[var(--text-primary)]">
                {scoreDisp}
              </p>
              <p className="mt-1 babel-meta-tech text-[var(--text-secondary)]">
                specificity {specStr}
                <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                  |
                </span>
                accuracy {accStr}
              </p>
              {note ? (
                <p className="mt-3 babel-meta italic leading-snug text-[var(--text-muted)]">
                  {note}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
