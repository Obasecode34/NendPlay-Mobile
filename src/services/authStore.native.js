// src/services/authStore.native.js
import { create } from 'zustand'
import { TokenManager } from './api'
import api from './api'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    TokenManager.setAccessToken(accessToken)
    if (refreshToken) {
      await TokenManager.saveRefreshToken(refreshToken)
    }
    set({ user, accessToken, isAuthenticated: true, isLoading: false })
  },

  updateUser: (updatedUser) => {
    set((state) => ({ user: { ...state.user, ...updatedUser } }))
  },

  setAccessToken: (accessToken) => {
    TokenManager.setAccessToken(accessToken)
    set({ accessToken })
  },

  clearAuth: async () => {
    TokenManager.clearAccessToken()
    await TokenManager.clearRefreshToken()
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
  },

  // Check for existing session on app launch
  initAuth: async () => {
    try {
      const refreshToken = await TokenManager.getRefreshToken()
      if (!refreshToken) {
        set({ isLoading: false })
        return
      }

      const res = await api.post('/auth/refresh-token', { refreshToken })
      if (res.data.success) {
        const { user, accessToken, refreshToken: newRefreshToken } = res.data.data
        await get().setAuth(user, accessToken, newRefreshToken)
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    await get().clearAuth()
  },
}))

export default useAuthStore
