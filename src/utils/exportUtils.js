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
  lines.push('# Babel: Debate Export', '')
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
    lines.push('## Round 2: Cross-review and rebuttal', '')
    for (const rev of [...reviews].sort((a, b) => a.roundNum - b.roundNum)) {
      lines.push(`### Round ${rev.roundNum}: ${aName}`, '', (rev.aReviews ?? '').trim(), '')
      lines.push(`### Round ${rev.roundNum}: ${bName}`, '', (rev.bReviews ?? '').trim(), '')
      lines.push(
        `### Round ${rev.roundNum}: ${cName}`,
        '',
        (rev.cReviews ?? '').trim(),
        ''
      )
    }
  }

  const reb = state.rebuttals && typeof state.rebuttals === 'object' ? state.rebuttals : {}
  if (reb && (reb.a || reb.b || reb.c)) {
    lines.push('## Rebuttals (legacy run)', '')
    lines.push(`### ${aName}`, '', String(reb.a ?? '').trim(), '')
    lines.push(`### ${bName}`, '', String(reb.b ?? '').trim(), '')
    lines.push(`### ${cName}`, '', String(reb.c ?? '').trim(), '')
  }

  const fin = state.finalPositions && typeof state.finalPositions === 'object' ? state.finalPositions : {}
  if (fin && (fin.a || fin.b || fin.c)) {
    lines.push('## Round 3: Final Positions', '')
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
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function' &&
      typeof window !== 'undefined' &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(t)
      return { ok: true }
    }
  } catch {
    /* fall through to legacy path */
  }

  try {
    if (typeof document === 'undefined') {
      return { ok: false, error: 'Clipboard is not available in this context.' }
    }
    const ta = document.createElement('textarea')
    ta.value = t
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.border = 'none'
    ta.style.outline = 'none'
    ta.style.boxShadow = 'none'
    ta.style.background = 'transparent'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, t.length)
    const ok = document.execCommand('copy')
    ta.remove()
    if (ok) return { ok: true }
    return { ok: false, error: 'Could not copy to clipboard.' }
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
  const blob = new Blob([md], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the browser has a chance to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
