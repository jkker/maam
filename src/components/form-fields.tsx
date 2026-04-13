/* eslint-disable typescript-eslint/no-unsafe-return -- TanStack Form useStore types meta.errors as any[] */
import { useStore } from '@tanstack/react-form'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import * as ShadcnSelect from '#/components/ui/select'
import { Slider as ShadcnSlider } from '#/components/ui/slider'
import { Switch as ShadcnSwitch } from '#/components/ui/switch'
import { Textarea as ShadcnTextarea } from '#/components/ui/textarea'
import { useFieldContext, useFormContext } from '#/hooks/form-context'

function ErrorMessages({ errors }: { errors: Array<string | { message: string }> }) {
  return (
    <>
      {errors.map((error) => (
        <p
          key={typeof error === 'string' ? error : error.message}
          className="mt-1 text-sm font-medium text-destructive"
        >
          {typeof error === 'string' ? error : error.message}
        </p>
      ))}
    </>
  )
}

export function SubmitButton({ label = 'Submit' }: { label?: string }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? 'Submitting…' : label}
        </Button>
      )}
    </form.Subscribe>
  )
}

export function TextField({ label, placeholder }: { label: string; placeholder?: string }) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors) as Array<
    string | { message: string }
  >

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        value={field.state.value}
        placeholder={placeholder}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  )
}

export function TextAreaField({ label, rows = 3 }: { label: string; rows?: number }) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors) as Array<
    string | { message: string }
  >

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <ShadcnTextarea
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        rows={rows}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  )
}

export function SelectField({
  label,
  values,
  placeholder,
}: {
  label: string
  values: Array<{ label: string; value: string }>
  placeholder?: string
}) {
  const field = useFieldContext<string>()
  const errors = useStore(field.store, (state) => state.meta.errors) as Array<
    string | { message: string }
  >

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ShadcnSelect.Select
        name={field.name}
        value={field.state.value}
        onValueChange={(value) => {
          if (value !== null) field.handleChange(value)
        }}
      >
        <ShadcnSelect.SelectTrigger className="w-full">
          <ShadcnSelect.SelectValue placeholder={placeholder} />
        </ShadcnSelect.SelectTrigger>
        <ShadcnSelect.SelectContent>
          <ShadcnSelect.SelectGroup>
            <ShadcnSelect.SelectLabel>{label}</ShadcnSelect.SelectLabel>
            {values.map((v) => (
              <ShadcnSelect.SelectItem key={v.value} value={v.value}>
                {v.label}
              </ShadcnSelect.SelectItem>
            ))}
          </ShadcnSelect.SelectGroup>
        </ShadcnSelect.SelectContent>
      </ShadcnSelect.Select>
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  )
}

export function SliderField({ label }: { label: string }) {
  const field = useFieldContext<number>()
  const errors = useStore(field.store, (state) => state.meta.errors) as Array<
    string | { message: string }
  >

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {label}: {field.state.value}
      </Label>
      <ShadcnSlider
        id={field.name}
        onBlur={field.handleBlur}
        value={[field.state.value]}
        onValueChange={(value) => {
          field.handleChange(typeof value === 'number' ? value : value[0])
        }}
      />
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  )
}

export function SwitchField({ label }: { label: string }) {
  const field = useFieldContext<boolean>()
  const errors = useStore(field.store, (state) => state.meta.errors) as Array<
    string | { message: string }
  >

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShadcnSwitch
          id={field.name}
          onBlur={field.handleBlur}
          checked={field.state.value}
          onCheckedChange={(checked) => field.handleChange(checked)}
        />
        <Label htmlFor={field.name}>{label}</Label>
      </div>
      {field.state.meta.isTouched && <ErrorMessages errors={errors} />}
    </div>
  )
}
