import { Fragment, useEffect, useMemo, useState } from 'react'
import InfluenceMap from './InfluenceMap.jsx'
import { supabase } from '../lib/supabaseClient.js'

const PAGE_SIZE = 20

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
  return p === null ? '—' : `${p}%`
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
  if (!c) return '—'
  const u = String(c).toLowerCase()
  const map = { a: row.model_a, b: row.model_b, c: row.model_c }
  const model = map[u]
  return model ?? String(c).toUpperCase()
}

/** @param {unknown} changeLabel @param {string} borderColor */
function changeBadge(changeLabel, borderColor) {
  const s = changeLabel == null || changeLabel === '' ? '—' : String(changeLabel)
  const low = s.toLowerCase()
  let bg = 'bg-[var(--bg-raised)]'
  let text = 'text-[var(--text-muted)]'
  if (low.includes('held firm')) {
    bg = 'bg-[#16A34A]/15'
    text = 'text-[#15803D]'
  } else if (low.includes('significant')) {
    bg = 'bg-[#DC2626]/12'
    text = 'text-[#B91C1C]'
  } else if (low.includes('minor') || low.includes('shifted')) {
    bg = 'bg-[#D97706]/12'
    text = 'text-[#B45309]'
  }
  return (
    <span
      className={`inline-block max-w-[7rem] truncate rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-medium ${bg} ${text}`}
      style={{ borderColor }}
      title={s}
    >
      {s}
    </span>
  )
}

/** @param {string} raw @param {number} fallback */
function clampPctInput(raw, fallback) {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-forge-card border border-[var(--border)]">
      <table className="w-full border-collapse text-left font-sans text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--bg-raised)]/60 font-mono text-[10px] tracking-[0.12em] text-[var(--text-muted)]">
          <tr>
            {[
              'Date',
              'Avg Δ',
              'A↔B',
              'A↔C',
              'B↔C',
              'Top',
              'Rounds',
              'Changed',
            ].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i} className="border-b border-[var(--border)]">
              {Array.from({ length: 8 }, (_, j) => (
                <td key={j} className="px-3 py-3">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--border)]/60" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** @param {{ title: string, value: string | number, subtitle?: string }} props */
function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-metric)] p-4">
      <p className="mb-1 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
        {title}
      </p>
      <p className="text-lg font-semibold text-[var(--text-primary)]">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 line-clamp-3 text-xs leading-snug text-[var(--text-secondary)]">
          {subtitle}
        </p>
      ) : null}
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
  const [expandedId, setExpandedId] = useState(/** @type {string | null} */ (null))

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
            'change_a',
            'change_b',
            'change_c',
            'change_type_a',
            'change_type_b',
            'change_type_c',
            'most_influenced',
            'most_resistant',
          ].join(',')
        )
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        setFetchError(error.message)
        setRows([])
      } else {
        setRows(Array.isArray(data) ? data : [])
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
    <div className="flex flex-col gap-8 pb-16">
      <div
        className="rounded-forge-card border border-[var(--border)] border-l-[3px] border-l-[var(--accent-forge)] bg-[var(--bg-surface)] p-4 md:p-5"
        role="note"
      >
        <p className="font-sans text-sm leading-relaxed text-[var(--text-secondary)]">
          This dataset is shared publicly as aggregate statistics and debate
          metrics. Prompt excerpts are retained in the database for research only
          and are not shown here. Full responses or personal information are
          never shared. By running a debate you consent to contributing
          anonymously to this dataset.
        </p>
      </div>

      {!supabaseConfigured ? (
        <p className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-notebook)] px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
          Set <code className="text-[var(--text-primary)]">VITE_SUPABASE_URL</code>{' '}
          and <code className="text-[var(--text-primary)]">VITE_SUPABASE_ANON_KEY</code>{' '}
          to load findings.
        </p>
      ) : null}

      {fetchError ? (
        <p className="font-mono text-sm text-[var(--diverge)]">{fetchError}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total debates" value={stats.total} />
        <StatCard
          title="Avg. claim disagreement"
          value={
            stats.avgDiv == null ? '—' : `${pct(stats.avgDiv)}%`
          }
          subtitle="mean pairwise claim tension across debates"
        />
        <StatCard
          title="Most flexible agent"
          value={
            stats.mostFlexible.name == null
              ? '—'
              : `${stats.mostFlexible.name}${
                  stats.mostFlexible.count > 0
                    ? ` (${stats.mostFlexible.count})`
                    : ''
                }`
          }
        />
        <StatCard
          title="Most combative agent"
          value={
            stats.mostCombative.name == null
              ? '—'
              : `${stats.mostCombative.name}${
                  stats.mostCombative.count > 0
                    ? ` (${stats.mostCombative.count})`
                    : ''
                }`
          }
        />
      </div>

      <p className="rounded-forge-card border border-dashed border-[var(--border)] bg-[var(--bg-surface)]/80 px-4 py-3 text-center font-sans text-xs italic leading-relaxed text-[var(--text-muted)]">
        Claim disagreement is derived from audited claims: how often agents agreed,
        disagreed, or split on each extracted claim — not embedding similarity.
      </p>

      {supabaseConfigured ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Agent dynamics
          </h2>
          {agentDynamics.n < 5 ? (
            <p className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
              Run 5 debates to unlock agent personality patterns.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
                <StatCard
                  title="Most combative round"
                  value={
                    agentDynamics.combativeRow == null ||
                    agentDynamics.maxComb < 0
                      ? '—'
                      : `${Math.round(agentDynamics.maxComb * 100)}%`
                  }
                />
                <StatCard
                  title="Most challenged agent"
                  value={
                    agentDynamics.mostChallengedName == null
                      ? '—'
                      : `${agentDynamics.mostChallengedName} (${agentDynamics.mostChallengedCount})`
                  }
                />
                <StatCard
                  title="Dominant voice"
                  value={
                    agentDynamics.dominantName == null ||
                    agentDynamics.dominantPct == null
                      ? '—'
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
                      ? '—'
                      : `${agentDynamics.synthesisBiasRate}%`
                  }
                  subtitle="Debates where validators flagged the synthesis as unfair to one or more positions"
                />
                <StatCard
                  title="Synthesis wins"
                  value={
                    agentDynamics.synthesisWinDenom === 0
                      ? '—'
                      : agentDynamics.synthesisWinLeaderName == null
                        ? '—'
                        : `${agentDynamics.synthesisWinLeaderName} (${agentDynamics.synthesisWinCount} of ${agentDynamics.synthesisWinDenom})`
                  }
                  subtitle="based on peer evaluation scores"
                />
                <StatCard
                  title="Most influenced model"
                  value={
                    agentDynamics.influencedLeader.count === 0
                      ? '—'
                      : `${agentDynamics.influencedLeader.name} (${agentDynamics.influencedLeader.count})`
                  }
                  subtitle="most often shifted most by embeddings + self-report"
                />
                <StatCard
                  title="Most resistant model"
                  value={
                    agentDynamics.resistantLeader.count === 0
                      ? '—'
                      : `${agentDynamics.resistantLeader.name} (${agentDynamics.resistantLeader.count})`
                  }
                  subtitle="most often changed least across logged debates"
                />
              </div>
              <div className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-metric)] p-4">
                <h3 className="mb-4 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
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
                        p.avg == null ? '—' : `${Math.round(p.avg)} avg words`
                      return (
                        <div key={slot}>
                          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-sans text-xs text-[var(--text-primary)]">
                            <span className="font-medium" style={{ color }}>
                              {label}
                            </span>
                            <span className="text-[var(--text-secondary)]">
                              {words}
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded bg-[var(--border)]/80">
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
        </section>
      ) : null}

      <div className="flex flex-col gap-4 rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="flex min-w-[200px] flex-1 flex-col gap-2">
          <p className="font-[family-name:var(--font-mono)] text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
            Divergence range
          </p>
          <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-primary)]">
            <label
              htmlFor="findings-div-min"
              className="inline-flex items-center gap-1.5"
            >
              <span className="text-[var(--text-muted)]">Min</span>
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
                className="w-[3.25rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-1.5 py-1 text-[11px] tabular-nums text-[var(--text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Minimum divergence percent"
              />
              <span className="text-[var(--text-muted)]">%</span>
            </label>
            <span className="text-[var(--text-muted)]" aria-hidden>
              —
            </span>
            <label
              htmlFor="findings-div-max"
              className="inline-flex items-center gap-1.5"
            >
              <span className="text-[var(--text-muted)]">Max</span>
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
                className="w-[3.25rem] rounded border border-[var(--border)] bg-[var(--bg-base)] px-1.5 py-1 text-[11px] tabular-nums text-[var(--text-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Maximum divergence percent"
              />
              <span className="text-[var(--text-muted)]">%</span>
            </label>
          </div>
        </div>
        <div className="flex min-w-[180px] flex-col gap-1">
          <label
            htmlFor="findings-sort"
            className="font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]"
          >
            Sort
          </label>
          <select
            id="findings-sort"
            value={sort}
            onChange={(e) =>
              setSort(/** @type {'recent' | 'contested' | 'aligned'} */ (e.target.value))
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
          >
            <option value="recent">Most recent</option>
            <option value="contested">Most contested</option>
            <option value="aligned">Most aligned</option>
          </select>
        </div>
      </div>

      {loading && supabaseConfigured ? (
        <TableSkeleton />
      ) : !loading && filteredSorted.length === 0 ? (
        <div className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-16 text-center text-sm text-[var(--text-secondary)]">
          {!supabaseConfigured ? (
            <>Connect Supabase to see aggregated findings.</>
          ) : rows.length === 0 ? (
            <>No debates logged yet — run the first one!</>
          ) : (
            <>No debates match your filters.</>
          )}
        </div>
      ) : !loading ? (
        <>
          <div className="overflow-x-auto rounded-forge-card border border-[var(--border)]">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px] tracking-[0.12em] text-[var(--text-muted)]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">
                    Date
                  </th>
                  <th className="px-3 py-2 font-medium">Avg Δ</th>
                  <th className="px-3 py-2 font-medium">A↔B</th>
                  <th className="px-3 py-2 font-medium">A↔C</th>
                  <th className="px-3 py-2 font-medium">B↔C</th>
                  <th className="px-3 py-2 font-medium">Top</th>
                  <th className="px-3 py-2 font-medium">Rounds</th>
                  <th className="min-w-[140px] px-3 py-2 font-medium">Changed</th>
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
                    : '—'
                  return (
                    <Fragment key={id}>
                      <tr
                        className={`cursor-pointer border-b border-[var(--border)] transition hover:bg-[var(--bg-raised)]/50 ${
                          rowIdx % 2 === 0
                            ? 'bg-[var(--bg-surface)]'
                            : 'bg-[var(--bg-base)]'
                        }`}
                        onClick={() =>
                          setExpandedId((e) => (e === id ? null : id))
                        }
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">
                          {dateStr}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(rowClaimAvg(row))}`}
                        >
                          {fmtPct(rowClaimAvg(row))}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(scores.ab)}`}
                        >
                          {fmtPct(scores.ab)}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(scores.ac)}`}
                        >
                          {fmtPct(scores.ac)}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(scores.bc)}`}
                        >
                          {fmtPct(scores.bc)}
                        </td>
                        <td
                          className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-[var(--text-secondary)]"
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
                        <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">
                          {row.rounds != null ? String(row.rounds) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            {changeBadge(row.change_a, 'var(--agent-a)')}
                            {changeBadge(row.change_b, 'var(--agent-b)')}
                            {changeBadge(row.change_c, 'var(--agent-c)')}
                          </div>
                        </td>
                      </tr>
                      {expandedId === id ? (
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
                          <td colSpan={8} className="px-6 py-6">
                            <p className="mb-2 font-mono text-[10px] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
                              Pairwise claim disagreement
                            </p>
                            <p className="mb-3 max-w-md font-sans text-[11px] italic leading-relaxed text-[var(--text-muted)]">
                              Edges aggregate agree / disagree / partial / silent
                              labels from the debate audit.
                            </p>
                            <div className="flex justify-center md:justify-start">
                              <InfluenceMap
                                scores={scores}
                                initials={{
                                  a: (String(row.model_a ?? 'A')[0] ?? 'A').toUpperCase(),
                                  b: (String(row.model_b ?? 'B')[0] ?? 'B').toUpperCase(),
                                  c: (String(row.model_c ?? 'C')[0] ?? 'C').toUpperCase(),
                                }}
                                config={{
                                  agentA: {
                                    name: String(row.model_a ?? 'Agent A'),
                                    color: 'var(--agent-a)',
                                  },
                                  agentB: {
                                    name: String(row.model_b ?? 'Agent B'),
                                    color: 'var(--agent-b)',
                                  },
                                  agentC: {
                                    name: String(row.model_c ?? 'Agent C'),
                                    color: 'var(--agent-c)',
                                  },
                                }}
                                influenceReport={null}
                                influenceLoading={false}
                                showPositionTracks={false}
                              />
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

          <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-[var(--text-secondary)]">
            <span>
              Page {safePage} of {totalPages} · {filteredSorted.length} debate
              {filteredSorted.length !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium transition enabled:hover:border-[var(--text-muted)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 font-medium transition enabled:hover:border-[var(--text-muted)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      {!loading && supabaseConfigured ? (
        <p className="font-mono text-[10px] text-[var(--text-muted)]">
          Showing debates with average claim disagreement between {divMin}% and{' '}
          {divMax}%. Rows without a stored average are hidden while filtering.
        </p>
      ) : null}
    </div>
  )
}
