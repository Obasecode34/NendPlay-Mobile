// src/stores/playerStore.js
import { create } from 'zustand'

const usePlayerStore = create((set) => ({
  currentMedia: null,
  isPlaying: false,
  volume: 1.0,
  position: 0,
  duration: 0,
  isMiniPlayer: false,

  setMedia: (media) => set({
    currentMedia: media,
    isPlaying: true,
    isMiniPlayer: true,
    position: 0,
  }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPosition: (position) => set({ position }),
  setDuration: (duration) => set({ duration }),
  clearMedia: () => set({
    currentMedia: null,
    isPlaying: false,
    isMiniPlayer: false,
    position: 0,
  }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
}))

export default usePlayerStore
