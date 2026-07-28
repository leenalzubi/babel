/** @typedef {'creator-portrait' | 'cat-portrait' | 'tablet-gate' | 'tablet-water' | 'tablet-palms' | 'gate-completion' | 'lineage-mode' | 'trash-archive'} EasterEggId */

/** @type {EasterEggId[]} */
export const EASTER_EGG_IDS = [
  'creator-portrait',
  'cat-portrait',
  'tablet-gate',
  'tablet-water',
  'tablet-palms',
  'gate-completion',
  'lineage-mode',
  'trash-archive',
]

export const ARCHIVE_UNLOCK_COUNT = 3

export const LINKEDIN_URL = 'https://www.linkedin.com/in/leenalzubi'
export const AVATAR_SRC = '/images/leen-avatar.png'
export const CAT_AVATAR_SRC = '/images/leen-illustration.png'

export const BUILDER_NOTE_HEADING = "Builder's note"
export const BUILDER_NOTE_BODY =
  'Babel does not claim that more AI reasoning is always better. It is an attempt to make disagreement easier to inspect, and bad certainty harder to fake.'

/** @type {Record<EasterEggId, { label: string, title?: string }>} */
export const EASTER_EGG_META = {
  'creator-portrait': {
    label: "About Leen Al-Zu'bi, creator of Babel",
    title: "Leen Al-Zu'bi",
  },
  'cat-portrait': {
    label: "Builder's note",
    title: "Builder's note",
  },
  'tablet-gate': {
    label: 'Clay tablet near the gate',
    title: 'Inscription',
  },
  'tablet-water': {
    label: 'Clay tablet near the water',
    title: 'Inscription',
  },
  'tablet-palms': {
    label: 'Clay tablet among the palms',
    title: 'Inscription',
  },
  'gate-completion': {
    label: 'The gate after a completed debate',
    title: 'Gate',
  },
  'lineage-mode': {
    label: 'Lineage view',
    title: 'Lineage',
  },
  'trash-archive': {
    label: 'Trash',
    title: 'Trash',
  },
}

export const TABLET_INSCRIPTIONS = {
  'tablet-gate': 'Agreement is not evidence of truth.',
  'tablet-water': 'Partial failure is still a result.',
  'tablet-palms':
    'The minority report was not lost. It was merely harder to find.',
  'gate-completion': 'The gate opened. The question did not close.',
}

export const LINEAGE_MODE_NOTICE =
  'Lineage view unlocked. Conclusions have histories.'

export const ARCHIVE_UNLOCK_NOTICE = 'Archive unlocked'

/**
 * Archive copy drawn from project docs / About — no invented chronology.
 */
export const ARCHIVE_CONTENT = {
  title: 'The Babel Archive',
  lede:
    'Babel began with a suspicion: several answers may produce more reading without producing better judgment. These notes document the product decisions, unresolved questions, and ideas that did not survive testing.',
  sections: [
    {
      heading: 'Why Babel exists',
      body: 'When models trained on similar data still diverge on the same prompt, that divergence is data. It points to genuinely contested knowledge, differing reasoning styles, and the limits of what these systems actually know versus what they confidently assert.',
    },
    {
      heading: 'What was kept',
      body: 'Three models answer independently, then challenge each other across rounds. Babel measures disagreement, position change, and whether influence looks like genuine updating or social pressure. Synthesis is required and peer-validated. Inspectable lineage walks findings back to stored claims and raw responses without inventing links.',
    },
    {
      heading: 'Unresolved questions',
      body: 'Claim extraction is automated and imperfect. Position-change embeddings capture content shift but not emphasis or confidence. Concession detection uses signal words and is directional only. The current models share significant training overlap, so observed divergence likely understates true disagreement. The public dataset is still small.',
    },
    {
      heading: 'Evidence honesty',
      body: 'Babel does not independently verify citations. Lineage may be complete, partial, or unavailable. Findings are never labeled verified or fact-checked unless an independent verification process is recorded, and it currently is not.',
    },
  ],
}
