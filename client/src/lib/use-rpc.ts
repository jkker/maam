import { useMemo } from 'react'

import { useAuthStore } from './auth-store'
import { orpc } from './orpc'

/**
 * Reactive hook for oRPC that updates when auth state changes
 * This ensures queries/mutations automatically use the latest auth credentials
 */
export function useRPC() {
  // Subscribe to auth changes
  const user = useAuthStore((state) => state.user)
  const device = useAuthStore((state) => state.device)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  // Return the orpc instance - it will use the latest auth from the store
  // The useMemo ensures we don't recreate the reference unnecessarily
  return useMemo(
    () => ({
      ...orpc,
      isAuthenticated,
      user,
      device,
    }),
    [isAuthenticated, user, device],
  )
}
