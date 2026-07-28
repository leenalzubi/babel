import React from 'react'
import { CONDITION_LABELS } from '../../lib/lab/schema.js'

/**
 * @param {{
 *   artifact: import('../../lib/lab/labTypes.js').EvaluationArtifact | null,
 *   condition: import('../../lib/lab/schema.js').EvaluationCondition,
 * }} props
 */
export default function LabConditionOutput({ artifact, condition }) {
  if (!artifact) {
    return (
      <p className="babel-meta mt-3 mb-0">
        No artifact recorded for {CONDITION_LABELS[condition]}.
      </p>
    )
  }

  if (artifact.developmentFixture) {
    return (
      <div className="mt-3">
        <p className="babel-meta m-0 text-[var(--ink-soft)]">
          Development fixture (not a scored production evaluation run).
        </p>
        <OutputBody artifact={artifact} condition={condition} />
      </div>
    )
  }

  return (
    <div className="mt-3">
      {artifact.failureNotes?.length ? (
        <ul className="babel-caution mb-3 list-disc pl-5">
          {artifact.failureNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <OutputBody artifact={artifact} condition={condition} />
    </div>
  )
}

/**
 * @param {{
 *   artifact: import('../../lib/lab/labTypes.js').EvaluationArtifact,
 *   condition: import('../../lib/lab/schema.js').EvaluationCondition,
 * }} props
 */
function OutputBody({ artifact, condition }) {
  if (condition === 'single_model') {
    if (!artifact.outputText?.trim()) {
      return (
        <p className="babel-meta m-0">
          Output not recorded for this condition.
        </p>
      )
    }
    return (
      <div className="reading-column whitespace-pre-wrap babel-prose text-[var(--ink)]">
        {artifact.outputText}
      </div>
    )
  }

  if (condition === 'side_by_side') {
    const rows = artifact.sideBySideOutputs
    if (!rows?.length) {
      return (
        <p className="babel-meta m-0">
          Side-by-side outputs not recorded. No synthesis is added for this
          condition.
        </p>
      )
    }
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.modelId} className="babel-card min-w-0">
            <p className="babel-meta-tech m-0">{row.modelId}</p>
            <p className="babel-prose mt-3 mb-0 whitespace-pre-wrap break-words text-[var(--ink)]">
              {row.text?.trim() ? row.text : 'Output not recorded.'}
            </p>
          </div>
        ))}
      </div>
    )
  }

  const rounds = artifact.babelRounds
  const synthesis = rounds?.synthesis || artifact.outputText
  if (
    !synthesis?.trim() &&
    !rounds?.round1?.length &&
    !rounds?.round2?.length &&
    !rounds?.round3?.length
  ) {
    return (
      <p className="babel-meta m-0">
        Babel rounds and synthesis not recorded for this condition.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/** @type {const} */ (['round1', 'round2', 'round3']).map((key) => {
        const list = rounds?.[key]
        if (!list?.length) return null
        return (
          <details key={key} className="border-b border-[var(--line)] pb-3">
            <summary className="babel-meta min-h-11 cursor-pointer py-2 text-[var(--ink)]">
              {key === 'round1'
                ? 'Round 1: independent positions'
                : key === 'round2'
                  ? 'Round 2: cross-examination'
                  : 'Round 3: revisions'}
            </summary>
            <ul className="mt-2 list-none space-y-3 p-0">
              {list.map((v, i) => (
                <li key={`${v.modelId}-${i}`} className="min-w-0">
                  <p className="babel-meta-tech m-0">
                    {v.roleId ? (
                      <>
                        <span className="meta-label">Role:</span> {v.roleId}
                        <span
                          className="mx-2 text-[var(--ink-soft)]"
                          aria-hidden
                        >
                          |
                        </span>
                      </>
                    ) : null}
                    <span className="meta-label">Model:</span> {v.modelId}
                  </p>
                  <p className="babel-prose mt-2 mb-0 whitespace-pre-wrap break-words">
                    {v.text?.trim() ? v.text : 'Not recorded.'}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
      <div>
        <h3 className="babel-display babel-display-card m-0">
          Structured synthesis
        </h3>
        {synthesis?.trim() ? (
          <div className="reading-column mt-3 whitespace-pre-wrap babel-prose text-[var(--ink)]">
            {synthesis}
          </div>
        ) : (
          <p className="babel-meta mt-3 mb-0">Synthesis not recorded.</p>
        )}
      </div>
    </div>
  )
}
