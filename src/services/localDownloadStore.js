import * as FileSystem from 'expo-file-system'
import * as LegacyFileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ROOT_DIR = `${FileSystem.documentDirectory}nendplay-downloads/`
const INDEX_KEY = 'nendplay:local-downloads:index'

const EXTENSIONS = {
  media: 'mp4',
  document: 'pdf',
}

function sanitizeFilePart(value = '') {
  return String(value || 'file')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
}

function extensionFromMime(mimeType = '', fallback = 'bin') {
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('mpegurl') || mimeType.includes('m3u8')) return 'm3u8'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('quicktime')) return 'mov'
  if (mimeType.includes('audio/mpeg')) return 'mp3'
  if (mimeType.includes('audio/mp4')) return 'm4a'
  if (mimeType.includes('audio')) return 'mp3'
  if (mimeType.includes('video')) return 'mp4'
  return fallback
}

function extensionFromUrl(url = '', fallback = 'bin') {
  const clean = String(url).split('?')[0].split('#')[0]
  const match = clean.match(/\.([a-z0-9]{2,6})$/i)
  return match?.[1]?.toLowerCase() || fallback
}

function isHlsDownload({ fileUrl = '', mimeType = '', forceHls = false } = {}) {
  if (forceHls) return true
  const normalizedMime = String(mimeType || '').toLowerCase()
  const normalizedUrl = String(fileUrl || '').toLowerCase()
  return normalizedMime.includes('mpegurl') || normalizedMime.includes('m3u8') || normalizedUrl.includes('.m3u8')
}

function getOrigin(url = '') {
  const match = String(url).match(/^(https?:\/\/[^/]+)/i)
  return match?.[1] || ''
}

function getBasePath(url = '') {
  const clean = String(url).split('#')[0]
  const queryIndex = clean.indexOf('?')
  const withoutQuery = queryIndex >= 0 ? clean.slice(0, queryIndex) : clean
  return withoutQuery.slice(0, withoutQuery.lastIndexOf('/') + 1)
}

function resolveRemoteUrl(baseUrl = '', path = '') {
  const value = String(path || '').trim()
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/')) return `${getOrigin(baseUrl)}${value}`
  return `${getBasePath(baseUrl)}${value}`
}

function extensionFromPlaylistLine(url = '') {
  const ext = extensionFromUrl(url, 'ts')
  return ext === 'm3u8' ? 'ts' : ext
}

async function downloadPlaylistAsset(remoteUrl, localUri) {
  const info = await FileSystem.getInfoAsync(localUri)
  if (!info.exists) {
    const result = await LegacyFileSystem.downloadAsync(remoteUrl, localUri)
    if (result.status && result.status >= 400) {
      throw new Error(`HLS asset download failed with status ${result.status}.`)
    }
  }
  return getFileSize(localUri)
}

async function rewriteTagAssetUris({ line, playlistUrl, folder, namePrefix, assetIndex }) {
  const uriMatches = [...String(line).matchAll(/URI="([^"]+)"/gi)]
  if (!uriMatches.length) {
    return {
      line,
      storedFileSize: 0,
      nextAssetIndex: assetIndex,
    }
  }

  let rewrittenLine = line
  let storedFileSize = 0
  let nextAssetIndex = assetIndex
  for (const match of uriMatches) {
    const original = match[1]
    const remoteUrl = resolveRemoteUrl(playlistUrl, original)
    const extension = extensionFromUrl(remoteUrl, 'bin')
    const localUri = `${folder}${sanitizeFilePart(namePrefix)}-asset-${nextAssetIndex}.${extension}`
    storedFileSize += await downloadPlaylistAsset(remoteUrl, localUri)
    rewrittenLine = rewrittenLine.replace(`URI="${original}"`, `URI="${localUri}"`)
    nextAssetIndex += 1
  }

  return {
    line: rewrittenLine,
    storedFileSize,
    nextAssetIndex,
  }
}

async function ensureDir(path) {
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true })
}

async function getFileSize(uri) {
  const info = await FileSystem.getInfoAsync(uri)
  return info.exists ? info.size || 0 : 0
}

async function fetchPlaylistText(playlistUrl) {
  const response = await fetch(playlistUrl)
  if (!response.ok) {
    throw new Error(`Playlist download failed with status ${response.status}.`)
  }
  return response.text()
}

async function downloadHlsPlaylist({
  playlistUrl,
  folder,
  namePrefix = 'index',
  depth = 0,
}) {
  if (depth > 4) throw new Error('HLS playlist nesting is too deep to download safely.')

  const playlistUri = `${folder}${sanitizeFilePart(namePrefix)}.m3u8`
  const existing = await FileSystem.getInfoAsync(playlistUri)
  if (existing.exists) {
    return {
      localUri: playlistUri,
      storedFileSize: existing.size || 0,
    }
  }

  const playlistText = await fetchPlaylistText(playlistUrl)
  const lines = playlistText.split(/\r?\n/)
  const rewrittenLines = []
  let storedFileSize = 0
  let assetIndex = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      rewrittenLines.push(line)
      continue
    }
    if (trimmed.startsWith('#')) {
      const rewrittenTag = await rewriteTagAssetUris({
        line,
        playlistUrl,
        folder,
        namePrefix,
        assetIndex,
      })
      storedFileSize += rewrittenTag.storedFileSize
      assetIndex = rewrittenTag.nextAssetIndex
      rewrittenLines.push(rewrittenTag.line)
      continue
    }

    const remoteUrl = resolveRemoteUrl(playlistUrl, trimmed)
    const lowerRemoteUrl = remoteUrl.toLowerCase()

    if (lowerRemoteUrl.includes('.m3u8')) {
      const child = await downloadHlsPlaylist({
        playlistUrl: remoteUrl,
        folder,
        namePrefix: `${namePrefix}-variant-${assetIndex}`,
        depth: depth + 1,
      })
      storedFileSize += child.storedFileSize
      rewrittenLines.push(child.localUri)
      assetIndex += 1
      continue
    }

    const extension = extensionFromPlaylistLine(remoteUrl)
    const segmentUri = `${folder}${sanitizeFilePart(namePrefix)}-segment-${assetIndex}.${extension}`
    storedFileSize += await downloadPlaylistAsset(remoteUrl, segmentUri)
    rewrittenLines.push(segmentUri)
    assetIndex += 1
  }

  await FileSystem.writeAsStringAsync(playlistUri, rewrittenLines.join('\n'))
  storedFileSize += await getFileSize(playlistUri)

  return {
    localUri: playlistUri,
    storedFileSize,
  }
}

async function saveHlsDownloadFile({ fileUrl, contentId, title }) {
  const folder = `${ROOT_DIR}media/${sanitizeFilePart(contentId)}-${sanitizeFilePart(title)}-hls/`
  await ensureDir(ROOT_DIR)
  await ensureDir(`${ROOT_DIR}media/`)
  await ensureDir(folder)

  const result = await downloadHlsPlaylist({
    playlistUrl: fileUrl,
    folder,
    namePrefix: 'index',
  })

  return {
    localUri: result.localUri,
    storageKey: result.localUri,
    storedFileSize: result.storedFileSize,
    isHlsPackage: true,
  }
}

export async function saveDownloadFile({
  fileUrl,
  contentType,
  contentId,
  title,
  mimeType,
  forceHls,
}) {
  if (!fileUrl) throw new Error('No file URL available for this download.')

  const type = contentType === 'document' ? 'document' : 'media'
  if (type === 'media' && isHlsDownload({ fileUrl, mimeType, forceHls })) {
    return saveHlsDownloadFile({ fileUrl, contentId, title })
  }

  const folder = `${ROOT_DIR}${type}/`
  await ensureDir(ROOT_DIR)
  await ensureDir(folder)

  const fallbackExt = EXTENSIONS[type]
  const extension = extensionFromMime(mimeType, extensionFromUrl(fileUrl, fallbackExt))
  const filename = `${sanitizeFilePart(contentId)}-${sanitizeFilePart(title)}.${extension}`
  const localUri = `${folder}${filename}`

  const existing = await FileSystem.getInfoAsync(localUri)
  if (existing.exists) {
    return {
      localUri,
      storageKey: localUri,
      storedFileSize: existing.size || 0,
    }
  }

  const result = await LegacyFileSystem.downloadAsync(fileUrl, localUri)
  if (result.status && result.status >= 400) {
    throw new Error(`Download failed with status ${result.status}.`)
  }

  return {
    localUri: result.uri,
    storageKey: result.uri,
    storedFileSize: await getFileSize(result.uri),
  }
}

async function readIndex() {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function writeIndex(items) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(items))
}

function getSnapshotFromDownload(download = {}, fallback = {}) {
  const snap = download.contentSnapshot || {}
  return {
    title: fallback.title || snap.title || 'Downloaded file',
    thumbnailUrl: fallback.thumbnailUrl || snap.thumbnailUrl || '',
    type: fallback.type || snap.type || (download.contentType === 'document' ? 'pdf' : 'video'),
    category: fallback.category || snap.category || '',
    duration: fallback.duration || snap.duration || 0,
    fileSize: fallback.fileSize || snap.fileSize || 0,
    mimeType: fallback.mimeType || snap.mimeType || '',
    fileUrl: fallback.fileUrl || snap.fileUrl || '',
  }
}

export async function upsertLocalDownloadRecord({
  download,
  contentType,
  contentId,
  storageKey,
  storedFileSize,
  snapshot = {},
}) {
  if (!storageKey) return null
  const now = new Date().toISOString()
  const resolvedContentType = contentType || download?.contentType || 'media'
  const resolvedContentId = String(contentId || download?.contentId || download?._id || storageKey)
  const record = {
    _id: download?._id || `local-${resolvedContentType}-${resolvedContentId}`,
    localOnly: !download?._id,
    contentType: resolvedContentType,
    contentId: resolvedContentId,
    status: 'completed',
    storageKey,
    storedFileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || 0,
    downloadedAt: download?.downloadedAt || now,
    contentSnapshot: getSnapshotFromDownload(download, {
      ...snapshot,
      fileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || download?.contentSnapshot?.fileSize || 0,
    }),
  }

  const current = await readIndex()
  const next = [
    record,
    ...current.filter((item) => {
      const sameFile = item.storageKey === record.storageKey
      const sameContent = item.contentType === record.contentType && String(item.contentId) === String(record.contentId)
      return !sameFile && !sameContent
    }),
  ]
  await writeIndex(next)
  return record
}

export async function getLocalDownloads({ contentType } = {}) {
  const items = await readIndex()
  const checked = []
  const validStorageKeys = new Set()
  for (const item of items) {
    const uri = await getReadableUri(item.storageKey)
    if (!uri) continue
    validStorageKeys.add(item.storageKey)
    if (contentType && item.contentType !== contentType) continue
    checked.push({ ...item, localOnly: true, storageKey: uri })
  }
  if (validStorageKeys.size !== items.length) {
    await writeIndex(items.filter((item) => validStorageKeys.has(item.storageKey)))
  }
  return checked
}

export async function removeLocalDownloadRecord(identifier) {
  if (!identifier) return
  const current = await readIndex()
  await writeIndex(current.filter((item) => (
    item._id !== identifier &&
    item.storageKey !== identifier &&
    String(item.contentId) !== String(identifier)
  )))
}

export async function deleteLocalDownload(storageKey) {
  if (!storageKey || !storageKey.startsWith(FileSystem.documentDirectory)) return
  const info = await FileSystem.getInfoAsync(storageKey)
  if (info.exists) await FileSystem.deleteAsync(storageKey, { idempotent: true })
  await removeLocalDownloadRecord(storageKey)
}

export async function getReadableUri(storageKey) {
  if (!storageKey) return ''
  const info = await FileSystem.getInfoAsync(storageKey)
  if (!info.exists) return ''
  return storageKey
}
