/**
 * Honest provenance: only states Babel can establish.
 * Never invents verification.
 */

/**
 * @param {{
 *   claimId: string,
 *   claimText?: string,
 *   citationsSupplied?: number,
 *   challengedBy?: string[],
 *   debateStatus?: string,
 *   verification?: string,
 *   open?: boolean,
 *   onClose?: () => void,
 * }} props
 */
export default function ProvenancePanel({
  claimId,
  claimText = '',
  citationsSupplied = 0,
  challengedBy = [],
  debateStatus = 'Retained after critique',
  verification = 'Not independently checked',
  open = true,
  onClose,
}) {
  if (!open) return null

  const challengedLabel =
    challengedBy.length === 0
      ? 'None recorded'
      : `${challengedBy.length} voice${challengedBy.length === 1 ? '' : 's'} (${challengedBy.join(', ')})`

  return (
    <div
      className="provenance-panel mt-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-4"
      role="region"
      aria-label={`Provenance for ${claimId}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="babel-eyebrow m-0">Provenance</p>
          <p className="babel-voice-name mt-1">{claimId}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            className="babel-btn babel-btn-quiet min-h-11 px-3 py-2"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>
      {claimText ? (
        <p className="mb-3 min-w-0 break-words text-[0.9rem] leading-relaxed text-[var(--ink-soft)]">
          {claimText}
        </p>
      ) : null}
      <dl className="m-0 grid gap-2 font-mono text-[0.78rem] text-[var(--ink)]">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--ink-soft)]">Citations supplied</dt>
          <dd className="m-0">{citationsSupplied}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--ink-soft)]">Challenged by</dt>
          <dd className="m-0 text-right">{challengedLabel}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--ink-soft)]">Debate status</dt>
          <dd className="m-0 text-right">{debateStatus}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-[var(--ink-soft)]">Verification</dt>
          <dd className="m-0 text-right">{verification}</dd>
        </div>
      </dl>
    </div>
  )
}
