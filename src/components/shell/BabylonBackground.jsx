/**
 * Fixed full-viewport Babylon environment behind the product UI.
 * @param {{ gateLit?: boolean }} props
 */
export default function BabylonBackground({ gateLit = false }) {
  return (
    <div
      className={`babel-environment${gateLit ? ' is-gate-lit' : ''}`}
      aria-hidden="true"
    >
      <img
        className="babel-environment-image"
        src="/images/babylon-environment.png"
        alt=""
        width={1232}
        height={928}
        decoding="async"
        fetchPriority="low"
      />
      <div className="babel-environment-veil" />
      {gateLit ? <div className="babel-environment-gate-glow" /> : null}
    </div>
  )
}
