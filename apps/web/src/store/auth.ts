import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Cookies from 'js-cookie'
import type { LoginResponse } from '@secureops/types'

interface AuthState {
  user: LoginResponse['user'] | null
  isAuthenticated: boolean
  login: (data: LoginResponse) => void
  logout: () => void
}

// SSR-safe storage: returns null on the server, uses localStorage on the client.
const ssrSafeStorage = createJSONStorage(() => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } as Storage
  }
  return localStorage
})

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: (data) => {
        Cookies.set('access_token', data.tokens.accessToken, { expires: 1 / 96 })
        Cookies.set('refresh_token', data.tokens.refreshToken, { expires: 7 })
        set({ user: data.user, isAuthenticated: true })
      },

      logout: () => {
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'secureops-auth',
      storage: ssrSafeStorage,
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      skipHydration: true,
    },
  ),
)
