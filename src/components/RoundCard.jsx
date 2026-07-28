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
import { useForgeUiSettings } from '../context/ForgeSettingsContext.jsx'
import { buildChallengesByClaim } from '../lib/claimNavigation.js'
import { isUnavailableAgentResponse } from '../lib/debateConstants.js'

/** @param {{ label: string, color: string, pct: number }} props */
function DivergenceChip({ label, color, pct }) {
  return (
    <span
      className="inline-flex flex-col items-center gap-0.5 rounded-[4px] border border-dashed border-[var(--border)] bg-transparent px-2 py-1.5 font-mono text-[10px] text-[var(--text-secondary)]"
      title="Claim disagreement from audited positions (pairwise)."
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {label}
        <span className="font-medium text-[var(--text-primary)]">{pct}%</span>
      </span>
      <span className="text-[8px] font-normal text-[var(--text-muted)]">
        Claims
      </span>
    </span>
  )
}

/**
 * @param {{
 *   agentKey: 'a'|'b'|'c',
 *   agentSpec: { name: string, color: string },
 *   text: string,
 *   startTime: number | null,
 *   endTime: number | null,
 * }} props
 */
function RoundAgentPanel({ agentKey, agentSpec, text, startTime, endTime }) {
  const { state } = useForge()
  const { roleTitle, modelName } = useVoiceLabels(agentKey, agentSpec)
  const structure = state.structures?.round1?.[agentKey] ?? null
  const criterion = state.decisionCriteria?.[0] ?? null
  const challengesByClaim = buildChallengesByClaim({
    agentKey,
    structures: state.structures,
    roles: state.roles,
  })

  return (
    <VoiceCard
      title={roleTitle}
      subtitle={modelName}
      color={agentSpec.color}
      stance={structure?.stance ?? 'independent'}
      responseState="done"
      extractionState={structure?.extraction ?? 'raw_response'}
      responseDomId={`voice-r1-${agentKey}`}
      regionLabel={`${roleTitle} (${modelName}) response`}
      foot={
        startTime != null ? (
          <AgentTimer startTime={startTime} endTime={endTime} />
        ) : null
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

/**
 * @param {{ title: string, color: string }} props
 */
function RoundAgentWaiting({ title, color }) {
  return (
    <div
      className="babel-voice voice flex min-h-[200px] flex-col border-dashed opacity-80"
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
 *   responseText: string,
 *   timer: { startTime: number | null, endTime: number | null },
 * }} props
 */
function AgentRoundColumn({ agentKey, agentSpec, responseText, timer }) {
  const voiceActions = useVoiceActions()
  const { roleTitle, modelName } = useVoiceLabels(agentKey, agentSpec)
  const hasResponse =
    typeof responseText === 'string' && responseText.length > 0
  const live =
    timer.startTime != null && timer.endTime == null

  if (hasResponse) {
    if (isUnavailableAgentResponse(responseText)) {
      return (
        <VoiceFailureNotice
          agentName={`${roleTitle} (${modelName})`}
          agentKey={agentKey}
          message={responseText}
          stageLabel="Round 1"
          busy={Boolean(voiceActions?.voiceBusy)}
          onRetry={
            voiceActions
              ? () => void voiceActions.retryVoice(agentKey, 'round_1')
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
      <RoundAgentPanel
        agentKey={agentKey}
        agentSpec={agentSpec}
        text={responseText}
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
        color={agentSpec.color}
        line="Thinking through your decision…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return <RoundAgentWaiting title={roleTitle} color={agentSpec.color} />
}

/** @param {{ scores: { ab: number, ac: number, bc: number }, initials: { a: string, b: string, c: string }, colors: { a: string, b: string, c: string }, divergenceReady: boolean }} props */
function DivergenceRow({ scores, initials, colors, divergenceReady }) {
  const pct = (n) => Math.min(100, Math.max(0, Math.round(Number(n) * 100)))
  if (!divergenceReady) return null
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t border-dashed border-[var(--border)] pt-6">
      <DivergenceChip
        label={`${initials.a}-${initials.b}`}
        color={colors.a}
        pct={pct(scores.ab)}
      />
      <DivergenceChip
        label={`${initials.a}-${initials.c}`}
        color={colors.c}
        pct={pct(scores.ac)}
      />
      <DivergenceChip
        label={`${initials.b}-${initials.c}`}
        color={colors.b}
        pct={pct(scores.bc)}
      />
    </div>
  )
}

/**
 * @param {{
 *   roundNum: number,
 *   scores: { ab: number, ac: number, bc: number, average: number },
 *   divergenceReady: boolean,
 *   round: { agentA: string, agentB: string, agentC: string },
 *   config: {
 *     agentA: { name: string, color: string },
 *     agentB: { name: string, color: string },
 *     agentC: { name: string, color: string },
 *   },
 *   agentTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 * }} props
 */
function RoundCard({
  roundNum,
  scores,
  divergenceReady,
  round,
  config,
  agentTimers,
}) {
  const { settings } = useForgeUiSettings()
  const { agentA, agentB, agentC } = config

  const initials = {
    a: (agentA.name?.[0] ?? 'A').toUpperCase(),
    b: (agentB.name?.[0] ?? 'B').toUpperCase(),
    c: (agentC.name?.[0] ?? 'C').toUpperCase(),
  }

  const colors = { a: agentA.color, b: agentB.color, c: agentC.color }

  const showDivergence =
    settings.showResearchSurfaces &&
    round.agentA &&
    round.agentB &&
    round.agentC &&
    scores &&
    typeof scores.ab === 'number'

  return (
    <section className="rounded-forge-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-forge-card">
      <SectionHeading
        className="mb-6 border-b border-[var(--line)] pb-4"
        eyebrow={`Round ${roundNum}`}
        title="Independent positions"
        lede="Each role answers without seeing the others. An organized response appears when extraction validates; otherwise the AI reasoning is shown."
      />

      <div className="majlis">
        <AgentRoundColumn
          agentKey="a"
          agentSpec={agentA}
          responseText={round.agentA}
          timer={agentTimers.a}
        />
        <AgentRoundColumn
          agentKey="b"
          agentSpec={agentB}
          responseText={round.agentB}
          timer={agentTimers.b}
        />
        <AgentRoundColumn
          agentKey="c"
          agentSpec={agentC}
          responseText={round.agentC}
          timer={agentTimers.c}
        />
      </div>

      <PartialRoundBanner
        roundLabel="Round 1"
        texts={[round.agentA, round.agentB, round.agentC]}
        failedNames={[
          isUnavailableAgentResponse(round.agentA) ? agentA.name : null,
          isUnavailableAgentResponse(round.agentB) ? agentB.name : null,
          isUnavailableAgentResponse(round.agentC) ? agentC.name : null,
        ].filter(Boolean)}
      />

      {showDivergence ? (
        <DivergenceRow
          scores={scores}
          initials={initials}
          colors={colors}
          divergenceReady={divergenceReady}
        />
      ) : null}
    </section>
  )
}

export default memo(RoundCard)
