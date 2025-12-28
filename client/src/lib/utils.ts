import type { TaskType } from '@maam/server/schema'

import { T } from '@maam/server/const'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn: typeof clsx = (...inputs) => twMerge(clsx(inputs))

export const formatTaskType = (type: string) => T[type as TaskType] || type
