import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'nendplay_continue_watching'
const MAX_ITEMS = 40

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

export async function getContinueWatching() {
  return readItems()
}

export async function upsertContinueWatching(media, progress = {}) {
  if (!media?._id) return
  const percent = Number(progress.progress || 0)
  if (percent >= 0.95) {
    await removeContinueWatching(media._id)
    return
  }

  const item = {
    _id: media._id,
    title: media.title || 'Untitled',
    type: media.type || 'media',
    thumbnailUrl: media.thumbnailUrl || '',
    progress: Math.max(0, Math.min(percent, 0.94)),
    position: Number(progress.position || 0),
    duration: Number(progress.duration || media.duration || 0),
    updatedAt: new Date().toISOString(),
  }

  const current = await readItems()
  await writeItems([item, ...current.filter((entry) => entry._id !== media._id)])
}

export async function removeContinueWatching(mediaId) {
  if (!mediaId) return
  const current = await readItems()
  await writeItems(current.filter((entry) => entry._id !== mediaId))
}
