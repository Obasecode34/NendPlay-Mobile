// src/screens/MediaPlayerScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  Dimensions, StatusBar, Image, Share,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Device from 'expo-device'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { mediaService, downloadService } from '../services/index'
import { saveDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloadStore'
import { upsertContinueWatching, removeContinueWatching } from '../services/continueWatchingStore'
import { addWatchHistory } from '../services/watchHistoryStore'
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

const { width } = Dimensions.get('window')
const PUBLIC_WEB_URL = 'https://nendplay.com'

function getCollectionLabel(item = {}) {
  if (item.collectionType === 'series_episode') {
    const season = item.seasonNumber !== null && item.seasonNumber !== undefined ? `S${item.seasonNumber}` : 'Season'
    const episode = item.episodeNumber !== null && item.episodeNumber !== undefined ? `E${item.episodeNumber}` : 'Episode'
    return `${season}:${episode}${item.episodeTitle ? ` · ${item.episodeTitle}` : ''}`
  }
  if (item.collectionType === 'movie_part') return `Part ${item.partNumber || ''}`.trim()
  return item.title || 'Media'
}

export default function MediaPlayerScreen({ route, navigation }) {
  const { mediaId, localUri, offlineMedia } = route.params
  const { theme } = useThemeStore()
  const { user, isAuthenticated } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [playbackSourceType, setPlaybackSourceType] = useState('auto')
  const [playbackError, setPlaybackError] = useState('')
  const streamUrl = localUri || playbackUrl || mediaService.getStreamUrl(mediaId)
  const streamSource = useMemo(() => ({
    uri: streamUrl,
    contentType: playbackSourceType === 'hls' ? 'hls' : 'auto',
  }), [streamUrl, playbackSourceType])
  const player = useVideoPlayer(streamSource, (player) => {
    player.play()
  })

  const [media, setMedia] = useState(null)
  const [collectionItems, setCollectionItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [liked, setLiked] = useState(false)
  const historyRecordedRef = useRef(false)

  useEffect(() => {
    if (localUri) {
      setMedia(offlineMedia || { title: 'Offline media', type: 'download' })
      setLocked(false)
      setLoading(false)
      return
    }
    fetchMedia()
  }, [mediaId, localUri])

  useEffect(() => {
    if (!playbackUrl || localUri) return
    try {
      player.replace({
        uri: playbackUrl,
        contentType: playbackSourceType === 'hls' ? 'hls' : 'auto',
      })
      player.play()
    } catch {}
  }, [playbackUrl, playbackSourceType, localUri])

  useEffect(() => {
    historyRecordedRef.current = false
  }, [media?._id, localUri])

  useEffect(() => {
    if (!media?._id || locked || localUri) return undefined
    const timer = setInterval(() => {
      try {
        const position = Number(player.currentTime || 0)
        const duration = Number(player.duration || media.duration || 0)
        if (!duration || position < 5) return
        const progress = position / duration
        if (progress >= 0.95) {
          removeContinueWatching(media._id)
          if (!historyRecordedRef.current) {
            historyRecordedRef.current = true
            addWatchHistory(media, { position, duration })
          }
        } else {
          upsertContinueWatching(media, { position, duration, progress })
        }
      } catch {}
    }, 5000)
    return () => clearInterval(timer)
  }, [media?._id, locked, localUri, player])

  const fetchMedia = async () => {
    setLoading(true)
    try {
      const res = await mediaService.getById(mediaId)
      const currentMedia = res.data.data.media
      setMedia(currentMedia)
      setCollectionItems([currentMedia, ...(currentMedia.collectionItems || [])].sort((a, b) => (
        (a.seasonNumber || 0) - (b.seasonNumber || 0)
        || (a.episodeNumber || 0) - (b.episodeNumber || 0)
        || (a.partNumber || 0) - (b.partNumber || 0)
        || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      )))
      setLocked(res.data.data.locked)
      if (!res.data.data.locked) {
        const playbackRes = await mediaService.getPlayback(mediaId)
        const playback = playbackRes.data.data.playback
        const resolvedUrl = mediaService.resolveStreamUrl(playback.streamUrl)
        if (!resolvedUrl) {
          setPlaybackError('No playable stream was returned for this media.')
          return
        }
        setPlaybackError('')
        setPlaybackSourceType(playback.sourceType || (resolvedUrl.includes('.m3u8') ? 'hls' : 'auto'))
        setPlaybackUrl(resolvedUrl)
      }
    } catch {
      Alert.alert('Error', 'Media not found')
      navigation.goBack()
    } finally { setLoading(false) }
  }

  const handleLike = async () => {
    try {
      await mediaService.like(mediaId)
      setLiked(true)
    } catch {}
  }

  const handleDownload = async () => {
    try {
      const deviceId = Device.osInternalBuildId || 'mobile-device'
      const res = await downloadService.authorize({
        contentType: 'media',
        contentId: mediaId,
        deviceId,
        platform: 'mobile',
      })
      if (res.data.data.alreadyDownloaded) {
        Alert.alert('Already Downloaded', 'This media is already in your downloads')
        return
      }
      const fileUrl = playbackUrl || streamUrl || res.data.data.fileUrl
      const forceHls = Boolean(
        media?.hlsUrl ||
        media?.playbackIds?.length ||
        String(media?.mimeType || res.data.data.mimeType || '').toLowerCase().includes('mpegurl')
      )
      const savedFile = await saveDownloadFile({
        fileUrl,
        contentType: 'media',
        contentId: mediaId,
        title: media?.title || res.data.data.title || 'media',
        mimeType: media?.mimeType || res.data.data.mimeType,
        forceHls,
      })
      await upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'media',
        contentId: mediaId,
        storageKey: savedFile.storageKey,
        storedFileSize: savedFile.storedFileSize || media?.fileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: media?.title || res.data.data.title || 'media',
          thumbnailUrl: media?.thumbnailUrl || '',
          type: media?.type || 'video',
          category: media?.category || '',
          duration: media?.duration || 0,
          mimeType: savedFile.isHlsPackage ? 'application/vnd.apple.mpegurl' : media?.mimeType || res.data.data.mimeType || '',
          fileUrl,
        },
      })
      if (res.data.data.download?._id) {
        await downloadService.complete({
          downloadId: res.data.data.download._id,
          storageKey: savedFile.storageKey,
          storedFileSize: savedFile.storedFileSize || media?.fileSize || res.data.data.fileSize || 0,
        })
        Alert.alert('Downloaded', 'Added to your Downloads tab for offline playback.')
        return
      }
      Alert.alert('Downloaded', 'This media was saved on this device and is available in your Downloads tab for offline playback.')
    } catch (err) {
      Alert.alert('Download Failed', err.response?.data?.message || 'Unable to prepare this download.')
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: media?.title || 'NendPlay media',
        message: `${media?.title || 'NendPlay media'} - Watch on NendPlay: ${PUBLIC_WEB_URL}/watch/${mediaId}`,
      })
    } catch {}
  }

  const formatTime = (ms) => {
    const totalSecs = Math.floor(ms / 1000)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: c.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { flex: 1, color: c.text, fontSize: 16, fontWeight: '700' },
    player: {
      width, height: width * 9 / 16,
      backgroundColor: '#000',
    },
    lockedBox: {
      width, height: width * 9 / 16, backgroundColor: c.surface,
      alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    lockedText: { color: c.text, fontSize: 16, fontWeight: '700' },
    lockedSub: { color: c.textMuted, fontSize: 13 },
    subBtn: {
      backgroundColor: c.primary, paddingHorizontal: 20,
      paddingVertical: 10, borderRadius: 20, marginTop: 8,
    },
    subBtnText: { color: 'white', fontWeight: '700' },
    controls: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    controlBtn: {
      width: 40, height: 40, borderRadius: 10, backgroundColor: c.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    timeText: { color: c.textMuted, fontSize: 12, fontFamily: 'monospace' },
    progress: {
      flex: 1, height: 4, backgroundColor: c.surfaceHigh,
      borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: c.primary, borderRadius: 2 },
    info: { padding: 16 },
    title: { color: c.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
    meta: { color: c.textMuted, fontSize: 13, marginBottom: 16 },
    actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    adStack: { marginBottom: 16 },
    adUnit: { marginHorizontal: 0 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    actionBtnText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    description: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    collectionTitle: { color: c.text, fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 12 },
    episodeCard: {
      flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    episodeThumb: { width: 96, height: 54, borderRadius: 10, backgroundColor: c.surfaceHigh, overflow: 'hidden' },
    episodeTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    episodeMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  })

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  )

  return (
    <View style={s.container}>
      <StatusBar hidden />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{media?.title}</Text>
      </View>

      {/* Player */}
      {locked ? (
        <View style={s.lockedBox}>
          <Ionicons name="lock-closed" size={40} color="#FBBF24" />
          <Text style={s.lockedText}>Premium Content</Text>
          <Text style={s.lockedSub}>Subscribe to watch this</Text>
          <TouchableOpacity style={s.subBtn} onPress={() => navigation.navigate('Subscribe')}>
            <Text style={s.subBtnText}>Subscribe Now</Text>
          </TouchableOpacity>
        </View>
      ) : playbackError ? (
        <View style={s.lockedBox}>
          <Ionicons name="alert-circle-outline" size={40} color="#F97316" />
          <Text style={s.lockedText}>Playback unavailable</Text>
          <Text style={s.lockedSub}>{playbackError}</Text>
        </View>
      ) : (
        <VideoView
          player={player}
          style={s.player}
          nativeControls
          contentFit="contain"
          onError={() => Alert.alert('Playback Error', 'Unable to play this media right now. Please try again.')}
        />
      )}

      <ScrollView>
        {/* Media info */}
        <View style={s.info}>
          <Text style={s.title}>{media?.title}</Text>
          <Text style={s.meta}>
            {media?.type?.replace('_', ' ')}
            {media?.releaseYear ? ` • ${media.releaseYear}` : ''}
            {media?.artist ? ` • ${media.artist}` : ''}
            {` • ${media?.viewCount || 0} views`}
          </Text>

          {/* Action buttons */}
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.actionBtn, liked && { backgroundColor: c.primary, borderColor: c.primary }]}
              onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16}
                color={liked ? 'white' : c.textMuted} />
              <Text style={[s.actionBtnText, liked && { color: 'white' }]}>
                {(media?.likeCount || 0) + (liked ? 1 : 0)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={16} color={c.textMuted} />
              <Text style={s.actionBtnText}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color={c.textMuted} />
              <Text style={s.actionBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          {!locked && !localUri ? (
            <View style={s.adStack}>
              <AdBanner style={s.adUnit} horizontalPadding={64} />
              <NendPlayAdCard placement="media" style={s.adUnit} />
            </View>
          ) : null}

          {media?.description && (
            <Text style={s.description}>{media.description}</Text>
          )}

          {!locked && !localUri ? <NativeAdvancedAd style={s.adUnit} /> : null}

          {collectionItems.length > 1 && (
            <View>
              <Text style={s.collectionTitle}>{media?.parentTitle || 'Episodes & Parts'}</Text>
              {collectionItems.map((item) => {
                const active = item._id === mediaId
                const thumbnailUri = mediaService.getThumbnailUrl(item) || item.thumbnailUrl || ''
                return (
                  <TouchableOpacity
                    key={item._id}
                    style={[s.episodeCard, active && { borderColor: c.primary }]}
                    onPress={() => !active && navigation.push('MediaPlayer', { mediaId: item._id })}>
                    <View style={s.episodeThumb}>
                      {thumbnailUri ? (
                        <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="play-circle" size={24} color={c.primary} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.episodeTitle} numberOfLines={1}>{getCollectionLabel(item)}</Text>
                      <Text style={s.episodeMeta} numberOfLines={1}>{item.title}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
