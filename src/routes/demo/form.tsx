/* eslint-disable react/no-children-prop -- TanStack Form's AppField requires render-prop children attribute */
import { createFileRoute } from '@tanstack/react-router'
import { type } from 'arktype'
import { FileText } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { useAppForm } from '#/hooks/form'

const contactSchema = type({
  firstName: 'string >= 2',
  lastName: 'string >= 2',
  email: 'string.email',
  phone: 'string >= 7',
  department: "'engineering' | 'design' | 'product' | 'marketing'",
  experience: 'number.integer >= 0 & number <= 100',
  bio: 'string >= 10',
  newsletter: 'boolean',
})

export const Route = createFileRoute('/demo/form')({
  staticData: { title: 'Form', icon: FileText },
  component: FormDemo,
})

function FormDemo() {
  const [submitted, setSubmitted] = useState<typeof contactSchema.infer | null>(null)

  const form = useAppForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      department: '' as 'engineering' | 'design' | 'product' | 'marketing',
      experience: 50,
      bio: '',
      newsletter: false,
    },
    validators: {
      onChange: ({ value }) => {
        const result = contactSchema(value)
        if (result instanceof type.errors) {
          const fieldErrors: Record<string, string> = {}
          for (const error of result) {
            const path = error.path.join('.')
            fieldErrors[path] = error.message
          }
          return fieldErrors
        }
        return undefined
      },
    },
    onSubmit: ({ value }) => {
      setSubmitted(value as typeof contactSchema.infer)
    },
  })

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold">TanStack Form + Arktype</h1>
        <p className="text-muted-foreground">
          Comprehensive form with field-level validation, custom components via{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">createFormHook</code>, and
          Arktype schemas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Fill in the form fields to see validation in action.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField
                name="firstName"
                children={(field) => <field.TextField label="First Name" placeholder="Jane" />}
              />
              <form.AppField
                name="lastName"
                children={(field) => <field.TextField label="Last Name" placeholder="Doe" />}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.AppField
                name="email"
                children={(field) => (
                  <field.TextField label="Email" placeholder="jane@example.com" />
                )}
              />
              <form.AppField
                name="phone"
                children={(field) => (
                  <field.TextField label="Phone" placeholder="+1 (555) 123-4567" />
                )}
              />
            </div>

            <form.AppField
              name="department"
              children={(field) => (
                <field.SelectField
                  label="Department"
                  placeholder="Choose a department"
                  values={[
                    { label: 'Engineering', value: 'engineering' },
                    { label: 'Design', value: 'design' },
                    { label: 'Product', value: 'product' },
                    { label: 'Marketing', value: 'marketing' },
                  ]}
                />
              )}
            />

            <form.AppField
              name="experience"
              children={(field) => <field.SliderField label="Experience Level (%)" />}
            />

            <form.AppField
              name="bio"
              children={(field) => <field.TextAreaField label="Bio" rows={4} />}
            />

            <form.AppField
              name="newsletter"
              children={(field) => <field.SwitchField label="Subscribe to newsletter" />}
            />

            <div className="flex items-center gap-4">
              <form.AppForm>
                <form.SubmitButton label="Submit" />
              </form.AppForm>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  form.reset()
                  setSubmitted(null)
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {submitted && (
        <Card>
          <CardHeader>
            <CardTitle>Submitted Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
