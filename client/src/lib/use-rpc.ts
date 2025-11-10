import { useAuthStore } from './auth-store'
import { orpc } from './orpc'

/**
 * Reactive hook for oRPC that updates when auth state changes
 * Returns the orpc instance which will automatically use current auth from headers callback
 * 
 * Note: To enable/disable queries based on auth, manually pass enabled option:
 * useQuery(orpc.someQuery.queryOptions({ input, enabled: isAuthenticated }))
 */
export function useRPC() {
  // Subscribe to auth state for reactivity
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  return { orpc, isAuthenticated }
}
