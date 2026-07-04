import type { Env } from './env'

/**
 * Validates MAA client authentication.
 * Supports token-based auth via Authorization header or query param.
 */
export function validateMaaAuth(request: Request, env: Env): boolean {
  // In development, allow all requests
  if (env.ENVIRONMENT === 'development' && !env.MAA_TOKENS) {
    return true
  }

  const tokens = env.MAA_TOKENS?.split(',').map((t) => t.trim()) ?? []
  if (tokens.length === 0) {
    return true // No tokens configured = open access
  }

  // Check Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (tokens.includes(token)) {
      return true
    }
  }

  // Check query param fallback (for compatibility)
  const url = new URL(request.url)
  const tokenParam = url.searchParams.get('token')
  if (tokenParam && tokens.includes(tokenParam)) {
    return true
  }

  return false
}

/**
 * Validates dashboard API authentication.
 * Uses API_SECRET env var for bearer token auth.
 */
export function validateApiAuth(request: Request, env: Env): boolean {
  // In development without secret, allow all
  if (env.ENVIRONMENT === 'development' && !env.API_SECRET) {
    return true
  }

  if (!env.API_SECRET) {
    return false // No secret configured = deny all in production
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === env.API_SECRET
  }

  return false
}

/**
 * Extracts actor identifier from request for audit logging.
 */
export function getActor(request: Request): string {
  // Could be enhanced with JWT claims, API key identity, etc.
  return request.headers.get('X-Actor') ?? 'dashboard'
}
