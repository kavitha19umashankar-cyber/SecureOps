import axios from 'axios'
import Cookies from 'js-cookie'

// NEXT_PUBLIC_API_URL is inlined by Next.js from .env.local at dev-server startup.
// Falls back to the local API port so it always works out of the box.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = Cookies.get('refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
          const { accessToken } = res.data.data.tokens
          Cookies.set('access_token', accessToken, { expires: 1 / 96 })
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch {
          Cookies.remove('access_token')
          Cookies.remove('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  },
)
