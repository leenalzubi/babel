import { useEffect, useState } from 'react'

const VA = { x: 100, y: 20 }
const VB = { x: 20, y: 160 }
const VC = { x: 180, y: 160 }

/** A = top, B = bottom-left, C = bottom-right */
const PATH_AB = `M ${VA.x} ${VA.y} L ${VB.x} ${VB.y}`
const PATH_AC = `M ${VA.x} ${VA.y} L ${VC.x} ${VC.y}`
const PATH_BC = `M ${VB.x} ${VB.y} L ${VC.x} ${VC.y}`

const MID_AB = { x: (VA.x + VB.x) / 2, y: (VA.y + VB.y) / 2 }
const MID_AC = { x: (VA.x + VC.x) / 2, y: (VA.y + VC.y) / 2 }
const MID_BC = { x: (VB.x + VC.x) / 2, y: (VB.y + VC.y) / 2 - 8 }

const CENTER = {
  x: (VA.x + VB.x + VC.x) / 3,
  y: (VA.y + VB.y + VC.y) / 3,
}

/** @param {number} s score 0–1 */
function pct(s) {
  const n = Number(s)
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n * 100)))
}

/** @param {number} s 0–1 */
function edgeStyle(s) {
  const p = pct(s)
  if (p <= 30) return { stroke: 'var(--agree)', strokeWidth: 2.5 }
  if (p <= 60) return { stroke: 'var(--neutral)', strokeWidth: 4 }
  return { stroke: 'var(--diverge)', strokeWidth: 6 }
}

/** @param {number} avg 0–1 */
function contextLabel(avg) {
  const p = pct(avg)
  if (p <= 30) return 'Aligned'
  if (p <= 60) return 'Debating'
  if (p <= 80) return 'Contested'
  return 'Opposed'
}

/**
 * Full-width horizontal divergence summary (mobile AgreementMeter).
 * @param {{
 *   scores: { ab: number, ac: number, bc: number, average: number },
 *   initials?: { a: string, b: string, c: string },
 * }} props
 */
export function ConsensusMeterBar({ scores, initials = { a: 'A', b: 'B', c: 'C' } }) {
  const ab = Number(scores?.ab) || 0
  const ac = Number(scores?.ac) || 0
  const bc = Number(scores?.bc) || 0
  const average = Number(scores?.average) || 0
  const avgP = pct(average)

  return (
    <div
      className="w-full rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3"
      aria-label="Pairwise semantic divergence: measures meaning similarity between responses, not shared vocabulary."
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Divergence
        </span>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
          {avgP}% · {contextLabel(average)}
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-[2px] border border-[var(--border)] bg-[var(--bg-base)]">
        <div
          className="h-full rounded-[1px] bg-[var(--accent-forge)]/65 transition-[width] duration-500"
          style={{ width: `${avgP}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 font-mono text-[9px] text-[var(--text-muted)]">
        <span className="flex flex-col items-center gap-0.5 text-center">
          <span>
            <span className="text-[var(--text-secondary)]">
              {initials.a}–{initials.b}
            </span>{' '}
            {pct(ab)}%
          </span>
          <span className="text-[8px] font-normal uppercase tracking-wide text-[var(--text-muted)]">
            semantic
          </span>
        </span>
        <span className="flex flex-col items-center gap-0.5 text-center">
          <span>
            <span className="text-[var(--text-secondary)]">
              {initials.a}–{initials.c}
            </span>{' '}
            {pct(ac)}%
          </span>
          <span className="text-[8px] font-normal uppercase tracking-wide text-[var(--text-muted)]">
            semantic
          </span>
        </span>
        <span className="flex flex-col items-center gap-0.5 text-center">
          <span>
            <span className="text-[var(--text-secondary)]">
              {initials.b}–{initials.c}
            </span>{' '}
            {pct(bc)}%
          </span>
          <span className="text-[8px] font-normal uppercase tracking-wide text-[var(--text-muted)]">
            semantic
          </span>
        </span>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   scores: { ab: number, ac: number, bc: number, average: number },
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

  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const dAB = edgeStyle(ab)
  const dAC = edgeStyle(ac)
  const dBC = edgeStyle(bc)

  const avgP = pct(average)

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
      aria-label="Pairwise semantic divergence triangle. Measures meaning similarity, not vocabulary overlap."
      title="Semantic divergence: how differently the models reasoned, not just how they phrased answers."
    >
      <svg
        width={200}
        height={180}
        viewBox="0 0 200 180"
        className="overflow-visible"
      >
        <defs>
          <style>{`
            .tc-edge-label { font-family: var(--font-mono), monospace; font-size: 9px; fill: var(--text-secondary); }
            .tc-edge-semantic { font-family: var(--font-mono), monospace; font-size: 6px; font-weight: 500; fill: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
            .tc-center-pct { font-family: var(--font-mono), monospace; font-size: 17px; font-weight: 600; fill: var(--text-primary); }
            .tc-center-lbl { font-family: var(--font-mono), monospace; font-size: 9px; fill: var(--text-muted); }
            .tc-init { font-family: var(--font-mono), monospace; font-size: 10px; font-weight: 700; fill: #fff; }
          `}</style>
        </defs>

        <path d={PATH_AB} {...commonPath} stroke={dAB.stroke} strokeWidth={dAB.strokeWidth} />
        <path d={PATH_AC} {...commonPath} stroke={dAC.stroke} strokeWidth={dAC.strokeWidth} />
        <path d={PATH_BC} {...commonPath} stroke={dBC.stroke} strokeWidth={dBC.strokeWidth} />

        <text x={MID_AB.x} y={MID_AB.y - 4} textAnchor="middle" className="tc-edge-label">
          {pct(ab)}%
        </text>
        <text x={MID_AB.x} y={MID_AB.y + 7} textAnchor="middle" className="tc-edge-semantic">
          semantic
        </text>
        <text x={MID_AC.x} y={MID_AC.y - 4} textAnchor="middle" className="tc-edge-label">
          {pct(ac)}%
        </text>
        <text x={MID_AC.x} y={MID_AC.y + 7} textAnchor="middle" className="tc-edge-semantic">
          semantic
        </text>
        <text x={MID_BC.x} y={MID_BC.y - 4} textAnchor="middle" className="tc-edge-label">
          {pct(bc)}%
        </text>
        <text x={MID_BC.x} y={MID_BC.y + 7} textAnchor="middle" className="tc-edge-semantic">
          semantic
        </text>

        <g>
          <circle cx={VA.x} cy={VA.y} r={9} fill="var(--agent-a)" />
          <text x={VA.x} y={VA.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.a}
          </text>
        </g>
        <g>
          <circle cx={VB.x} cy={VB.y} r={9} fill="var(--agent-b)" />
          <text x={VB.x} y={VB.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.b}
          </text>
        </g>
        <g>
          <circle cx={VC.x} cy={VC.y} r={9} fill="var(--agent-c)" />
          <text x={VC.x} y={VC.y} dy="0.35em" textAnchor="middle" className="tc-init">
            {initials.c}
          </text>
        </g>

        <text
          x={CENTER.x}
          y={CENTER.y - 6}
          textAnchor="middle"
          className="tc-center-pct"
        >
          {avgP}%
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + 10}
          textAnchor="middle"
          className="tc-center-lbl"
        >
          {contextLabel(average)}
        </text>
        <text
          x={CENTER.x}
          y={CENTER.y + 22}
          textAnchor="middle"
          className="tc-edge-semantic"
        >
          semantic
        </text>
      </svg>
    </figure>
  )
}
