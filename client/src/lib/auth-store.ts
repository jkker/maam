import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  userId: string | null
  deviceId: string | null
  deviceName: string | null
  isAuthenticated: boolean
  
  // Actions
  login: (userId: string, deviceId: string, deviceName?: string) => void
  logout: () => void
  updateDeviceName: (name: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      deviceId: null,
      deviceName: null,
      isAuthenticated: false,

      login: (userId: string, deviceId: string, deviceName?: string) =>
        set({
          userId,
          deviceId,
          deviceName: deviceName || null,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          userId: null,
          deviceId: null,
          deviceName: null,
          isAuthenticated: false,
        }),

      updateDeviceName: (name: string) =>
        set((state) => ({
          ...state,
          deviceName: name,
        })),
    }),
    {
      name: 'maam-auth-storage',
    },
  ),
)
