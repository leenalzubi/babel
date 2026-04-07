const ATTR = '---ATTRIBUTIONS---'
const CONC = '---CONCESSIONS---'
const HELD = '---HELD-FIRM---'
const RAT = '---RATIONALE---'

/**
 * @param {string} text
 * @param {string} startMarker
 * @param {string[]} endMarkers
 */
function sliceBetween(text, startMarker, endMarkers) {
  const si = text.indexOf(startMarker)
  if (si === -1) return ''
  const start = si + startMarker.length
  let end = text.length
  for (const em of endMarkers) {
    const ei = text.indexOf(em, start)
    if (ei !== -1 && ei < end) end = ei
  }
  return text.slice(start, end).trim()
}

/**
 * @param {string} s
 */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {string} raw
 * @param {{
 *   agentA?: { name?: string },
 *   agentB?: { name?: string },
 *   agentC?: { name?: string },
 * } | undefined} config
 * @returns {{
 *   output: string,
 *   attributions: { a: string, b: string, c: string },
 *   rationale: string,
 *   concessions: string[],
 *   heldFirm: string[],
 * }}
 */
export function parseSynthesisOutput(raw, config) {
  const text = typeof raw === 'string' ? raw.trim() : ''

  const markerPositions = [ATTR, CONC, HELD, RAT]
    .map((m) => text.indexOf(m))
    .filter((i) => i >= 0)
  const firstMarker =
    markerPositions.length > 0 ? Math.min(...markerPositions) : -1

  let output =
    firstMarker >= 0 ? text.slice(0, firstMarker).trim() : text

  const attrBlock = sliceBetween(text, ATTR, [CONC, HELD, RAT])
  const concessionsBlock = sliceBetween(text, CONC, [HELD, RAT, ATTR])
  const heldBlock = sliceBetween(text, HELD, [RAT, ATTR, CONC])
  const rationale = sliceBetween(text, RAT, [])

  output = output
    .replace(/^\[(?:Synthesized answer|Your synthesized answer[^\]]*)\]\s*\n?/i, '')
    .trim()

  const attributions = { a: '', b: '', c: '' }
  if (attrBlock) {
    for (const line of attrBlock.split('\n')) {
      const t = line.trim()
      if (!t) continue
      let m = t.match(/^AGENT_A:\s*(.*)$/i)
      if (m) attributions.a = m[1].trim()
      m = t.match(/^AGENT_B:\s*(.*)$/i)
      if (m) attributions.b = m[1].trim()
      m = t.match(/^AGENT_C:\s*(.*)$/i)
      if (m) attributions.c = m[1].trim()
      m = t.match(/^GPT-4O:\s*(.*)$/i)
      if (m) attributions.a = m[1].trim()
      m = t.match(/^PHI-4:\s*(.*)$/i)
      if (m) attributions.b = m[1].trim()
      m = t.match(/^MISTRAL:\s*(.*)$/i)
      if (m) attributions.c = m[1].trim()
    }
  }

  const cfg = config && typeof config === 'object' ? config : {}
  const aName = cfg.agentA?.name ?? ''
  const bName = cfg.agentB?.name ?? ''
  const cName = cfg.agentC?.name ?? ''
  if (attrBlock && aName) {
    for (const line of attrBlock.split('\n')) {
      const t = line.trim()
      const m = t.match(new RegExp(`^${escapeRe(aName)}:\\s*(.*)$`, 'i'))
      if (m) attributions.a = m[1].trim()
    }
  }
  if (attrBlock && bName) {
    for (const line of attrBlock.split('\n')) {
      const t = line.trim()
      const m = t.match(new RegExp(`^${escapeRe(bName)}:\\s*(.*)$`, 'i'))
      if (m) attributions.b = m[1].trim()
    }
  }
  if (attrBlock && cName) {
    for (const line of attrBlock.split('\n')) {
      const t = line.trim()
      const m = t.match(new RegExp(`^${escapeRe(cName)}:\\s*(.*)$`, 'i'))
      if (m) attributions.c = m[1].trim()
    }
  }

  const concessions = concessionsBlock
    ? concessionsBlock
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : []
  const heldFirm = heldBlock
    ? heldBlock
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : []

  return { output, attributions, rationale, concessions, heldFirm }
}
