import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  children?: ReactNode
  value?: string
  type?: 'text' | 'number' | 'date'
  min?: string
  max?: string
  step?: string
  placeholder?: string
  textarea?: boolean
  onChange?: (value: string) => void
}

export function Field(props: FieldProps) {
  const control = props.children ? (
    props.children
  ) : props.textarea ? (
    <textarea
      placeholder={props.placeholder}
      value={props.value ?? ''}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  ) : (
    <input
      max={props.max}
      min={props.min}
      placeholder={props.placeholder}
      step={props.step}
      type={props.type ?? 'text'}
      value={props.value ?? ''}
      onChange={(event) => props.onChange?.(event.target.value)}
    />
  )

  if (props.children) {
    return (
      <label className="field">
        <span className="label">{props.label}</span>
        {control}
      </label>
    )
  }

  return (
    <label className="field">
      <span className="label">{props.label}</span>
      {control}
    </label>
  )
}
