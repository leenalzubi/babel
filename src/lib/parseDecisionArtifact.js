/**
 * Parse the flagship 8-section decision synthesis.
 * Falls back gracefully when sections are missing.
 */

/**
 * @typedef {{
 *   id: string,
 *   text: string,
 *   claimIds: string[],
 *   challengingClaimIds?: string[],
 *   kind: 'agreement' | 'disagreement' | 'support' | 'weak' | 'minority' | 'change' | 'next' | 'frame',
 * }} SynthesisFinding
 *
 * @typedef {{
 *   framed: string,
 *   agreement: string,
 *   disagreement: string,
 *   strongestSupport: string,
 *   weakestAssumptions: string,
 *   minorityReport: string,
 *   whatWouldChange: string,
 *   recommendedNextStep: string,
 *   findings: SynthesisFinding[],
 * }} DecisionArtifact
 */

const SECTION_MARKERS = [
  ['framed', '---FRAMED---'],
  ['agreement', '---AGREEMENT---'],
  ['disagreement', '---DISAGREEMENT---'],
  ['strongestSupport', '---STRONGEST-SUPPORT---'],
  ['weakestAssumptions', '---WEAKEST-ASSUMPTIONS---'],
  ['minorityReport', '---MINORITY-REPORT---'],
  ['whatWouldChange', '---WHAT-WOULD-CHANGE---'],
  ['recommendedNextStep', '---NEXT-STEP---'],
]

const FINDINGS_JSON = '---FINDINGS-JSON---'

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
 * @param {string} body
 * @returns {string[]}
 */
function extractClaimIds(body) {
  const ids = []
  const re = /\b((?:[ABC]-)?C\d+[′']?)\b/gi
  let m
  while ((m = re.exec(body)) !== null) {
    ids.push(m[1].toUpperCase())
  }
  return [...new Set(ids)]
}

/**
 * @param {string} id
 * @returns {SynthesisFinding['kind'] | null}
 */
function kindFromFindingId(id) {
  const s = String(id || '').toLowerCase()
  if (s === 'framed' || s === 'frame') return 'frame'
  if (s === 'agreement') return 'agreement'
  if (
    s === 'disagreement' ||
    s === 'central_disagreement' ||
    s === 'central-disagreement'
  )
    return 'disagreement'
  if (
    s === 'strongestsupport' ||
    s === 'strong_evidence' ||
    s === 'strong-evidence' ||
    s === 'support'
  )
    return 'support'
  if (
    s === 'weakestassumptions' ||
    s === 'weak_assumption' ||
    s === 'weak-assumption' ||
    s === 'weak'
  )
    return 'weak'
  if (s === 'minorityreport' || s === 'minority_report' || s === 'minority')
    return 'minority'
  if (
    s === 'whatwouldchange' ||
    s === 'reversal_condition' ||
    s === 'reversal-condition' ||
    s === 'change'
  )
    return 'change'
  if (
    s === 'recommendednextstep' ||
    s === 'next-step' ||
    s === 'recommendation' ||
    s === 'next'
  )
    return 'next'
  return null
}

/**
 * @param {string} id
 */
function sectionKeyFromFindingId(id) {
  const kind = kindFromFindingId(id)
  const map = {
    frame: 'framed',
    agreement: 'agreement',
    disagreement: 'disagreement',
    support: 'strongestSupport',
    weak: 'weakestAssumptions',
    minority: 'minorityReport',
    change: 'whatWouldChange',
    next: 'recommendedNextStep',
  }
  return kind ? map[kind] : String(id)
}

/**
 * Parse optional FINDINGS-JSON block.
 * @param {string} text
 * @returns {SynthesisFinding[]}
 */
function parseFindingsJson(text) {
  const block = sliceBetween(text, FINDINGS_JSON, [
    '---ATTRIBUTIONS---',
    '---CONCESSIONS---',
    '---HELD-FIRM---',
    '---RATIONALE---',
  ])
  if (!block) return []
  const start = block.indexOf('[')
  const end = block.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const arr = JSON.parse(block.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    /** @type {SynthesisFinding[]} */
    const out = []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const o = /** @type {Record<string, unknown>} */ (item)
      const rawId = String(o.findingId ?? o.id ?? '').trim()
      const kind = kindFromFindingId(rawId) || kindFromFindingId(String(o.type ?? ''))
      if (!kind) continue
      const id = sectionKeyFromFindingId(rawId)
      const textBody = String(o.text ?? '').trim()
      if (!textBody) continue
      const supporting = Array.isArray(o.supportingClaimIds)
        ? o.supportingClaimIds.map((x) => String(x).toUpperCase())
        : []
      const challenging = Array.isArray(o.challengingClaimIds)
        ? o.challengingClaimIds.map((x) => String(x).toUpperCase())
        : []
      const fromText = extractClaimIds(textBody)
      out.push({
        id,
        text: textBody,
        claimIds: [...new Set([...supporting, ...fromText])],
        challengingClaimIds: challenging,
        kind,
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * @param {string} raw
 * @returns {DecisionArtifact}
 */
export function parseDecisionArtifact(raw) {
  const text = String(raw ?? '').trim()
  const markerList = [
    ...SECTION_MARKERS.map(([, m]) => m),
    FINDINGS_JSON,
    '---ATTRIBUTIONS---',
  ]

  /** @type {Record<string, string>} */
  const sections = {}
  for (let i = 0; i < SECTION_MARKERS.length; i++) {
    const [key, marker] = SECTION_MARKERS[i]
    const ends = markerList.filter((m) => m !== marker)
    sections[key] = sliceBetween(text, marker, ends)
  }

  const hasAny = Object.values(sections).some(Boolean)
  const fromJson = parseFindingsJson(text)

  /** @type {SynthesisFinding[]} */
  const findings = []
  /** @type {Array<[string, SynthesisFinding['kind']]>} */
  const map = [
    ['framed', 'frame'],
    ['agreement', 'agreement'],
    ['disagreement', 'disagreement'],
    ['strongestSupport', 'support'],
    ['weakestAssumptions', 'weak'],
    ['minorityReport', 'minority'],
    ['whatWouldChange', 'change'],
    ['recommendedNextStep', 'next'],
  ]

  for (const [key, kind] of map) {
    const jsonHit = fromJson.find((f) => f.id === key || f.kind === kind)
    const body = jsonHit?.text || sections[key]
    if (!body) continue
    const claimIds = [
      ...new Set([
        ...(jsonHit?.claimIds ?? []),
        ...extractClaimIds(body),
      ]),
    ]
    findings.push({
      id: key,
      text: body,
      claimIds,
      challengingClaimIds: jsonHit?.challengingClaimIds ?? [],
      kind,
    })
  }

  if (!hasAny && !fromJson.length && text) {
    findings.push({
      id: 'framed',
      text,
      claimIds: extractClaimIds(text),
      kind: 'frame',
    })
    return {
      framed: text,
      agreement: '',
      disagreement: '',
      strongestSupport: '',
      weakestAssumptions: '',
      minorityReport: '',
      whatWouldChange: '',
      recommendedNextStep: '',
      findings,
    }
  }

  return {
    framed: sections.framed || findings.find((f) => f.id === 'framed')?.text || '',
    agreement:
      sections.agreement ||
      findings.find((f) => f.id === 'agreement')?.text ||
      '',
    disagreement:
      sections.disagreement ||
      findings.find((f) => f.id === 'disagreement')?.text ||
      '',
    strongestSupport:
      sections.strongestSupport ||
      findings.find((f) => f.id === 'strongestSupport')?.text ||
      '',
    weakestAssumptions:
      sections.weakestAssumptions ||
      findings.find((f) => f.id === 'weakestAssumptions')?.text ||
      '',
    minorityReport:
      sections.minorityReport ||
      findings.find((f) => f.id === 'minorityReport')?.text ||
      '',
    whatWouldChange:
      sections.whatWouldChange ||
      findings.find((f) => f.id === 'whatWouldChange')?.text ||
      '',
    recommendedNextStep:
      sections.recommendedNextStep ||
      findings.find((f) => f.id === 'recommendedNextStep')?.text ||
      '',
    findings,
  }
}

/**
 * Build a readable markdown body from the artifact for display / memo seed.
 * @param {DecisionArtifact} artifact
 */
export function decisionArtifactToMarkdown(artifact) {
  const parts = []
  if (artifact.framed) {
    parts.push('### Decision framed', '', artifact.framed, '')
  }
  if (artifact.agreement) {
    parts.push('### What the voices agree on', '', artifact.agreement, '')
  }
  if (artifact.disagreement) {
    parts.push('### The central disagreement', '', artifact.disagreement, '')
  }
  if (artifact.strongestSupport) {
    parts.push('### Strongest support', '', artifact.strongestSupport, '')
  }
  if (artifact.weakestAssumptions) {
    parts.push('### Weakest assumptions', '', artifact.weakestAssumptions, '')
  }
  if (artifact.minorityReport) {
    parts.push('### Minority report', '', artifact.minorityReport, '')
  }
  if (artifact.whatWouldChange) {
    parts.push(
      '### What would change the answer',
      '',
      artifact.whatWouldChange,
      ''
    )
  }
  if (artifact.recommendedNextStep) {
    parts.push(
      '### Recommended next step',
      '',
      artifact.recommendedNextStep,
      ''
    )
  }
  return parts.join('\n').trim()
}
