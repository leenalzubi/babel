import { memo } from 'react'
import AgentResponseBody from './AgentResponseBody.jsx'
import AgentThinking from './AgentThinking.jsx'
import AgentTimer from './AgentTimer.jsx'
import SectionHeading from './SectionHeading.jsx'
import VoiceCard from './VoiceCard.jsx'
import VoiceFailureNotice from './VoiceFailureNotice.jsx'
import { isUnavailableAgentResponse } from '../lib/debateConstants.js'
import { classifyRebuttalStance } from '../lib/rebuttalStance.js'

const mdClass =
  'max-w-none min-w-0 break-words text-[17px] leading-[1.85] text-[var(--text-secondary)] [&_a]:text-[var(--accent-forge)] [&_code]:break-words [&_code]:rounded-[4px] [&_code]:bg-[var(--bg-raised)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_strong]:text-[var(--text-primary)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5'

/** @param {{ stance: 'conceded' | 'held' | 'modified' }} props */
function StanceBadge({ stance }) {
  const map = {
    conceded: 'bg-[#97372B]/15 text-[#7A2C23] ring-1 ring-[#97372B]/30',
    held: 'bg-[#4C6647]/12 text-[#3D5439] ring-1 ring-[#4C6647]/25',
    modified: 'bg-[#D97706]/12 text-[#B45309] ring-1 ring-[#D97706]/25',
  }
  const labels = {
    conceded: 'Conceded',
    held: 'Held firm',
    modified: 'Modified',
  }
  return (
    <span
      className={`inline-flex rounded-[4px] px-2 py-0.5 font-mono text-[9px] font-semibold ${map[stance]}`}
    >
      {labels[stance]}
    </span>
  )
}

/**
 * @param {{
 *   agentSpec: { name: string, color: string },
 *   body: string,
 *   timer: { startTime: number | null, endTime: number | null },
 *   borderVar: string,
 *   dotClass: string,
 *   regionLabel: string,
 * }} props
 */
function RebuttalColumn({
  agentSpec,
  body,
  timer,
  regionLabel,
}) {
  const hasBody = typeof body === 'string' && body.length > 0
  const live = timer.startTime != null && timer.endTime == null
  const stance = classifyRebuttalStance(body)

  if (hasBody) {
    if (isUnavailableAgentResponse(body)) {
      return (
        <VoiceFailureNotice
          agentName={agentSpec.name}
          message={body}
          stageLabel="Rebuttal"
        />
      )
    }
    return (
      <VoiceCard
        title={agentSpec.name}
        color={agentSpec.color}
        stance="rebuttal"
        regionLabel={regionLabel}
        foot={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <StanceBadge stance={stance} />
            {timer.startTime != null ? (
              <AgentTimer
                startTime={timer.startTime}
                endTime={timer.endTime ?? null}
              />
            ) : null}
          </div>
        }
      >
        <AgentResponseBody rawText={body} markdownClassName={mdClass} />
      </VoiceCard>
    )
  }

  if (live) {
    return (
      <AgentThinking
        title={agentSpec.name}
        color={agentSpec.color}
        line="Responding to challenges…"
        startTime={timer.startTime}
        endTime={timer.endTime}
      />
    )
  }

  return (
    <div className="babel-voice flex min-h-[140px] flex-col border-dashed opacity-80">
      <div
        className="babel-voice-niche"
        style={{
          background: `color-mix(in srgb, ${agentSpec.color} 12%, var(--plaster-hi))`,
        }}
      >
        <span className="babel-voice-name" style={{ color: agentSpec.color }}>
          {agentSpec.name}
        </span>
        <span className="babel-voice-stance">waiting</span>
      </div>
      <div className="babel-voice-body flex flex-1 items-center justify-center">
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
 *   rebuttals: { a?: string | null, b?: string | null, c?: string | null },
 *   rebuttalTimers: {
 *     a: { startTime: number | null, endTime: number | null },
 *     b: { startTime: number | null, endTime: number | null },
 *     c: { startTime: number | null, endTime: number | null },
 *   },
 * }} props
 */
function RebuttalCard({ config, rebuttals, rebuttalTimers }) {
  const { agentA, agentB, agentC } = config
  const ra = rebuttals?.a ?? ''
  const rb = rebuttals?.b ?? ''
  const rc = rebuttals?.c ?? ''

  return (
    <section className="flex flex-col gap-6">
      <SectionHeading
        className="border-b border-[var(--line)] pb-4"
        eyebrow="Round 3"
        title="Rebuttals"
        lede="Each agent responds to challenges directed at them."
      />

      <div className="flex flex-col gap-4">
        <RebuttalColumn
          agentSpec={agentA}
          body={ra}
          timer={rebuttalTimers.a}
          regionLabel={`${agentA.name} rebuttal`}
        />
        <RebuttalColumn
          agentSpec={agentB}
          body={rb}
          timer={rebuttalTimers.b}
          regionLabel={`${agentB.name} rebuttal`}
        />
        <RebuttalColumn
          agentSpec={agentC}
          body={rc}
          timer={rebuttalTimers.c}
          regionLabel={`${agentC.name} rebuttal`}
        />
      </div>
    </section>
  )
}

export default memo(RebuttalCard)
