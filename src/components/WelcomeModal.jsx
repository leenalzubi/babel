/** @type {string} Key for sessionStorage — welcome dismissed for this browser tab session. */
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
      style={{ backgroundColor: 'rgba(28, 24, 20, 0.75)' }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        className="w-full max-w-[420px] rounded-[8px] shadow-lg"
        style={{
          backgroundColor: '#FDFAF4',
          padding: '48px',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <h1
            id="welcome-modal-title"
            className="mb-4 text-[36px] font-normal leading-none tracking-[0.08em] text-[#1C1814]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Babel
          </h1>
          <p
            className="mb-10 max-w-[320px] text-[17px] leading-[1.7] text-[#6B5E4E]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            An AI debate experiment using three different models.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="cursor-pointer border-none px-10 py-3 text-[14px] font-medium text-white transition hover:brightness-110"
            style={{
              backgroundColor: '#8B1A1A',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
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
