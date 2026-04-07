import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

const VA = { x: 140, y: 27 }
const VB = { x: 33, y: 213 }
const VC = { x: 247, y: 213 }
const PATH_AB = `M ${VA.x} ${VA.y} L ${VB.x} ${VB.y}`
const PATH_AC = `M ${VA.x} ${VA.y} L ${VC.x} ${VC.y}`
const PATH_BC = `M ${VB.x} ${VB.y} L ${VC.x} ${VC.y}`

const EDGE_STROKE = {
  ab: '#2563EB',
  ac: '#DC2626',
  bc: '#16A34A',
}

/** @param {number} s 0–1 */
function edgeWidthForScore(s) {
  const p = Math.min(100, Math.max(0, Math.round(Number(s) * 100)))
  if (p <= 30) return 3
  if (p <= 60) return 5.5
  return 8.5
}

/**
 * @param {{
 *   scores: { ab: number, ac: number, bc: number },
 *   initials: { a: string, b: string, c: string },
 * }} props
 */
function BetweenModelDivergenceTriangle({ scores, initials }) {
  const ab = Number(scores?.ab) || 0
  const ac = Number(scores?.ac) || 0
  const bc = Number(scores?.bc) || 0
  const wAB = edgeWidthForScore(ab)
  const wAC = edgeWidthForScore(ac)
  const wBC = edgeWidthForScore(bc)

  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        Between-model divergence
      </p>
      <svg width={280} height={240} viewBox="0 0 280 240" className="overflow-visible">
        <path
          d={PATH_AB}
          fill="none"
          stroke={EDGE_STROKE.ab}
          strokeWidth={wAB}
          strokeLinecap="round"
        />
        <path
          d={PATH_AC}
          fill="none"
          stroke={EDGE_STROKE.ac}
          strokeWidth={wAC}
          strokeLinecap="round"
        />
        <path
          d={PATH_BC}
          fill="none"
          stroke={EDGE_STROKE.bc}
          strokeWidth={wBC}
          strokeLinecap="round"
        />
        <g>
          <circle cx={VA.x} cy={VA.y} r={12} fill="var(--agent-a)" />
          <text
            x={VA.x}
            y={VA.y}
            dy="0.35em"
            textAnchor="middle"
            className="fill-white font-[family-name:var(--font-mono)] text-[12px] font-bold"
          >
            {initials.a}
          </text>
        </g>
        <g>
          <circle cx={VB.x} cy={VB.y} r={12} fill="var(--agent-b)" />
          <text
            x={VB.x}
            y={VB.y}
            dy="0.35em"
            textAnchor="middle"
            className="fill-white font-[family-name:var(--font-mono)] text-[12px] font-bold"
          >
            {initials.b}
          </text>
        </g>
        <g>
          <circle cx={VC.x} cy={VC.y} r={12} fill="var(--agent-c)" />
          <text
            x={VC.x}
            y={VC.y}
            dy="0.35em"
            textAnchor="middle"
            className="fill-white font-[family-name:var(--font-mono)] text-[12px] font-bold"
          >
            {initials.c}
          </text>
        </g>
      </svg>
      <p className="mt-2 max-w-[280px] text-center font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
        Edge thickness shows reasoning divergence
      </p>
    </div>
  )
}

/** @param {unknown} d */
function r3PercentFromDistance(d) {
  const x = Number(d)
  const v = Number.isFinite(x) ? x : 0.15
  if (v < 0.1) return 10
  if (v < 0.25) return 32
  if (v < 0.45) return 58
  return 90
}

/** @param {string} cls */
function classificationBadgeClass(cls) {
  const c = String(cls).toLowerCase()
  if (c.includes('held firm'))
    return 'bg-[#16A34A]/15 text-[#15803D] border-[#16A34A]/35'
  if (c.includes('significant'))
    return 'bg-[#DC2626]/12 text-[#B91C1C] border-[#DC2626]/35'
  if (c.includes('minor'))
    return 'bg-[#D97706]/12 text-[#B45309] border-[#D97706]/35'
  if (c.includes('shifted'))
    return 'bg-[#D97706]/15 text-[#9A3412] border-[#D97706]/40'
  return 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border)]'
}

/** @param {string} ct */
function changeTypeBadge(ct) {
  const t = String(ct)
  const map = {
    genuine_update: 'bg-[#16A34A]/12 text-[#15803D] border-[#16A34A]/30',
    social_capitulation:
      'bg-[#D97706]/12 text-[#B45309] border-[#D97706]/35',
    clarification: 'bg-[#2563EB]/10 text-[#1D4ED8] border-[#2563EB]/30',
    no_change: 'bg-[var(--bg-base)] text-[var(--text-muted)] border-[var(--border)]',
  }
  const label = {
    genuine_update: 'Genuine update',
    social_capitulation: 'Social capitulation',
    clarification: 'Clarification',
    no_change: 'No change',
  }
  const cls = map[/** @type {keyof typeof map} */ (t)] ?? map.no_change
  const lab = label[/** @type {keyof typeof label} */ (t)] ?? t
  return { cls, lab }
}

/**
 * @param {string} text
 * @param {{ agentA: { name: string, color: string }, agentB: { name: string, color: string }, agentC: { name: string, color: string } }} config
 */
function highlightAgentsInText(text, config) {
  if (!text) return '—'
  const agents = [
    { name: config.agentA.name, color: config.agentA.color },
    { name: config.agentB.name, color: config.agentB.color },
    { name: config.agentC.name, color: config.agentC.color },
  ].filter((a) => a.name)
  agents.sort((a, b) => b.name.length - a.name.length)
  /** @type {(string | import('react').ReactNode)[]} */
  let chunks = [text]
  for (const { name, color } of agents) {
    const out = []
    for (const ch of chunks) {
      if (typeof ch !== 'string') {
        out.push(ch)
        continue
      }
      let rest = ch
      let guard = 0
      while (rest.length && guard++ < 50) {
        const i = rest.indexOf(name)
        if (i === -1) {
          out.push(rest)
          break
        }
        if (i > 0) out.push(rest.slice(0, i))
        out.push(
          <span key={`${name}-${rest.slice(0, i).length}`} style={{ color }}>
            {name}
          </span>
        )
        rest = rest.slice(i + name.length)
      }
    }
    chunks = out
  }
  return chunks.map((n, i) =>
    typeof n === 'string' ? <span key={i}>{n}</span> : n
  )
}

/**
 * @param {{
 *   slot: 'a' | 'b' | 'c',
 *   agentSpec: { name: string, color: string },
 *   row: Record<string, unknown> | null | undefined,
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 * }} props
 */
function PositionTrack({ agentSpec, row, config }) {
  const [open, setOpen] = useState(false)
  const distance = Number(row?.distance)
  const d = Number.isFinite(distance) ? distance : 0.15
  const toward = row?.towardConsensus
  const cls = String(row?.classification ?? 'minor shift')
  const self = row?.selfReport && typeof row.selfReport === 'object'
    ? /** @type {Record<string, unknown>} */ (row.selfReport)
    : null

  const pctR1 = 10
  const pctR3 = r3PercentFromDistance(d)
  const pctR2 = (pctR1 + pctR3) / 2

  const towardConsensus = toward === true
  const away = toward === false
  const gradTo = towardConsensus ? '#9ca3af' : away ? '#DC2626' : '#a8a29e'
  const gradient = `linear-gradient(90deg, ${agentSpec.color}33 0%, ${gradTo}55 100%)`

  const { cls: typeCls, lab: typeLab } = changeTypeBadge(
    String(self?.change_type ?? 'no_change')
  )

  return (
    <div className="rounded-[6px] border border-[var(--border)] bg-[#FDFAF4]/90 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-[140px] items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: agentSpec.color }}
            aria-hidden
          />
          <span className="font-[family-name:var(--font-body)] text-sm font-medium text-[var(--text-primary)]">
            {agentSpec.name}
          </span>
        </div>
        <div className="min-w-0 flex-1 px-1">
          <div
            className="relative h-3 rounded-full"
            style={{ background: gradient }}
            role="presentation"
          >
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--text-primary)] shadow"
              style={{ left: `${pctR1}%` }}
              title="R1"
            />
            <span
              className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white/90"
              style={{ left: `${pctR2}%` }}
              title="R2"
            />
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--text-primary)] shadow"
              style={{ left: `${pctR3}%` }}
              title="R3"
            />
          </div>
          <div className="mt-0.5 flex justify-between font-[family-name:var(--font-mono)] text-[9px] text-[var(--text-muted)]">
            <span>R1</span>
            <span>R2</span>
            <span>R3</span>
          </div>
        </div>
        <div className="shrink-0">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium ${classificationBadgeClass(cls)}`}
          >
            {cls}
          </span>
        </div>
      </div>
      {self ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)] underline decoration-dotted underline-offset-2"
        >
          {open ? 'Hide self-report' : 'Show self-report'}
        </button>
      ) : null}
      {open && self ? (
        <div className="mt-3 space-y-2 border-t border-dashed border-[var(--border)] pt-3 text-[12px] leading-snug text-[var(--text-secondary)]">
          <span
            className={`inline-block rounded-[4px] border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] ${typeCls}`}
          >
            {typeLab}
          </span>
          <p>
            <span className="font-medium text-[var(--text-muted)]">
              What changed:{' '}
            </span>
            {self.what_changed ? String(self.what_changed) : '—'}
          </p>
          <p>
            <span className="font-medium text-[var(--text-muted)]">
              Caused by:{' '}
            </span>
            {self.what_caused_it
              ? highlightAgentsInText(String(self.what_caused_it), config)
              : '—'}
          </p>
          <p>
            <span className="font-medium text-[var(--text-muted)]">
              Held firm on:{' '}
            </span>
            {self.what_held_firm ? String(self.what_held_firm) : '—'}
          </p>
          <p>
            <span className="font-medium text-[var(--text-muted)]">
              Would have changed for:{' '}
            </span>
            {self.what_would_change_mind
              ? String(self.what_would_change_mind)
              : '—'}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   scores: { ab: number, ac: number, bc: number, average?: number, totalClaims?: number, contestedClaims?: number, unanimousClaims?: number },
 *   initials?: { a: string, b: string, c: string },
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   influenceReport: Record<string, unknown> | null,
 *   influenceLoading?: boolean,
 *   showPositionTracks?: boolean,
 * }} props
 */
export default function InfluenceMap({
  scores,
  initials = { a: 'G', b: 'P', c: 'M' },
  config,
  influenceReport,
  influenceLoading = false,
  showPositionTracks = true,
}) {
  const summary = useMemo(() => {
    if (!influenceReport) {
      return { firm: 0, shifted: 0, sig: 0 }
    }
    /** @param {string} k */
    const row = (k) =>
      influenceReport[k] && typeof influenceReport[k] === 'object'
        ? /** @type {Record<string, unknown>} */ (influenceReport[k])
        : null
    let firm = 0
    let shifted = 0
    let sig = 0
    for (const k of ['a', 'b', 'c']) {
      const c = String(row(k)?.classification ?? '').toLowerCase()
      if (c.includes('held firm')) firm += 1
      else if (c.includes('significant')) sig += 1
      else shifted += 1
    }
    return { firm, shifted, sig }
  }, [influenceReport])

  const tracksVisible =
    showPositionTracks && influenceReport && !influenceLoading

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8">
      <section aria-label="Between-model divergence">
        <BetweenModelDivergenceTriangle scores={scores} initials={initials} />
      </section>

      {showPositionTracks ? (
        <section aria-label="Position change across rounds">
          <p className="mb-3 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Position change across rounds
          </p>
          {influenceLoading ? (
            <div
              className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              Analysing position changes...
            </div>
          ) : null}
          {tracksVisible ? (
            <>
              <p className="mb-4 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-muted)]">
                {summary.firm} models held firm · {summary.shifted} shifted ·{' '}
                {summary.sig} changed significantly
              </p>
              <div className="flex flex-col gap-4">
                <PositionTrack
                  agentSpec={config.agentA}
                  row={
                    influenceReport.a && typeof influenceReport.a === 'object'
                      ? /** @type {Record<string, unknown>} */ (
                          influenceReport.a
                        )
                      : null
                  }
                  config={config}
                />
                <PositionTrack
                  agentSpec={config.agentB}
                  row={
                    influenceReport.b && typeof influenceReport.b === 'object'
                      ? /** @type {Record<string, unknown>} */ (
                          influenceReport.b
                        )
                      : null
                  }
                  config={config}
                />
                <PositionTrack
                  agentSpec={config.agentC}
                  row={
                    influenceReport.c && typeof influenceReport.c === 'object'
                      ? /** @type {Record<string, unknown>} */ (
                          influenceReport.c
                        )
                      : null
                  }
                  config={config}
                />
              </div>
            </>
          ) : !influenceLoading ? (
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
              Position tracks appear after final positions are analysed.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
