import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: string | undefined
  device: string | undefined
  isAuthenticated: boolean

  // Actions
  login: (user: string, device: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: undefined,
      device: undefined,
      isAuthenticated: false,
      login: (user: string, device: string) =>
        set({
          user,
          device,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: undefined,
          device: undefined,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'maam-auth-storage',
    },
  ),
)
