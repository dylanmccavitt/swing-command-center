import type { ReactNode } from 'react'

export function PanelHead(props: {
  kicker: string
  title: string
  pill?: ReactNode
}) {
  return (
    <div className="panel-head">
      <div>
        <div className="kicker">{props.kicker}</div>
        <div className="title">{props.title}</div>
      </div>
      {props.pill ? <span className="pill">{props.pill}</span> : null}
    </div>
  )
}
