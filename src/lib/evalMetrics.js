/**
 * Phase B evaluation metrics (§10): computed from forge state after a run.
 */

/**
 * @param {Record<string, unknown>} state
 * @returns {Record<string, unknown>}
 */
export function computeEvalMetrics(state) {
  const structures =
    /** @type {{
     *   round1?: Record<string, { extraction?: string, claims?: unknown[] } | null>,
     *   round2?: Record<string, { extraction?: string, counterpoints?: { linked?: boolean }[] } | null>,
     *   round3?: Record<string, { extraction?: string, changes?: { action?: string }[] } | null>,
     * }} */ (state.structures ?? {})

  const voices = /** @type {const} */ (['a', 'b', 'c'])
  let structured = 0
  let partial = 0
  let raw = 0
  let failed = 0
  let claimCount = 0
  let linkedCp = 0
  let unlinkedCp = 0
  let preserved = 0
  let narrowed = 0
  let amended = 0
  let withdrawn = 0

  for (const v of voices) {
    const r1 = structures.round1?.[v]
    const ext = r1?.extraction ?? 'raw_response'
    if (ext === 'structured') structured += 1
    else if (ext === 'partially_structured') partial += 1
    else if (ext === 'structure_failed') failed += 1
    else raw += 1
    claimCount += Array.isArray(r1?.claims) ? r1.claims.length : 0

    const cps = structures.round2?.[v]?.counterpoints ?? []
    for (const cp of cps) {
      if (cp.linked) linkedCp += 1
      else unlinkedCp += 1
    }

    const changes = structures.round3?.[v]?.changes ?? []
    for (const ch of changes) {
      if (ch.action === 'preserved') preserved += 1
      else if (ch.action === 'narrowed') narrowed += 1
      else if (ch.action === 'amended') amended += 1
      else if (ch.action === 'withdrawn') withdrawn += 1
    }
  }

  const artifact =
    /** @type {{ findings?: { claimIds?: string[] }[], minorityReport?: string } | null} */ (
      /** @type {any} */ (state.synthesis)?.decisionArtifact ?? null
    )
  const findings = artifact?.findings ?? []
  const findingsWithClaims = findings.filter(
    (f) => Array.isArray(f.claimIds) && f.claimIds.length > 0
  ).length
  const minorityPresent = Boolean(artifact?.minorityReport?.trim())

  const timers = [
    state.agentTimers,
    state.reviewTimers,
    state.finalPositionTimers,
  ]
  /** @type {number[]} */
  const latencies = []
  for (const bag of timers) {
    if (!bag || typeof bag !== 'object') continue
    for (const v of voices) {
      const t = /** @type {any} */ (bag)[v]
      if (t?.startTime != null && t?.endTime != null) {
        latencies.push(Math.max(0, t.endTime - t.startTime))
      }
    }
  }
  latencies.sort((a, b) => a - b)
  const medianMs =
    latencies.length === 0
      ? null
      : latencies.length % 2 === 1
        ? latencies[(latencies.length - 1) / 2]
        : Math.round(
            (latencies[latencies.length / 2 - 1] +
              latencies[latencies.length / 2]) /
              2
          )
  const p95Ms =
    latencies.length === 0
      ? null
      : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]

  const substantiveChangeRate =
    preserved + narrowed + amended + withdrawn === 0
      ? null
      : (narrowed + amended + withdrawn) /
        (preserved + narrowed + amended + withdrawn)

  return {
    schemaVersion: 1,
    status: state.status ?? null,
    roles: state.roles ?? null,
    criteria: state.decisionCriteria ?? [],
    extraction: {
      structured,
      partially_structured: partial,
      raw_response: raw,
      structure_failed: failed,
      claimCount,
    },
    counterpoints: {
      linked: linkedCp,
      unlinked: unlinkedCp,
      mappingErrorProxy:
        linkedCp + unlinkedCp === 0
          ? null
          : unlinkedCp / (linkedCp + unlinkedCp),
    },
    positionChanges: {
      preserved,
      narrowed,
      amended,
      withdrawn,
      substantiveChangeRate,
    },
    synthesis: {
      hasArtifact: Boolean(artifact),
      findings: findings.length,
      findingsWithClaimLinks: findingsWithClaims,
      traceabilityRate:
        findings.length === 0 ? null : findingsWithClaims / findings.length,
      minorityPresent,
    },
    latency: {
      segments: latencies.length,
      medianMs,
      p95Ms,
      totalMs: latencies.reduce((a, b) => a + b, 0),
    },
    progressCallsCompleted: state.progressCallsCompleted ?? 0,
    voiceErrors: {
      a: Boolean(/** @type {any} */ (state).voiceErrors?.a),
      b: Boolean(/** @type {any} */ (state).voiceErrors?.b),
      c: Boolean(/** @type {any} */ (state).voiceErrors?.c),
    },
  }
}
