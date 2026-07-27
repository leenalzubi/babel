/**
 * Best-effort structured extraction over model responses.
 * Extraction failure never discards the raw answer.
 */

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   evidence?: string[],
 * }} BabelClaim
 *
 * @typedef {{
 *   targetClaimId: string | null,
 *   text: string,
 *   linked: boolean,
 * }} BabelCounterpoint
 *
 * @typedef {{
 *   claimId: string,
 *   action: 'preserved' | 'narrowed' | 'amended' | 'withdrawn',
 *   revisedId?: string | null,
 *   text?: string,
 *   reason?: string,
 * }} BabelPositionChange
 *
 * @typedef {'structured' | 'partially_structured' | 'raw_response' | 'structure_failed'} ExtractionState
 *
 * @typedef {{
 *   extraction: ExtractionState,
 *   stance?: 'support' | 'oppose' | 'conditional' | null,
 *   claims: BabelClaim[],
 *   counterpoints: BabelCounterpoint[],
 *   changes: BabelPositionChange[],
 *   unparsed: string,
 *   raw: string,
 * }} StructuredVoice
 */

/**
 * @param {string} text
 */
function stripFences(text) {
  const t = String(text ?? '').trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  return m ? m[1].trim() : t
}

/**
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
function tryParseJsonObject(text) {
  const cleaned = stripFences(text)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return parsed && typeof parsed === 'object' ? /** @type {Record<string, unknown>} */ (parsed) : null
  } catch {
    return null
  }
}

/**
 * @param {unknown} v
 * @returns {'support' | 'oppose' | 'conditional' | null}
 */
function normalizeStance(v) {
  const s = String(v ?? '')
    .toLowerCase()
    .trim()
  if (s.startsWith('support') || s === 'yes' || s === 'for') return 'support'
  if (s.startsWith('oppose') || s === 'no' || s === 'against') return 'oppose'
  if (s.startsWith('cond')) return 'conditional'
  return null
}

/**
 * @param {unknown} list
 * @param {string} agentPrefix
 * @returns {BabelClaim[]}
 */
function normalizeClaims(list, agentPrefix) {
  if (!Array.isArray(list)) return []
  /** @type {BabelClaim[]} */
  const out = []
  list.forEach((item, i) => {
    if (typeof item === 'string' && item.trim()) {
      out.push({
        id: `${agentPrefix}C${i + 1}`,
        text: item.trim(),
        evidence: [],
      })
      return
    }
    if (!item || typeof item !== 'object') return
    const o = /** @type {Record<string, unknown>} */ (item)
    const text = String(o.text ?? o.claim ?? '').trim()
    if (!text) return
    const rawId = String(o.id ?? `C${i + 1}`).trim() || `C${i + 1}`
    const id = rawId.match(/^[ABC]-/i)
      ? rawId
      : `${agentPrefix}${rawId.replace(/^C/i, 'C')}`
    const evidence = Array.isArray(o.evidence)
      ? o.evidence.map((e) => String(e).trim()).filter(Boolean)
      : typeof o.evidence === 'string' && o.evidence.trim()
        ? [o.evidence.trim()]
        : typeof o.rationale === 'string' && o.rationale.trim()
          ? [o.rationale.trim()]
          : []
    out.push({ id, text, evidence })
  })
  return out
}

/**
 * @param {string} raw
 * @param {string} agentPrefix
 * @returns {BabelClaim[]}
 */
function parseClaimsFromText(raw, agentPrefix) {
  /** @type {BabelClaim[]} */
  const claims = []
  const re =
    /^(?:[-*•]\s*)?(?:Claim\s*)?(C\d+[′']?)\s*[:.\-\u2013\u2014]\s*(.+)$/gim
  let m
  while ((m = re.exec(raw)) !== null) {
    const id = `${agentPrefix}${m[1].replace(/^C/i, 'C')}`
    claims.push({ id, text: m[2].trim(), evidence: [] })
  }
  return claims
}

/**
 * @param {string} agentKey
 */
export function agentClaimPrefix(agentKey) {
  const k = String(agentKey || 'a').toLowerCase()
  if (k === 'b') return 'B-'
  if (k === 'c') return 'C-'
  return 'A-'
}

/**
 * Round 1 position extraction.
 * @param {string} raw
 * @param {'a'|'b'|'c'|string} agentKey
 * @returns {StructuredVoice}
 */
export function parseRound1Structure(raw, agentKey) {
  const text = String(raw ?? '')
  const prefix = agentClaimPrefix(agentKey)
  if (!text.trim() || text.includes('took longer than')) {
    return emptyStructure(text, 'raw_response')
  }

  const json = tryParseJsonObject(text)
  if (json) {
    const claims = normalizeClaims(json.claims, prefix)
    const stance = normalizeStance(json.stance)
    if (claims.length > 0) {
      return {
        extraction: 'structured',
        stance,
        claims,
        counterpoints: [],
        changes: [],
        unparsed: '',
        raw: text,
      }
    }
    return {
      extraction: 'structure_failed',
      stance,
      claims: [],
      counterpoints: [],
      changes: [],
      unparsed: '',
      raw: text,
    }
  }

  const stanceMatch = text.match(
    /^\s*STANCE\s*:\s*(support|oppose|conditional)\b/im
  )
  const stance = stanceMatch
    ? normalizeStance(stanceMatch[1])
    : normalizeStance(
        text.match(/\b(support|oppose|conditional)\b/i)?.[1]
      )
  const claims = parseClaimsFromText(text, prefix)
  if (claims.length >= 1) {
    return {
      extraction: claims.length >= 2 || stance ? 'structured' : 'partially_structured',
      stance,
      claims,
      counterpoints: [],
      changes: [],
      unparsed: '',
      raw: text,
    }
  }

  return emptyStructure(text, 'raw_response')
}

/**
 * Round 2 counterpoint extraction.
 * @param {string} raw
 * @param {Set<string> | string[]} [validClaimIds]
 * @returns {StructuredVoice}
 */
export function parseRound2Structure(raw, validClaimIds = []) {
  const text = String(raw ?? '')
  const valid = validClaimIds instanceof Set ? validClaimIds : new Set(validClaimIds)
  if (!text.trim() || text.includes('took longer than')) {
    return emptyStructure(text, 'raw_response')
  }

  const json = tryParseJsonObject(text)
  /** @type {BabelCounterpoint[]} */
  const counterpoints = []
  if (json && Array.isArray(json.counterpoints)) {
    for (const item of json.counterpoints) {
      if (!item || typeof item !== 'object') continue
      const o = /** @type {Record<string, unknown>} */ (item)
      const body = String(o.text ?? o.critique ?? '').trim()
      if (!body) continue
      const target = String(o.targetClaimId ?? o.target ?? o.claimId ?? '')
        .trim()
        .toUpperCase()
      const linked = Boolean(target && valid.has(target))
      counterpoints.push({
        targetClaimId: linked ? target : target || null,
        text: body,
        linked,
      })
    }
  } else {
    const re =
      /(?:challenges?|counter(?:point)?|re:\s*)\s*((?:[ABC]-)?C\d+[′']?)\s*[:.\-\u2013\u2014]\s*(.+)/gi
    let m
    while ((m = re.exec(text)) !== null) {
      const target = m[1].toUpperCase()
      const linked = valid.has(target)
      counterpoints.push({
        targetClaimId: target,
        text: m[2].trim(),
        linked,
      })
    }
  }

  if (counterpoints.length > 0) {
    const allLinked = counterpoints.every((c) => c.linked)
    return {
      extraction: allLinked ? 'structured' : 'partially_structured',
      stance: null,
      claims: [],
      counterpoints,
      changes: [],
      unparsed: '',
      raw: text,
    }
  }

  return emptyStructure(text, 'raw_response')
}

/**
 * Round 3 position-change extraction.
 * @param {string} raw
 * @returns {StructuredVoice}
 */
export function parseRound3Structure(raw) {
  const text = String(raw ?? '')
  if (!text.trim() || text.includes('took longer than')) {
    return emptyStructure(text, 'raw_response')
  }

  const json = tryParseJsonObject(text)
  /** @type {BabelPositionChange[]} */
  const changes = []
  if (json && Array.isArray(json.changes)) {
    for (const item of json.changes) {
      if (!item || typeof item !== 'object') continue
      const o = /** @type {Record<string, unknown>} */ (item)
      const action = String(o.action ?? o.verb ?? '')
        .toLowerCase()
        .trim()
      if (
        action !== 'preserved' &&
        action !== 'narrowed' &&
        action !== 'amended' &&
        action !== 'withdrawn'
      ) {
        continue
      }
      const claimId = String(o.claimId ?? o.id ?? '').trim()
      if (!claimId) continue
      changes.push({
        claimId,
        action: /** @type {BabelPositionChange['action']} */ (action),
        revisedId: o.revisedId ? String(o.revisedId) : action === 'narrowed' || action === 'amended' ? `${claimId}′` : null,
        text: o.text ? String(o.text) : '',
        reason: o.reason ? String(o.reason) : '',
      })
    }
  } else {
    const re =
      /((?:[ABC]-)?C\d+[′']?)\s*[:.\-\u2013\u2014]?\s*(preserved|narrowed|amended|withdrawn)\b(?:\s*[:.\-\u2013\u2014]\s*(.+))?/gi
    let m
    while ((m = re.exec(text)) !== null) {
      const action = /** @type {BabelPositionChange['action']} */ (
        m[2].toLowerCase()
      )
      const claimId = m[1]
      changes.push({
        claimId,
        action,
        revisedId:
          action === 'narrowed' || action === 'amended' ? `${claimId}′` : null,
        text: m[3]?.trim() ?? '',
        reason: '',
      })
    }
  }

  if (changes.length > 0) {
    return {
      extraction: 'structured',
      stance: null,
      claims: [],
      counterpoints: [],
      changes,
      unparsed: '',
      raw: text,
    }
  }

  return emptyStructure(text, 'raw_response')
}

/**
 * @param {string} raw
 * @param {ExtractionState} extraction
 * @returns {StructuredVoice}
 */
function emptyStructure(raw, extraction) {
  return {
    extraction,
    stance: null,
    claims: [],
    counterpoints: [],
    changes: [],
    unparsed: '',
    raw: String(raw ?? ''),
  }
}

/**
 * Collect claim IDs from round-1 structures for linking.
 * @param {Partial<Record<'a'|'b'|'c', StructuredVoice | null | undefined>>} round1
 */
export function collectClaimIds(round1) {
  /** @type {Set<string>} */
  const ids = new Set()
  for (const key of /** @type {const} */ (['a', 'b', 'c'])) {
    const s = round1?.[key]
    if (!s?.claims) continue
    for (const c of s.claims) {
      if (c.id) ids.add(c.id.toUpperCase())
    }
  }
  return ids
}
