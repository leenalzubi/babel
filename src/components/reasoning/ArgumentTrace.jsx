/**
 * Compact claim lineage: assembled from explicit relationships only.
 */

import React from 'react'

/**
 * @typedef {{ label: string, claimId?: string | null, onSelect?: () => void }} TraceStep
 */

/**
 * @param {{ steps: TraceStep[] }} props
 */
export default function ArgumentTrace({ steps = [] }) {
  if (!steps.length) return null

  return (
    <nav
      className="argument-trace mt-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] px-3 py-2"
      aria-label="Argument trace"
    >
      <p className="babel-eyebrow mb-2">Argument trace</p>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1 p-0 font-mono text-[0.75rem] leading-relaxed text-[var(--ink-soft)]">
        {steps.map((step, i) => (
          <li key={`${step.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? (
              <span className="text-[var(--ink-faint)]" aria-hidden>
                →
              </span>
            ) : null}
            {step.onSelect ? (
              <button
                type="button"
                className="min-h-11 rounded-[var(--radius-sm)] px-1 text-left text-[var(--blue)] underline-offset-2 hover:underline"
                onClick={step.onSelect}
              >
                {step.label}
              </button>
            ) : (
              <span>{step.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Build a simple R1→R2→R3 trace for a claim when relationships exist.
 * @param {{
 *   roleLabel: string,
 *   claimId: string,
 *   challenges?: { roleLabel: string, text?: string }[],
 *   change?: { action: string, revisedId?: string | null } | null,
 *   criterion?: string | null,
 * }} opts
 * @returns {TraceStep[]}
 */
export function buildClaimTraceSteps({
  roleLabel,
  claimId,
  challenges = [],
  change = null,
  criterion = null,
}) {
  /** @type {TraceStep[]} */
  const steps = [{ label: `${roleLabel} ${claimId}`, claimId }]
  for (const ch of challenges) {
    steps.push({
      label: `${ch.roleLabel} challenges${ch.text ? '' : ' evidence'}`,
    })
  }
  if (change) {
    const verb = change.action
    const id = change.revisedId || claimId
    steps.push({
      label: `${roleLabel} ${verb} to ${id}`,
      claimId: id,
    })
  }
  if (criterion) {
    steps.push({ label: `retained under criterion: ${criterion}` })
  }
  return steps
}
