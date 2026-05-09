export function SectionDivider(props: { label: string; meta?: string }) {
  return (
    <div className="section-divider">
      <span className="label">— {props.label}</span>
      <span className="rule" />
      {props.meta ? <span className="meta">{props.meta}</span> : null}
    </div>
  )
}
