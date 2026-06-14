// src/screens/DownloadsScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Device from 'expo-device'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { downloadService } from '../services/index'
import { deleteLocalDownload, getLocalDownloads, getReadableUri, removeLocalDownloadRecord } from '../services/localDownloadStore'

const DOWNLOAD_PAGE_LIMIT = 30

const CATEGORY_LABELS = {
  movies: '🎬 Movies', music: '🎵 Music', tvShows: '📺 TV Shows',
  videos: '🎥 Videos', podcasts: '🎙 Podcasts', shorts: '⚡ Shorts',
  documents: '📄 Documents', other: '📁 Other',
}

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DownloadsScreen({ embedded = false, contentType, navigation }) {
  const fallbackNavigation = useNavigation()
  const nav = navigation || fallbackNavigation
  const { theme } = useThemeStore()
  const { isAuthenticated } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [downloads, setDownloads] = useState([])
  const [grouped, setGrouped] = useState({})
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const deviceId = Device.osInternalBuildId || 'mobile-device'

  useEffect(() => {
    fetchAll()
  }, [isAuthenticated, contentType])

  const groupDownloads = (items = []) => {
    const buckets = {
      movies: [],
      music: [],
      tvShows: [],
      videos: [],
      podcasts: [],
      shorts: [],
      documents: [],
      other: [],
    }
    items.forEach((item) => {
      const type = item.contentSnapshot?.type || ''
      if (type === 'movie') buckets.movies.push(item)
      else if (type === 'music') buckets.music.push(item)
      else if (type === 'tv_show') buckets.tvShows.push(item)
      else if (type === 'video') buckets.videos.push(item)
      else if (type === 'podcast') buckets.podcasts.push(item)
      else if (type === 'short') buckets.shorts.push(item)
      else if (item.contentType === 'document') buckets.documents.push(item)
      else buckets.other.push(item)
    })
    return buckets
  }

  const mergeDownloads = (serverItems = [], localItems = []) => {
    const seen = new Set()
    return [...localItems, ...serverItems].filter((item) => {
      const key = `${item.contentType}:${item.contentId || item._id}:${item.storageKey || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => new Date(b.downloadedAt || 0) - new Date(a.downloadedAt || 0))
  }

  const mergeGrouped = (current = {}, next = {}) => {
    const merged = { ...current }
    Object.entries(next).forEach(([key, items]) => {
      merged[key] = [...(merged[key] || []), ...(items || [])]
    })
    return merged
  }

  const fetchAll = async (pageToLoad = 1, append = false) => {
    const localItems = await getLocalDownloads({ contentType })
    if (!isAuthenticated) {
      setDownloads(localItems)
      setGrouped(groupDownloads(localItems))
      setDeviceInfo(null)
      setPage(1)
      setHasMore(false)
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
      return
    }
    try {
      const params = { deviceId, page: pageToLoad, limit: DOWNLOAD_PAGE_LIMIT }
      if (contentType) params.contentType = contentType
      const [dlRes, devRes] = await Promise.all([
        downloadService.getAll(params),
        downloadService.getDevices(),
      ])
      const nextDownloads = dlRes.data.data.downloads || []
      const pagination = dlRes.data.data.pagination || {}
      const mergedDownloads = append
        ? mergeDownloads([...downloads, ...nextDownloads], localItems)
        : mergeDownloads(nextDownloads, localItems)
      setDownloads(mergedDownloads)
      setGrouped(groupDownloads(mergedDownloads))
      setDeviceInfo(devRes.data.data)
      setPage(pageToLoad)
      setHasMore(pageToLoad < (pagination.pages || 1))
    } catch {
      setDownloads(localItems)
      setGrouped(groupDownloads(localItems))
      setHasMore(false)
    } finally { setLoading(false); setRefreshing(false); setLoadingMore(false) }
  }

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchAll(page + 1, true)
  }

  const handleDelete = async (id) => {
    Alert.alert('Remove Download', 'Remove this from your downloads?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            const item = downloads.find((download) => download._id === id)
            if (item?.localOnly) {
              await deleteLocalDownload(item.storageKey)
              await removeLocalDownloadRecord(id)
            } else {
              const result = await downloadService.delete(id)
              const storageKey = result.data?.data?.storageKey
              await deleteLocalDownload(storageKey)
            }
            fetchAll(1, false)
          } catch { Alert.alert('Error', 'Failed to remove') }
        }
      }
    ])
  }

  const handleOpen = async (item) => {
    const localUri = await getReadableUri(item.storageKey)
    const url = localUri || item.contentSnapshot?.fileUrl
    if (!url) {
      Alert.alert('Open download', 'This downloaded item does not have a readable file link.')
      return
    }
    if (item.contentType === 'media') {
      nav?.navigate('MediaPlayer', {
        mediaId: item.contentId,
        localUri: url,
        offlineMedia: item.contentSnapshot,
      })
      return
    }

    if (item.contentType === 'document') {
      nav?.navigate('DocumentReader', {
        document: {
          ...item.contentSnapshot,
          id: item.contentId,
          storageKey: url,
          localUri: url,
        },
      })
      return
    }

    try { await Linking.openURL(url) }
    catch { Alert.alert('Open download', 'Unable to open this file on your device.') }
  }

  const getItems = () => activeTab === 'all' ? downloads : (grouped[activeTab] || [])
  const nonEmpty = Object.entries(grouped).filter(([, items]) => items.length > 0).map(([k]) => k)

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8, paddingHorizontal: 16,
      paddingBottom: 12, backgroundColor: c.bgDeep,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    title: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: c.textMuted, fontSize: 13 },
    deviceCard: {
      margin: 16, padding: 14, backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
    },
    deviceCardTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    slotBar: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    slot: { flex: 1, height: 6, borderRadius: 3 },
    slotInfo: { color: c.textMuted, fontSize: 12 },
    tabsRow: { paddingHorizontal: 16, marginBottom: 4 },
    itemCard: {
      flexDirection: 'row', gap: 12, padding: 14,
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    thumb: {
      width: 80, height: 56, borderRadius: 8,
      backgroundColor: c.surfaceHigh, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
    },
    itemTitle: { color: c.text, fontSize: 13, fontWeight: '600', marginBottom: 4 },
    itemMeta: { color: c.textMuted, fontSize: 11 },
    playBtn: {
      backgroundColor: c.primary, paddingHorizontal: 12,
      paddingVertical: 5, borderRadius: 8, marginTop: 6, alignSelf: 'flex-start',
    },
    playBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
  })

  const renderItem = ({ item }) => {
    const snap = item.contentSnapshot
    return (
      <View style={s.itemCard}>
        <View style={s.thumb}>
          <Ionicons
            name={item.contentType === 'media' ? 'play-circle' : 'document-text'}
            size={24} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.itemTitle} numberOfLines={1}>{snap.title}</Text>
          <Text style={s.itemMeta}>
            {snap.type?.replace('_', ' ')} · {formatSize(snap.fileSize)}
          </Text>
          <TouchableOpacity style={s.playBtn} onPress={() => handleOpen(item)}>
            <Text style={s.playBtnText}>
              {item.contentType === 'media' ? 'Play' : 'Read'}
            </Text>
          </TouchableOpacity>
          {item.contentType === 'document' ? (
            <Text style={s.itemMeta}>Read-only full PDF access</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item._id)} style={{ padding: 4 }}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {!embedded ? (
        <View style={s.header}>
          <Text style={s.title}>Downloads</Text>
          <Text style={s.subtitle}>{downloads.length} files saved offline</Text>
        </View>
      ) : null}

      {/* Device slots */}
      {deviceInfo && (
        <View style={s.deviceCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.deviceCardTitle}>Download Devices</Text>
            <Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>
              {deviceInfo.slotsUsed}/{deviceInfo.slotsTotal} slots
            </Text>
          </View>
          <View style={s.slotBar}>
            {[...Array(deviceInfo.slotsTotal || 1)].map((_, i) => (
              <View key={i} style={[s.slot, {
                backgroundColor: i < deviceInfo.slotsUsed ? c.primary : c.surfaceHigh
              }]} />
            ))}
          </View>
          <Text style={s.slotInfo}>{deviceInfo.plan} plan</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : downloads.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="download-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>No downloads yet</Text>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>
            {contentType === 'document'
              ? 'Download PDFs from NovelHub to unlock full access here'
              : 'Download media to watch offline'}
          </Text>
        </View>
      ) : (
        <>
          {/* Category tabs */}
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
            data={['all', ...nonEmpty]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setActiveTab(item)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: activeTab === item ? c.primary : c.surface,
                  borderWidth: 1, borderColor: activeTab === item ? c.primary : c.border,
                }}>
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: activeTab === item ? 'white' : c.textMuted,
                }}>
                  {item === 'all'
                    ? `All (${downloads.length})`
                    : `${CATEGORY_LABELS[item]} (${grouped[item]?.length})`
                  }
                </Text>
              </TouchableOpacity>
            )}
          />

          <FlatList
            data={getItems()}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            refreshControl={
              <RefreshControl refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchAll(1, false) }}
                tintColor={c.primary} />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.55}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={c.primary} style={{ marginVertical: 18 }} /> : null}
          />
        </>
      )}
    </View>
  )
}
