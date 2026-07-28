import { useEffect, useMemo, useState } from 'react'
import PageHeader from './layout/PageHeader.jsx'
import PageSection from './layout/PageSection.jsx'
import ReadingColumn from './layout/ReadingColumn.jsx'
import { supabase } from '../lib/supabaseClient.js'

const PAGE_SIZE = 20

/**
 * Build page numbers with ellipses for numbered pagination.
 * @param {number} current
 * @param {number} total
 * @returns {(number | 'ellipsis')[]}
 */
function pageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  /** @type {(number | 'ellipsis')[]} */
  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('ellipsis')
  for (let p = start; p <= end; p += 1) items.push(p)
  if (end < total - 1) items.push('ellipsis')
  items.push(total)
  return items
}

/**
 * Turn opaque network failures into actionable copy.
 * @param {unknown} err
 */
function formatFindingsFetchError(err) {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String(/** @type {{ message?: unknown }} */ (err).message ?? '')
      : err instanceof Error
        ? err.message
        : String(err ?? '')
  const lower = raw.toLowerCase()
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed')
  ) {
    return (
      'Could not reach Supabase (network / DNS). Check that VITE_SUPABASE_URL ' +
      'points to an active project (Dashboard → Project Settings → API), ' +
      'then restart the Vite dev server so .env.local is reloaded.'
    )
  }
  if (lower.includes('jwt') || lower.includes('invalid api key')) {
    return (
      'Supabase rejected the anon key. Update VITE_SUPABASE_ANON_KEY from the ' +
      'project API settings and restart the dev server.'
    )
  }
  return raw || 'Failed to load debates.'
}

/** @param {unknown} n */
function pct(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return null
  return Math.min(100, Math.max(0, Math.round(x * 100)))
}

/** @param {unknown} val */
function divergenceCellClass(val) {
  const p = pct(val)
  if (p === null) return 'text-[var(--text-muted)]'
  if (p <= 30) return 'font-medium text-[var(--agree)]'
  if (p <= 60) return 'font-medium text-[var(--neutral)]'
  return 'font-medium text-[var(--diverge)]'
}

/** @param {unknown} val */
function fmtPct(val) {
  const p = pct(val)
  return p === null ? '-' : `${p}%`
}

/** Prefer claim-based average; fall back to legacy semantic `divergence_avg`. */
function rowClaimAvg(r) {
  const c = r.claim_divergence_avg
  if (c != null && c !== '' && !Number.isNaN(Number(c))) return Number(c)
  const d = r.divergence_avg
  if (d != null && d !== '' && !Number.isNaN(Number(d))) return Number(d)
  return null
}

/** @param {Record<string, unknown>} r */
function rowClaimScores(r) {
  /** @param {string} ck @param {string} dk */
  const pick = (ck, dk) => {
    const c = r[ck]
    if (c != null && c !== '' && !Number.isNaN(Number(c))) return Number(c)
    const d = r[dk]
    if (d != null && d !== '' && !Number.isNaN(Number(d))) return Number(d)
    return null
  }
  return {
    ab: pick('claim_divergence_ab', 'divergence_ab'),
    ac: pick('claim_divergence_ac', 'divergence_ac'),
    bc: pick('claim_divergence_bc', 'divergence_bc'),
    average: rowClaimAvg(r),
    unanimousClaims:
      r.unanimous_claims != null && r.unanimous_claims !== ''
        ? Number(r.unanimous_claims)
        : 0,
    contestedClaims:
      r.contested_claims != null && r.contested_claims !== ''
        ? Number(r.contested_claims)
        : 0,
  }
}

/**
 * @param {string | null | undefined} c
 * @param {{ model_a?: string, model_b?: string, model_c?: string }} row
 */
function contributorDisplay(c, row) {
  if (!c) return '-'
  const u = String(c).toLowerCase()
  const map = { a: row.model_a, b: row.model_b, c: row.model_c }
  const model = map[u]
  return model ?? String(c).toUpperCase()
}

/** @param {string} raw @param {number} fallback */
function clampPctInput(raw, fallback) {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function TableSkeleton() {
  return (
    <div className="findings-table-wrap">
      <table className="babel-table w-full">
        <thead>
          <tr>
            {[
              'Date',
              'Avg Δ',
              'A↔B',
              'A↔C',
              'B↔C',
              'Top',
              'Rounds',
            ].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i} className="border-b border-[var(--line)]">
              {Array.from({ length: 7 }, (_, j) => (
                <td key={j} className="px-3 py-3.5">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]/60" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** @param {{ title: string, value: string | number, subtitle?: string, emptyLabel?: string }} props */
function StatCard({ title, value, subtitle, emptyLabel = 'Not enough data yet' }) {
  const isEmpty =
    value === '-' ||
    value === null ||
    value === undefined ||
    value === ''
  const display = isEmpty ? emptyLabel : value

  return (
    <div className="metric-card">
      <p className="metric-label">{title}</p>
      <p className={`metric-value ${isEmpty ? 'is-empty' : ''}`}>{display}</p>
      {subtitle ? <p className="metric-subtitle">{subtitle}</p> : null}
    </div>
  )
}

export default function FindingsPanel() {
  const [rows, setRows] = useState(/** @type {Record<string, unknown>[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(/** @type {string | null} */ (null))

  const [divMin, setDivMin] = useState(0)
  const [divMax, setDivMax] = useState(100)
  const [sort, setSort] = useState(/** @type {'recent' | 'contested' | 'aligned'} */ ('recent'))
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!supabase) {
        if (!cancelled) {
          setRows([])
          setLoading(false)
          setFetchError(null)
        }
        return
      }
      setLoading(true)
      setFetchError(null)
      try {
        const { data, error } = await supabase
          .from('debates')
          .select(
            [
              'id',
              'created_at',
              'model_a',
              'model_b',
              'model_c',
              'claim_divergence_ab',
              'claim_divergence_ac',
              'claim_divergence_bc',
              'claim_divergence_avg',
              'divergence_ab',
              'divergence_ac',
              'divergence_bc',
              'divergence_avg',
              'total_claims',
              'contested_claims',
              'unanimous_claims',
              'hard_disagreements',
              'rounds',
              'top_contributor',
              'conflict_score_ab',
              'conflict_score_ac',
              'conflict_score_bc',
              'challenged_most',
              'dominant_agent',
              'named_references_a',
              'named_references_b',
              'named_references_c',
              'response_length_a',
              'response_length_b',
              'response_length_c',
              'most_flexible',
              'most_combative',
              'bias_flagged',
              'validation_status',
              'synthesis_winner',
              'gpt_competition_score',
              'phi_competition_score',
              'mistral_competition_score',
              'most_influenced',
              'most_resistant',
            ].join(',')
          )
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (error) {
          setFetchError(formatFindingsFetchError(error))
          setRows([])
        } else {
          setRows(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (cancelled) return
        setFetchError(formatFindingsFetchError(err))
        setRows([])
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    const valid = rows.filter((r) => rowClaimAvg(r) != null)
    const total = rows.length
    const avgDiv =
      valid.length === 0
        ? null
        : valid.reduce((s, r) => s + /** @type {number} */ (rowClaimAvg(r)), 0) /
          valid.length

    /** @param {string} col */
    function tallyAgentSlot(col) {
      const tallies = new Map()
      for (const r of rows) {
        const slot = String(r[col] ?? '').toLowerCase()
        if (slot !== 'a' && slot !== 'b' && slot !== 'c') continue
        const model =
          slot === 'a'
            ? r.model_a
            : slot === 'b'
              ? r.model_b
              : r.model_c
        if (typeof model === 'string' && model) {
          tallies.set(model, (tallies.get(model) ?? 0) + 1)
        }
      }
      let name = /** @type {string | null} */ (null)
      let count = 0
      for (const [k, n] of tallies) {
        if (n > count) {
          count = n
          name = k
        }
      }
      return { name, count }
    }

    const mostFlexible = tallyAgentSlot('most_flexible')
    const mostCombative = tallyAgentSlot('most_combative')

    return {
      total,
      avgDiv,
      mostFlexible,
      mostCombative,
    }
  }, [rows])

  const agentDynamics = useMemo(() => {
    const n = rows.length

    /** @param {Record<string, unknown>} r */
    function avgConflict(r) {
      const a = Number(r.conflict_score_ab)
      const b = Number(r.conflict_score_ac)
      const c = Number(r.conflict_score_bc)
      if (![a, b, c].every((x) => Number.isFinite(x))) return null
      return (a + b + c) / 3
    }

    let combativeRow = /** @type {Record<string, unknown> | null} */ (null)
    let maxComb = -1
    for (const r of rows) {
      const ac = avgConflict(r)
      if (ac != null && ac > maxComb) {
        maxComb = ac
        combativeRow = r
      }
    }

    /** @param {Record<string, unknown>} r @param {'a'|'b'|'c'} slot */
    function slotModel(r, slot) {
      const k =
        slot === 'a'
          ? r.model_a
          : slot === 'b'
            ? r.model_b
            : r.model_c
      return typeof k === 'string' && k ? k : null
    }

    const challengedTally = new Map()
    for (const r of rows) {
      const cm = String(r.challenged_most ?? '').toLowerCase()
      if (cm !== 'a' && cm !== 'b' && cm !== 'c') continue
      const m = slotModel(r, cm)
      if (!m) continue
      challengedTally.set(m, (challengedTally.get(m) ?? 0) + 1)
    }
    let mostChallengedName = /** @type {string | null} */ (null)
    let mostChallengedCount = 0
    for (const [k, v] of challengedTally) {
      if (v > mostChallengedCount) {
        mostChallengedCount = v
        mostChallengedName = k
      }
    }

    const dominantTally = new Map()
    let dominantDenom = 0
    for (const r of rows) {
      const d = String(r.dominant_agent ?? '').toLowerCase()
      if (d !== 'a' && d !== 'b' && d !== 'c') continue
      dominantDenom += 1
      const m = slotModel(r, d)
      if (!m) continue
      dominantTally.set(m, (dominantTally.get(m) ?? 0) + 1)
    }
    let dominantName = /** @type {string | null} */ (null)
    let dominantCount = 0
    for (const [k, v] of dominantTally) {
      if (v > dominantCount) {
        dominantCount = v
        dominantName = k
      }
    }
    const dominantPct =
      dominantDenom > 0 && dominantName != null
        ? Math.round((dominantCount / dominantDenom) * 100)
        : null

    let namedCount = 0
    for (const r of rows) {
      if (
        r.named_references_a === true ||
        r.named_references_b === true ||
        r.named_references_c === true
      ) {
        namedCount += 1
      }
    }
    const namedPct = Math.round((namedCount / n) * 100)

    /** @param {string} key */
    function avgLen(key) {
      const vals = rows
        .map((r) => Number(r[key]))
        .filter((x) => Number.isFinite(x) && x >= 0)
      if (vals.length === 0) return null
      return vals.reduce((s, x) => s + x, 0) / vals.length
    }

    /** @param {string} key */
    function modeModel(key) {
      const counts = new Map()
      for (const r of rows) {
        const m = r[key]
        if (typeof m === 'string' && m) {
          counts.set(m, (counts.get(m) ?? 0) + 1)
        }
      }
      let best = /** @type {string | null} */ (null)
      let nc = 0
      for (const [k, v] of counts) {
        if (v > nc) {
          nc = v
          best = k
        }
      }
      return best
    }

    const personality = {
      a: { avg: avgLen('response_length_a'), label: modeModel('model_a') },
      b: { avg: avgLen('response_length_b'), label: modeModel('model_b') },
      c: { avg: avgLen('response_length_c'), label: modeModel('model_c') },
    }

    const rowsWithBiasFlag = rows.filter(
      (r) => typeof r.bias_flagged === 'boolean'
    )
    const synthesisBiasRate =
      rowsWithBiasFlag.length === 0
        ? null
        : Math.round(
            (rowsWithBiasFlag.filter((r) => r.bias_flagged === true).length /
              rowsWithBiasFlag.length) *
              100
          )

    const swTally = { gpt: 0, phi: 0, mistral: 0 }
    let synthesisWinDenom = 0
    for (const r of rows) {
      const w = String(r.synthesis_winner ?? '').toLowerCase()
      if (w !== 'gpt' && w !== 'phi' && w !== 'mistral') continue
      synthesisWinDenom += 1
      swTally[w] += 1
    }
    let synthesisWinLeaderSlot = /** @type {'gpt' | 'phi' | 'mistral' | null} */ (
      null
    )
    let synthesisWinCount = 0
    for (const slot of /** @type {const} */ (['gpt', 'phi', 'mistral'])) {
      const c = swTally[slot]
      if (c > synthesisWinCount) {
        synthesisWinCount = c
        synthesisWinLeaderSlot = slot
      }
    }
    const sampleWinRow =
      synthesisWinLeaderSlot == null
        ? null
        : rows.find(
            (r) =>
              String(r.synthesis_winner ?? '').toLowerCase() ===
              synthesisWinLeaderSlot
          )
    const synthesisWinLeaderName =
      sampleWinRow == null || synthesisWinLeaderSlot == null
        ? null
        : slotModel(
            sampleWinRow,
            synthesisWinLeaderSlot === 'gpt'
              ? 'a'
              : synthesisWinLeaderSlot === 'phi'
                ? 'b'
                : 'c'
          )

    const inflTally = /** @type {Map<string, number>} */ (new Map())
    const resTally = /** @type {Map<string, number>} */ (new Map())
    for (const r of rows) {
      const mi = String(r.most_influenced ?? '').toLowerCase()
      if (mi === 'a' || mi === 'b' || mi === 'c') {
        const m = slotModel(r, /** @type {'a'|'b'|'c'} */ (mi))
        if (m) inflTally.set(m, (inflTally.get(m) ?? 0) + 1)
      }
      const mr = String(r.most_resistant ?? '').toLowerCase()
      if (mr === 'a' || mr === 'b' || mr === 'c') {
        const m = slotModel(r, /** @type {'a'|'b'|'c'} */ (mr))
        if (m) resTally.set(m, (resTally.get(m) ?? 0) + 1)
      }
    }
    /** @param {Map<string, number>} m */
    function mapLeader(m) {
      let name = /** @type {string | null} */ (null)
      let c = 0
      for (const [k, v] of m) {
        if (v > c) {
          c = v
          name = k
        }
      }
      return { name, count: c }
    }
    const influencedLeader = mapLeader(inflTally)
    const resistantLeader = mapLeader(resTally)

    return {
      n,
      combativeRow,
      maxComb,
      mostChallengedName,
      mostChallengedCount,
      dominantName,
      dominantPct,
      dominantDenom,
      namedPct,
      personality,
      synthesisBiasRate,
      synthesisWinLeaderName,
      synthesisWinCount,
      synthesisWinDenom,
      influencedLeader,
      resistantLeader,
    }
  }, [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const av = rowClaimAvg(r)
      const p = pct(av)
      if (p === null) return false
      if (p < divMin || p > divMax) return false
      return true
    })

    const sorted = [...list]
    if (sort === 'recent') {
      sorted.sort((a, b) => {
        const ta = new Date(/** @type {string} */ (a.created_at ?? 0)).getTime()
        const tb = new Date(/** @type {string} */ (b.created_at ?? 0)).getTime()
        return tb - ta
      })
    } else if (sort === 'contested') {
      sorted.sort(
        (a, b) =>
          Number(rowClaimAvg(b) ?? -1) - Number(rowClaimAvg(a) ?? -1)
      )
    } else {
      sorted.sort(
        (a, b) =>
          Number(rowClaimAvg(a) ?? 2) - Number(rowClaimAvg(b) ?? 2)
      )
    }
    return sorted
  }, [rows, divMin, divMax, sort])

  useEffect(() => {
    setPage(1)
  }, [divMin, divMax, sort])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filteredSorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

  const supabaseConfigured = Boolean(supabase)

  return (
    <article
      className="reading-page findings-page"
      aria-labelledby="findings-page-title"
    >
      <PageHeader
        title="An open record of disagreement"
        titleId="findings-page-title"
        lede="Aggregate metrics from debates logged here: divergence, influence, and how models move under challenge."
      />

      <ReadingColumn>
        <div className="findings-disclosure" role="note">
          <p className="babel-prose m-0">
            This dataset is shared publicly as aggregate statistics and debate
            metrics. Prompt excerpts are retained in the database for research only
            and are not shown here. Full responses or personal information are
            never shared. By running a debate you consent to contributing
            anonymously to this dataset.
          </p>
        </div>

        {!supabaseConfigured ? (
          <p className="findings-inline-note babel-meta m-0">
            Set <code className="text-[var(--ink)]">VITE_SUPABASE_URL</code>{' '}
            and <code className="text-[var(--ink)]">VITE_SUPABASE_ANON_KEY</code>{' '}
            to load findings.
          </p>
        ) : null}

        {fetchError ? (
          <div className="findings-inline-note findings-inline-note--error" role="alert">
            <p className="babel-eyebrow m-0 text-[var(--madder)]">
              Findings unavailable
            </p>
            <p className="mt-2 babel-meta m-0 leading-relaxed text-[var(--ink-soft)]">
              {fetchError}
            </p>
          </div>
        ) : null}

        <PageSection first title="Current evidence" titleId="findings-evidence-h">
          <div className="metric-card-row findings-metric-row">
            <StatCard title="Total debates" value={stats.total} />
            <StatCard
              title="Avg. claim disagreement"
              value={
                stats.avgDiv == null ? '-' : `${pct(stats.avgDiv)}%`
              }
              subtitle="mean pairwise claim tension across debates"
              emptyLabel="Not enough data yet"
            />
            {stats.mostFlexible.name != null ? (
              <StatCard
                title="Most flexible agent"
                value={`${stats.mostFlexible.name}${
                  stats.mostFlexible.count > 0
                    ? ` (${stats.mostFlexible.count})`
                    : ''
                }`}
              />
            ) : null}
            {stats.mostCombative.name != null ? (
              <StatCard
                title="Most combative agent"
                value={`${stats.mostCombative.name}${
                  stats.mostCombative.count > 0
                    ? ` (${stats.mostCombative.count})`
                    : ''
                }`}
              />
            ) : null}
          </div>

          <p className="methodology-note findings-methodology-note">
            Claim disagreement is derived from audited claims: how often agents agreed,
            disagreed, or split on each extracted claim, not embedding similarity.
          </p>
        </PageSection>

        {supabaseConfigured ? (
          <PageSection title="Agent dynamics" titleId="findings-dynamics-h">
            {agentDynamics.n < 5 ? (
              <p className="findings-empty-state babel-prose m-0">
                Run 5 debates to unlock agent personality patterns.
              </p>
            ) : (
              <>
                <div className="metric-card-row findings-metric-row">
                  <StatCard
                    title="Most combative round"
                    value={
                      agentDynamics.combativeRow == null ||
                      agentDynamics.maxComb < 0
                        ? '-'
                        : `${Math.round(agentDynamics.maxComb * 100)}%`
                    }
                  />
                  <StatCard
                    title="Most challenged agent"
                    value={
                      agentDynamics.mostChallengedName == null
                        ? '-'
                        : `${agentDynamics.mostChallengedName} (${agentDynamics.mostChallengedCount})`
                    }
                  />
                  <StatCard
                    title="Dominant voice"
                    value={
                      agentDynamics.dominantName == null ||
                      agentDynamics.dominantPct == null
                        ? '-'
                        : `${agentDynamics.dominantName} (${agentDynamics.dominantPct}%)`
                    }
                    subtitle={
                      agentDynamics.dominantDenom > 0
                        ? `Among debates with a clear synthesis winner (${agentDynamics.dominantDenom} debates)`
                        : undefined
                    }
                  />
                  <StatCard
                    title="Named each other"
                    value={`${agentDynamics.namedPct}%`}
                    subtitle="Debates where at least one cross-review mentioned GPT, Phi, or Mistral"
                  />
                  <StatCard
                    title="Synthesis bias rate"
                    value={
                      agentDynamics.synthesisBiasRate == null
                        ? '-'
                        : `${agentDynamics.synthesisBiasRate}%`
                    }
                    subtitle="Debates where validators flagged the synthesis as unfair to one or more positions"
                  />
                  <StatCard
                    title="Synthesis wins"
                    value={
                      agentDynamics.synthesisWinDenom === 0
                        ? '-'
                        : agentDynamics.synthesisWinLeaderName == null
                          ? '-'
                          : `${agentDynamics.synthesisWinLeaderName} (${agentDynamics.synthesisWinCount} of ${agentDynamics.synthesisWinDenom})`
                    }
                    subtitle="based on peer evaluation scores"
                  />
                  <StatCard
                    title="Most influenced model"
                    value={
                      agentDynamics.influencedLeader.count === 0
                        ? '-'
                        : `${agentDynamics.influencedLeader.name} (${agentDynamics.influencedLeader.count})`
                    }
                    subtitle="most often shifted most by embeddings + self-report"
                  />
                  <StatCard
                    title="Most resistant model"
                    value={
                      agentDynamics.resistantLeader.count === 0
                        ? '-'
                        : `${agentDynamics.resistantLeader.name} (${agentDynamics.resistantLeader.count})`
                    }
                    subtitle="most often changed least across logged debates"
                  />
                </div>
                <div className="findings-personality">
                  <h3 className="babel-display babel-display-card m-0 mb-4">
                    Personality patterns
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      const { personality } = agentDynamics
                      const maxAvg = Math.max(
                        personality.a.avg ?? 0,
                        personality.b.avg ?? 0,
                        personality.c.avg ?? 0,
                        1
                      )
                      const bars = [
                        {
                          slot: 'a',
                          color: 'var(--agent-a)',
                          p: personality.a,
                        },
                        {
                          slot: 'b',
                          color: 'var(--agent-b)',
                          p: personality.b,
                        },
                        {
                          slot: 'c',
                          color: 'var(--agent-c)',
                          p: personality.c,
                        },
                      ]
                      return bars.map(({ slot, color, p }) => {
                        const w =
                          p.avg != null && maxAvg > 0
                            ? (p.avg / maxAvg) * 100
                            : 0
                        const label =
                          p.label != null && p.label !== ''
                            ? p.label
                            : `Agent ${slot.toUpperCase()}`
                        const words =
                          p.avg == null ? '-' : `${Math.round(p.avg)} avg words`
                        return (
                          <div key={slot}>
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 babel-meta text-[var(--ink)]">
                              <span className="font-medium" style={{ color }}>
                                {label}
                              </span>
                              <span className="text-[var(--ink-soft)]">
                                {words === '-' ? 'Not enough data yet' : words}
                              </span>
                            </div>
                            <div className="h-2.5 overflow-hidden rounded bg-[var(--line)]/80">
                              <div
                                className="h-full rounded transition-[width] duration-300"
                                style={{
                                  width: `${w}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
              </>
            )}
          </PageSection>
        ) : null}

        <PageSection title="Explore debates" titleId="findings-explore-h">
          <div className="findings-controls">
            <div className="findings-control-field">
              <p className="babel-eyebrow m-0">Divergence range</p>
              <div className="findings-range-inputs babel-meta text-[var(--ink)]">
                <label
                  htmlFor="findings-div-min"
                  className="inline-flex items-center gap-1.5"
                >
                  <span className="meta-label">Min</span>
                  <input
                    id="findings-div-min"
                    type="number"
                    min={0}
                    max={100}
                    value={divMin}
                    onChange={(e) => {
                      const v = clampPctInput(e.target.value, divMin)
                      setDivMin(Math.min(v, divMax))
                    }}
                    className="findings-control-input"
                    aria-label="Minimum divergence percent"
                  />
                  <span aria-hidden>%</span>
                </label>
                <span className="text-[var(--ink-faint)]" aria-hidden>
                  to
                </span>
                <label
                  htmlFor="findings-div-max"
                  className="inline-flex items-center gap-1.5"
                >
                  <span className="meta-label">Max</span>
                  <input
                    id="findings-div-max"
                    type="number"
                    min={0}
                    max={100}
                    value={divMax}
                    onChange={(e) => {
                      const v = clampPctInput(e.target.value, divMax)
                      setDivMax(Math.max(v, divMin))
                    }}
                    className="findings-control-input"
                    aria-label="Maximum divergence percent"
                  />
                  <span aria-hidden>%</span>
                </label>
              </div>
            </div>
            <div className="findings-control-field findings-control-field--sort">
              <label htmlFor="findings-sort" className="babel-eyebrow m-0">
                Sort
              </label>
              <select
                id="findings-sort"
                value={sort}
                onChange={(e) =>
                  setSort(
                    /** @type {'recent' | 'contested' | 'aligned'} */ (
                      e.target.value
                    )
                  )
                }
                className="findings-control-select"
              >
                <option value="recent">Most recent</option>
                <option value="contested">Most contested</option>
                <option value="aligned">Most aligned</option>
              </select>
            </div>
          </div>

          {!loading && supabaseConfigured ? (
            <p className="findings-filter-summary babel-meta m-0">
              Showing debates with average claim disagreement between {divMin}% and{' '}
              {divMax}%. Rows without a stored average are hidden while filtering.
            </p>
          ) : null}
        </PageSection>
      </ReadingColumn>

      <div className="findings-data-width">
        <PageSection title="Debate record" titleId="findings-record-h">
          {loading && supabaseConfigured ? (
            <TableSkeleton />
          ) : !loading && filteredSorted.length === 0 ? (
            <p className="findings-empty-state babel-prose m-0">
              {!supabaseConfigured ? (
                <>Connect Supabase to see aggregated findings.</>
              ) : rows.length === 0 ? (
                <>No debates logged yet: run the first one!</>
              ) : (
                <>No debates match your filters.</>
              )}
            </p>
          ) : !loading ? (
            <>
              <div className="findings-table-wrap">
                <table className="babel-table w-full min-w-[800px]">
                  <thead className="sticky top-0 z-[1] bg-[var(--plaster-hi)]">
                    <tr>
                      <th className="whitespace-nowrap">Date</th>
                      <th>Avg Δ</th>
                      <th>A↔B</th>
                      <th>A↔C</th>
                      <th>B↔C</th>
                      <th>Top</th>
                      <th>Rounds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, rowIdx) => {
                      const id =
                        row.id != null
                          ? String(row.id)
                          : `row-${safePage}-${rowIdx}`
                      const scores = rowClaimScores(row)
                      const iso =
                        typeof row.created_at === 'string'
                          ? row.created_at
                          : row.created_at != null
                            ? String(row.created_at)
                            : ''
                      const dateStr = iso
                        ? new Date(iso).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '-'
                      return (
                        <tr
                          key={id}
                          className={`border-b border-[var(--line)] transition hover:bg-[color-mix(in_srgb,var(--blue-wash)_55%,transparent)] ${
                            rowIdx % 2 === 0
                              ? 'bg-[var(--plaster-hi)]'
                              : 'bg-[color-mix(in_srgb,var(--plaster)_88%,transparent)]'
                          }`}
                        >
                            <td className="whitespace-nowrap px-3 py-3.5 babel-meta-tech text-[var(--ink-soft)]">
                              {dateStr}
                            </td>
                            <td
                              className={`px-3 py-3.5 babel-meta-tech ${divergenceCellClass(rowClaimAvg(row))}`}
                            >
                              {fmtPct(rowClaimAvg(row))}
                            </td>
                            <td
                              className={`px-3 py-3.5 babel-meta-tech ${divergenceCellClass(scores.ab)}`}
                            >
                              {fmtPct(scores.ab)}
                            </td>
                            <td
                              className={`px-3 py-3.5 babel-meta-tech ${divergenceCellClass(scores.ac)}`}
                            >
                              {fmtPct(scores.ac)}
                            </td>
                            <td
                              className={`px-3 py-3.5 babel-meta-tech ${divergenceCellClass(scores.bc)}`}
                            >
                              {fmtPct(scores.bc)}
                            </td>
                            <td
                              className="max-w-[120px] truncate px-3 py-3.5 babel-meta-tech text-[var(--ink-soft)]"
                              title={String(
                                contributorDisplay(
                                  /** @type {string} */ (row.top_contributor),
                                  row
                                )
                              )}
                            >
                              {contributorDisplay(
                                /** @type {string} */ (row.top_contributor),
                                row
                              )}
                            </td>
                            <td className="px-3 py-3.5 babel-meta-tech text-[var(--ink-soft)]">
                              {row.rounds != null ? String(row.rounds) : '-'}
                            </td>
                          </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="findings-table-footer babel-meta">
                <span>
                  {filteredSorted.length} debate
                  {filteredSorted.length !== 1 ? 's' : ''}
                </span>
                <nav className="findings-pagination" aria-label="Findings pages">
                  {pageItems(safePage, totalPages).map((item, i) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`e-${i}`}
                        className="findings-pagination-ellipsis"
                        aria-hidden
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`findings-pagination-page${
                          item === safePage ? ' is-current' : ''
                        }`}
                        aria-label={`Page ${item}`}
                        aria-current={item === safePage ? 'page' : undefined}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </nav>
              </div>
            </>
          ) : null}
        </PageSection>
      </div>
    </article>
  )
}
