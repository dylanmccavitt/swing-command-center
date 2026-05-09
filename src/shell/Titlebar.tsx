import { useEffect, useState } from 'react'
import type { Theme } from '../hooks/useTheme'

export function Titlebar(props: {
  breadcrumb: string
  marketStatus: string
  theme: Theme
  onToggleTheme: () => void
}) {
  const [time, setTime] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatClock(new Date())), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="titlebar">
      <div className="traffic" aria-hidden="true">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
      <div className="center">{props.breadcrumb}</div>
      <div className="right">
        <span className="live">live · {props.marketStatus.toLowerCase()}</span>
        <span>{time}</span>
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={props.onToggleTheme}
        >
          [ {props.theme} ]
        </button>
      </div>
    </header>
  )
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}
