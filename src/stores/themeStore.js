// src/stores/themeStore.js
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTheme, getAllThemes } from '../theme/themes'

const THEME_KEY = 'nendplay-theme'

const useThemeStore = create((set, get) => ({
  activeThemeId: 'midnight',
  theme: getTheme('midnight'),
  themes: getAllThemes(),

  // Load saved theme on app start
  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY)
      const themeId = saved || 'midnight'
      set({ activeThemeId: themeId, theme: getTheme(themeId) })
    } catch {
      set({ activeThemeId: 'midnight', theme: getTheme('midnight') })
    }
  },

  // Set and persist theme
  setTheme: async (themeId) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, themeId)
    } catch {}
    set({ activeThemeId: themeId, theme: getTheme(themeId) })
  },
}))

export default useThemeStore
