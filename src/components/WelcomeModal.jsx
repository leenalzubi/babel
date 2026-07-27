/** @type {string} Key for sessionStorage: welcome dismissed for this browser tab session. */
export const WELCOME_STORAGE_KEY = 'babel_welcomed'

const STORAGE_KEY = WELCOME_STORAGE_KEY

/**
 * @param {{ onClose: () => void }} props
 */
export default function WelcomeModal({ onClose }) {
  function handleStart() {
    try {
      sessionStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      /* ignore */
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(36, 32, 27, 0.72)' }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className="relative w-full max-w-[420px] rounded-[6px]"
        style={{
          backgroundColor: 'var(--plaster-hi)',
          padding: '48px',
          boxShadow: 'var(--shadow-lift)',
          border: '1px solid var(--line)',
        }}
      >
        <button
          type="button"
          onClick={handleStart}
          aria-label="Close welcome dialog"
          className="absolute cursor-pointer border-none bg-transparent p-0 text-[20px] leading-none text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40 focus-visible:ring-offset-2"
          style={{
            top: 16,
            right: 16,
            padding: '4px 8px',
          }}
        >
          ×
        </button>
        <div className="flex flex-col items-center">
          <span className="babel-eyebrow mb-4 justify-center">Welcome</span>
          <h1
            id="welcome-modal-title"
            className="mb-4 text-center text-[36px] font-normal leading-none tracking-[-0.01em] text-[var(--ink)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 340,
              fontOpticalSizing: 'auto',
            }}
          >
            Babel
          </h1>
          <div
            className="mb-10 max-w-[320px] space-y-4 text-justify babel-prose"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <p>
              Three AI models debate the same question. All three know who they
              are arguing with and are competing to write the sharpest
              cross-review. Then, we track for whether they actually change
              their minds.
            </p>
            <p>
              Every debate contributes to an open dataset studying how language
              models reason, compete, and influence each other.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="babel-btn babel-btn-primary"
            style={{
              padding: '12px 40px',
            }}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  )
}
