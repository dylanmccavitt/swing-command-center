import { useEffect, useRef } from 'react'
import type { ViewKey } from './useViewSwitcher'
import { VIEW_ORDER } from './useViewSwitcher'

type HotkeyOptions = {
  onCommandPalette: () => void
  onNewTicket: () => void
  onView: (view: ViewKey) => void
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useHotkeys(options: HotkeyOptions) {
  const chordRef = useRef('')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && /^[1-6]$/.test(event.key)) {
        event.preventDefault()
        options.onView(VIEW_ORDER[Number(event.key) - 1])
        return
      }

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        options.onCommandPalette()
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (key === 'g') {
        chordRef.current = 'g'
        window.setTimeout(() => {
          chordRef.current = ''
        }, 900)
        return
      }

      if (chordRef.current === 'g' && key === 'j') {
        event.preventDefault()
        chordRef.current = ''
        options.onView('journal')
        return
      }

      if (chordRef.current === 'g' && key === 'r') {
        event.preventDefault()
        chordRef.current = ''
        options.onView('research')
        return
      }

      if (key === 'n') {
        event.preventDefault()
        options.onNewTicket()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [options])
}
