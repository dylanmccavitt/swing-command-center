type StatTone = 'neutral' | 'pos' | 'neg' | 'warn'

export function Stat(props: {
  label: string
  value: string
  sub: string
  tone?: StatTone
}) {
  return (
    <div className="stat">
      <div className="label">{props.label}</div>
      <div className={`value ${props.tone ?? ''}`}>{props.value}</div>
      <div className="sub">{props.sub}</div>
    </div>
  )
}
