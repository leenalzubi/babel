import { Fragment, useMemo, useState } from 'react'
import { Loader2, Flag } from 'lucide-react'
import {
  buildRowsForClaim,
  changeArrowTone,
  computeJourneySummary,
} from '../lib/auditJourney.js'
import { buildCompetitionMatrix } from '../lib/crossReviewCompetition.js'
import { buildDivergenceRowsFromAudit, normStance } from '../lib/claimDivergence.js'
import { useForge } from '../store/useForgeStore.js'

/** @param {unknown} v */
function str(v) {
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

/**
 * @param {unknown} slot
 * @param {{
 *   agentA: { name: string, color: string },
 *   agentB: { name: string, color: string },
 *   agentC: { name: string, color: string },
 * }} config
 */
function slotLabel(slot, config) {
  const s = str(slot).toLowerCase()
  if (s === 'gpt' || s.includes('gpt-4')) return config.agentA.name
  if (s === 'phi' || s.includes('phi')) return config.agentB.name
  if (s === 'mistral' || s.includes('mistral')) return config.agentC.name
  return str(slot) || '-'
}

/**
 * @param {unknown} slot
 * @param {{
 *   agentA: { name: string, color: string },
 *   agentB: { name: string, color: string },
 *   agentC: { name: string, color: string },
 * }} config
 */
function slotColor(slot, config) {
  const s = str(slot).toLowerCase()
  if (s === 'gpt' || s.includes('gpt-4')) return config.agentA.color
  if (s === 'phi' || s.includes('phi')) return config.agentB.color
  if (s === 'mistral' || s.includes('mistral')) return config.agentC.color
  return 'var(--text-muted)'
}

/** @param {{ value: string }} props */
function PositionCell({ value }) {
  const v = str(value).toLowerCase()
  if (v === 'agree') {
    return (
      <span className="text-[#4C6647]" aria-label="Agree">
        ✓
      </span>
    )
  }
  if (v === 'disagree') {
    return (
      <span className="text-[#97372B]" aria-label="Disagree">
        ✗
      </span>
    )
  }
  if (v === 'partial') {
    return (
      <span className="text-[#D97706]" aria-label="Partial">
        ~
      </span>
    )
  }
  return (
    <span className="text-[var(--text-muted)]" aria-label="Silent">
      -
    </span>
  )
}

/** @param {{ round: 2 | 3, value: unknown, prior: unknown }} props */
function JourneyRoundCell({ round, value, prior }) {
  const changed =
    round > 1 && normStance(value) !== normStance(prior)
  const tone = changed ? changeArrowTone(prior, value) : 'muted'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <PositionCell value={value} />
      {changed ? (
        <span
          className={`font-mono text-[10px] leading-none ${
            tone === 'green'
              ? 'text-[#4C6647]'
              : tone === 'red'
                ? 'text-[#97372B]'
                : 'text-[var(--text-muted)]'
          }`}
          aria-hidden
        >
          →
        </span>
      ) : (
        <span className="h-[10px]" aria-hidden />
      )}
    </div>
  )
}

/** @param {unknown} n */
function cleanChangeNote(n) {
  if (n == null) return null
  const s = String(n).trim()
  if (!s || s.toLowerCase() === 'null') return null
  return s
}

/**
 * @param {{
 *   audit: Record<string, unknown>,
 *   claimId: string,
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 * }} props
 */
function PositionJourneyBlock({ audit, claimId, config }) {
  const rows = buildRowsForClaim(audit, claimId)
  if (!rows.r1) return null

  const models = [
    {
      name: config.agentA.name,
      r1: rows.r1.gpt,
      r2: rows.r2gpt,
      r3: rows.r3gpt,
    },
    {
      name: config.agentB.name,
      r1: rows.r1.phi,
      r2: rows.r2phi,
      r3: rows.r3phi,
    },
    {
      name: config.agentC.name,
      r1: rows.r1.mistral,
      r2: rows.r2mistral,
      r3: rows.r3mistral,
    },
  ]

  return (
    <section className="mb-6 border-b border-[#D4C9B0]/60 pb-6">
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        Position journey
      </p>
      <div className="space-y-3">
        {models.map((m) => {
          const p1 = normStance(m.r1)
          const v2 = m.r2?.position ?? m.r1
          const v3 = m.r3?.position ?? v2
          const p2 = normStance(v2)
          const p3 = normStance(v3)
          const ch2 = p1 !== p2
          const ch3 = p2 !== p3
          const t12 = changeArrowTone(m.r1, v2)
          const t23 = changeArrowTone(v2, v3)
          const mark2 = ch2 ? (
            <span
              className={`font-mono ${
                t12 === 'green'
                  ? 'text-[#4C6647]'
                  : t12 === 'red'
                    ? 'text-[#97372B]'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              →
            </span>
          ) : null
          const mark3 = ch3 ? (
            <span
              className={`font-mono ${
                t23 === 'green'
                  ? 'text-[#4C6647]'
                  : t23 === 'red'
                    ? 'text-[#97372B]'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              →
            </span>
          ) : null
          const n2 = cleanChangeNote(m.r2?.changeNote)
          const n3 = cleanChangeNote(m.r3?.changeNote)
          return (
            <div key={m.name} className="text-[13px]">
              <span className="font-mono font-medium text-[var(--text-primary)]">
                {m.name}:
              </span>{' '}
              <span className="text-[var(--text-secondary)]">
                [{p1} R1] → [{p2} R2{mark2 ? <> {mark2}</> : null}] → [
                {p3} R3{mark3 ? <> {mark3}</> : null}]
              </span>
              {n2 || n3 ? (
                <p className="mt-1 pl-1 italic text-[12px] text-[var(--text-muted)]">
                  {[n2, n3].filter(Boolean).join('; ')}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** @param {{ verdict: string, minorityIncluded?: boolean }} props */
function VerdictPill({ verdict, minorityIncluded }) {
  const v = str(verdict).toLowerCase()
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide'
  if (minorityIncluded || v === 'minority') {
    const label =
      v === 'minority' || !v ? 'Minority' : v.charAt(0).toUpperCase() + v.slice(1)
    return (
      <span
        className={`${base} bg-[#97372B]/12 text-[#7A2C23]`}
      >
        <Flag className="h-3 w-3" strokeWidth={2} aria-hidden />
        {label}
      </span>
    )
  }
  if (v === 'unanimous') {
    return (
      <span
        className={`${base} bg-[#4C6647]/12 text-[#3D5439]`}
      >
        Unanimous
      </span>
    )
  }
  if (v === 'majority') {
    return (
      <span
        className={`${base} bg-[#1E4E5E]/10 text-[#163B47]`}
      >
        Majority
      </span>
    )
  }
  if (v === 'contested') {
    return (
      <span
        className={`${base} bg-[#D97706]/12 text-[#B45309]`}
      >
        Contested
      </span>
    )
  }
  return (
    <span className={`${base} bg-[var(--bg-raised)] text-[var(--text-muted)]`}>
      {verdict || '-'}
    </span>
  )
}

/** @param {{ type: string }} props */
function ChallengeTypeBadge({ type }) {
  const t = str(type).toLowerCase()
  const map = {
    direct: 'bg-[var(--bg-raised)] text-[var(--text-secondary)]',
    implicit: 'bg-[var(--bg-synthesis)]/80 text-[var(--text-secondary)]',
    reframe: 'bg-[var(--bg-notebook)] text-[var(--text-muted)]',
    none: 'bg-[var(--bg-base)] text-[var(--text-muted)]',
  }
  const labelMap = {
    direct: 'Direct',
    implicit: 'Implicit',
    reframe: 'Reframe',
    none: 'None',
  }
  const cls = map[/** @type {keyof typeof map} */ (t)] ?? map.none
  const mapped = labelMap[/** @type {keyof typeof labelMap} */ (t)]
  const label =
    mapped ??
    (t ? t.charAt(0).toUpperCase() + t.slice(1) : 'None')
  return (
    <span
      className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] tracking-wide ${cls}`}
    >
      {label}
    </span>
  )
}

/** @param {{ framing: string }} props */
function FramingBadge({ framing }) {
  const f = str(framing).toLowerCase()
  const danger = f === 'modified' || f === 'dropped'
  const label =
    !f || f === '-'
      ? '-'
      : f.charAt(0).toUpperCase() + f.slice(1)
  return (
    <span
      className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] tracking-wide ${
        danger
          ? f === 'dropped'
            ? 'bg-[#97372B]/12 text-[#7A2C23]'
            : 'bg-[#D97706]/12 text-[#B45309]'
          : 'bg-[var(--bg-raised)] text-[var(--text-secondary)]'
      }`}
    >
      {label}
    </span>
  )
}

/**
 * @param {{
 *   trace: Record<string, unknown>,
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   audit?: Record<string, unknown> | null,
 *   claimId?: string,
 * }} props
 */
function TracePanel({ trace, config, audit, claimId }) {
  if (trace.error) {
    return (
      <div className="px-6 py-4 font-mono text-xs text-[var(--diverge)]">
        Trace unavailable: {str(trace.error)}
      </div>
    )
  }

  const origin = trace.origin && typeof trace.origin === 'object' ? trace.origin : {}
  const challenge =
    trace.challenge && typeof trace.challenge === 'object' ? trace.challenge : {}
  const defense =
    trace.defense && typeof trace.defense === 'object' ? trace.defense : {}
  const syn =
    trace.synthesisTreatment &&
    typeof trace.synthesisTreatment === 'object'
      ? trace.synthesisTreatment
      : {}

  const originAgent = slotLabel(origin.agent, config)
  const originColor = slotColor(origin.agent, config)

  const byRaw = challenge.by
  const byList = Array.isArray(byRaw)
    ? byRaw.map((x) => slotLabel(x, config))
    : []

  return (
    <div
      className="border-l-[3px] border-l-[#1E4E5E] bg-[#F8F3E8] px-6 py-5 text-[14px] leading-relaxed text-[#24201B]"
      style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
    >
      {audit && claimId ? (
        <PositionJourneyBlock audit={audit} claimId={claimId} config={config} />
      ) : null}

      <section className="mb-6">
        <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          01 Origin
        </p>
        <p className="font-[family-name:var(--font-body)]">
          Introduced by{' '}
          <span className="font-mono text-[12px]" style={{ color: originColor }}>
            {originAgent}
          </span>
        </p>
        {origin.quote ? (
          <blockquote className="mt-2 border-l border-[#D4C9B0] pl-3 italic text-[var(--text-secondary)]">
            {str(origin.quote)}
          </blockquote>
        ) : null}
      </section>

      <section className="mb-6">
        <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          02 Challenge
        </p>
        {challenge.occurred ? (
          <>
            <p>
              Challenged by{' '}
              <span className="font-mono text-[12px] text-[var(--text-primary)]">
                {byList.length ? byList.join(', ') : '-'}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ChallengeTypeBadge type={str(challenge.type)} />
            </div>
            {challenge.quote ? (
              <blockquote className="mt-2 border-l border-[#D4C9B0] pl-3 italic text-[var(--text-secondary)]">
                {str(challenge.quote)}
              </blockquote>
            ) : null}
          </>
        ) : (
          <p className="text-[var(--text-secondary)]">
            No direct challenge recorded.
          </p>
        )}
      </section>

      <section className="mb-6">
        <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          03 Defense
        </p>
        {defense.occurred ? (
          <>
            <p>
              Defended by{' '}
              <span className="font-mono text-[12px] text-[var(--text-primary)]">
                {str(defense.by) || '-'}
              </span>
            </p>
            {defense.quote ? (
              <blockquote className="mt-2 border-l border-[#D4C9B0] pl-3 italic text-[var(--text-secondary)]">
                {str(defense.quote)}
              </blockquote>
            ) : null}
          </>
        ) : (
          <p className="italic text-[var(--text-muted)]">
            Claim entered synthesis undefended.
          </p>
        )}
      </section>

      <section>
        <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          04 Synthesis decision
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FramingBadge framing={str(syn.framing)} />
        </div>
        {syn.quote ? (
          <blockquote className="border-l border-[#D4C9B0] pl-3 italic text-[var(--text-secondary)]">
            {str(syn.quote)}
          </blockquote>
        ) : null}
        {syn.drift ? (
          <div className="mt-4 rounded-[4px] border border-dashed border-[#D97706]/50 bg-[#D97706]/10 px-3 py-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#B45309]">
              ⚑ Drift detected
            </p>
            {syn.driftNote ? (
              <p className="mt-1 italic text-[13px] text-[var(--text-secondary)]">
                {str(syn.driftNote)}
              </p>
            ) : null}
          </div>
        ) : null}
        {trace.flag ? (
          <div className="mt-4 rounded-[4px] border border-dashed border-[#97372B]/40 bg-[#97372B]/8 px-3 py-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#7A2C23]">
              ⚑ Notable
            </p>
            {trace.flagReason ? (
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {str(trace.flagReason)}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}

/**
 * @param {string} line
 * @param {{
 *   agentA: { name: string, color: string },
 *   agentB: { name: string, color: string },
 *   agentC: { name: string, color: string },
 * }} config
 */
function synthesisLineAgentPill(line, config) {
  const l = str(line).toLowerCase()
  if (/\b(agent[_\s]?c|mistral)\b/i.test(line) || l.includes('mistral')) {
    return { name: config.agentC.name, color: config.agentC.color }
  }
  if (/\b(agent[_\s]?b|phi-4)\b/i.test(line) || l.includes('phi')) {
    return { name: config.agentB.name, color: config.agentB.color }
  }
  if (/\b(agent[_\s]?a|gpt-4o)\b/i.test(line) || l.includes('gpt')) {
    return { name: config.agentA.name, color: config.agentA.color }
  }
  return { name: '-', color: 'var(--text-muted)' }
}

export default function AuditTrail({ onRetryAudit, auditRetrying = false }) {
  const { state } = useForge()
  const {
    audit,
    auditLoading,
    auditError,
    config,
    synthesis,
    validation,
    synthesisWinner,
  } = state
  const stageAuditError = state.stageErrors?.audit ?? null
  const showAuditUnavailable = Boolean(auditError || stageAuditError)
  const concessions = Array.isArray(synthesis?.concessions)
    ? synthesis.concessions
    : []
  const heldFirmLines = Array.isArray(synthesis?.heldFirm)
    ? synthesis.heldFirm
    : []
  const [expandedId, setExpandedId] = useState(/** @type {string | null} */ (null))

  const claimById = useMemo(() => {
    const list = audit?.claims
    if (!Array.isArray(list)) return new Map()
    return new Map(list.map((c) => [str(c.id), c]))
  }, [audit])

  const rows = useMemo(() => {
    if (!audit) return []
    const hasJourney =
      audit.positionsRound1 &&
      typeof audit.positionsRound1 === 'object' &&
      audit.positionsRound2 &&
      typeof audit.positionsRound2 === 'object' &&
      audit.positionsRound3 &&
      typeof audit.positionsRound3 === 'object'

    if (hasJourney) {
      const divRows = buildDivergenceRowsFromAudit(audit)
      return divRows.map((dr) => {
        const id = str(dr.claimId)
        const br = buildRowsForClaim(audit, id)
        const claim = claimById.get(id)
        const r1 = br.r1
        const g1 = r1?.gpt
        const p1 = r1?.phi
        const m1 = r1?.mistral
        const g2 = br.r2gpt?.position ?? g1
        const p2 = br.r2phi?.position ?? p1
        const m2 = br.r2mistral?.position ?? m1
        const g3 = br.r3gpt?.position ?? g2
        const p3 = br.r3phi?.position ?? p2
        const m3 = br.r3mistral?.position ?? m2
        return {
          claimId: id,
          text: claim && typeof claim.text === 'string' ? claim.text : id,
          gpt: { r1: g1, r2: g2, r3: g3 },
          phi: { r1: p1, r2: p2, r3: p3 },
          mistral: { r1: m1, r2: m2, r3: m3 },
          verdict: str(dr.verdict),
          minorityIncluded: Boolean(dr.minorityIncluded),
        }
      })
    }

    const positions = audit.positions
    if (!Array.isArray(positions) || positions.length === 0) return []
    return positions.map((p) => {
      const po = /** @type {Record<string, unknown>} */ (p)
      const id = str(po.claimId)
      const claim = claimById.get(id)
      const g = po.gpt
      const ph = po.phi
      const mi = po.mistral
      return {
        claimId: id,
        text: claim && typeof claim.text === 'string' ? claim.text : id,
        gpt: { r1: g, r2: g, r3: g },
        phi: { r1: ph, r2: ph, r3: ph },
        mistral: { r1: mi, r2: mi, r3: mi },
        verdict: str(po.verdict),
        minorityIncluded: Boolean(po.minorityIncluded),
      }
    })
  }, [audit, claimById])

  const tracesByClaim = useMemo(() => {
    const m = new Map()
    const list = audit?.traces
    if (!Array.isArray(list)) return m
    for (const t of list) {
      if (t && typeof t === 'object' && 'claimId' in t) {
        m.set(str(t.claimId), /** @type {Record<string, unknown>} */ (t))
      }
    }
    return m
  }, [audit])

  const journeyStats = useMemo(
    () =>
      audit
        ? computeJourneySummary(audit)
        : { nClaims: 0, unchanged: 0, shifted: 0, flipped: 0 },
    [audit]
  )

  const hasExpandableRow = rows.some(
    (r) => r.verdict === 'contested' || r.minorityIncluded
  )

  const competitionMatrix = useMemo(() => {
    if (
      !synthesisWinner ||
      typeof synthesisWinner !== 'object' ||
      !synthesisWinner.evaluations
    ) {
      return null
    }
    return buildCompetitionMatrix(
      /** @type {Parameters<typeof buildCompetitionMatrix>[0]} */ (
        synthesisWinner
      )
    )
  }, [synthesisWinner])

  if (
    !auditLoading &&
    !audit &&
    !auditError &&
    concessions.length === 0 &&
    heldFirmLines.length === 0 &&
    validation == null &&
    !competitionMatrix
  ) {
    return null
  }

  return (
    <section
      className="audit-trail mx-auto w-full max-w-4xl px-1 pb-12"
      aria-label="Debate audit trail"
    >
      {competitionMatrix ? (
        <div className="mb-10 overflow-x-auto rounded-[6px] border border-dashed border-[#D4C9B0] bg-[var(--bg-surface)]/60 px-4 py-5 md:px-6">
          <h3 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Competition scores
          </h3>
          <p className="mb-4 font-[family-name:var(--font-body)] text-xs italic text-[var(--text-muted)]">
            Peer evaluation totals (specificity + accuracy) / 2. Hover a cell for the
            evaluator note.
          </p>
          <table className="w-full min-w-[420px] border-collapse text-left font-mono text-[12px]">
            <thead>
              <tr className="border-b border-[#D4C9B0] text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-2 py-2 font-medium">Evaluator</th>
                {(
                  [
                    ['gpt', config.agentA.name],
                    ['phi', config.agentB.name],
                    ['mistral', config.agentC.name],
                  ]
                ).map(([key, name]) => (
                  <th
                    key={key}
                    className={`px-2 py-2 text-center font-medium ${
                      competitionMatrix.winner === key
                        ? 'bg-[#FEF3C7]/90 text-[#B45309]'
                        : ''
                    }`}
                  >
                    Scored {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['gpt', config.agentA.name],
                  ['phi', config.agentB.name],
                  ['mistral', config.agentC.name],
                ]
              ).map(([rowKey, rowName]) => (
                <tr
                  key={rowKey}
                  className="border-b border-dashed border-[#D4C9B0]/80"
                >
                  <td className="px-2 py-2 text-[var(--text-primary)]">
                    {rowName}
                  </td>
                  {(['gpt', 'phi', 'mistral']).map((colKey) => {
                    const v =
                      competitionMatrix.cells[rowKey]?.[colKey] ?? null
                    const note =
                      competitionMatrix.notes[rowKey]?.[colKey] ?? ''
                    const isDiag = rowKey === colKey
                    const winCol = competitionMatrix.winner === colKey
                    return (
                      <td
                        key={colKey}
                        className={`px-2 py-2 text-center tabular-nums ${
                          winCol ? 'bg-[#FEF3C7]/50' : ''
                        }`}
                        title={!isDiag && note ? note : undefined}
                      >
                        {isDiag ? '-' : v != null ? String(v) : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr className="font-semibold text-[var(--text-primary)]">
                <td className="px-2 py-2">Average</td>
                {(['gpt', 'phi', 'mistral']).map((colKey) => {
                  const a = competitionMatrix.avgCol[colKey]
                  const winCol = competitionMatrix.winner === colKey
                  return (
                    <td
                      key={colKey}
                      className={`px-2 py-2 text-center tabular-nums ${
                        winCol ? 'bg-[#FEF3C7]/80 text-[#B45309]' : ''
                      }`}
                    >
                      {a != null ? `${a}` : '-'}
                      {winCol ? ' ← winner' : ''}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {concessions.length > 0 ? (
        <div className="mb-10 rounded-[6px] border border-dashed border-[#4C6647]/35 bg-[#4C6647]/6 px-4 py-5 md:px-6">
          <h3 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[#3D5439]">
            Concessions made
          </h3>
          <ul className="flex flex-col gap-3">
            {concessions.map((line, i) => {
              const pill = synthesisLineAgentPill(line, config)
              return (
                <li
                  key={`conc-${i}`}
                  className="flex flex-wrap items-baseline gap-2 text-[15px] italic leading-relaxed text-[var(--text-secondary)]"
                >
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] font-medium not-italic text-[var(--text-primary)]"
                    style={{ borderColor: pill.color, color: pill.color }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: pill.color }}
                      aria-hidden
                    />
                    {pill.name}
                  </span>
                  <span className="text-[var(--text-muted)]">conceded:</span>
                  <span>{str(line).replace(/^[^:]+:\s*/, '').trim() || str(line)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {heldFirmLines.length > 0 ? (
        <div className="mb-10 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/80 px-4 py-5 md:px-6">
          <h3 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Positions maintained under challenge
          </h3>
          <ul className="flex flex-col gap-3">
            {heldFirmLines.map((line, i) => {
              const pill = synthesisLineAgentPill(line, config)
              return (
                <li
                  key={`held-${i}`}
                  className="relative flex flex-wrap items-baseline gap-2 pl-3 text-[15px] leading-relaxed text-[var(--text-secondary)] before:absolute before:left-0 before:top-1 before:h-[calc(100%-4px)] before:w-px before:bg-[var(--agree)]/50"
                >
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--text-primary)]"
                    style={{ borderColor: pill.color, color: pill.color }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: pill.color }}
                      aria-hidden
                    />
                    {pill.name}
                  </span>
                  <span className="text-[var(--text-muted)]">maintained:</span>
                  <span className="italic">
                    {str(line).replace(/^[^:]+:\s*/, '').trim() || str(line)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {auditLoading ? (
        <div
          className="mb-6 flex items-center justify-center gap-2 font-mono text-[13px] text-[var(--text-muted)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Computing audit trail…
        </div>
      ) : null}

      {showAuditUnavailable && !auditLoading ? (
        <div
          className="mb-4 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-center"
          role="status"
        >
          <p className="font-mono text-xs text-[var(--text-muted)]">
            Evaluation unavailable. The debate and synthesis remain above.
          </p>
          {typeof onRetryAudit === 'function' ? (
            <button
              type="button"
              className="babel-btn babel-btn-ghost mt-3"
              disabled={auditRetrying}
              onClick={onRetryAudit}
            >
              {auditRetrying ? 'Retrying audit…' : 'Retry audit'}
            </button>
          ) : null}
        </div>
      ) : null}

      {audit ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <span className="babel-eyebrow">Audit trail</span>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-[4px] border border-dashed border-[#D4C9B0] bg-transparent px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)]">
                {journeyStats.nClaims} claims
              </span>
              <span className="rounded-[4px] border border-dashed border-[#D97706]/45 bg-[#D97706]/10 px-2 py-1 font-mono text-[10px] text-[#B45309]">
                {journeyStats.shifted} positions shifted
              </span>
              <span
                className={`rounded-[4px] border border-dashed px-2 py-1 font-mono text-[10px] ${
                  journeyStats.flipped > 0
                    ? 'border-[#97372B]/40 bg-[#97372B]/10 text-[#7A2C23]'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                {journeyStats.flipped} flipped
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs italic text-[var(--text-muted)]">
              No claim rows returned for this debate.
            </p>
          ) : (
            <>
              <p className="mb-2 babel-meta">
                {journeyStats.nClaims} claims; {journeyStats.unchanged}{' '}
                unchanged; {journeyStats.shifted} shifted;{' '}
                {journeyStats.flipped} flipped
              </p>
              <div className="overflow-x-auto rounded-[6px] border border-dashed border-[#D4C9B0] bg-[var(--bg-surface)]/60">
                <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#D4C9B0]">
                      <th
                        rowSpan={2}
                        className="px-3 py-2 align-bottom font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]"
                      >
                        Claim
                      </th>
                      <th
                        colSpan={3}
                        className="px-2 py-2 text-center font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]"
                      >
                        {config.agentA.name}
                      </th>
                      <th
                        colSpan={3}
                        className="px-2 py-2 text-center font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]"
                      >
                        {config.agentB.name}
                      </th>
                      <th
                        colSpan={3}
                        className="px-2 py-2 text-center font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]"
                      >
                        {config.agentC.name}
                      </th>
                      <th
                        rowSpan={2}
                        className="px-2 py-2 align-bottom text-center font-mono text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)]"
                      >
                        Final verdict
                      </th>
                    </tr>
                    <tr className="border-b border-[#D4C9B0]">
                      {[
                        config.agentA.name,
                        config.agentB.name,
                        config.agentC.name,
                      ].flatMap((agentName) =>
                        ['R1', 'R2', 'R3'].map((r) => (
                          <th
                            key={`${agentName}-${r}`}
                            className="px-1 py-1.5 text-center font-mono text-[10px] font-medium tracking-wide text-[var(--text-muted)]"
                          >
                            {r}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const expandable =
                        row.verdict === 'contested' || row.minorityIncluded
                      const open = expandedId === row.claimId
                      const trace = tracesByClaim.get(row.claimId)
                      return (
                        <Fragment key={`audit-row-${row.claimId}`}>
                          <tr
                            className={`border-b border-dashed border-[#D4C9B0] transition-colors ${
                              expandable
                                ? 'cursor-pointer hover:bg-[#F0E8D5]'
                                : ''
                            }`}
                            onClick={() => {
                              if (!expandable) return
                              setExpandedId((id) =>
                                id === row.claimId ? null : row.claimId
                              )
                            }}
                            onKeyDown={(e) => {
                              if (!expandable) return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setExpandedId((id) =>
                                  id === row.claimId ? null : row.claimId
                                )
                              }
                            }}
                            tabIndex={expandable ? 0 : undefined}
                            aria-expanded={expandable ? open : undefined}
                          >
                            <td
                              className="px-3 py-3 align-top text-[14px] leading-snug text-[#24201B]"
                              style={{
                                fontFamily: 'var(--font-body), Georgia, serif',
                              }}
                            >
                              {row.text}
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={1}
                                value={row.gpt.r1}
                                prior={row.gpt.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={2}
                                value={row.gpt.r2}
                                prior={row.gpt.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={3}
                                value={row.gpt.r3}
                                prior={row.gpt.r2}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={1}
                                value={row.phi.r1}
                                prior={row.phi.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={2}
                                value={row.phi.r2}
                                prior={row.phi.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={3}
                                value={row.phi.r3}
                                prior={row.phi.r2}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={1}
                                value={row.mistral.r1}
                                prior={row.mistral.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={2}
                                value={row.mistral.r2}
                                prior={row.mistral.r1}
                              />
                            </td>
                            <td className="px-1 py-2 text-center align-middle">
                              <JourneyRoundCell
                                round={3}
                                value={row.mistral.r3}
                                prior={row.mistral.r2}
                              />
                            </td>
                            <td className="px-2 py-3 text-center align-middle">
                              <VerdictPill
                                verdict={row.verdict}
                                minorityIncluded={row.minorityIncluded}
                              />
                            </td>
                          </tr>
                          {expandable ? (
                            <tr
                              key={`${row.claimId}-trace`}
                              className="bg-[var(--bg-base)]/30"
                            >
                              <td colSpan={11} className="p-0">
                                <div
                                  className={`overflow-hidden transition-[max-height] duration-[400ms] ease-out ${
                                    open ? 'max-h-[3200px]' : 'max-h-0'
                                  }`}
                                >
                                  {open ? (
                                    trace ? (
                                      <TracePanel
                                        trace={trace}
                                        config={config}
                                        audit={audit}
                                        claimId={row.claimId}
                                      />
                                    ) : (
                                      <div className="px-6 py-4 font-mono text-xs italic text-[var(--text-muted)]">
                                        No trace returned for this claim.
                                      </div>
                                    )
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {!hasExpandableRow && rows.length > 0 ? (
                <p className="mt-6 text-center font-[family-name:var(--font-body)] text-sm italic text-[var(--text-muted)]">
                  All claims reached consensus: no contested positions detected.
                </p>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {validation?.status === 'pending' ? (
        <div
          className="mt-10 flex items-center gap-2 rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/80 px-4 py-4 font-mono text-[13px] text-[var(--text-muted)]"
          role="status"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Peer validation in progress…
        </div>
      ) : null}

      {validation &&
      validation.b &&
      validation.c &&
      (validation.status === 'approved' || validation.status === 'flagged') ? (
        <div
          className={`mt-10 rounded-[6px] border border-dashed px-4 py-5 md:px-6 ${
            validation.status === 'flagged'
              ? 'border-l-[3px] border-l-[#D97706] bg-[#FFFBEB]/90'
              : 'border-l-[3px] border-l-[#4C6647] bg-[#E8EDE6]/90'
          } border-[var(--border)]`}
        >
          <h3 className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Peer validation
          </h3>
          <p
            className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]"
            style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
          >
            The two non-synthesizing agents reviewed the synthesis for fairness
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              { key: 'b', spec: config.agentB, v: validation.b },
              { key: 'c', spec: config.agentC, v: validation.c },
            ].map(({ key, spec, v }) => (
              <div
                key={key}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)]/90 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[var(--text-primary)]"
                    style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
                  >
                    {spec.name}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-[var(--text-primary)]">
                    {v.score}/10
                  </span>
                </div>
                <p className="mt-2 babel-meta">
                  fair_to_me:{' '}
                  <span className="text-[var(--ink)]">
                    {v.fair_to_me ? 'yes' : 'no'}
                  </span>
                  ; fair_to_others:{' '}
                  <span className="text-[var(--ink)]">
                    {v.fair_to_others ? 'yes' : 'no'}
                  </span>
                </p>
                {v.bias_note ? (
                  <p
                    className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]"
                    style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                      bias_note:{' '}
                    </span>
                    {str(v.bias_note)}
                  </p>
                ) : null}
                {v.missing ? (
                  <p
                    className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]"
                    style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
                  >
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                      missing:{' '}
                    </span>
                    {str(v.missing)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
