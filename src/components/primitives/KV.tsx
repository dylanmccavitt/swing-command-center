import type { ReactNode } from 'react'

export function KV(props: {
  label: string
  value: ReactNode
  tone?: 'pos' | 'neg' | 'warn'
}) {
  return (
    <div className="kv">
      <span className="k">{props.label}</span>
      <span className={`v ${props.tone ?? ''}`}>{props.value}</span>
    </div>
  )
}
