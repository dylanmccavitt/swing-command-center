import type { ReactNode } from 'react'

export function Pill(props: { children: ReactNode; tone?: string }) {
  return <span className={`pill ${props.tone ?? ''}`}>{props.children}</span>
}
