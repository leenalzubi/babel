import { countRoundOutcomes } from '../lib/babelErrors.js'

/**
 * Soft banner when a round finished with a mix of successes and failures.
 * @param {{
 *   roundLabel: string,
 *   texts: string[],
 *   failedNames?: string[],
 * }} props
 */
export default function PartialRoundBanner({
  roundLabel,
  texts,
  failedNames = [],
}) {
  const { ok, failed, total } = countRoundOutcomes(texts)
  if (total < 2 || failed === 0 || ok === 0) return null

  const failedLabel =
    failedNames.length > 0
      ? failedNames.join(', ')
      : `${failed} voice${failed === 1 ? '' : 's'}`

  return (
    <div
      className="mt-4 rounded-[6px] border border-dashed border-amber-700/35 bg-[color-mix(in_srgb,var(--highlight)_12%,var(--bg-surface))] px-4 py-3"
      role="status"
    >
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {ok} of {total} voices completed {roundLabel}.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
        {failedLabel} did not finish this stage. Babel can continue with the
        available responses.
      </p>
    </div>
  )
}
