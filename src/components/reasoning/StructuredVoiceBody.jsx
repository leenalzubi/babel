import { useMemo, useState } from 'react'
import AgentResponseBody from '../AgentResponseBody.jsx'
import ArgumentTrace, { buildClaimTraceSteps } from './ArgumentTrace.jsx'
import ProvenancePanel from './ProvenancePanel.jsx'
import {
  ClaimBlock,
  Counterpoint,
  PositionChange,
  UnparsedPassage,
} from './Primitives.jsx'
import { claimAnchorId, jumpToClaim } from '../../lib/claimNavigation.js'

const replyMd =
  'max-w-none min-w-0 break-words text-[length:var(--text-body)] leading-[var(--lh-body)] text-[var(--text-secondary)] [&_code]:break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_strong]:text-[var(--text-primary)]'

/**
 * Renders structured extraction with raw-response fallback.
 * @param {{
 *   rawText: string,
 *   structure?: import('../../lib/parseStructuredResponse.js').StructuredVoice | null,
 *   roleLabel?: string,
 *   challengesByClaim?: Record<string, { roleLabel: string, text?: string }[]>,
 *   criterion?: string | null,
 *   moveToResponseId?: string | null,
 * }} props
 */
export default function StructuredVoiceBody({
  rawText,
  structure = null,
  roleLabel = 'Voice',
  challengesByClaim = {},
  criterion = null,
  moveToResponseId = null,
}) {
  const [showOriginal, setShowOriginal] = useState(false)
  const [provenanceId, setProvenanceId] = useState(
    /** @type {string | null} */ (null)
  )

  const extraction = structure?.extraction ?? 'raw_response'
  const canStructure =
    structure &&
    (extraction === 'structured' || extraction === 'partially_structured') &&
    (structure.claims.length > 0 ||
      structure.counterpoints.length > 0 ||
      structure.changes.length > 0)

  const activeClaim = useMemo(() => {
    if (!provenanceId || !structure?.claims) return null
    return structure.claims.find((c) => c.id === provenanceId) ?? null
  }, [provenanceId, structure])

  const headingId = moveToResponseId || undefined

  if (!canStructure || showOriginal) {
    return (
      <div id={headingId}>
        {extraction === 'structure_failed' ||
        (!canStructure && extraction === 'raw_response') ? (
          <p className="mb-2 font-mono text-[0.72rem] text-[var(--ink-soft)]">
            Organized response was unavailable. View the AI reasoning.
          </p>
        ) : null}
        {canStructure ? (
          <button
            type="button"
            className="babel-btn babel-btn-quiet mb-2 min-h-11 px-2 py-1"
            onClick={() => setShowOriginal(false)}
          >
            Organized response
          </button>
        ) : null}
        <AgentResponseBody rawText={rawText} markdownClassName={replyMd} />
      </div>
    )
  }

  return (
    <div data-extraction={extraction} id={headingId}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {structure.stance ? (
          <span className="babel-voice-stance">stance: {structure.stance}</span>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="babel-btn babel-btn-quiet min-h-11 px-2 py-1"
          onClick={() => setShowOriginal(true)}
        >
          AI reasoning
        </button>
      </div>

      {structure.claims.map((claim) => {
        const challenges = challengesByClaim[claim.id] ?? []
        const change =
          structure.changes.find(
            (ch) =>
              ch.claimId === claim.id ||
              ch.claimId.endsWith(claim.id.replace(/^[ABC]-/, ''))
          ) ?? null
        const steps = buildClaimTraceSteps({
          roleLabel,
          claimId: claim.id,
          challenges,
          change,
          criterion,
        }).map((step) => ({
          ...step,
          onSelect: step.claimId
            ? () => jumpToClaim(step.claimId)
            : undefined,
        }))
        return (
          <div
            key={claim.id}
            id={claimAnchorId(claim.id)}
            className="claim-anchor mb-4 scroll-mt-28 rounded-[var(--radius-sm)]"
          >
            <ClaimBlock
              id={claim.id}
              text={claim.text}
              evidence={claim.evidence}
              onOpenProvenance={setProvenanceId}
            />
            {change?.text && change.action !== 'preserved' ? (
              <p className="mt-1 text-[0.85rem] text-[var(--ink-soft)]">
                <span className="position-change font-semibold">
                  Was:{' '}
                </span>
                {claim.text}
                {change.text ? (
                  <>
                    <span className="mx-2 text-[var(--ink-soft)]">→</span>
                    <span className="text-[var(--ink)]">{change.text}</span>
                  </>
                ) : null}
              </p>
            ) : null}
            {steps.length > 1 ? <ArgumentTrace steps={steps} /> : null}
          </div>
        )
      })}

      {structure.counterpoints.map((cp, i) => (
        <Counterpoint
          key={`cp-${i}`}
          targetClaimId={cp.targetClaimId}
          text={cp.text}
          linked={cp.linked}
        />
      ))}

      {structure.changes
        .filter((ch) => !structure.claims.some((c) => c.id === ch.claimId))
        .map((ch, i) => (
          <PositionChange
            key={`ch-${i}`}
            claimId={ch.claimId}
            action={ch.action}
            revisedId={ch.revisedId}
            text={ch.text}
            reason={ch.reason}
          />
        ))}

      {extraction === 'partially_structured' && structure.unparsed ? (
        <UnparsedPassage>
          <AgentResponseBody
            rawText={structure.unparsed}
            markdownClassName={replyMd}
          />
        </UnparsedPassage>
      ) : null}

      {provenanceId && activeClaim ? (
        <ProvenancePanel
          claimId={activeClaim.id}
          claimText={activeClaim.text}
          citationsSupplied={activeClaim.evidence?.length ?? 0}
          challengedBy={(challengesByClaim[activeClaim.id] ?? []).map(
            (c) => c.roleLabel
          )}
          debateStatus={
            structure.changes.some((c) => c.claimId === activeClaim.id)
              ? 'Revised after critique'
              : 'Retained after critique'
          }
          verification="Not independently checked"
          onClose={() => setProvenanceId(null)}
        />
      ) : null}
    </div>
  )
}
