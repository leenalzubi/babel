/**
 * Restrained clay refuse-jar icon for the Trash shortcut.
 * @param {{ className?: string, title?: string }} [props]
 */
export default function ClayRefuseJarIcon({ className = '', title }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {/* Rim */}
      <ellipse
        cx="12"
        cy="6.2"
        rx="6.2"
        ry="2.1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Body */}
      <path
        d="M5.8 6.4c0 0.4 0.2 1.2 0.5 2.1 0.6 1.9 1.5 4.4 2.1 6.2 0.3 0.9 0.9 1.6 1.8 1.9 1.1 0.4 2.5 0.4 3.6 0 0.9-0.3 1.5-1 1.8-1.9 0.6-1.8 1.5-4.3 2.1-6.2 0.3-0.9 0.5-1.7 0.5-2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Shoulder band */}
      <path
        d="M6.6 9.2c1.6 0.7 3.4 1 5.4 1s3.8-0.3 5.4-1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Lid handle */}
      <path
        d="M10.2 4.4c0.4-0.9 1.1-1.4 1.8-1.4s1.4 0.5 1.8 1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** @param {{ className?: string }} [props] */
export function TrashFilePdfIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      aria-hidden
    >
      <path
        d="M7 3.5h7.2L18.5 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M14 3.6V8h4.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 13.2h7M8.5 16.2h5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** @param {{ className?: string }} [props] */
export function TrashFileMdIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      aria-hidden
    >
      <rect
        x="5"
        y="3.5"
        width="14"
        height="17"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 8.5h8M8 12h8M8 15.5h5.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** @param {{ className?: string }} [props] */
export function TrashFileZipIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      aria-hidden
    >
      <path
        d="M6.5 8.5h11v11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-11Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 8.5 8.2 4.5h7.6l1.7 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v3.5M12 14.5v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="10.4"
        y="16.2"
        width="3.2"
        height="2.4"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}
