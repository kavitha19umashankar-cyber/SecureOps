import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'
import type { LoginResponse } from '@secureops/types'

const secureStorage = {
  getItem: async (name: string) => {
    return await SecureStore.getItemAsync(name)
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value)
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name)
  },
}

interface AuthState {
  user: LoginResponse['user'] | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (data: LoginResponse) => void
  logout: () => void
  updateToken: (accessToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (data) => {
        set({
          user: data.user,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          isAuthenticated: true,
        })
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      updateToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'secureops-auth',
      storage: createJSONStorage(() => secureStorage),
    },
  ),
)
