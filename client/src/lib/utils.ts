import { T, type TaskType } from '@maam/server/schema'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatTaskType = (type: TaskType) => {
  return T[type] || type
}
