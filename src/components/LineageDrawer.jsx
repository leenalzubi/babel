import React, { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import ArgumentTrace from './reasoning/ArgumentTrace.jsx'
import {
  buildDeterministicTrace,
  evidenceLabel,
  normalizeClaimId,
} from '../lib/synthesisLineage.js'
import { jumpToClaim } from '../lib/claimNavigation.js'

const mdClass =
  'max-w-none text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink)] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_code]:font-mono [&_code]:text-[0.9em]'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   finding: import('../lib/lineageTypes.js').EnrichedSynthesisFinding | null,
 *   registry: Record<string, any>,
 *   voiceRecords: Record<string, any>,
 *   criteria?: string[],
 *   returnFocusRef?: { current: HTMLElement | null },
 * }} props
 */
export default function LineageDrawer({
  open,
  onClose,
  finding,
  registry,
  voiceRecords,
  criteria = [],
  returnFocusRef,
}) {
  const titleId = useId()
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const [originalId, setOriginalId] = useState(/** @type {string | null} */ (null))
  const [originalClaimId, setOriginalClaimId] = useState(
    /** @type {string | null} */ (null)
  )

  useEffect(() => {
    if (!open) {
      setOriginalId(null)
      setOriginalClaimId(null)
      return
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => closeRef.current?.focus(), 20)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
    }
  }, [open, finding?.findingId])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (originalId) {
          setOriginalId(null)
          setOriginalClaimId(null)
          return
        }
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, originalId])

  useEffect(() => {
    if (open) return
    const el = returnFocusRef?.current
    if (el && typeof el.focus === 'function') {
      window.requestAnimationFrame(() => el.focus())
    }
  }, [open, returnFocusRef])

  if (!open || !finding) return null

  const supporting = finding.supportingClaimIds
    .map((id) => registry[normalizeClaimId(id)])
    .filter(Boolean)
  const challenging = finding.challengingClaimIds
    .map((id) => registry[normalizeClaimId(id)])
    .filter(Boolean)
  const related = (finding.relatedClaimIds ?? [])
    .map((id) => registry[normalizeClaimId(id)])
    .filter(Boolean)

  const changedPairs = supporting
    .filter((c) => c.supersedesClaimId || c.revisedByClaimId || c.evolution === 'withdrawn')
    .map((c) => {
      const earlier = c.supersedesClaimId
        ? registry[normalizeClaimId(c.supersedesClaimId)]
        : c.evolution !== 'new'
          ? c
          : null
      const later = c.revisedByClaimId
        ? registry[normalizeClaimId(c.revisedByClaimId)]
        : c
      return { earlier, later, claim: c }
    })

  // Also show R1 claims that were revised
  for (const c of Object.values(registry)) {
    if (
      c.roundId === 'round_1' &&
      c.revisedByClaimId &&
      supporting.some(
        (s) =>
          normalizeClaimId(s.claimId) === normalizeClaimId(c.claimId) ||
          normalizeClaimId(s.supersedesClaimId || '') ===
            normalizeClaimId(c.claimId)
      )
    ) {
      const later = registry[normalizeClaimId(c.revisedByClaimId)]
      if (
        later &&
        !changedPairs.some(
          (p) =>
            normalizeClaimId(p.earlier?.claimId || '') ===
            normalizeClaimId(c.claimId)
        )
      ) {
        changedPairs.push({ earlier: c, later, claim: c })
      }
    }
  }

  const original = originalId ? voiceRecords[originalId] : null
  const originalClaim = originalClaimId
    ? registry[normalizeClaimId(originalClaimId)]
    : null

  const openOriginal = (responseId, claimId) => {
    setOriginalId(responseId)
    setOriginalClaimId(claimId ?? null)
    try {
      console.info('[babel:analytics]', {
        event: 'original_response_opened',
        responseId,
        claimId: claimId ?? null,
      })
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]"
        aria-label="Close lineage panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[92dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-[var(--radius)] border border-[var(--line)] bg-[var(--plaster)] shadow-forge-card md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[min(100vw,28rem)] md:rounded-none md:border-l md:border-t-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-4">
          <div className="min-w-0">
            <p className="babel-eyebrow m-0">Lineage</p>
            <h2
              id={titleId}
              className="mt-1 font-[family-name:var(--font-display)] text-[1.15rem] font-[560] leading-snug text-[var(--ink)]"
            >
              Inspect finding
            </h2>
            <p className="mt-1 font-mono text-[0.72rem] text-[var(--ink-soft)]">
              {finding.lineageStatus === 'complete'
                ? 'Complete lineage'
                : finding.lineageStatus === 'partial'
                  ? 'Partial lineage'
                  : 'Lineage unavailable'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="babel-btn babel-btn-quiet min-h-11 min-w-11 p-2"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {original ? (
            <OriginalResponseView
              record={original}
              claim={originalClaim}
              onBack={() => {
                setOriginalId(null)
                setOriginalClaimId(null)
              }}
            />
          ) : (
            <>
              <section aria-labelledby="lineage-finding-h" className="mb-6">
                <h3
                  id="lineage-finding-h"
                  className="babel-voice-name mb-2"
                >
                  Finding
                </h3>
                <p className="m-0 whitespace-pre-wrap text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--ink)]">
                  {finding.text}
                </p>
                {finding.limitation ? (
                  <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
                    {finding.limitation}
                  </p>
                ) : null}
              </section>

              <ClaimSection
                title="Supported by"
                empty="No supporting claims are linked to this finding."
                claims={supporting}
                registry={registry}
                criteria={criteria}
                onViewOriginal={openOriginal}
                onJumpClaim={jumpToClaim}
              />

              <ClaimSection
                title="Challenged by"
                empty="No challenges are linked to this finding."
                claims={challenging}
                registry={registry}
                criteria={criteria}
                ochre
                onViewOriginal={openOriginal}
                onJumpClaim={jumpToClaim}
              />

              {related.length > 0 ? (
                <ClaimSection
                  title="Related (not supporting)"
                  empty=""
                  claims={related}
                  registry={registry}
                  criteria={criteria}
                  onViewOriginal={openOriginal}
                  onJumpClaim={jumpToClaim}
                />
              ) : null}

              {changedPairs.length > 0 ? (
                <section aria-labelledby="lineage-changed-h" className="mb-6">
                  <h3 id="lineage-changed-h" className="babel-voice-name mb-2">
                    What changed
                  </h3>
                  <ul className="m-0 list-none space-y-3 p-0">
                    {changedPairs.map(({ earlier, later, claim }, i) => (
                      <li
                        key={`${claim.claimId}-chg-${i}`}
                        className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3"
                      >
                        <p className="position-change m-0 font-mono text-[0.75rem] uppercase tracking-wide">
                          {later?.evolution || claim.evolution || 'revised'}
                        </p>
                        {earlier ? (
                          <p className="mt-2 text-[0.9rem] text-[var(--ink-soft)]">
                            <span className="font-mono text-[0.72rem] text-[var(--ink-soft)]">
                              Earlier ({earlier.claimId})
                            </span>
                            <br />
                            {earlier.text}
                          </p>
                        ) : null}
                        {later && later !== earlier ? (
                          <p className="mt-2 text-[0.9rem] text-[var(--ink)]">
                            <span className="font-mono text-[0.72rem] text-[var(--ink-soft)]">
                              Later ({later.claimId})
                            </span>
                            <br />
                            {later.text || '_(withdrawn)_'}
                          </p>
                        ) : null}
                        {(later?.changeReason || claim.changeReason) && (
                          <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
                            {later?.changeReason || claim.changeReason}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="lineage-limits-h" className="mb-6">
                <h3 id="lineage-limits-h" className="babel-voice-name mb-2">
                  Limitations
                </h3>
                <ul className="m-0 list-disc space-y-1 pl-5 text-[0.9rem] text-[var(--ink-soft)]">
                  {finding.limitation ? (
                    <li>{finding.limitation}</li>
                  ) : null}
                  <li>
                    Citations are model-supplied unless this build records an
                    independent check. Default: not independently verified.
                  </li>
                  <li>
                    Exact source passage mapping is unavailable unless a
                    character range was captured (it was not).
                  </li>
                  {!supporting.length && finding.lineageStatus !== 'complete' ? (
                    <li>
                      Lineage for this finding could not be fully established
                      from stored claim references.
                    </li>
                  ) : null}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * @param {{
 *   title: string,
 *   empty: string,
 *   claims: any[],
 *   registry: Record<string, any>,
 *   criteria: string[],
 *   ochre?: boolean,
 *   onViewOriginal: (responseId: string, claimId?: string) => void,
 *   onJumpClaim: (id: string) => void,
 * }} props
 */
function ClaimSection({
  title,
  empty,
  claims,
  registry,
  criteria,
  ochre = false,
  onViewOriginal,
  onJumpClaim,
}) {
  const headingId = `lineage-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={headingId} className="mb-6">
      <h3 id={headingId} className="babel-voice-name mb-2">
        {title}
      </h3>
      {claims.length === 0 ? (
        <p className="m-0 text-[0.9rem] text-[var(--ink-soft)]">{empty}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {claims.map((c) => {
            const trace = buildDeterministicTrace(c, registry, criteria)
            return (
              <li
                key={c.claimId}
                className={`rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3 ${
                  ochre ? 'border-l-2 border-l-[var(--ochre)]' : ''
                }`}
              >
                <p className="m-0 babel-meta-tech">
                  <span className="meta-label">Role:</span>{' '}
                  {c.roleLabel || 'Voice'}
                  <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                    |
                  </span>
                  <span className="meta-label">Model:</span>{' '}
                  {c.modelName || c.modelId}
                  <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                    |
                  </span>
                  <span className="meta-label">Round:</span>{' '}
                  {String(c.roundId).replace('_', ' ')}
                  <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
                    |
                  </span>
                  <span className="meta-label">Claim:</span> {c.claimId}
                </p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--ink)]">
                  {c.text}
                </p>
                <p className="mt-2 babel-meta">
                  Evolution: {c.evolution || 'unknown'};{' '}
                  {evidenceLabel(c.evidenceState || 'not_checked')}
                </p>
                {trace.length > 0 ? (
                  <ArgumentTrace
                    steps={trace.map((s) => ({
                      ...s,
                      onSelect: s.claimId
                        ? () => onJumpClaim(s.claimId)
                        : undefined,
                    }))}
                  />
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="babel-btn babel-btn-ghost min-h-11"
                    onClick={() => {
                      try {
                        console.info('[babel:analytics]', {
                          event: ochre
                            ? 'challenging_claim_selected'
                            : 'supporting_claim_selected',
                          claimId: c.claimId,
                        })
                      } catch {
                        /* ignore */
                      }
                      onViewOriginal(c.responseId, c.claimId)
                    }}
                  >
                    View original response
                  </button>
                  <button
                    type="button"
                    className="babel-btn babel-btn-quiet min-h-11"
                    onClick={() => onJumpClaim(c.claimId)}
                  >
                    Jump to claim
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * @param {{
 *   record: any,
 *   claim: any,
 *   onBack: () => void,
 * }} props
 */
function OriginalResponseView({ record, claim, onBack }) {
  const hasExactRange =
    claim &&
    typeof claim.sourceStart === 'number' &&
    typeof claim.sourceEnd === 'number' &&
    claim.sourceEnd > claim.sourceStart

  let before = ''
  let highlight = ''
  let after = ''
  if (hasExactRange) {
    before = record.rawText.slice(0, claim.sourceStart)
    highlight = record.rawText.slice(claim.sourceStart, claim.sourceEnd)
    after = record.rawText.slice(claim.sourceEnd)
  }

  return (
    <div>
      <button
        type="button"
        className="babel-btn babel-btn-quiet mb-4 min-h-11 px-2"
        onClick={onBack}
      >
        ← Back to lineage
      </button>
      <h3 className="babel-voice-name m-0">Original response</h3>
      <p className="mt-2 babel-meta-tech">
        <span className="meta-label">Role:</span> {record.roleLabel || 'Voice'}
        <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
          |
        </span>
        <span className="meta-label">Model:</span>{' '}
        {record.modelName || record.modelId}
        <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
          |
        </span>
        <span className="meta-label">Round:</span>{' '}
        {String(record.roundId).replace('_', ' ')}
        {record.createdAt ? (
          <>
            <span className="mx-2 text-[var(--ink-faint)]" aria-hidden>
              |
            </span>
            <span className="meta-label">Recorded:</span> {record.createdAt}
          </>
        ) : null}
      </p>
      {hasExactRange ? (
        <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
          Exact source passage highlighted below.
        </p>
      ) : (
        <p className="mt-2 text-[0.85rem] text-[var(--ink-soft)]">
          Exact passage mapping unavailable. The full unmodified response is
          shown.
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-[var(--radius)] border border-[var(--line)] bg-[var(--plaster-hi)] p-3">
        {hasExactRange ? (
          <pre className="m-0 whitespace-pre-wrap break-words font-[family-name:var(--font-body)] text-[0.95rem] leading-[1.65] text-[var(--ink)]">
            {before}
            <mark className="bg-[color-mix(in_srgb,var(--oasis)_35%,transparent)] text-[var(--ink)]">
              {highlight}
            </mark>
            {after}
          </pre>
        ) : (
          <div className={mdClass}>
            <ReactMarkdown>{record.rawText}</ReactMarkdown>
          </div>
        )}
      </div>
      {claim ? (
        <p className="mt-3 font-mono text-[0.72rem] text-[var(--ink-soft)]">
          Associated claim: {claim.claimId}
        </p>
      ) : null}
    </div>
  )
}
