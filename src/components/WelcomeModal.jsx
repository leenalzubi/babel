import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'babel_welcomed'

const PROMPT_TEXT =
  'Is the ocean more dangerous than it was 100 years ago, or have we just gotten better at measuring the risk?'

const RESPONSES = [
  {
    border: '#2563EB',
    text: 'The ocean presents significantly greater dangers today. Climate change has intensified storm systems, raised sea levels, and fundamentally altered marine ecosystems in ways that have no historical precedent.',
  },
  {
    border: '#16A34A',
    text: 'The ocean itself has not changed. What has changed is our ability to detect, measure, and communicate risk. A century ago, thousands drowned in storms we never saw coming.',
  },
  {
    border: '#DC2626',
    text: 'Both are true and neither fully explains the other. The question assumes danger is a single measurable thing. It is not.',
  },
]

const AGENT_LABELS = [
  { name: 'GPT-4o mini', color: '#2563EB' },
  { name: 'Phi-4 Reasoning', color: '#16A34A' },
  { name: 'Mistral Small', color: '#DC2626' },
]

const FADE_IN_MS = 600
const FADE_OUT_MS = 400
const TYPE_MS = 35
const M1_MIN_VISIBLE_MS = 3000
const M2_HOLD_MS = 4000
const BUTTON_DELAY_MS = 800

/** @param {number} ms */
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {{
 *   onClose: () => void,
 *   onStartExploring: () => void,
 *   onHowItWorks: () => void,
 * }} props
 */
export default function WelcomeModal({
  onClose,
  onStartExploring,
  onHowItWorks,
}) {
  /** 1 | 2 | 3 — which moment occupies the main stage */
  const [stage, setStage] = useState(/** @type {1 | 2 | 3} */ (1))
  /** Opacity 0–1 per stage wrapper */
  const [op1, setOp1] = useState(0)
  const [op2, setOp2] = useState(0)
  const [op3, setOp3] = useState(0)

  const [typedLen, setTypedLen] = useState(0)
  const [typingDone, setTypingDone] = useState(false)

  const [cardIn, setCardIn] = useState([false, false, false])
  const [m3Reveal, setM3Reveal] = useState(
    /** @type {{ shrink: boolean, copy: boolean } } */ ({
      shrink: false,
      copy: false,
    })
  )
  const [buttonsVisible, setButtonsVisible] = useState(false)
  const [showClose, setShowClose] = useState(false)

  const runIdRef = useRef(0)

  const persistWelcomed = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      /* ignore */
    }
  }, [])

  const handleStart = useCallback(() => {
    persistWelcomed()
    onClose()
    onStartExploring()
  }, [onClose, onStartExploring, persistWelcomed])

  const handleAbout = useCallback(() => {
    persistWelcomed()
    onClose()
    onHowItWorks()
  }, [onClose, onHowItWorks, persistWelcomed])

  const handleDismissX = useCallback(() => {
    persistWelcomed()
    onClose()
  }, [onClose, persistWelcomed])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  /* Typewriter during stage 1 */
  useEffect(() => {
    if (stage !== 1 || op1 !== 1) return

    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTypedLen(i)
      if (i >= PROMPT_TEXT.length) {
        window.clearInterval(id)
        setTypingDone(true)
      }
    }, TYPE_MS)

    return () => window.clearInterval(id)
  }, [stage, op1])

  /* Master timeline */
  useEffect(() => {
    const id = ++runIdRef.current
    const alive = () => id === runIdRef.current

    const run = async () => {
      /* —— Moment 1 —— */
      setStage(1)
      setOp1(0)
      setTypedLen(0)
      setTypingDone(false)
      await wait(20)
      if (!alive()) return
      setOp1(1)

      const typeDuration = PROMPT_TEXT.length * TYPE_MS
      const visibleUntil = Math.max(FADE_IN_MS + M1_MIN_VISIBLE_MS, typeDuration + 400)
      await wait(visibleUntil)
      if (!alive()) return

      setOp1(0)
      await wait(FADE_OUT_MS)
      if (!alive()) return

      /* —— Moment 2 —— */
      setStage(2)
      setCardIn([false, false, false])
      setOp2(0)
      await wait(20)
      if (!alive()) return
      setOp2(1)
      await wait(FADE_IN_MS)
      if (!alive()) return

      setCardIn([true, false, false])
      await wait(300)
      if (!alive()) return
      setCardIn([true, true, false])
      await wait(300)
      if (!alive()) return
      setCardIn([true, true, true])

      await wait(M2_HOLD_MS)
      if (!alive()) return

      setOp2(0)
      await wait(FADE_OUT_MS)
      if (!alive()) return

      /* —— Moment 3 —— */
      setStage(3)
      setM3Reveal({ shrink: false, copy: false })
      setButtonsVisible(false)
      setShowClose(false)
      setOp3(0)
      await wait(20)
      if (!alive()) return
      setOp3(1)
      await wait(FADE_IN_MS)
      if (!alive()) return

      setM3Reveal({ shrink: true, copy: false })
      await wait(100)
      if (!alive()) return
      setM3Reveal({ shrink: true, copy: true })
      await wait(700)
      if (!alive()) return

      await wait(BUTTON_DELAY_MS)
      if (!alive()) return
      setButtonsVisible(true)
      await wait(350)
      if (!alive()) return
      setShowClose(true)
    }

    void run()
    return () => {
      runIdRef.current++
    }
  }, [])

  const fadeStyle = (opacity) => ({
    opacity,
    transition: `opacity ${opacity === 1 ? FADE_IN_MS : FADE_OUT_MS}ms ease-out`,
  })

  const responseCardClass =
    'rounded-[4px] border border-solid bg-[#FDFAF4] px-4 py-3 text-[13px] leading-[1.7] text-[#1C1814] max-sm:w-full'
  const responseFont = { fontFamily: 'var(--font-body), Georgia, serif' }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(28, 24, 20, 0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-heading"
    >
      <div
        className="relative flex min-h-dvh w-full max-w-[580px] flex-col overflow-y-auto bg-[#FDFAF4] max-sm:rounded-none sm:max-h-[min(900px,90vh)] sm:min-h-0 sm:rounded-[12px]"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.35)' }}
      >
        {showClose ? (
          <button
            type="button"
            onClick={handleDismissX}
            className="absolute right-3 top-3 z-10 rounded-md p-2 text-[#6B5E4E] transition hover:bg-black/5 hover:text-[#1C1814] sm:right-4 sm:top-4"
            aria-label="Close welcome"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}

        <div className="p-7 sm:p-12">
          <div className="relative min-h-[280px] sm:min-h-[300px]">
            {/* Moment 1 */}
            <div
              className="flex flex-col items-center text-center"
              style={{
                ...fadeStyle(stage === 1 ? op1 : 0),
                position: stage === 1 ? 'relative' : 'absolute',
                width: '100%',
                top: 0,
                left: 0,
                pointerEvents: stage === 1 && op1 > 0.5 ? 'auto' : 'none',
              }}
            >
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-[#6B5E4E]">
                a single question
              </p>
              <p
                className="font-display mt-6 max-w-[420px] text-[22px] italic leading-snug text-[#1C1814]"
                aria-live="polite"
              >
                {PROMPT_TEXT.slice(0, typedLen)}
                {!typingDone ? (
                  <span className="ml-px inline-block h-[1.1em] w-px translate-y-px animate-pulse bg-[#1C1814]" />
                ) : null}
              </p>
            </div>

            {/* Moment 2 */}
            <div
              style={{
                ...fadeStyle(stage === 2 ? op2 : 0),
                position: stage === 2 ? 'relative' : 'absolute',
                width: '100%',
                top: 0,
                left: 0,
                pointerEvents: stage === 2 && op2 > 0.5 ? 'auto' : 'none',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
                {RESPONSES.map((r, i) => (
                  <div
                    key={i}
                    className={responseCardClass}
                    style={{
                      ...responseFont,
                      borderColor: '#D4C9B0',
                      borderLeftWidth: 3,
                      borderLeftColor: r.border,
                      opacity: cardIn[i] ? 1 : 0,
                      transform: cardIn[i] ? 'translateY(0)' : 'translateY(12px)',
                      transition:
                        'opacity 500ms ease-out, transform 500ms ease-out',
                    }}
                  >
                    {r.text}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-center font-[family-name:var(--font-mono)] text-[11px] text-[#6B5E4E]">
                three different answers
              </p>
            </div>

            {/* Moment 3 */}
            <div
              style={{
                ...fadeStyle(stage === 3 ? op3 : 0),
                position: stage === 3 ? 'relative' : 'absolute',
                width: '100%',
                top: 0,
                left: 0,
                pointerEvents: stage === 3 && op3 > 0.5 ? 'auto' : 'none',
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
                {RESPONSES.map((r, i) => (
                  <div
                    key={i}
                    className="flex max-w-[200px] flex-col gap-2 max-sm:max-w-none sm:max-w-[180px]"
                  >
                    <p
                      className="min-h-[1rem] text-center font-[family-name:var(--font-mono)] text-[11px] font-medium"
                      style={{
                        color: AGENT_LABELS[i].color,
                        opacity: m3Reveal.shrink ? 1 : 0,
                        transition: 'opacity 600ms ease-out',
                      }}
                    >
                      {AGENT_LABELS[i].name}
                    </p>
                    <div
                      className={responseCardClass}
                      style={{
                        ...responseFont,
                        borderColor: '#D4C9B0',
                        borderLeftWidth: 3,
                        borderLeftColor: r.border,
                        transform: m3Reveal.shrink ? 'scale(0.95)' : 'scale(1)',
                        opacity: m3Reveal.shrink ? 0.4 : 1,
                        transition:
                          'transform 600ms ease-out, opacity 600ms ease-out',
                        transformOrigin: 'top center',
                      }}
                    >
                      {r.text}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-10 flex flex-col items-center text-center"
                style={{
                  opacity: m3Reveal.copy ? 1 : 0,
                  transition: 'opacity 600ms ease-out',
                }}
              >
                <h2
                  id="welcome-modal-heading"
                  className="font-display text-2xl font-normal text-[#1C1814] sm:text-[24px]"
                >
                  Three models. One question. No collaboration.
                </h2>
                <div
                  className="mt-6 max-w-[420px] space-y-4 text-[16px] leading-[1.8] text-[#6B5E4E]"
                  style={{ fontFamily: 'var(--font-body), Georgia, serif' }}
                >
                  <p>
                    Babel is not a tool for getting answers faster. It is a tool
                    for understanding how different minds approach the same
                    question — where they converge, where they hold firm, and
                    what the structure of their disagreement reveals.
                  </p>
                  <p>
                    Built out of curiosity. Free to use. The data belongs to
                    everyone.
                  </p>
                </div>
              </div>

              <div
                className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
                style={{
                  opacity: buttonsVisible ? 1 : 0,
                  transition: 'opacity 500ms ease-out',
                }}
              >
                <button
                  type="button"
                  onClick={handleStart}
                  className="rounded-[6px] bg-[#8B1A1A] px-8 py-3 font-[family-name:var(--font-mono)] text-sm font-semibold text-white transition hover:bg-[#751515]"
                >
                  Start exploring
                </button>
                <button
                  type="button"
                  onClick={handleAbout}
                  className="bg-transparent font-[family-name:var(--font-mono)] text-sm font-semibold text-[#8B1A1A] underline decoration-transparent transition hover:underline hover:decoration-[#8B1A1A]"
                >
                  How it works →
                </button>
              </div>
              <p
                className="mt-8 text-center font-[family-name:var(--font-mono)] text-[9px] text-[#6B5E4E]/90"
                style={{
                  opacity: buttonsVisible ? 1 : 0,
                  transition: 'opacity 500ms ease-out',
                }}
              >
                This appears once. You can revisit it anytime from the About
                tab.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { STORAGE_KEY as WELCOME_STORAGE_KEY }
