import { Fragment, useMemo, useState } from 'react'
import { Loader2, Flag } from 'lucide-react'
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
  return str(slot) || '—'
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
      <span className="text-[#16A34A]" aria-label="Agree">
        ✓
      </span>
    )
  }
  if (v === 'disagree') {
    return (
      <span className="text-[#DC2626]" aria-label="Disagree">
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
      ·
    </span>
  )
}

/** @param {{ verdict: string, minorityIncluded?: boolean }} props */
function VerdictPill({ verdict, minorityIncluded }) {
  const v = str(verdict).toLowerCase()
  const base =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide'
  if (minorityIncluded || v === 'minority') {
    const label = v === 'minority' || !v ? 'minority' : v
    return (
      <span
        className={`${base} bg-[#DC2626]/12 text-[#B91C1C]`}
      >
        <Flag className="h-3 w-3" strokeWidth={2} aria-hidden />
        {label}
      </span>
    )
  }
  if (v === 'unanimous') {
    return (
      <span
        className={`${base} bg-[#16A34A]/12 text-[#15803D]`}
      >
        unanimous
      </span>
    )
  }
  if (v === 'majority') {
    return (
      <span
        className={`${base} bg-[#2563EB]/10 text-[#1D4ED8]`}
      >
        majority
      </span>
    )
  }
  if (v === 'contested') {
    return (
      <span
        className={`${base} bg-[#D97706]/12 text-[#B45309]`}
      >
        contested
      </span>
    )
  }
  return (
    <span className={`${base} bg-[var(--bg-raised)] text-[var(--text-muted)]`}>
      {verdict || '—'}
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
  const cls = map[/** @type {keyof typeof map} */ (t)] ?? map.none
  return (
    <span
      className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${cls}`}
    >
      {t || 'none'}
    </span>
  )
}

/** @param {{ framing: string }} props */
function FramingBadge({ framing }) {
  const f = str(framing).toLowerCase()
  const danger = f === 'modified' || f === 'dropped'
  return (
    <span
      className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
        danger
          ? f === 'dropped'
            ? 'bg-[#DC2626]/12 text-[#B91C1C]'
            : 'bg-[#D97706]/12 text-[#B45309]'
          : 'bg-[var(--bg-raised)] text-[var(--text-secondary)]'
      }`}
    >
      {f || '—'}
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
 * }} props
 */
function TracePanel({ trace, config }) {
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
      className="border-l-[3px] border-l-[#8B1A1A] bg-[#FDFAF4] px-6 py-5 text-[14px] leading-relaxed text-[#1C1814]"
      style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
    >
      <section className="mb-6">
        <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          01 ORIGIN
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
          02 CHALLENGE
        </p>
        {challenge.occurred ? (
          <>
            <p>
              Challenged by{' '}
              <span className="font-mono text-[12px] text-[var(--text-primary)]">
                {byList.length ? byList.join(', ') : '—'}
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
          03 DEFENSE
        </p>
        {defense.occurred ? (
          <>
            <p>
              Defended by{' '}
              <span className="font-mono text-[12px] text-[var(--text-primary)]">
                {str(defense.by) || '—'}
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
          04 SYNTHESIS DECISION
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
          <div className="mt-4 rounded-[4px] border border-dashed border-[#DC2626]/40 bg-[#DC2626]/8 px-3 py-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#B91C1C]">
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

export default function AuditTrail() {
  const { state } = useForge()
  const { audit, auditLoading, auditError, config } = state
  const [expandedId, setExpandedId] = useState(/** @type {string | null} */ (null))

  const claimById = useMemo(() => {
    const list = audit?.claims
    if (!Array.isArray(list)) return new Map()
    return new Map(list.map((c) => [str(c.id), c]))
  }, [audit])

  const rows = useMemo(() => {
    const positions = audit?.positions
    if (!Array.isArray(positions) || positions.length === 0) return []
    return positions.map((p) => {
      const po = /** @type {Record<string, unknown>} */ (p)
      const id = str(po.claimId)
      const claim = claimById.get(id)
      return {
        claimId: id,
        text: claim && typeof claim.text === 'string' ? claim.text : id,
        gpt: po.gpt,
        phi: po.phi,
        mistral: po.mistral,
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

  const summary = useMemo(() => {
    const nClaims = Array.isArray(audit?.claims) ? audit.claims.length : rows.length
    let unanimous = 0
    let contested = 0
    let minority = 0
    for (const r of rows) {
      if (r.verdict === 'unanimous') unanimous += 1
      if (r.verdict === 'contested') contested += 1
      if (r.minorityIncluded) minority += 1
    }
    return { nClaims, unanimous, contested, minority }
  }, [audit, rows])

  const hasExpandableRow = rows.some(
    (r) => r.verdict === 'contested' || r.minorityIncluded
  )

  const colLabels = ['GPT-4o', 'Phi-4', 'Mistral']

  if (!auditLoading && !audit && !auditError) {
    return null
  }

  return (
    <section
      className="audit-trail mx-auto w-full max-w-4xl px-1 pb-12"
      aria-label="Debate audit trail"
    >
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

      {auditError ? (
        <p className="mb-4 text-center font-mono text-xs text-[var(--text-muted)]">
          Audit could not be completed: {auditError}
        </p>
      ) : null}

      {audit ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Audit trail
            </h2>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-[4px] border border-dashed border-[#D4C9B0] bg-transparent px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)]">
                {summary.nClaims} claims
              </span>
              <span className="rounded-[4px] border border-dashed border-[#16A34A]/40 bg-[#16A34A]/8 px-2 py-1 font-mono text-[10px] text-[#15803D]">
                {summary.unanimous} unanimous
              </span>
              <span className="rounded-[4px] border border-dashed border-[#D97706]/45 bg-[#D97706]/10 px-2 py-1 font-mono text-[10px] text-[#B45309]">
                {summary.contested} contested
              </span>
              <span className="rounded-[4px] border border-dashed border-[#DC2626]/40 bg-[#DC2626]/10 px-2 py-1 font-mono text-[10px] text-[#B91C1C]">
                {summary.minority} minority included
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center font-mono text-xs italic text-[var(--text-muted)]">
              No claim rows returned for this debate.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-[6px] border border-dashed border-[#D4C9B0] bg-[var(--bg-surface)]/60">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[50%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[12.5%]" />
                    <col className="w-[12.5%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#D4C9B0]">
                      <th className="px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Claim
                      </th>
                      {colLabels.map((lab) => (
                        <th
                          key={lab}
                          className="px-2 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                        >
                          {lab}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-mono text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Verdict
                      </th>
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
                              className="px-3 py-3 align-top text-[14px] leading-snug text-[#1C1814]"
                              style={{
                                fontFamily: 'var(--font-body), Georgia, serif',
                              }}
                            >
                              {row.text}
                            </td>
                            <td className="px-2 py-3 text-center align-middle">
                              <PositionCell value={str(row.gpt)} />
                            </td>
                            <td className="px-2 py-3 text-center align-middle">
                              <PositionCell value={str(row.phi)} />
                            </td>
                            <td className="px-2 py-3 text-center align-middle">
                              <PositionCell value={str(row.mistral)} />
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
                              <td colSpan={5} className="p-0">
                                <div
                                  className={`overflow-hidden transition-[max-height] duration-[400ms] ease-out ${
                                    open ? 'max-h-[3200px]' : 'max-h-0'
                                  }`}
                                >
                                  {open ? (
                                    trace ? (
                                      <TracePanel trace={trace} config={config} />
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
                  All claims reached consensus — no contested positions detected.
                </p>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  )
}
