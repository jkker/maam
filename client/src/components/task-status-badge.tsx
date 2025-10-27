import { cva, type VariantProps } from 'class-variance-authority'
import { Ban, CheckCircle2, Circle, Clock, Loader2, type LucideIcon, XCircle } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const taskStatusBadgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      status: {
        SUCCESS: 'border-transparent bg-green-100 text-green-800 [a&]:hover:bg-green-200',
        PENDING: 'border-transparent bg-yellow-100 text-yellow-800 [a&]:hover:bg-yellow-200',
        RUNNING: 'border-transparent bg-blue-100 text-blue-800 [a&]:hover:bg-blue-200',
        FAILED: 'border-transparent bg-red-100 text-red-800 [a&]:hover:bg-red-200',
        CANCELLED: 'border-transparent bg-gray-100 text-gray-800 [a&]:hover:bg-gray-200',
        DONE: 'border-transparent bg-purple-100 text-purple-800 [a&]:hover:bg-purple-200',
      },
    },
    defaultVariants: {
      status: 'PENDING',
    },
  },
)

const statusIcons: Record<string, LucideIcon> = {
  SUCCESS: CheckCircle2,
  PENDING: Clock,
  RUNNING: Loader2,
  FAILED: XCircle,
  CANCELLED: Ban,
  DONE: Circle,
}

interface TaskStatusBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'children'>,
    VariantProps<typeof taskStatusBadgeVariants> {
  iconOnly?: boolean
  children?: React.ReactNode
}

function TaskStatusBadge({
  className,
  status = 'PENDING',
  iconOnly = false,
  children,
  ...props
}: TaskStatusBadgeProps) {
  const Icon = status ? statusIcons[status] : Clock
  const displayText = children || status

  return (
    <span
      data-slot="task-status-badge"
      className={cn(taskStatusBadgeVariants({ status }), iconOnly && 'p-1', className)}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn('size-3', status === 'RUNNING' && 'animate-spin')}
          aria-hidden={!iconOnly}
        />
      )}
      {!iconOnly && <span>{displayText}</span>}
    </span>
  )
}

export { TaskStatusBadge }
