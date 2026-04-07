import { Fragment, useEffect, useMemo, useState } from 'react'
import TriangleConsensus from './TriangleConsensus.jsx'
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

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-forge-card border border-[var(--border)]">
      <table className="w-full border-collapse text-left font-sans text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--bg-raised)]/60 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          <tr>
            {[
              'Date',
              'Prompt',
              'Avg Δ',
              'A↔B',
              'A↔C',
              'B↔C',
              'Top',
              'Rounds',
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
      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
  const [search, setSearch] = useState('')
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
        .select('*')
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
    const valid = rows.filter(
      (r) => r.divergence_avg != null && !Number.isNaN(Number(r.divergence_avg))
    )
    const total = rows.length
    const avgDiv =
      valid.length === 0
        ? null
        : valid.reduce((s, r) => s + Number(r.divergence_avg), 0) / valid.length

    let mostRow = null
    let maxAvg = -1
    for (const r of rows) {
      const v = Number(r.divergence_avg)
      if (!Number.isNaN(v) && v > maxAvg) {
        maxAvg = v
        mostRow = r
      }
    }

    const tallies = new Map()
    for (const r of rows) {
      const tc = r.top_contributor
      if (tc == null) continue
      const key =
        String(tc).toLowerCase() === 'a'
          ? r.model_a
          : String(tc).toLowerCase() === 'b'
            ? r.model_b
            : String(tc).toLowerCase() === 'c'
              ? r.model_c
              : null
      if (typeof key === 'string' && key) {
        tallies.set(key, (tallies.get(key) ?? 0) + 1)
      }
    }
    let topModel = null
    let topCount = 0
    for (const [k, n] of tallies) {
      if (n > topCount) {
        topCount = n
        topModel = k
      }
    }

    return {
      total,
      avgDiv,
      mostRow,
      topModel,
      topCount,
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
    }
  }, [rows])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter((r) => {
      const prev =
        typeof r.prompt_preview === 'string' ? r.prompt_preview : ''
      if (q && !prev.toLowerCase().includes(q)) return false
      const p = pct(r.divergence_avg)
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
          Number(b.divergence_avg ?? -1) - Number(a.divergence_avg ?? -1)
      )
    } else {
      sorted.sort(
        (a, b) =>
          Number(a.divergence_avg ?? 2) - Number(b.divergence_avg ?? 2)
      )
    }
    return sorted
  }, [rows, search, divMin, divMax, sort])

  useEffect(() => {
    setPage(1)
  }, [divMin, divMax, sort, search])

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
          This dataset is shared publicly. Only the first 120 characters of each
          prompt are stored. Never full responses or personal information. By
          running a debate you consent to contributing anonymously to this
          dataset.
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
        <StatCard title="Total debates run" value={stats.total} />
        <StatCard
          title="Average divergence"
          value={
            stats.avgDiv == null ? '—' : `${pct(stats.avgDiv)}%`
          }
        />
        <StatCard
          title="Most contested"
          value={
            stats.mostRow == null
              ? '—'
              : `${pct(stats.mostRow.divergence_avg)}%`
          }
          subtitle={
            stats.mostRow &&
            typeof stats.mostRow.prompt_preview === 'string'
              ? stats.mostRow.prompt_preview
              : undefined
          }
        />
        <StatCard
          title="Top contributor"
          value={
            stats.topModel == null
              ? '—'
              : `${stats.topModel}${stats.topCount > 0 ? ` (${stats.topCount})` : ''}`
          }
        />
      </div>

      {supabaseConfigured ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Agent Dynamics
          </h2>
          {agentDynamics.n < 5 ? (
            <p className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
              Run 5 debates to unlock agent personality patterns.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Most Combative Round"
                  value={
                    agentDynamics.combativeRow == null ||
                    agentDynamics.maxComb < 0
                      ? '—'
                      : `${Math.round(agentDynamics.maxComb * 100)}%`
                  }
                  subtitle={
                    agentDynamics.combativeRow &&
                    typeof agentDynamics.combativeRow.prompt_preview ===
                      'string'
                      ? agentDynamics.combativeRow.prompt_preview
                      : undefined
                  }
                />
                <StatCard
                  title="Most Challenged Agent"
                  value={
                    agentDynamics.mostChallengedName == null
                      ? '—'
                      : `${agentDynamics.mostChallengedName} (${agentDynamics.mostChallengedCount})`
                  }
                />
                <StatCard
                  title="Dominant Voice"
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
                  title="Named Each Other"
                  value={`${agentDynamics.namedPct}%`}
                  subtitle="Debates where at least one cross-review mentioned GPT, Phi, or Mistral"
                />
              </div>
              <div className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-metric)] p-4">
                <h3 className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Personality Patterns
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
          <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Divergence range ({divMin}% – {divMax}%)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <input
              type="range"
              min={0}
              max={100}
              value={divMin}
              onChange={(e) => {
                const v = Number(e.target.value)
                setDivMin(Math.min(v, divMax))
              }}
              className="h-2 flex-1 accent-[var(--accent-forge)]"
              aria-label="Minimum divergence percent"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={divMax}
              onChange={(e) => {
                const v = Number(e.target.value)
                setDivMax(Math.max(v, divMin))
              }}
              className="h-2 flex-1 accent-[var(--accent-forge)]"
              aria-label="Maximum divergence percent"
            />
          </div>
        </div>
        <div className="flex min-w-[180px] flex-col gap-1">
          <label
            htmlFor="findings-sort"
            className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
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
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label
            htmlFor="findings-search"
            className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
          >
            Search prompt
          </label>
          <input
            id="findings-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by preview text…"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 font-sans text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
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
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-[1] border-b border-[var(--border)] bg-[var(--bg-surface)] font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 font-medium">
                    Date
                  </th>
                  <th className="min-w-[140px] px-3 py-2 font-medium">
                    Prompt preview
                  </th>
                  <th className="px-3 py-2 font-medium">Avg Δ</th>
                  <th className="px-3 py-2 font-medium">A↔B</th>
                  <th className="px-3 py-2 font-medium">A↔C</th>
                  <th className="px-3 py-2 font-medium">B↔C</th>
                  <th className="px-3 py-2 font-medium">Top</th>
                  <th className="px-3 py-2 font-medium">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, rowIdx) => {
                  const id =
                    row.id != null
                      ? String(row.id)
                      : `row-${safePage}-${rowIdx}`
                  const scores = {
                    ab: Number(row.divergence_ab),
                    ac: Number(row.divergence_ac),
                    bc: Number(row.divergence_bc),
                    average: Number(row.divergence_avg),
                  }
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
                        <td className="max-w-[240px] truncate px-3 py-2 text-[var(--text-primary)]">
                          {typeof row.prompt_preview === 'string'
                            ? row.prompt_preview
                            : '—'}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(row.divergence_avg)}`}
                        >
                          {fmtPct(row.divergence_avg)}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(row.divergence_ab)}`}
                        >
                          {fmtPct(row.divergence_ab)}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(row.divergence_ac)}`}
                        >
                          {fmtPct(row.divergence_ac)}
                        </td>
                        <td
                          className={`px-3 py-2 font-mono text-xs ${divergenceCellClass(row.divergence_bc)}`}
                        >
                          {fmtPct(row.divergence_bc)}
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
                      </tr>
                      {expandedId === id ? (
                        <tr className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
                          <td colSpan={8} className="px-6 py-6">
                            <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Pairwise divergence
                            </p>
                            <div className="flex justify-center md:justify-start">
                              <TriangleConsensus
                                scores={scores}
                                initials={{ a: 'A', b: 'B', c: 'C' }}
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
          Showing debates with average divergence between {divMin}% and {divMax}
          %. Rows without a stored average are hidden while filtering.
        </p>
      ) : null}
    </div>
  )
}
