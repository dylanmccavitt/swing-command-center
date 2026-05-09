import { useMemo, useState } from 'react'

export type ViewKey =
  | 'cockpit'
  | 'research'
  | 'planner'
  | 'journal'
  | 'cash'
  | 'import'

export const VIEW_ORDER: ViewKey[] = [
  'cockpit',
  'research',
  'planner',
  'journal',
  'cash',
  'import',
]

export const VIEW_LABELS: Record<ViewKey, string> = {
  cockpit: 'Cockpit',
  research: 'Research',
  planner: 'Planner',
  journal: 'Journal',
  cash: 'Cash plan',
  import: 'Import',
}

export function useViewSwitcher() {
  const [view, setView] = useState<ViewKey>('cockpit')
  const views = useMemo(
    () => VIEW_ORDER.map((key, index) => ({ key, label: VIEW_LABELS[key], shortcut: `⌘${index + 1}` })),
    [],
  )

  function switchView(nextView: ViewKey) {
    setView(nextView)
  }

  return { view, views, switchView }
}
