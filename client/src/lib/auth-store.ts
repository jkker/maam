import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: string | undefined
  device: string | undefined
  isAuthenticated: boolean
}

export const useAuthStore = create<AuthState>()(
  persist((_set) => ({ user: undefined, device: undefined, isAuthenticated: false }), {
    name: 'maam-auth-storage',
  }),
)
