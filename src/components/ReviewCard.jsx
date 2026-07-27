import { memo } from 'react'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import SectionHeading from './SectionHeading.jsx'
import VoiceCard from './VoiceCard.jsx'
import VoiceFailureNotice from './VoiceFailureNotice.jsx'
import PartialRoundBanner from './PartialRoundBanner.jsx'
import StructuredVoiceBody from './reasoning/StructuredVoiceBody.jsx'
import { useVoiceActions } from '../context/VoiceActionsContext.jsx'
import { useVoiceLabels } from '../hooks/useVoiceLabels.js'
import { useForge } from '../store/useForgeStore.js'
import { isUnavailableAgentResponse } from '../lib/debateConstants.js'

/**
 * @param {{
 *   agentKey: 'a'|'b'|'c',
 *   agentSpec: { name: string, color: string },
 *   body: string,
 *   startTime?: number | null,
 *   endTime?: number | null,
 * }} props
 */
function CrossReviewAgentCard({
  agentKey,
  agentSpec,
  body,
  startTime,
  endTime,
}) {
  const { state } = useForge()
  const { roleTitle, modelName } = useVoiceLabels(agentKey, agentSpec)
  const structure = state.structures?.round2?.[agentKey] ?? null

  return (
    <VoiceCard
      title={roleTitle}
      subtitle={modelName}
      color={agentSpec.color}
      stance="cross-examination"
        responseState="done"
      extractionState={structure?.extraction ?? 'raw_response'}
      responseDomId={`voice-r2-${agentKey}`}
      regionLabel={`${roleTitle} (${modelName}) cross-examination`}
      foot={
        startTime != null ? (
          <AgentTimer startTime={startTime} endTime={endTime ?? null} />
        ) : null
      }
    >
      <StructuredVoiceBody
        rawText={body}
        structure={structure}
        roleLabel={roleTitle}
      />
    </VoiceCard>
  )
}

/**
 * @param {{ title: string, color: string }} props
 */
function CrossReviewWaiting({ title, color }) {
  return (
    <div
      className="babel-voice voice flex min-h-[160px] flex-col border-dashed opacity-80"
      data-state="pending"
    >
      <div
        className="babel-voice-niche niche"
        style={{
          background: `color-mix(in srgb, ${color} 12%, var(--plaster-hi))`,
        }}
      >
        <span className="babel-voice-name" style={{ color }}>
          {title}
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
 *   agentKey: 'a' | 'b' | 'c',
 *   agentSpec: { name: string, color: string },
 *   body: string,
 *   timer: { startTime: number | null, endTime: number | null },
 * }} props
 */
function ReviewAgentColumn({ agentKey, agentSpec, body, timer }) {
  const voiceActions = useVoiceActions()
  const { roleTitle, modelName } = useVoiceLabels(agentKey, agentSpec)
  const hasBody = typeof body === 'string' && body.length > 0
  const live = timer.startTime != null && timer.endTime == null
  const color = agentSpec.color

  if (hasBody) {
    if (isUnavailableAgentResponse(body)) {
      return (
        <VoiceFailureNotice
          agentName={`${roleTitle} (${modelName})`}
          agentKey={agentKey}
          message={body}
          stageLabel="Cross-examination"
          busy={Boolean(voiceActions?.voiceBusy)}
          onRetry={
            voiceActions
              ? () => void voiceActions.retryVoice(agentKey, 'round_2')
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
      <CrossReviewAgentCard
        agentKey={agentKey}
        agentSpec={agentSpec}
        body={body}
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={roleTitle}
        subtitle={modelName}
        color={color}
        line="Examining the other voices…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return <CrossReviewWaiting title={roleTitle} color={color} />
}

/**
 * @param {{
 *   aReviews: string
 *   bReviews: string
 *   cReviews: string
 *   config: {
 *     agentA: { name: string, color: string }
 *     agentB: { name: string, color: string }
 *     agentC: { name: string, color: string }
 *   }
 *   reviewTimers: {
 *     a: { startTime: number | null, endTime: number | null }
 *     b: { startTime: number | null, endTime: number | null }
 *     c: { startTime: number | null, endTime: number | null }
 *   }
 * }} props
 */
function ReviewCard({ aReviews, bReviews, cReviews, config, reviewTimers }) {
  const { agentA, agentB, agentC } = config

  return (
    <section className="flex flex-col gap-6">
      <SectionHeading
        className="border-b border-[var(--line)] pb-4"
        eyebrow="Round 2"
        title="Cross-examination"
        lede="Each role critiques the strongest claims from the others. Linked counterpoints attach when mapping validates."
      />

      <div className="majlis">
        <ReviewAgentColumn
          agentKey="a"
          agentSpec={agentA}
          body={aReviews}
          timer={reviewTimers.a}
        />
        <ReviewAgentColumn
          agentKey="b"
          agentSpec={agentB}
          body={bReviews}
          timer={reviewTimers.b}
        />
        <ReviewAgentColumn
          agentKey="c"
          agentSpec={agentC}
          body={cReviews}
          timer={reviewTimers.c}
        />
      </div>

      <PartialRoundBanner
        roundLabel="Round 2"
        texts={[aReviews, bReviews, cReviews]}
        failedNames={[
          isUnavailableAgentResponse(aReviews) ? agentA.name : null,
          isUnavailableAgentResponse(bReviews) ? agentB.name : null,
          isUnavailableAgentResponse(cReviews) ? agentC.name : null,
        ].filter(Boolean)}
      />
    </section>
  )
}

export default memo(ReviewCard)
