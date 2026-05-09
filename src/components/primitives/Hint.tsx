import type { ReactNode } from 'react'

export function Hint(props: { children: ReactNode; variant?: 'warn' }) {
  return <div className={`hint ${props.variant ?? ''}`}>{props.children}</div>
}
