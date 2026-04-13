import { type LucideIcon, CheckIcon, CopyIcon, TerminalIcon } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Field, FieldGroup } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { useCopyToClipboard } from '#/hooks/use-copy-to-clipboard'

interface CopyItem {
  id: string
  label: string
  description: string
  value: string
  icon: LucideIcon
}

function CopyableItem({ item }: { item: CopyItem }) {
  const { copy, isCopied } = useCopyToClipboard()

  return (
    <div className="flex items-start gap-3 border-b p-4 last:border-b-0">
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        <item.icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={item.id} className="text-sm font-medium">
            {item.label}
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => copy(item.value, { withToast: true })}
            className="h-7 w-7"
            aria-label={`Copy ${item.label}`}
          >
            {isCopied ? (
              <CheckIcon className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{item.description}</p>
        <Field>
          <FieldGroup>
            <Input id={item.id} value={item.value} readOnly className="font-mono text-xs" />
          </FieldGroup>
        </Field>
      </div>
    </div>
  )
}

export function CopyToClipboardExample({
  items = [
    {
      id: 'username-validation',
      label: 'Username Validation',
      description: 'Regex pattern for username validation',
      value: '^[a-zA-Z0-9_]{3,20}$',
      icon: TerminalIcon,
    },
    {
      id: 'phone-validation',
      label: 'Phone Validation',
      description: 'Regex pattern for phone number validation',
      value: '^\\+?[1-9]\\d{1,14}$',
      icon: TerminalIcon,
    },
    {
      id: 'hex-color-validation',
      label: 'Hex Color Validation',
      description: 'Regex pattern for hex color validation',
      value: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$',
      icon: TerminalIcon,
    },
  ],
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy to Clipboard Examples</CardTitle>
        <CardDescription>
          Demonstration of the useCopyToClipboard hook with various use cases
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="text-sm font-semibold">Quick Copy with Toast Notification</div>
          <div className="rounded-lg border bg-card">
            {items.map((item) => (
              <CopyableItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
