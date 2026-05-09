import type { ReactNode } from 'react'

export function Panel(props: { children: ReactNode; className?: string }) {
  return <div className={`panel ${props.className ?? ''}`}>{props.children}</div>
}
