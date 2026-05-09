import type { ReactNode } from 'react'

export function FieldRow(props: { children: ReactNode }) {
  return <div className="field-row">{props.children}</div>
}
