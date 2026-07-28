import { useEffect, useState } from 'react'

/** Equilateral-ish layout in viewBox 0 0 280 240: scaled from legacy 200×180 with isotropic fit. */
const VA = { x: 140, y: 27 }
const VB = { x: 33, y: 213 }
const VC = { x: 247, y: 213 }

/** A = top, B = bottom-left, C = bottom-right */
const PATH_AB = `M ${VA.x} ${VA.y} L ${VB.x} ${VB.y}`
const PATH_AC = `M ${VA.x} ${VA.y} L ${VC.x} ${VC.y}`
const PATH_BC = `M ${VB.x} ${VB.y} L ${VC.x} ${VC.y}`

const MID_AB = { x: (VA.x + VB.x) / 2, y: (VA.y + VB.y) / 2 }
const MID_AC = { x: (VA.x + VC.x) / 2, y: (VA.y + VC.y) / 2 }
const MID_BC = { x: (VB.x + VC.x) / 2, y: (VB.y + VC.y) / 2 - 10 }

const CENTER = {
  x: (VA.x + VB.x + VC.x) / 3,
  y: (VA.y + VB.y + VC.y) / 3,
}

/** Push edge midpoint outward from centroid so labels clear stroked edges. */
function edgeLabelPos(mid, extra = 26) {
  const dx = mid.x - CENTER.x
  const dy = mid.y - CENTER.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: mid.x + (dx / len) * extra,
    y: mid.y + (dy / len) * extra,
  }
}

/** @param {number} s score 0-1 */
function pct(s) {
  const n = Number(s)
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n * 100)))
}

/** G↔P (A-B): blue; G↔M (A-C): red; P↔M (B-C): green: hue matches “source” vertex of each pair. */
const EDGE_STROKE = {
  ab: '#1E4E5E',
  ac: '#97372B',
  bc: '#4C6647',
}

/** @param {number} s 0-1 */
function edgeWidthForScore(s) {
  const p = pct(s)
  if (p <= 30) return 3.5
  if (p <= 60) return 5.5
  return 8
}

/**
 * Full-width horizontal summary (mobile).
 * @param {{
 *   scores: { ab: number, ac: number, bc: number, average: number, unanimousClaims?: number, contestedClaims?: number },
 *   initials?: { a: string, b: string, c: string },
 * }} props
 */
export function ConsensusMeterBar({ scores, initials = { a: 'A', b: 'B', c: 'C' } }) {
  const ab = Number(scores?.ab) || 0
  const ac = Number(scores?.ac) || 0
  const bc = Number(scores?.bc) || 0
  const average = Number(scores?.average) || 0
  const avgP = pct(average)
  const unanimous = Number(scores?.unanimousClaims) || 0
  const contested = Number(scores?.contestedClaims) || 0

  return (
    <div
      className="w-full rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3"
      aria-label="Pairwise claim disagreement between agents."
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <span className="font-[family-name:var(--font-mono)] text-[10px] font-medium text-[var(--text-muted)]">
          Claim disagreement
        </span>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="font-[family-name:var(--font-mono)] text-[17px] font-semibold leading-none text-[var(--text-primary)]">
            {avgP}%
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] leading-tight text-[var(--text-muted)]">
            {unanimous} unanimous, {contested} contested
          </span>
        </div>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--bg-base)]">
        <div
          className="h-full rounded-[1px] bg-[var(--accent-forge)]/65 transition-[width] duration-500"
          style={{ width: `${avgP}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 font-mono text-[9px] text-[var(--text-muted)]">
        <span className="text-center">
          <span className="text-[var(--text-secondary)]">
            {initials.a}-{initials.b}
          </span>{' '}
          {pct(ab)}%
        </span>
        <span className="text-center">
          <span className="text-[var(--text-secondary)]">
            {initials.a}-{initials.c}
          </span>{' '}
          {pct(ac)}%
        </span>
        <span className="text-center">
          <span className="text-[var(--text-secondary)]">
            {initials.b}-{initials.c}
          </span>{' '}
          {pct(bc)}%
        </span>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   scores: { ab: number, ac: number, bc: number, average: number, totalClaims?: number, contestedClaims?: number, unanimousClaims?: number },
 *   initials?: { a: string, b: string, c: string },
 * }} props
 */
export default function TriangleConsensus({
  scores,
  initials = { a: 'A', b: 'B', c: 'C' },
}) {
  const ab = Number(scores?.ab) || 0
  const ac = Number(scores?.ac) || 0
  const bc = Number(scores?.bc) || 0
  const average = Number(scores?.average) || 0
  const unanimousClaims = Number(scores?.unanimousClaims) || 0
  const contestedClaims = Number(scores?.contestedClaims) || 0

  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const wAB = edgeWidthForScore(ab)
  const wAC = edgeWidthForScore(ac)
  const wBC = edgeWidthForScore(bc)

  const avgP = pct(average)

  const abPos = edgeLabelPos(MID_AB)
  const acPos = edgeLabelPos(MID_AC)
  const bcPos = edgeLabelPos(MID_BC)

  const commonPath = {
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    pathLength: 100,
    strokeDasharray: 100,
    strokeDashoffset: drawn ? 0 : 100,
    style: { transition: 'stroke-dashoffset 600ms ease-out' },
  }

  return (
    <figure
      className="m-0 inline-flex flex-col items-center"
      aria-label="Pairwise claim disagreement triangle."
      title="Claim disagreement from audited positions (agree / disagree / partial / silent)."
    >
      <svg
        width={280}
        height={240}
        viewBox="0 0 280 240"
        className="overflow-visible"
      >
        <defs>
          <style>{`
            .tc-edge-label { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 500; fill: var(--text-secondary); }
            .tc-center-pct { font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 700; fill: var(--text-primary); }
            .tc-center-sub { font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 500; fill: var(--text-muted); }
            .tc-init { font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; fill: #fff; }
          `}</style>
        </defs>

        <path
          d={PATH_AB}
          {...commonPath}
          stroke={EDGE_STROKE.ab}
          strokeWidth={wAB}
        />
        <path
          d={PATH_AC}
          {...commonPath}
          stroke={EDGE_STROKE.ac}
          strokeWidth={wAC}
        />
        <path
          d={PATH_BC}
          {...commonPath}
          stroke={EDGE_STROKE.bc}
          strokeWidth={wBC}
        />

        <text x={abPos.x} y={abPos.y + 6} textAnchor="middle" className="tc-edge-label">
          {pct(ab)}%
        </text>
        <text x={acPos.x} y={acPos.y + 6} textAnchor="middle" className="tc-edge-label">
          {pct(ac)}%
        </text>
        <text x={bcPos.x} y={bcPos.y + 6} textAnchor="middle" className="tc-edge-label">
          {pct(bc)}%
        </text>

        <g>
          <circle cx={VA.x} cy={VA.y} r={12} fill="var(--agent-a)" />
          <text x={VA.x} y={VA.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.a}
          </text>
        </g>
        <g>
          <circle cx={VB.x} cy={VB.y} r={12} fill="var(--agent-b)" />
          <text x={VB.x} y={VB.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.b}
          </text>
        </g>
        <g>
          <circle cx={VC.x} cy={VC.y} r={12} fill="var(--agent-c)" />
          <text x={VC.x} y={VC.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.c}
          </text>
        </g>

        <text
          x={CENTER.x}
          y={CENTER.y - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          className="tc-center-pct"
        >
          {avgP}%
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          className="tc-center-sub"
        >
          claim disagreement
        </text>
      </svg>
      <p className="mb-0 mt-2 text-center font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
        {unanimousClaims} unanimous, {contestedClaims} contested
      </p>
      <p
        className="mb-0 mt-2 flex max-w-[280px] flex-wrap justify-center gap-x-3 gap-y-1 text-center font-[family-name:var(--font-mono)] text-[10px] leading-snug text-[var(--text-muted)]"
        aria-label="Vertex initials: G GPT-4o mini, P Phi-4, M Mistral Small"
      >
        <span className="whitespace-nowrap">G = GPT-4o mini</span>
        <span className="whitespace-nowrap">P = Phi-4</span>
        <span className="whitespace-nowrap">M = Mistral Small</span>
      </p>
    </figure>
  )
}
