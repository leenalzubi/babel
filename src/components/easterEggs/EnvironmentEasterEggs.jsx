import EasterEgg from './EasterEgg.jsx'
import {
  AVATAR_SRC,
  EASTER_EGG_META,
  LINKEDIN_URL,
  TABLET_INSCRIPTIONS,
} from '../../lib/easterEggs/catalog.js'
import { useState } from 'react'

/**
 * @param {{
 *   activeTab: 'babel' | 'findings' | 'lab' | 'about' | 'method',
 *   debateComplete?: boolean,
 * }} props
 */
export default function EnvironmentEasterEggs({
  activeTab,
  debateComplete = false,
}) {
  const showGateTablet = activeTab === 'babel'
  const showWaterTablet = activeTab === 'findings'
  const showPalmsTablet = activeTab === 'lab' || activeTab === 'method'
  const showGateCompletion = activeTab === 'babel' && debateComplete

  return (
    <div className="easter-egg-layer" aria-label="Environment details">
      <CreatorPortraitEgg />

      {showGateTablet ? (
        <ClayTabletEgg
          id="tablet-gate"
          className="easter-egg-spot easter-egg-spot--gate"
          inscription={TABLET_INSCRIPTIONS['tablet-gate']}
        />
      ) : null}

      {showWaterTablet ? (
        <ClayTabletEgg
          id="tablet-water"
          className="easter-egg-spot easter-egg-spot--water"
          inscription={TABLET_INSCRIPTIONS['tablet-water']}
        />
      ) : null}

      {showPalmsTablet ? (
        <ClayTabletEgg
          id="tablet-palms"
          className="easter-egg-spot easter-egg-spot--palms"
          inscription={TABLET_INSCRIPTIONS['tablet-palms']}
        />
      ) : null}

      {showGateCompletion ? (
        <ClayTabletEgg
          id="gate-completion"
          className="easter-egg-spot easter-egg-spot--gate-complete"
          inscription={TABLET_INSCRIPTIONS['gate-completion']}
          variant="gate"
        />
      ) : null}
    </div>
  )
}

function CreatorPortraitEgg() {
  const [imgFailed, setImgFailed] = useState(false)
  const meta = EASTER_EGG_META['creator-portrait']

  return (
    <EasterEgg
      id="creator-portrait"
      label={meta.label}
      cardTitle={meta.title}
      className="easter-egg-spot easter-egg-spot--portrait"
      triggerClassName="easter-egg-portrait-trigger"
      cardClassName="easter-egg-card--profile"
      placement="end"
      card={
        <>
          <p className="easter-egg-name">Leen Al-Zu&apos;bi</p>
          <p className="easter-egg-meta">Creator of Babel</p>
          <p className="easter-egg-meta">
            Product Manager at World Wide Technology
          </p>
          <p className="easter-egg-meta">Toronto, Canada</p>
          <a
            className="easter-egg-link"
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn ↗
          </a>
        </>
      }
    >
      <span className="easter-egg-portrait" aria-hidden>
        {imgFailed ? (
          <span className="easter-egg-initials">L</span>
        ) : (
          <img
            src={AVATAR_SRC}
            alt=""
            width={128}
            height={128}
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        )}
      </span>
    </EasterEgg>
  )
}

/**
 * @param {{
 *   id: 'tablet-gate' | 'tablet-water' | 'tablet-palms' | 'gate-completion',
 *   className: string,
 *   inscription: string,
 *   variant?: 'tablet' | 'gate',
 * }} props
 */
function ClayTabletEgg({ id, className, inscription, variant = 'tablet' }) {
  const meta = EASTER_EGG_META[id]

  return (
    <EasterEgg
      id={id}
      label={meta.label}
      cardTitle={meta.title}
      className={className}
      triggerClassName={
        variant === 'gate'
          ? 'easter-egg-gate-trigger'
          : 'easter-egg-tablet-trigger'
      }
      cardClassName="easter-egg-card--inscription"
      placement="above"
      card={<p className="easter-egg-inscription">{inscription}</p>}
    >
      {variant === 'gate' ? (
        <span className="easter-egg-gate-mark" aria-hidden />
      ) : (
        <span className="easter-egg-tablet" aria-hidden>
          <span className="easter-egg-tablet-face" />
        </span>
      )}
    </EasterEgg>
  )
}
