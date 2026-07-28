/**
 * @typedef {import('./synthesisLineage.js').RoundId} RoundId
 * @typedef {import('./synthesisLineage.js').ClaimEvolution} ClaimEvolution
 * @typedef {import('./synthesisLineage.js').EvidenceVerification} EvidenceVerification
 * @typedef {import('./synthesisLineage.js').LineageStatus} LineageStatus
 * @typedef {import('./synthesisLineage.js').StructureStatus} StructureStatus
 */

/**
 * @typedef {{
 *   responseId: string,
 *   debateId: string,
 *   roundId: RoundId,
 *   agentId: string,
 *   roleId?: string,
 *   roleLabel?: string,
 *   modelId: string,
 *   modelName?: string,
 *   providerId?: string,
 *   rawText: string,
 *   createdAt: string,
 *   structureStatus?: StructureStatus,
 * }} RawVoiceResponse
 */

/**
 * @typedef {{
 *   claimId: string,
 *   responseId: string,
 *   debateId: string,
 *   roundId: RoundId,
 *   agentId: string,
 *   roleId?: string,
 *   roleLabel?: string,
 *   modelId: string,
 *   modelName?: string,
 *   text: string,
 *   sourceQuote?: string,
 *   sourceStart?: number,
 *   sourceEnd?: number,
 *   evidenceState?: EvidenceVerification,
 *   citationIds?: string[],
 *   evidenceTexts?: string[],
 *   evolution?: ClaimEvolution,
 *   supersedesClaimId?: string,
 *   revisedByClaimId?: string,
 *   challengedByClaimIds?: string[],
 *   supportsClaimIds?: string[],
 *   challengesClaimId?: string | null,
 *   linked?: boolean,
 *   changeReason?: string,
 *   withdrawnInResponseId?: string,
 *   structureStatus?: StructureStatus,
 * }} ClaimReference
 */

/**
 * @typedef {{
 *   findingId: string,
 *   type: string,
 *   text: string,
 *   supportingClaimIds: string[],
 *   challengingClaimIds: string[],
 *   relatedClaimIds?: string[],
 *   lineageStatus: LineageStatus,
 *   limitation?: string,
 *   kind?: string,
 * }} EnrichedSynthesisFinding
 */

export {}
