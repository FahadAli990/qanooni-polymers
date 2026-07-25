import axios from 'axios'
import { TOKEN_KEY } from '../constants/app'

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const api = axios.create({ baseURL: apiBase })

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      onUnauthorized?.()
    }
    return Promise.reject(err)
  },
)

export default api

export function getErrorMessage(err) {
  return err.response?.data?.error || err.message || 'Something went wrong'
}
