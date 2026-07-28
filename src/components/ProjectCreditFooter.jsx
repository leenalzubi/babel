/**
 * Quiet project credit: sits after all stage content, not sticky.
 */
export default function ProjectCreditFooter() {
  return (
    <footer className="credit">
      <div className="credit-inner">
        <span className="credit-copy">
          Built by <span className="who">Leen Al-Zu&apos;bi</span>, a Product
          Manager, as a personal project.
        </span>

        <nav className="credit-links" aria-label="Leen Al-Zu'bi profiles">
          <a
            href="https://www.linkedin.com/in/leenalzubi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Leen Al-Zu'bi on LinkedIn, opens in a new tab"
          >
            LinkedIn
          </a>

          <a
            href="https://github.com/leenalzubi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Leen Al-Zu'bi on GitHub, opens in a new tab"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
