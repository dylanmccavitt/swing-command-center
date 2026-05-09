import type { ReactNode } from 'react'

export function Card(props: { children: ReactNode; className?: string }) {
  return <article className={`card ${props.className ?? ''}`}>{props.children}</article>
}
