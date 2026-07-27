/**
 * Reasoning primitives: design system §4.
 */

import { jumpToClaim } from '../../lib/claimNavigation.js'

/**
 * @param {{
 *   id: string,
 *   text: string,
 *   evidence?: string[],
 *   onEvidence?: (claimId: string, evidenceIndex: number) => void,
 *   onOpenProvenance?: (claimId: string) => void,
 * }} props
 */
export function ClaimBlock({
  id,
  text,
  evidence = [],
  onEvidence,
  onOpenProvenance,
}) {
  return (
    <div className="claim-block mb-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <button
          type="button"
          className="babel-voice-name shrink-0 underline-offset-2 hover:underline"
          onClick={() => onOpenProvenance?.(id)}
          aria-label={`Open provenance for claim ${id}`}
        >
          {id}
        </button>
        <p className="m-0 min-w-0 flex-1 text-[var(--ink)]">{text}</p>
      </div>
      {evidence.length > 0 ? (
        <ul className="mt-1.5 list-none space-y-1 pl-0">
          {evidence.map((ev, i) => (
            <li key={`${id}-ev-${i}`}>
              <button
                type="button"
                className="evidence-link text-left text-[0.85rem] text-[var(--blue)] underline-offset-2 hover:underline"
                onClick={() => {
                  onEvidence?.(id, i)
                  onOpenProvenance?.(id)
                }}
              >
                <span aria-hidden>❧ </span>
                {ev}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * @param {{ targetClaimId?: string | null, text: string, linked?: boolean }} props
 */
export function Counterpoint({ targetClaimId, text, linked = false }) {
  return (
    <div className="counterpoint mb-3">
      <p className="m-0 text-[0.92rem] leading-relaxed text-[var(--ink)]">
        {linked && targetClaimId ? (
          <button
            type="button"
            className="babel-voice-name mr-2 text-[var(--ink-soft)] underline-offset-2 hover:underline"
            onClick={() => jumpToClaim(targetClaimId)}
          >
            vs {targetClaimId}
          </button>
        ) : (
          <span className="mr-2 font-mono text-[0.72rem] uppercase tracking-wide text-[var(--ink-soft)]">
            Unlinked critique
          </span>
        )}
        {text}
      </p>
    </div>
  )
}

/**
 * @param {{
 *   claimId: string,
 *   action: string,
 *   revisedId?: string | null,
 *   text?: string,
 *   reason?: string,
 * }} props
 */
export function PositionChange({
  claimId,
  action,
  revisedId,
  text,
  reason,
}) {
  return (
    <div className="position-change mb-3">
      <p className="m-0 text-[0.92rem] leading-relaxed">
        <span className="font-mono text-[0.75rem] uppercase tracking-wide">
          {claimId}
          {revisedId ? ` → ${revisedId}` : ''}
        </span>
        <span className="mx-2 font-semibold">{action}</span>
        {text ? <span className="text-[var(--ink)]">{text}</span> : null}
      </p>
      {reason ? (
        <p className="mt-1 text-[0.85rem] text-[var(--ink-soft)]">{reason}</p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ children: import('react').ReactNode, label?: string }} props
 */
export function MinorityReport({ children, label = 'Minority report' }) {
  return (
    <aside className="minority-report" aria-label={label}>
      <p className="babel-eyebrow mb-2">{label}</p>
      <div className="text-[0.95rem] leading-relaxed text-[var(--ink)]">
        {children}
      </div>
    </aside>
  )
}

/**
 * @param {{ label: string, selected?: boolean, onToggle?: () => void, disabled?: boolean }} props
 */
export function DecisionCriterion({
  label,
  selected = false,
  onToggle,
  disabled = false,
}) {
  if (!onToggle) {
    return <span className="criterion-chip">{label}</span>
  }
  return (
    <button
      type="button"
      className={`criterion-chip transition ${
        selected
          ? 'border-[var(--blue)] bg-[var(--blue-wash)] text-[var(--blue-deep)]'
          : 'opacity-70 hover:opacity-100'
      }`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      {label}
    </button>
  )
}

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function UnparsedPassage({ children }) {
  return (
      <div className="mt-3 rounded-[var(--radius)] border border-dashed border-[var(--line-firm)] bg-[var(--plaster-hi)] p-3">
      <p className="babel-eyebrow mb-2">Unparsed passage</p>
      <div className="babel-meta text-[var(--ink-soft)]">{children}</div>
    </div>
  )
}

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export function UnresolvedQuestion({ children }) {
  return (
    <p className="unresolved m-0 inline text-[var(--ink)]">
      <span className="sr-only">Open question: </span>
      {children}
    </p>
  )
}

/**
 * @param {{ children: import('react').ReactNode, claimIds?: string[] }} props
 */
export function ConsensusFinding({ children, claimIds = [] }) {
  return (
    <div className="mb-3 border-l-2 border-[var(--oasis)] pl-3">
      <div className="text-[0.95rem] leading-relaxed text-[var(--ink)]">
        {children}
      </div>
      {claimIds.length > 0 ? (
        <p className="mt-1 font-mono text-[0.72rem] text-[var(--ink-soft)]">
          {claimIds.join('; ')}
        </p>
      ) : null}
    </div>
  )
}
