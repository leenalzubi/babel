import { memo, useMemo } from 'react'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import InfluenceMap from './InfluenceMap.jsx'
import SectionHeading from './SectionHeading.jsx'
import VoiceCard from './VoiceCard.jsx'
import VoiceFailureNotice from './VoiceFailureNotice.jsx'
import StructuredVoiceBody from './reasoning/StructuredVoiceBody.jsx'
import { useVoiceActions } from '../context/VoiceActionsContext.jsx'
import { useVoiceLabels } from '../hooks/useVoiceLabels.js'
import { useForge } from '../store/useForgeStore.js'
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import { buildChallengesByClaim } from '../lib/claimNavigation.js'
import { isUnavailableAgentResponse } from '../lib/debateConstants.js'

/**
 * @param {{
 *   startTime: number | null,
 *   endTime: number | null,
 * }} t
 * @returns {number | null}
 */
function segmentMs(t) {
  if (t.startTime == null || t.endTime == null) return null
  return Math.max(0, t.endTime - t.startTime)
}

/**
 * @param {{
 *   agentKey: 'a' | 'b' | 'c',
 *   agentTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   reviewTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   rebuttalTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   finalPositionTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 * }} props
 */
function useTotalDebateMs({
  agentKey,
  agentTimers,
  reviewTimers,
  rebuttalTimers,
  finalPositionTimers,
}) {
  return useMemo(() => {
    const parts = [
      segmentMs(agentTimers[agentKey] ?? {}),
      segmentMs(reviewTimers[agentKey] ?? {}),
      segmentMs(rebuttalTimers[agentKey] ?? {}),
      segmentMs(finalPositionTimers[agentKey] ?? {}),
    ].filter((v) => v != null)
    if (parts.length === 0) return null
    return parts.reduce((a, b) => a + b, 0)
  }, [agentKey, agentTimers, reviewTimers, rebuttalTimers, finalPositionTimers])
}

/** @param {{ totalMs: number | null }} props */
function TotalDebateTimer({ totalMs }) {
  if (totalMs == null) {
    return (
      <span className="babel-meta-tech text-[var(--ink-faint)]">Unavailable</span>
    )
  }
  const sec = Math.round(totalMs / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const label =
    m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
  return (
    <span
      className="babel-meta-tech text-[var(--ink-soft)]"
      title="Total time this model spent generating in this debate"
    >
      {label} total
    </span>
  )
}

/**
 * @param {{
 *   agentKey: 'a' | 'b' | 'c',
 *   agentSpec: { name: string, color: string },
 *   text: string,
 *   finalTimer: { startTime: number | null, endTime: number | null },
 *   totalMs: number | null,
 * }} props
 */
function FinalColumn({ agentKey, agentSpec, text, finalTimer, totalMs }) {
  const voiceActions = useVoiceActions()
  const { state } = useForge()
  const { roleTitle, modelName } = useVoiceLabels(agentKey, agentSpec)
  const structure = state.structures?.round3?.[agentKey] ?? null
  const criterion = state.decisionCriteria?.[0] ?? null
  const challengesByClaim = buildChallengesByClaim({
    agentKey,
    structures: state.structures,
    roles: state.roles,
  })

  const hasText = typeof text === 'string' && text.length > 0
  const live =
    finalTimer.startTime != null && finalTimer.endTime == null

  if (hasText) {
    if (isUnavailableAgentResponse(text)) {
      return (
        <VoiceFailureNotice
          agentName={`${roleTitle} (${modelName})`}
          agentKey={agentKey}
          message={text}
          stageLabel="Final answer"
          busy={Boolean(voiceActions?.voiceBusy)}
          onRetry={
            voiceActions
              ? () => void voiceActions.retryVoice(agentKey, 'final_answers')
              : null
          }
          onContinueWithout={
            voiceActions
              ? () => voiceActions.continueWithout(agentKey)
              : null
          }
        />
      )
    }
    return (
      <VoiceCard
        title={roleTitle}
        subtitle={modelName}
        color={agentSpec.color}
        stance="revision"
        responseState="done"
        extractionState={structure?.extraction ?? 'raw_response'}
        responseDomId={`voice-r3-${agentKey}`}
        regionLabel={`${roleTitle} (${modelName}) final position`}
        foot={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {finalTimer.startTime != null ? (
              <AgentTimer
                startTime={finalTimer.startTime}
                endTime={finalTimer.endTime}
              />
            ) : (
              <span />
            )}
            <TotalDebateTimer totalMs={totalMs} />
          </div>
        }
      >
        <StructuredVoiceBody
          rawText={text}
          structure={structure}
          roleLabel={roleTitle}
          challengesByClaim={challengesByClaim}
          criterion={criterion}
        />
      </VoiceCard>
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={roleTitle}
        subtitle={modelName}
        color={agentSpec.color}
        line="Preserving, narrowing, amending, or withdrawing…"
        startTime={finalTimer.startTime}
        endTime={finalTimer.endTime}
      />
    )
  }

  return (
    <div
      className="babel-voice voice flex min-h-[180px] flex-col border-dashed opacity-80"
      data-state="pending"
    >
      <div
        className="babel-voice-niche niche"
        style={{
          background: `color-mix(in srgb, ${agentSpec.color} 12%, var(--plaster-hi))`,
        }}
      >
        <span className="babel-voice-name" style={{ color: agentSpec.color }}>
          {roleTitle}
        </span>
        <span className="babel-voice-stance">Waiting to speak</span>
      </div>
      <div className="babel-voice-body body flex flex-1 items-center justify-center">
        <p className="text-center text-sm italic text-[var(--text-muted)]">
          Waiting its turn
        </p>
      </div>
    </div>
  )
}

/**
 * @param {{
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   finalPositions: { a?: string | null, b?: string | null, c?: string | null },
 *   finalPositionTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 *   agentTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   reviewTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   rebuttalTimers: Record<string, { startTime: number | null, endTime: number | null }>,
 *   scores: { ab: number, ac: number, bc: number, average?: number } | null,
 *   divergenceReady?: boolean,
 *   influenceReport?: Record<string, unknown> | null,
 *   influenceLoading?: boolean,
 *   influenceError?: { title?: string, detail?: string, userMessage?: string } | null,
 *   onRetryInfluence?: () => void,
 * }} props
 */
function FinalPositionCard({
  config,
  scores = null,
  divergenceReady = false,
  finalPositions,
  finalPositionTimers,
  agentTimers,
  reviewTimers,
  rebuttalTimers,
  influenceReport = null,
  influenceLoading = false,
  influenceError = null,
  onRetryInfluence,
}) {
  const { settings } = useForgeUiSettings()
  const { agentA, agentB, agentC } = config
  const fa = finalPositions?.a ?? ''
  const fb = finalPositions?.b ?? ''
  const fc = finalPositions?.c ?? ''

  const initials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const totalA = useTotalDebateMs({
    agentKey: 'a',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })
  const totalB = useTotalDebateMs({
    agentKey: 'b',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })
  const totalC = useTotalDebateMs({
    agentKey: 'c',
    agentTimers,
    reviewTimers,
    rebuttalTimers,
    finalPositionTimers,
  })

  const finalsReady = [fa, fb, fc].every(
    (t) =>
      typeof t === 'string' && t.length > 0 && !isUnavailableAgentResponse(t)
  )

  const showInfluenceSection =
    settings.showResearchSurfaces &&
    finalsReady &&
    scores != null &&
    typeof scores.ab === 'number'

  return (
    <section className="flex flex-col gap-6">
      <SectionHeading
        className="border-b border-[var(--line)] pb-4"
        eyebrow="Round 3"
        title="Revision"
        lede="Each role marks earlier claims as preserved, narrowed, amended, or withdrawn, then states a closing position."
      />

      <div className="majlis">
        <FinalColumn
          agentKey="a"
          agentSpec={agentA}
          text={fa}
          finalTimer={finalPositionTimers.a}
          totalMs={totalA}
        />
        <FinalColumn
          agentKey="b"
          agentSpec={agentB}
          text={fb}
          finalTimer={finalPositionTimers.b}
          totalMs={totalB}
        />
        <FinalColumn
          agentKey="c"
          agentSpec={agentC}
          text={fc}
          finalTimer={finalPositionTimers.c}
          totalMs={totalC}
        />
      </div>

      {showInfluenceSection && scores ? (
        <div className="border-t border-dashed border-[var(--border)] pt-6">
          <InfluenceMap
            scores={scores}
            initials={initials}
            config={config}
            influenceReport={influenceReport}
            influenceLoading={influenceLoading}
            influenceError={influenceError}
            onRetryInfluence={onRetryInfluence}
            showPositionTracks
            divergenceReady={divergenceReady}
          />
        </div>
      ) : null}
    </section>
  )
}

export default memo(FinalPositionCard)
