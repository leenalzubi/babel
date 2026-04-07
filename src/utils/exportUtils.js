/**
 * @typedef {{
 *   prompt?: string,
 *   rounds: Array<{ roundNum: number, agentA: string, agentB: string, agentC: string }>,
 *   reviews: Array<{ roundNum: number, aReviews: string, bReviews: string, cReviews: string }>,
 *   synthesis: { output: string, rationale?: string, attributions?: { a?: string, b?: string, c?: string } } | null,
 *   config?: { agentA?: { name?: string }, agentB?: { name?: string }, agentC?: { name?: string } },
 * }} ForgeExportState
 */

/**
 * @param {ForgeExportState | Record<string, unknown>} state
 * @returns {string}
 */
export function exportToMarkdown(state) {
  const prompt = typeof state.prompt === 'string' ? state.prompt : ''
  const rounds = Array.isArray(state.rounds) ? state.rounds : []
  const reviews = Array.isArray(state.reviews) ? state.reviews : []
  const synthesis = state.synthesis ?? null
  const config = state.config && typeof state.config === 'object' ? state.config : {}

  const aName = config.agentA?.name ?? 'Agent A'
  const bName = config.agentB?.name ?? 'Agent B'
  const cName = config.agentC?.name ?? 'Agent C'

  const dateStr = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const lines = []
  lines.push('# Babel — Debate Export', '')
  lines.push(`**Prompt:** ${prompt.trim() || '_(empty)_'}`, '')
  lines.push(`**Date:** ${dateStr}`, '')

  const r1 = rounds.find((r) => r.roundNum === 1) ?? rounds[0]
  if (r1) {
    lines.push('## Round 1', '')
    lines.push(`### ${aName}`, '', (r1.agentA ?? '').trim(), '')
    lines.push(`### ${bName}`, '', (r1.agentB ?? '').trim(), '')
    lines.push(`### ${cName}`, '', (r1.agentC ?? '').trim(), '')
  }

  if (reviews.length > 0) {
    lines.push('## Cross-Reviews', '')
    for (const rev of [...reviews].sort((a, b) => a.roundNum - b.roundNum)) {
      lines.push(`### Round ${rev.roundNum} — ${aName}`, '', (rev.aReviews ?? '').trim(), '')
      lines.push(`### Round ${rev.roundNum} — ${bName}`, '', (rev.bReviews ?? '').trim(), '')
      lines.push(
        `### Round ${rev.roundNum} — ${cName}`,
        '',
        (rev.cReviews ?? '').trim(),
        ''
      )
    }
  }

  const reb = state.rebuttals && typeof state.rebuttals === 'object' ? state.rebuttals : {}
  if (reb && (reb.a || reb.b || reb.c)) {
    lines.push('## Round 3 — Rebuttals', '')
    lines.push(`### ${aName}`, '', String(reb.a ?? '').trim(), '')
    lines.push(`### ${bName}`, '', String(reb.b ?? '').trim(), '')
    lines.push(`### ${cName}`, '', String(reb.c ?? '').trim(), '')
  }

  const fin = state.finalPositions && typeof state.finalPositions === 'object' ? state.finalPositions : {}
  if (fin && (fin.a || fin.b || fin.c)) {
    lines.push('## Round 4 — Final Positions', '')
    lines.push(`### ${aName}`, '', String(fin.a ?? '').trim(), '')
    lines.push(`### ${bName}`, '', String(fin.b ?? '').trim(), '')
    lines.push(`### ${cName}`, '', String(fin.c ?? '').trim(), '')
  }

  if (synthesis) {
    const out = (synthesis.output ?? '').trim()
    const rat = (synthesis.rationale ?? '').trim()
    lines.push('## Synthesis', '', out, '')
    if (rat) {
      lines.push(
        ...rat.split('\n').map((line) => `> ${line}`),
        ''
      )
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

/**
 * @param {string} text
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function copyToClipboard(text) {
  const t = typeof text === 'string' ? text : String(text ?? '')
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      return { ok: false, error: 'Clipboard API not available in this context.' }
    }
    await navigator.clipboard.writeText(t)
    return { ok: true }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Could not copy to clipboard.'
    return { ok: false, error: msg }
  }
}

/**
 * Builds markdown from state and triggers download as `babel-export-{timestamp}.md`.
 * @param {ForgeExportState | Record<string, unknown>} state
 */
export function downloadMarkdown(state) {
  const md = exportToMarkdown(state)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `babel-export-${ts}.md`
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
