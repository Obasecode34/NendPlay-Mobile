import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'nendplay-device-media-state'

const limitList = (items, max = 30) => items.slice(0, max)

const useDeviceMediaStore = create((set, get) => ({
  hydrated: false,
  favorites: {},
  history: [],
  continueWatching: {},
  playlists: [],
  musicQueue: [],
  repeatMode: 'off',
  shuffle: false,
  videoSettings: {
    playbackRate: 1,
    subtitleSize: 18,
    subtitleColor: '#FFFFFF',
    subtitleBackground: 'rgba(0,0,0,0.65)',
  },
  aiReadiness: {
    recommendationSignals: [],
    mediaDetectionVersion: 1,
  },

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        set({ ...parsed, hydrated: true })
        return
      }
    } catch {}
    set({ hydrated: true })
  },

  persist: async () => {
    const {
      favorites, history, continueWatching, playlists, musicQueue,
      repeatMode, shuffle, videoSettings, aiReadiness,
    } = get()
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        favorites, history, continueWatching, playlists, musicQueue,
        repeatMode, shuffle, videoSettings, aiReadiness,
      }))
    } catch {}
  },

  toggleFavorite: async (asset) => {
    const id = asset.id || asset.uri
    set((state) => {
      const next = { ...state.favorites }
      if (next[id]) delete next[id]
      else next[id] = {
        id,
        uri: asset.uri,
        filename: asset.filename,
        mediaType: asset.mediaType,
        duration: asset.duration,
        savedAt: Date.now(),
      }
      return { favorites: next }
    })
    await get().persist()
  },

  addHistory: async (asset, type) => {
    const id = asset.id || asset.uri
    set((state) => ({
      history: limitList([
        {
          id,
          uri: asset.uri,
          filename: asset.filename,
          mediaType: type,
          duration: asset.duration,
          playedAt: Date.now(),
        },
        ...state.history.filter((item) => item.id !== id),
      ]),
      aiReadiness: {
        ...state.aiReadiness,
        recommendationSignals: limitList([
          { type: 'play', mediaType: type, title: asset.filename, at: Date.now() },
          ...state.aiReadiness.recommendationSignals,
        ], 80),
      },
    }))
    await get().persist()
  },

  saveProgress: async (asset, position = 0, duration = 0) => {
    const id = asset.id || asset.uri
    if (!id || position < 5) return
    set((state) => ({
      continueWatching: {
        ...state.continueWatching,
        [id]: {
          id,
          uri: asset.uri,
          filename: asset.filename,
          position,
          duration,
          updatedAt: Date.now(),
        },
      },
    }))
    await get().persist()
  },

  setPlaybackRate: async (playbackRate) => {
    set((state) => ({ videoSettings: { ...state.videoSettings, playbackRate } }))
    await get().persist()
  },

  setSubtitleSetting: async (key, value) => {
    set((state) => ({ videoSettings: { ...state.videoSettings, [key]: value } }))
    await get().persist()
  },

  createPlaylist: async (name, assets = []) => {
    const playlist = {
      id: `playlist_${Date.now()}`,
      name,
      assets: assets.map((asset) => asset.id || asset.uri),
      createdAt: Date.now(),
    }
    set((state) => ({ playlists: [playlist, ...state.playlists] }))
    await get().persist()
    return playlist
  },

  setMusicQueue: async (assets) => {
    set({ musicQueue: assets.map((asset) => asset.id || asset.uri) })
    await get().persist()
  },

  toggleShuffle: async () => {
    set((state) => ({ shuffle: !state.shuffle }))
    await get().persist()
  },

  cycleRepeat: async () => {
    const next = get().repeatMode === 'off' ? 'all' : get().repeatMode === 'all' ? 'one' : 'off'
    set({ repeatMode: next })
    await get().persist()
  },
}))

export default useDeviceMediaStore
