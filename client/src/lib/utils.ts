import type { TaskType } from '@maam/server'

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatTaskType = (type: TaskType) => {
  return type.replace('LinkStart-', '')
}
