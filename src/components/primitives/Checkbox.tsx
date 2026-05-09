export function Checkbox(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="checkbox">
      <input
        checked={props.checked}
        type="checkbox"
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  )
}
