export function ScoreBar(props: { score: number; openFields?: number }) {
  return (
    <>
      <div className="score-bar">
        <div className="track">
          <div className="fill" style={{ width: `${props.score}%` }} />
        </div>
        <div className="num">{props.score} / 100</div>
      </div>
      {props.openFields !== undefined ? (
        <div className="muted small" style={{ marginTop: 4 }}>
          {props.openFields} open fields
        </div>
      ) : null}
    </>
  )
}
