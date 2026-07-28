/**
 * Inspectable synthesis lineage: claim registry and finding enrichment.
 * Raw responses remain the source of truth; structures are interpretation.
 */

import { roleLabel } from './babelRoles.js'
import { parseDecisionArtifact } from './parseDecisionArtifact.js'

/** @typedef {'round_1' | 'round_2' | 'round_3' | 'synthesis'} RoundId */
/** @typedef {'new' | 'kept' | 'narrowed' | 'expanded' | 'revised' | 'withdrawn' | 'unknown'} ClaimEvolution */
/** @typedef {'not_checked' | 'model_supplied' | 'retrieved_unverified' | 'verified' | 'inaccessible'} EvidenceVerification */
/** @typedef {'complete' | 'partial' | 'unavailable'} LineageStatus */
/** @typedef {'structured' | 'partially_structured' | 'raw_only' | 'structure_failed'} StructureStatus */

/**
 * @param {'a'|'b'|'c'} agentKey
 * @param {1|2|3} roundNum
 */
export function responseIdFor(agentKey, roundNum) {
  return `voice-r${roundNum}-${agentKey}`
}

/**
 * @param {string} claimId
 */
export function normalizeClaimId(claimId) {
  return String(claimId ?? '')
    .trim()
    .toUpperCase()
    .replace(/'/g, '′')
}

/**
 * Map extraction status onto StructureStatus vocabulary.
 * @param {string | null | undefined} extraction
 * @returns {StructureStatus}
 */
export function toStructureStatus(extraction) {
  const e = String(extraction ?? '')
  if (e === 'structured') return 'structured'
  if (e === 'partially_structured') return 'partially_structured'
  if (e === 'structure_failed') return 'structure_failed'
  return 'raw_only'
}

/**
 * Map Round 3 action onto ClaimEvolution.
 * @param {string | null | undefined} action
 * @returns {ClaimEvolution}
 */
export function evolutionFromAction(action) {
  const a = String(action ?? '').toLowerCase()
  if (a === 'preserved') return 'kept'
  if (a === 'narrowed') return 'narrowed'
  if (a === 'amended') return 'revised'
  if (a === 'withdrawn') return 'withdrawn'
  if (a === 'expanded') return 'expanded'
  if (a === 'new') return 'new'
  return 'unknown'
}

/**
 * Evidence status from claim evidence array; never claims verification.
 * @param {{ evidence?: string[] } | null | undefined} claim
 * @returns {EvidenceVerification}
 */
export function evidenceStateForClaim(claim) {
  const ev = claim?.evidence
  if (Array.isArray(ev) && ev.some((x) => String(x).trim())) {
    return 'model_supplied'
  }
  return 'not_checked'
}

/**
 * Human label for evidence state (honest wording only).
 * @param {EvidenceVerification} state
 */
export function evidenceLabel(state) {
  switch (state) {
    case 'model_supplied':
      return 'Citation supplied by model'
    case 'retrieved_unverified':
      return 'Source retrieved but not verified'
    case 'inaccessible':
      return 'Source inaccessible'
    case 'verified':
      return 'Independently verified'
    case 'not_checked':
    default:
      return 'Not independently verified'
  }
}

/**
 * Build immutable voice records from forge state (additive overlay).
 * Does not mutate raw text.
 * @param {Record<string, unknown>} state
 * @returns {Record<string, import('./lineageTypes.js').RawVoiceResponse>}
 */
export function buildVoiceRecords(state) {
  /** @type {Record<string, any>} */
  const out = {}
  const roles = /** @type {any} */ (state).roles ?? {}
  const config = /** @type {any} */ (state).config ?? {}
  const debateId =
    typeof state.debateId === 'string' && state.debateId
      ? state.debateId
      : 'session'
  const specs = {
    a: config.agentA,
    b: config.agentB,
    c: config.agentC,
  }
  const structures = /** @type {any} */ (state).structures ?? {}

  const r1 = Array.isArray(state.rounds)
    ? state.rounds.find((r) => r.roundNum === 1) ?? state.rounds[0]
    : null
  const rev = Array.isArray(state.reviews)
    ? state.reviews.find((r) => r.roundNum === 1) ?? state.reviews[0]
    : null
  const finals = /** @type {any} */ (state).finalPositions ?? {}
  const timers = {
    1: /** @type {any} */ (state).agentTimers ?? {},
    2: /** @type {any} */ (state).reviewTimers ?? {},
    3: /** @type {any} */ (state).finalPositionTimers ?? {},
  }

  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const roleId = roles[agent]
    const modelId = specs[agent]?.model ?? specs[agent]?.name ?? 'unknown'
    const modelName = specs[agent]?.name ?? 'Model'

    const texts = {
      1:
        agent === 'a'
          ? r1?.agentA
          : agent === 'b'
            ? r1?.agentB
            : r1?.agentC,
      2:
        agent === 'a'
          ? rev?.aReviews
          : agent === 'b'
            ? rev?.bReviews
            : rev?.cReviews,
      3: finals[agent],
    }
    const structBags = {
      1: structures.round1?.[agent],
      2: structures.round2?.[agent],
      3: structures.round3?.[agent],
    }

    for (const roundNum of /** @type {const} */ ([1, 2, 3])) {
      const raw = texts[roundNum]
      if (typeof raw !== 'string' || !raw.length) continue
      const id = responseIdFor(agent, roundNum)
      const t = timers[roundNum]?.[agent]
      const createdAt =
        t?.endTime != null
          ? new Date(t.endTime).toISOString()
          : t?.startTime != null
            ? new Date(t.startTime).toISOString()
            : new Date().toISOString()
      out[id] = {
        responseId: id,
        debateId,
        roundId: /** @type {RoundId} */ (`round_${roundNum}`),
        agentId: agent,
        roleId: roleId ?? undefined,
        roleLabel: roleLabel(roleId),
        modelId,
        modelName,
        providerId: undefined,
        rawText: raw,
        createdAt,
        structureStatus: toStructureStatus(structBags[roundNum]?.extraction),
      }
    }
  }
  return out
}

/**
 * Build claim reference registry from structures + voice records.
 * @param {Record<string, unknown>} state
 * @returns {Record<string, import('./lineageTypes.js').ClaimReference>}
 */
export function buildClaimRegistry(state) {
  const voiceRecords = buildVoiceRecords(state)
  const structures = /** @type {any} */ (state).structures ?? {}
  const roles = /** @type {any} */ (state).roles ?? {}
  const config = /** @type {any} */ (state).config ?? {}
  const debateId =
    typeof state.debateId === 'string' && state.debateId
      ? state.debateId
      : 'session'
  const specs = {
    a: config.agentA,
    b: config.agentB,
    c: config.agentC,
  }

  /** @type {Record<string, any>} */
  const registry = {}

  // Round 1 claims
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const bag = structures.round1?.[agent]
    const claims = bag?.claims ?? []
    const responseId = responseIdFor(agent, 1)
    for (const claim of claims) {
      if (!claim?.id || !claim?.text) continue
      const key = normalizeClaimId(claim.id)
      registry[key] = {
        claimId: claim.id,
        responseId,
        debateId,
        roundId: 'round_1',
        agentId: agent,
        roleId: roles[agent],
        roleLabel: roleLabel(roles[agent]),
        modelId: specs[agent]?.model ?? specs[agent]?.name ?? 'unknown',
        modelName: specs[agent]?.name ?? 'Model',
        text: claim.text,
        evidenceState: evidenceStateForClaim(claim),
        citationIds: Array.isArray(claim.evidence)
          ? claim.evidence.map((_, i) => `${claim.id}-ev-${i}`)
          : [],
        evidenceTexts: Array.isArray(claim.evidence) ? claim.evidence : [],
        evolution: 'new',
        challengedByClaimIds: [],
        supportsClaimIds: [],
        structureStatus: toStructureStatus(bag?.extraction),
      }
    }
  }

  // Round 2 counterpoints → challenges
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const bag = structures.round2?.[agent]
    const cps = bag?.counterpoints ?? []
    const responseId = responseIdFor(agent, 2)
    cps.forEach((cp, i) => {
      if (!cp?.text) return
      const challengeId = normalizeClaimId(
        `${agent.toUpperCase()}-CP${i + 1}`
      )
      const targetKey = cp.targetClaimId
        ? normalizeClaimId(cp.targetClaimId)
        : null
      registry[challengeId] = {
        claimId: `${agent.toUpperCase()}-CP${i + 1}`,
        responseId,
        debateId,
        roundId: 'round_2',
        agentId: agent,
        roleId: roles[agent],
        roleLabel: roleLabel(roles[agent]),
        modelId: specs[agent]?.model ?? specs[agent]?.name ?? 'unknown',
        modelName: specs[agent]?.name ?? 'Model',
        text: cp.text,
        evidenceState: 'not_checked',
        citationIds: [],
        evidenceTexts: [],
        evolution: 'new',
        challengedByClaimIds: [],
        supportsClaimIds: [],
        challengesClaimId: targetKey && registry[targetKey] ? targetKey : null,
        linked: Boolean(cp.linked && targetKey && registry[targetKey]),
        structureStatus: toStructureStatus(bag?.extraction),
      }
      if (targetKey && registry[targetKey] && cp.linked) {
        const list = registry[targetKey].challengedByClaimIds ?? []
        if (!list.includes(challengeId)) {
          registry[targetKey].challengedByClaimIds = [...list, challengeId]
        }
      }
    })
  }

  // Round 3 position changes: new claim versions, never overwrite R1 text
  for (const agent of /** @type {const} */ (['a', 'b', 'c'])) {
    const bag = structures.round3?.[agent]
    const changes = bag?.changes ?? []
    const responseId = responseIdFor(agent, 3)
    for (const ch of changes) {
      if (!ch?.claimId) continue
      const priorKey = normalizeClaimId(ch.claimId)
      const prior = registry[priorKey]
      const evolution = evolutionFromAction(ch.action)
      const revisedId =
        ch.revisedId ||
        (evolution === 'narrowed' || evolution === 'revised'
          ? `${ch.claimId}′`
          : null)
      if (prior) {
        prior.evolution = evolution
        if (revisedId) {
          prior.revisedByClaimId = normalizeClaimId(revisedId)
        }
      }
      if (
        revisedId &&
        (evolution === 'narrowed' ||
          evolution === 'revised' ||
          evolution === 'expanded')
      ) {
        const key = normalizeClaimId(revisedId)
        registry[key] = {
          claimId: revisedId,
          responseId,
          debateId,
          roundId: 'round_3',
          agentId: agent,
          roleId: roles[agent],
          roleLabel: roleLabel(roles[agent]),
          modelId: specs[agent]?.model ?? specs[agent]?.name ?? 'unknown',
          modelName: specs[agent]?.name ?? 'Model',
          text: ch.text || prior?.text || '',
          evidenceState: 'not_checked',
          citationIds: [],
          evidenceTexts: [],
          evolution,
          supersedesClaimId: priorKey,
          challengedByClaimIds: prior?.challengedByClaimIds
            ? [...prior.challengedByClaimIds]
            : [],
          supportsClaimIds: [],
          changeReason: ch.reason || '',
          structureStatus: toStructureStatus(bag?.extraction),
        }
        if (prior) {
          prior.revisedByClaimId = key
        }
      }
      if (evolution === 'withdrawn' && prior) {
        prior.evolution = 'withdrawn'
        prior.withdrawnInResponseId = responseId
        prior.changeReason = ch.reason || ''
      }
      if (evolution === 'kept' && prior) {
        prior.evolution = 'kept'
        prior.changeReason = ch.reason || ''
      }
    }
  }

  return registry
}

/**
 * Map finding kind onto SynthesisFindingType.
 * @param {string} kind
 */
export function findingTypeFromKind(kind) {
  switch (kind) {
    case 'agreement':
      return 'agreement'
    case 'disagreement':
      return 'central_disagreement'
    case 'support':
      return 'strong_evidence'
    case 'weak':
      return 'weak_assumption'
    case 'minority':
      return 'minority_report'
    case 'change':
      return 'reversal_condition'
    case 'next':
      return 'recommendation'
    case 'frame':
      return 'unknown'
    default:
      return 'unknown'
  }
}

/**
 * Validate and enrich synthesis findings against the claim registry.
 * Invalid IDs are removed; lineageStatus set honestly.
 * Withdrawn claims cannot support a conclusion.
 *
 * @param {import('./parseDecisionArtifact.js').DecisionArtifact | null | undefined} artifact
 * @param {Record<string, any>} registry
 * @param {{ hasStructures?: boolean }} [opts]
 * @returns {{
 *   findings: import('./lineageTypes.js').EnrichedSynthesisFinding[],
 *   invalidReferences: { findingId: string, claimId: string }[],
 *   debateLineageStatus: LineageStatus,
 * }}
 */
export function enrichSynthesisFindings(artifact, registry, opts = {}) {
  const hasRegistry = Object.keys(registry).length > 0
  const hasStructures = opts.hasStructures !== false && hasRegistry
  /** @type {{ findingId: string, claimId: string }[]} */
  const invalidReferences = []

  if (!artifact?.findings?.length) {
    return {
      findings: [],
      invalidReferences,
      debateLineageStatus: hasStructures ? 'partial' : 'unavailable',
    }
  }

  if (!hasStructures) {
    return {
      findings: artifact.findings.map((f) => ({
        findingId: f.id,
        type: findingTypeFromKind(f.kind),
        text: f.text,
        supportingClaimIds: [],
        challengingClaimIds: [],
        relatedClaimIds: [],
        lineageStatus: /** @type {LineageStatus} */ ('unavailable'),
        limitation:
          'Lineage unavailable for this debate. Organized response was not recorded.',
        kind: f.kind,
      })),
      invalidReferences,
      debateLineageStatus: 'unavailable',
    }
  }

  const findings = artifact.findings.map((f) => {
    const rawIds = Array.isArray(f.claimIds) ? f.claimIds : []
    /** @type {string[]} */
    const supporting = []
    /** @type {string[]} */
    const challenging = []
    /** @type {string[]} */
    const related = []

    for (const raw of rawIds) {
      const key = normalizeClaimId(raw)
      const ref = registry[key]
      if (!ref) {
        invalidReferences.push({ findingId: f.id, claimId: raw })
        continue
      }
      if (ref.evolution === 'withdrawn') {
        // Withdrawn claims do not support conclusions
        related.push(ref.claimId)
        continue
      }
      if (ref.roundId === 'round_2' && ref.challengesClaimId) {
        challenging.push(ref.claimId)
        continue
      }
      supporting.push(ref.claimId)
      // Collect challenges against supporting claims
      for (const chId of ref.challengedByClaimIds ?? []) {
        if (!challenging.includes(chId)) challenging.push(chId)
      }
    }

    // Also pull challenges from FINDINGS-JSON challengingClaimIds if present
    if (Array.isArray(/** @type {any} */ (f).challengingClaimIds)) {
      for (const raw of /** @type {any} */ (f).challengingClaimIds) {
        const key = normalizeClaimId(raw)
        const ref = registry[key]
        if (!ref) {
          invalidReferences.push({ findingId: f.id, claimId: raw })
          continue
        }
        if (!challenging.includes(ref.claimId)) challenging.push(ref.claimId)
      }
    }

    let lineageStatus = /** @type {LineageStatus} */ ('unavailable')
    /** @type {string | undefined} */
    let limitation

    const intended = rawIds.length
    const resolved = supporting.length + challenging.length + related.length

    if (intended === 0 && supporting.length === 0) {
      lineageStatus = 'unavailable'
      limitation =
        'The synthesis did not cite claim IDs for this finding, so lineage cannot be assembled.'
    } else if (resolved === 0 && intended > 0) {
      lineageStatus = 'unavailable'
      limitation =
        'Cited claim IDs could not be matched to stored claims. Invalid references were removed.'
    } else if (invalidReferences.some((x) => x.findingId === f.id) || related.length) {
      lineageStatus = 'partial'
      const parts = []
      if (invalidReferences.some((x) => x.findingId === f.id)) {
        parts.push('Some cited claim IDs were invalid and were removed.')
      }
      if (related.length) {
        parts.push(
          'A withdrawn claim was cited and is shown as related, not supporting.'
        )
      }
      limitation = parts.join(' ')
    } else {
      lineageStatus = 'complete'
      // Still note when evidence was never verified
      if (
        supporting.some((id) => {
          const r = registry[normalizeClaimId(id)]
          return r?.evidenceState === 'model_supplied'
        })
      ) {
        // complete lineage, but limitation about verification is honest
        limitation =
          'Citations were supplied by models and were not independently verified.'
      }
      if (
        supporting.some((id) => {
          const r = registry[normalizeClaimId(id)]
          return r?.structureStatus === 'partially_structured'
        })
      ) {
        limitation = limitation
          ? `${limitation} Some claims were extracted from free text.`
          : 'Some claims were extracted from free text.'
      }
    }

    return {
      findingId: f.id,
      type: findingTypeFromKind(f.kind),
      text: f.text,
      supportingClaimIds: supporting,
      challengingClaimIds: challenging,
      relatedClaimIds: related,
      lineageStatus,
      limitation,
      kind: f.kind,
    }
  })

  const statuses = findings.map((f) => f.lineageStatus)
  let debateLineageStatus = /** @type {LineageStatus} */ ('unavailable')
  if (statuses.every((s) => s === 'complete')) debateLineageStatus = 'complete'
  else if (statuses.some((s) => s === 'complete' || s === 'partial'))
    debateLineageStatus = 'partial'

  return { findings, invalidReferences, debateLineageStatus }
}

/**
 * Deterministic argument trace steps for a claim when relationships exist.
 * @param {any} claim
 * @param {Record<string, any>} registry
 * @param {string[]} [criteria]
 */
export function buildDeterministicTrace(claim, registry, criteria = []) {
  if (!claim) return []
  /** @type {{ label: string, claimId?: string }[]} */
  const steps = [
    {
      label: `${claim.roleLabel || 'Voice'} ${claim.claimId}`,
      claimId: claim.claimId,
    },
  ]
  for (const chId of claim.challengedByClaimIds ?? []) {
    const ch = registry[normalizeClaimId(chId)]
    if (!ch) continue
    steps.push({
      label: `${ch.roleLabel || 'Voice'} challenges evidence`,
      claimId: ch.claimId,
    })
  }
  if (claim.revisedByClaimId) {
    const rev = registry[normalizeClaimId(claim.revisedByClaimId)]
    if (rev) {
      steps.push({
        label: `${rev.roleLabel || 'Voice'} ${rev.evolution} to ${rev.claimId}`,
        claimId: rev.claimId,
      })
    }
  } else if (claim.evolution && claim.evolution !== 'new') {
    steps.push({
      label: `${claim.roleLabel || 'Voice'} ${claim.evolution} ${claim.claimId}`,
      claimId: claim.claimId,
    })
  }
  if (criteria[0] && claim.evolution && claim.evolution !== 'withdrawn') {
    steps.push({ label: `retained under criterion: ${criteria[0]}` })
  }
  return steps.length > 1 ? steps : []
}

/**
 * Full lineage bundle for the UI.
 * @param {Record<string, unknown>} state
 */
export function buildLineageBundle(state) {
  const voiceRecords = buildVoiceRecords(state)
  const registry = buildClaimRegistry(state)
  let artifact =
    /** @type {any} */ (state).synthesis?.decisionArtifact ?? null

  if (!artifact?.findings?.length) {
    const output = /** @type {any} */ (state).synthesis?.output
    if (typeof output === 'string' && output.trim()) {
      artifact = parseDecisionArtifact(output)
    }
  }

  const hasStructures = Object.keys(registry).some(
    (k) => registry[k].roundId === 'round_1'
  )
  const enriched = enrichSynthesisFindings(artifact, registry, {
    hasStructures,
  })

  if (enriched.invalidReferences.length) {
    console.warn(
      '[babel:lineage] Invalid synthesis claim references removed:',
      enriched.invalidReferences
    )
  }

  return {
    voiceRecords,
    registry,
    ...enriched,
    artifact,
  }
}
