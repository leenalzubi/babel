import React, { useEffect, useMemo } from 'react'
import { loadEvaluationCatalog } from '../../lib/lab/loadCases.js'
import { trackLabEvent } from '../../lib/lab/analytics.js'
import LabIndex from './LabIndex.jsx'
import LabMethodology from './LabMethodology.jsx'
import LabCaseDetail from './LabCaseDetail.jsx'

/**
 * @typedef {{
 *   view: 'index' | 'methodology' | 'case',
 *   caseSlug?: string | null,
 * }} LabRoute
 */

/**
 * @param {{
 *   route: LabRoute,
 *   onNavigate: (route: LabRoute) => void,
 * }} props
 */
export default function LabPanel({ route, onNavigate }) {
  const catalog = useMemo(() => loadEvaluationCatalog(), [])

  useEffect(() => {
    if (route.view === 'index') trackLabEvent('lab_viewed')
    if (route.view === 'methodology') trackLabEvent('methodology_viewed')
    if (route.view === 'case' && route.caseSlug) {
      trackLabEvent('case_opened', { slug: route.caseSlug })
    }
  }, [route.view, route.caseSlug])

  if (route.view === 'methodology') {
    return (
      <LabMethodology
        onBack={() => onNavigate({ view: 'index' })}
        datasetVersion={catalog.datasetVersion}
      />
    )
  }

  if (route.view === 'case' && route.caseSlug) {
    return (
      <LabCaseDetail
        slug={route.caseSlug}
        cases={catalog.cases}
        onBack={() => onNavigate({ view: 'index' })}
        onOpenMethodology={() => onNavigate({ view: 'methodology' })}
      />
    )
  }

  return (
    <LabIndex
      catalog={catalog}
      onOpenCase={(slug) => onNavigate({ view: 'case', caseSlug: slug })}
      onOpenMethodology={() => onNavigate({ view: 'methodology' })}
    />
  )
}
