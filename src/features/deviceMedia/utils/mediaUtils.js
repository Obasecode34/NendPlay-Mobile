export const DEVICE_TABS = {
  VIDEOS: 'videos',
  MUSIC: 'music',
}

export const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'name', label: 'Name', icon: 'text-outline' },
  { key: 'duration', label: 'Length', icon: 'timer-outline' },
  { key: 'size', label: 'Size', icon: 'file-tray-full-outline' },
]

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export const VIDEO_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'recent', label: 'Recent' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'movies', label: 'Movies' },
  { key: 'series', label: 'Series' },
  { key: 'folders', label: 'Folders' },
]

export const MUSIC_SECTIONS = [
  { key: 'trending', label: 'Trending Music', terms: ['hit', 'trend', 'viral'] },
  { key: 'new', label: 'New Releases', terms: ['new', '2026', 'latest'] },
  { key: 'recommended', label: 'Recommended For You', terms: [] },
  { key: 'charts', label: 'Top Charts', terms: ['top', 'chart', 'best'] },
  { key: 'genres', label: 'Genres', terms: ['afro', 'gospel', 'hip', 'jazz', 'pop'] },
  { key: 'podcasts', label: 'Podcasts', terms: ['podcast'] },
]

export function cleanTitle(filename = '') {
  const value = String(filename || '')
  return value.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || value || 'Unknown media'
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatSize(bytes = 0) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
}

export function getAssetSize(asset) {
  if (!asset) return 0
  return Number(asset.fileSize || asset.mediaSubtypes?.fileSize || 0) || 0
}

export function getSourceForUri(uri, title = '') {
  const lower = `${uri}`.toLowerCase()
  const contentType = lower.includes('.m3u8') ? 'hls' : 'auto'
  return {
    uri,
    contentType,
    useCaching: !lower.includes('.m3u8'),
    metadata: { title: cleanTitle(title), artist: 'NendPlay Media' },
  }
}

export function getVideoBucket(asset) {
  if (!asset) return 'recent'
  const text = `${asset.filename || ''}`.toLowerCase()
  if (text.includes('download') || text.includes('/download')) return 'downloads'
  if (text.includes('s0') || text.includes('season') || text.includes('episode') || text.includes('e0')) return 'series'
  if (asset.duration >= 3600 || text.includes('movie') || text.includes('film')) return 'movies'
  return 'recent'
}

export function filterVideoAssets(items, filter) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!filter || filter === 'all') return safeItems
  if (filter === 'folders') return safeItems
  return safeItems.filter((item) => getVideoBucket(item) === filter)
}

export function sortAssets(items, mode) {
  const sorted = (Array.isArray(items) ? items : []).filter(Boolean)
  if (mode === 'name') {
    sorted.sort((a, b) => cleanTitle(a.filename).localeCompare(cleanTitle(b.filename)))
  } else if (mode === 'duration') {
    sorted.sort((a, b) => (b.duration || 0) - (a.duration || 0))
  } else if (mode === 'size') {
    sorted.sort((a, b) => getAssetSize(b) - getAssetSize(a))
  } else {
    sorted.sort((a, b) => (b.creationTime || b.modificationTime || 0) - (a.creationTime || a.modificationTime || 0))
  }
  return sorted
}

function searchableAssetText(item = {}) {
  const filename = item.filename || ''
  const extension = filename.includes('.') ? filename.split('.').pop() : ''
  return [
    filename,
    cleanTitle(filename),
    extension,
    item.id,
    item.uri,
    item.localUri,
    item.mediaType,
    item.albumId,
    item.albumTitle,
    item.title,
    item.artist,
    item.author,
    item.description,
    item.mediaSubtypes,
  ]
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function searchAssets(items, query) {
  const terms = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  if (!terms.length) return safeItems
  return safeItems.filter((item) => {
    const haystack = searchableAssetText(item)
    return terms.every((term) => haystack.includes(term))
  })
}

export function buildMusicRows(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
  const fallback = safeItems.slice(0, 12)
  return MUSIC_SECTIONS.map((section) => {
    const sectionItems = section.terms.length
      ? safeItems.filter((item) => section.terms.some((term) => cleanTitle(item.filename).toLowerCase().includes(term)))
      : fallback
    return { ...section, items: sectionItems.length ? sectionItems.slice(0, 12) : fallback }
  }).filter((section) => section.items.length)
}
