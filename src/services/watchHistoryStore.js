import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'nendplay_watch_history'
const MAX_ITEMS = 200

async function readItems() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeItems(items) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {}
}

export async function getWatchHistory() {
  return readItems()
}

export async function addWatchHistory(media, progress = {}) {
  if (!media?._id) return

  const item = {
    _id: media._id,
    title: media.title || 'Untitled',
    type: media.type || 'media',
    thumbnailUrl: media.thumbnailUrl || '',
    duration: Number(progress.duration || media.duration || 0),
    completed: true,
    watchedAt: new Date().toISOString(),
  }

  const current = await readItems()
  await writeItems([item, ...current.filter((entry) => entry._id !== media._id)])
}

export async function clearWatchHistoryByDays(days) {
  if (days === 'all') {
    await writeItems([])
    return []
  }

  const numberOfDays = Number(days)
  if (!Number.isFinite(numberOfDays) || numberOfDays <= 0) {
    return readItems()
  }

  const cutoff = Date.now() - numberOfDays * 24 * 60 * 60 * 1000
  const current = await readItems()
  const remaining = current.filter((entry) => {
    const watchedAt = new Date(entry.watchedAt || entry.updatedAt || 0).getTime()
    return !watchedAt || watchedAt < cutoff
  })
  await writeItems(remaining)
  return remaining
}
