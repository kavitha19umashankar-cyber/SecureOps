import axios from 'axios'
import { useAuthStore } from '../store/auth'

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://10.0.2.2:3001'

export const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, updateToken, logout } = useAuthStore.getState()
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken })
          const { accessToken } = res.data.data.tokens
          updateToken(accessToken)
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch {
          logout()
        }
      }
    }
    return Promise.reject(err)
  },
)
