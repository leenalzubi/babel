import { AlertTriangle } from 'lucide-react'

/**
 * @param {{ message: string | null, onDismiss: () => void }} props
 */
export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null

  const text = typeof message === 'string' ? message : String(message ?? '')

  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-forge-card border border-red-200 bg-red-50 px-4 py-3 text-red-900 shadow-forge-card"
      role="alert"
    >
      <AlertTriangle
        className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
        aria-hidden
      />
      <p className="min-w-0 flex-1 font-mono text-xs leading-relaxed text-red-900">
        {text}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 font-mono text-[10px] font-medium text-red-800 hover:bg-red-100"
      >
        Dismiss
      </button>
    </div>
  )
}
