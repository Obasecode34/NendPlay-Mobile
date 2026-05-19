// src/services/api.js
// Axios instance for React Native.
// Access token stored in memory.
// Refresh token stored in SecureStore (encrypted native storage).

import 'react-native-url-polyfill/auto'
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

// Replace with your backend URL
// For development: use your computer's local IP (not localhost)
// localhost on mobile = the phone itself, not your computer
// Find your IP: ipconfig (Windows) → look for IPv4 under Wi-Fi
const BASE_URL = 'http://10.36.141.186:5000/api' // ← UPDATE THIS

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Token management
export const TokenManager = {
  accessToken: null,

  setAccessToken: (token) => {
    TokenManager.accessToken = token
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  },

  clearAccessToken: () => {
    TokenManager.accessToken = null
    delete api.defaults.headers.common['Authorization']
  },

  // Refresh token stored securely on device
  saveRefreshToken: async (token) => {
    try {
      await SecureStore.setItemAsync('nendplay_refresh_token', token)
    } catch {}
  },

  getRefreshToken: async () => {
    try {
      return await SecureStore.getItemAsync('nendplay_refresh_token')
    } catch {
      return null
    }
  },

  clearRefreshToken: async () => {
    try {
      await SecureStore.deleteItemAsync('nendplay_refresh_token')
    } catch {}
  },
}

// ── Interceptor: auto-refresh on 401 ──────────────────────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh-token') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = await TokenManager.getRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')

        const res = await api.post('/auth/refresh-token', { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = res.data.data

        TokenManager.setAccessToken(accessToken)
        await TokenManager.saveRefreshToken(newRefreshToken)

        // Update auth store
        const { default: useAuthStore } = await import('./authStore.native')
        useAuthStore.getState().setAccessToken(accessToken)

        processQueue(null, accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        const { default: useAuthStore } = await import('./authStore.native')
        useAuthStore.getState().clearAuth()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
