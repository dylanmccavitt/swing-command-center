export function Sparkbar(props: { delta?: number | null }) {
  const delta = props.delta ?? 0
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : ''

  return (
    <div className="spark" aria-hidden="true">
      {Array.from({ length: 10 }).map((_, index) => {
        const seed = Math.sin(index * 1.7 + delta * 3.1) * 0.5 + 0.5
        const height = 6 + Math.round(seed * 12)
        const className = index > 5 ? tone : ''

        return <span className={className} key={index} style={{ height }} />
      })}
    </div>
  )
}
