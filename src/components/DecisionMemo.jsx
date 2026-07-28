import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { copyToClipboard } from '../utils/exportUtils.js'
import { FINDING_TITLES } from '../lib/claimNavigation.js'
import ClaimIdLinks from './reasoning/ClaimIdLinks.jsx'
import { MinorityReport, PositionChange } from './reasoning/Primitives.jsx'
import SectionHeading from './SectionHeading.jsx'
import { useForge } from '../store/useForgeStore.js'
import { roleLabel } from '../lib/babelRoles.js'

/**
 * Lightweight editable assembly of the synthesis (§5 Stage 6).
 * @param {{
 *   prompt: string,
 *   criteria?: string[],
 *   artifact: import('../lib/parseDecisionArtifact.js').DecisionArtifact | null | undefined,
 *   roles?: { a?: string, b?: string, c?: string },
 * }} props
 */
export default function DecisionMemo({
  prompt,
  criteria = [],
  artifact,
  roles: _roles,
}) {
  const { state } = useForge()
  const findings = artifact?.findings ?? []
  const minority = artifact?.minorityReport ?? ''
  const nextDefault = artifact?.recommendedNextStep ?? ''

  const [included, setIncluded] = useState(() =>
    new Set(findings.filter((f) => f.kind !== 'minority').map((f) => f.id))
  )
  const [includeMinority, setIncludeMinority] = useState(Boolean(minority))
  const [nextStep, setNextStep] = useState(nextDefault)
  const [toast, setToast] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    setIncluded(
      new Set(findings.filter((f) => f.kind !== 'minority').map((f) => f.id))
    )
    setIncludeMinority(Boolean(minority))
    setNextStep(nextDefault)
  }, [artifact, findings, minority, nextDefault])

  const revisions = useMemo(() => {
    /** @type {{ role: string, change: import('../lib/parseStructuredResponse.js').BabelPositionChange, original?: string }[]} */
    const rows = []
    for (const key of /** @type {const} */ (['a', 'b', 'c'])) {
      const changes = state.structures?.round3?.[key]?.changes ?? []
      const claims = state.structures?.round1?.[key]?.claims ?? []
      for (const ch of changes) {
        if (ch.action === 'preserved') continue
        const original = claims.find(
          (c) =>
            c.id === ch.claimId ||
            c.id.endsWith(ch.claimId.replace(/^[ABC]-/, ''))
        )?.text
        rows.push({
          role: roleLabel(state.roles?.[key]),
          change: ch,
          original,
        })
      }
    }
    return rows
  }, [state.structures, state.roles])

  const memoMarkdown = useMemo(() => {
    const lines = []
    lines.push('# Babel: Decision memo', '')
    lines.push(`**Decision:** ${prompt.trim() || '_(empty)_'}`, '')
    if (criteria.length) {
      lines.push(`**Criteria:** ${criteria.join(', ')}`, '')
    }
    for (const f of findings) {
      if (f.kind === 'minority') continue
      if (f.kind === 'next') continue
      if (!included.has(f.id)) continue
      const title = FINDING_TITLES[f.kind] ?? f.id
      lines.push(`## ${title}`, '', f.text, '')
      if (f.claimIds?.length) {
        lines.push(`Claims: ${f.claimIds.join(', ')}`, '')
      }
    }
    if (includeMinority && minority) {
      lines.push('## Minority report', '', minority, '')
    }
    if (revisions.length) {
      lines.push('## Position changes', '')
      for (const row of revisions) {
        lines.push(
          `- **${row.role}** ${row.change.claimId} ${row.change.action}${
            row.change.revisedId ? ` → ${row.change.revisedId}` : ''
          }`,
          row.original ? `  - Original: ${row.original}` : '',
          row.change.text ? `  - Revised: ${row.change.text}` : '',
          row.change.reason ? `  - Why: ${row.change.reason}` : '',
          ''
        )
      }
    }
    lines.push('## Recommended next step', '', nextStep.trim() || '_(none)_', '')
    return lines.join('\n')
  }, [
    prompt,
    criteria,
    findings,
    included,
    includeMinority,
    minority,
    nextStep,
    revisions,
  ])

  const flash = useCallback((msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2000)
  }, [])

  const download = useCallback(() => {
    const blob = new Blob([memoMarkdown], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `babel-decision-memo-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    flash('downloaded')
  }, [memoMarkdown, flash])

  if (!artifact) return null

  return (
    <section
      className="rounded-forge-card border border-[var(--line)] bg-[var(--plaster)] p-6 shadow-forge-card sm:p-8"
      aria-label="Decision memo"
    >
      <SectionHeading
        eyebrow="Human judgment"
        title="Decision memo"
        lede="Carry or remove findings, restore the minority report, compare revisions, edit the next step, then export Markdown."
      />

      <ul className="mt-6 list-none space-y-3 p-0">
        {findings
          .filter((f) => f.kind !== 'minority' && f.kind !== 'next')
          .map((f) => (
            <li
              key={f.id}
              className="flex gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3"
            >
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={included.has(f.id)}
                  onChange={() => {
                    setIncluded((prev) => {
                      const next = new Set(prev)
                      if (next.has(f.id)) next.delete(f.id)
                      else next.add(f.id)
                      return next
                    })
                  }}
                />
                <span>
                  <span className="babel-voice-name block">
                    {FINDING_TITLES[f.kind] ?? f.id}
                  </span>
                  <span className="mt-1 block text-[0.92rem] leading-relaxed text-[var(--ink)]">
                    {f.text}
                  </span>
                  <ClaimIdLinks claimIds={f.claimIds} />
                </span>
              </label>
            </li>
          ))}
      </ul>

      {revisions.length > 0 ? (
        <div className="mt-6">
          <p className="babel-eyebrow mb-3">Revised vs original</p>
          <div className="space-y-3">
            {revisions.map((row, i) => (
              <div
                key={`${row.change.claimId}-${i}`}
                className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3"
              >
                <p className="babel-voice-name m-0 mb-2">{row.role}</p>
                <PositionChange
                  claimId={row.change.claimId}
                  action={row.change.action}
                  revisedId={row.change.revisedId}
                  text={row.change.text}
                  reason={row.change.reason}
                />
                {row.original ? (
                  <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
                    <span className="font-mono text-[0.72rem] text-[var(--ink-soft)]">
                      Original
                    </span>
                    <br />
                    {row.original}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {minority ? (
        <div className="mt-5">
          <label className="mb-2 flex min-h-11 items-center gap-2 text-[0.9rem] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={includeMinority}
              onChange={(e) => setIncludeMinority(e.target.checked)}
            />
            Include minority report
          </label>
          {includeMinority ? (
            <MinorityReport>
              <p className="m-0 whitespace-pre-wrap">{minority}</p>
            </MinorityReport>
          ) : null}
        </div>
      ) : null}

      <div className="babel-field mt-5">
        <label htmlFor="memo-next-step" className="babel-eyebrow">
          Recommended next step
        </label>
        <textarea
          id="memo-next-step"
          rows={4}
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          className="min-h-[96px]"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="babel-btn babel-btn-primary min-h-11"
          onClick={async () => {
            const r = await copyToClipboard(memoMarkdown)
            if (r.ok) flash('copied')
          }}
        >
          Copy memo
        </button>
        <button
          type="button"
          className="babel-btn babel-btn-ghost min-h-11"
          onClick={download}
        >
          <Download className="h-4 w-4" aria-hidden />
          Export Markdown
        </button>
        {toast ? (
          <span
            className="self-center font-mono text-[0.75rem] text-[var(--oasis)]"
            role="status"
          >
            {toast}
          </span>
        ) : null}
      </div>
    </section>
  )
}
