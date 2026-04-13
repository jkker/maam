import { regex } from 'arkregex'

export const hexColorRegex = regex('^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')

export const usernameRegex = regex('^[a-zA-Z0-9_]{3,20}$')

export const phoneRegex = regex('^\\+?[1-9]\\d{1,14}$')
