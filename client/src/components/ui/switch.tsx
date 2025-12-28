import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'

import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

interface TriStateSwitchProps extends Omit<
  React.ComponentProps<typeof SwitchPrimitive.Root>,
  'checked' | 'onCheckedChange'
> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
  loading?: boolean
  thumb?: React.ReactNode
}

export function TriStateSwitch({
  className,
  checked,
  onCheckedChange,
  loading = false,
  disabled = false,
  thumb,
  ...props
}: TriStateSwitchProps) {
  const handleCheckedChange = (newChecked: boolean) => {
    if (loading || disabled || !onCheckedChange) return
    onCheckedChange(newChecked)
  }

  const isDisabled = loading || disabled

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-loading={loading ? 'true' : 'false'}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      disabled={isDisabled}
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input data-[loading=true]:opacity-70 focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0',
          "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-2 grid place-items-center",
        )}
      >
        {thumb}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}
