// src/screens/MediaPlayerScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
  Dimensions, StatusBar, Image, Share, Pressable, PanResponder, Switch,
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
    return `${season}:${episode}${item.episodeTitle ? ` - ${item.episodeTitle}` : ''}`
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
  const [controlsVisible, setControlsVisible] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [progressWidth, setProgressWidth] = useState(1)
  const [overlayHint, setOverlayHint] = useState('Double tap left or right\nto rewind or forward')
  const [edgeIndicator, setEdgeIndicator] = useState(null)
  const [volume, setVolume] = useState(1)
  const [brightness, setBrightness] = useState(0.72)
  const [detailsTab, setDetailsTab] = useState('overview')
  const [autoPlayNext, setAutoPlayNext] = useState(true)
  const videoViewRef = useRef(null)
  const lastTapRef = useRef({ side: null, time: 0 })
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

  useEffect(() => {
    if (locked) return undefined
    const timer = setInterval(() => {
      try {
        setPosition(Number(player.currentTime || 0))
        setDuration(Number(player.duration || media?.duration || 0))
        setPlaying(Boolean(player.playing))
      } catch {}
    }, 500)
    return () => clearInterval(timer)
  }, [locked, media?.duration, player, streamUrl])

  useEffect(() => {
    if (!overlayHint) return undefined
    const timer = setTimeout(() => setOverlayHint(''), 1800)
    return () => clearTimeout(timer)
  }, [overlayHint])

  useEffect(() => {
    if (!edgeIndicator) return undefined
    const timer = setTimeout(() => setEdgeIndicator(null), 1400)
    return () => clearTimeout(timer)
  }, [edgeIndicator, volume, brightness])

  useEffect(() => {
    try {
      player.playbackRate = playbackSpeed
    } catch {}
  }, [player, playbackSpeed])

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

  const flashHint = (message) => {
    setOverlayHint(message)
  }

  const seekBy = (seconds) => {
    try {
      const next = Math.max(0, Math.min(Number(player.duration || duration || 0) || Infinity, Number(player.currentTime || 0) + seconds))
      player.currentTime = next
      setPosition(next)
      flashHint(seconds > 0 ? '+10 seconds' : '-10 seconds')
    } catch {}
  }

  const setSpeed = (speed) => {
    setPlaybackSpeed(speed)
    try {
      player.playbackRate = speed
    } catch {}
    flashHint(`Speed ${speed}x`)
  }

  const togglePlay = () => {
    try {
      if (playing) {
        player.pause()
        setPlaying(false)
        return
      }
      player.play()
      setPlaying(true)
    } catch {}
  }

  const seekToRatio = (x) => {
    if (!duration) return
    const ratio = Math.max(0, Math.min(1, x / progressWidth))
    const next = ratio * duration
    try {
      player.currentTime = next
      setPosition(next)
    } catch {}
  }

  const handlePlayerTap = (side) => {
    const now = Date.now()
    if (lastTapRef.current.side === side && now - lastTapRef.current.time < 360) {
      seekBy(side === 'left' ? -10 : 10)
      lastTapRef.current = { side: null, time: 0 }
      return
    }
    lastTapRef.current = { side, time: now }
    setControlsVisible((value) => !value)
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 || Math.abs(gesture.dy) > 18,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        const seconds = gesture.dx > 0 ? 10 : -10
        seekBy(seconds)
        return
      }
      const isVolumeGesture = gesture.moveX > width / 2
      if (isVolumeGesture) {
        const next = Math.max(0, Math.min(1, volume + (gesture.dy < 0 ? 0.1 : -0.1)))
        setVolume(next)
        setEdgeIndicator('volume')
        try { player.volume = next } catch {}
        flashHint(`Volume ${Math.round(next * 100)}%`)
        return
      }
      const nextBrightness = Math.max(0.2, Math.min(1, brightness + (gesture.dy < 0 ? 0.08 : -0.08)))
      setBrightness(nextBrightness)
      setEdgeIndicator('brightness')
      flashHint(`Brightness ${Math.round(nextBrightness * 100)}%`)
    },
  })

  const openCollectionItem = (item) => {
    if (!item?._id || item._id === mediaId) return
    navigation.push('MediaPlayer', { mediaId: item._id })
  }

  const playNextCollectionItem = () => {
    if (collectionItems.length <= 1) {
      flashHint('No next item')
      return
    }
    const currentIndex = collectionItems.findIndex((item) => item._id === mediaId)
    const next = collectionItems[currentIndex >= 0 ? (currentIndex + 1) % collectionItems.length : 0]
    openCollectionItem(next)
  }

  const playPreviousCollectionItem = () => {
    if (collectionItems.length <= 1) {
      flashHint('No previous item')
      return
    }
    const currentIndex = collectionItems.findIndex((item) => item._id === mediaId)
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : collectionItems.length - 1
    openCollectionItem(collectionItems[previousIndex])
  }

  const openFullscreen = async () => {
    try {
      await videoViewRef.current?.enterFullscreen?.()
    } catch {
      flashHint('Fullscreen is unavailable on this device')
    }
  }

  const handlePlayerTool = (label) => {
    if (label === 'Playlist') {
      setDetailsTab('episodes')
      flashHint(collectionItems.length > 1 ? 'Playlist opened below' : 'No playlist items')
      return
    }
    if (label === 'Subtitles') {
      Alert.alert('Subtitles', 'Subtitle track selection will appear here when this media includes subtitle files.')
      return
    }
    if (label === 'Audio') {
      Alert.alert('Audio', 'This media is using its default audio track.')
      return
    }
    if (label === 'Speed') {
      Alert.alert(
        'Playback speed',
        `Current speed: ${playbackSpeed}x`,
        [0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => ({
          text: `${speed}x`,
          onPress: () => setSpeed(speed),
        })).concat({ text: 'Cancel', style: 'cancel' })
      )
      return
    }
    if (label === 'Auto') {
      setAutoPlayNext((value) => !value)
      flashHint(`Auto play ${autoPlayNext ? 'off' : 'on'}`)
      return
    }
    if (label === 'Quality') {
      Alert.alert('Quality', playbackSourceType === 'hls' ? 'Adaptive quality is enabled for this stream.' : 'This video is using the available source quality.')
      return
    }
    if (label === 'Fullscreen') {
      openFullscreen()
    }
  }

  const formatTime = (seconds = 0) => {
    const totalSecs = Math.max(0, Math.floor(seconds || 0))
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (h) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
    playerShell: { backgroundColor: '#000' },
    playerTop: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: insets.top + 8, paddingHorizontal: 14, paddingBottom: 10,
      backgroundColor: '#000',
    },
    playerTitle: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    playerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      padding: 14,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    railWrap: {
      width: 48,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.48)',
      alignItems: 'center',
      gap: 6,
    },
    rail: {
      width: 4, height: 88, borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.42)',
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    railFill: { width: '100%', backgroundColor: c.primary, borderRadius: 4 },
    centerControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },
    roundControl: {
      width: 56, height: 56, borderRadius: 28,
      borderWidth: 2, borderColor: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0.28)',
      alignItems: 'center', justifyContent: 'center',
    },
    hintBubble: {
      alignSelf: 'center',
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: c.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    playerToolBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 9,
      backgroundColor: '#000',
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    toolText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', marginTop: 3 },
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
    title: { color: c.text, fontSize: 22, fontWeight: '900', marginBottom: 6 },
    meta: { color: c.textMuted, fontSize: 13, marginBottom: 16 },
    actions: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    adStack: { marginBottom: 16 },
    adUnit: { marginHorizontal: 0 },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    },
    actionBtnText: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    description: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    tabRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      marginTop: 10,
      marginBottom: 14,
    },
    detailTab: { paddingVertical: 13, marginRight: 26 },
    detailTabText: { fontSize: 14, fontWeight: '900' },
    twoColInfo: {
      borderLeftWidth: 1,
      borderLeftColor: c.border,
      paddingLeft: 16,
      gap: 11,
    },
    poster: {
      width: 140,
      height: 86,
      borderRadius: 12,
      backgroundColor: c.surface,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
    },
    rowTitle: { color: c.text, fontSize: 17, fontWeight: '900' },
    collectionTitle: { color: c.text, fontSize: 17, fontWeight: '900', marginTop: 24, marginBottom: 12 },
    episodeCard: {
      flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, marginBottom: 10,
    },
    episodeThumb: { width: 96, height: 54, borderRadius: 10, backgroundColor: c.surfaceHigh, overflow: 'hidden' },
    episodeTitle: { color: c.text, fontSize: 14, fontWeight: '900' },
    episodeMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    bottomMini: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bgDeep,
    },
  })

  if (loading) return (
    <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  )

  const progressPercent = duration ? Math.max(0, Math.min(100, (position / duration) * 100)) : 0
  const thumbnailUri = media ? mediaService.getThumbnailUrl(media) || media.thumbnailUrl || '' : ''
  const nextUp = collectionItems.find((item) => item._id !== mediaId) || collectionItems[0]
  const moreLikeThis = collectionItems.filter((item) => item._id !== mediaId).slice(0, 8)
  const genreText = Array.isArray(media?.genres) && media.genres.length
    ? media.genres.slice(0, 3).join(', ')
    : media?.genre || media?.category || 'Entertainment'
  const castText = Array.isArray(media?.cast) && media.cast.length
    ? media.cast.join(', ')
    : media?.artist || 'NendPlay Creators'

  return (
    <View style={s.container}>
      <StatusBar hidden />

      <View style={s.playerShell}>
        <View style={s.playerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.playerTitle} numberOfLines={1}>{media?.title || 'NendPlay Media'}</Text>
          <TouchableOpacity onPress={() => flashHint('Casting will be available on supported TVs')}>
            <Ionicons name="cast-outline" size={23} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDetailsTab('episodes')}>
            <Ionicons name="reader-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => flashHint('More player options')}>
            <Ionicons name="ellipsis-vertical" size={21} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

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
          <View style={{ position: 'relative' }} {...panResponder.panHandlers}>
            <VideoView
              ref={videoViewRef}
              player={player}
              style={s.player}
              nativeControls={false}
              contentFit="cover"
              allowsPictureInPicture
              startsPictureInPictureAutomatically
              fullscreenOptions={{ enable: true }}
              onError={() => Alert.alert('Playback Error', 'Unable to play this media right now. Please try again.')}
            />

            {controlsVisible ? (
              <View style={s.playerOverlay} pointerEvents="box-none">
                <Pressable
                  style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
                  onPress={() => setControlsVisible(false)}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  {edgeIndicator === 'brightness' ? (
                    <View style={[s.railWrap, { zIndex: 1 }]}>
                      <Ionicons name="sunny-outline" size={16} color="#FBBF24" />
                      <View style={s.rail}>
                        <View style={[s.railFill, { height: `${Math.round(brightness * 100)}%` }]} />
                      </View>
                      <Text style={{ color: '#FFFFFF', fontSize: 9 }}>Brightness</Text>
                    </View>
                  ) : <View style={{ width: 48 }} />}

                  <View style={{ width: 48 }} />

                  {edgeIndicator === 'volume' ? (
                    <View style={[s.railWrap, { zIndex: 1 }]}>
                      <Ionicons name="volume-high-outline" size={16} color="#FFFFFF" />
                      <View style={s.rail}>
                        <View style={[s.railFill, { height: `${Math.round(volume * 100)}%` }]} />
                      </View>
                      <Text style={{ color: '#FFFFFF', fontSize: 9 }}>Volume</Text>
                    </View>
                  ) : <View style={{ width: 48 }} />}
                </View>

                <View style={{ zIndex: 1 }}>
                  <View style={s.centerControls}>
                    <TouchableOpacity onPress={playPreviousCollectionItem}>
                      <Ionicons name="play-skip-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => seekBy(-10)}>
                      <Ionicons name="reload-circle-outline" size={34} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.roundControl} onPress={togglePlay}>
                      <Ionicons name={playing ? 'pause' : 'play'} size={30} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => seekBy(10)}>
                      <Ionicons name="reload-circle-outline" size={34} color="#FFFFFF" style={{ transform: [{ scaleX: -1 }] }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={playNextCollectionItem}>
                      <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {overlayHint ? (
                    <View style={s.hintBubble}>
                      <Ionicons name="hand-left-outline" size={22} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontWeight: '900', textAlign: 'center' }}>{overlayHint}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ zIndex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{formatTime(position)}</Text>
                    <Pressable
                      style={[s.progress, { height: 5 }]}
                      onLayout={(event) => setProgressWidth(Math.max(1, event.nativeEvent.layout.width))}
                      onPress={(event) => seekToRatio(event.nativeEvent.locationX)}>
                      <View style={[s.progressFill, { width: `${progressPercent}%` }]} />
                    </Pressable>
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{formatTime(duration)}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setControlsVisible(true)}
              />
            )}
          </View>
        )}

        {controlsVisible ? <View style={s.playerToolBar}>
          {[
            ['list-outline', 'Playlist'],
            ['chatbox-outline', 'Subtitles'],
            ['pulse-outline', 'Audio'],
            ['speedometer-outline', 'Speed'],
            ['tv-outline', 'Auto'],
            ['scan-outline', 'Fullscreen'],
          ].map(([icon, label]) => (
            <TouchableOpacity key={label} style={{ alignItems: 'center', minWidth: 46 }} onPress={() => handlePlayerTool(label)}>
              <Ionicons name={icon} size={17} color="#FFFFFF" />
              <Text style={s.toolText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View> : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        <View style={s.info}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{media?.title}</Text>
              <Text style={s.meta}>
                {media?.type?.replace('_', ' ') || 'video'} | {media?.viewCount || 0} views
                {media?.releaseYear ? ` | ${media.releaseYear}` : ''} | {genreText}
                {duration ? ` | ${formatTime(duration)}` : ''}
              </Text>
            </View>
            <View style={s.poster}>
              {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="image-outline" size={26} color={c.textMuted} />
                </View>
              )}
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.actionBtn, liked && { backgroundColor: c.primary, borderColor: c.primary }]}
              onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? 'white' : c.primary} />
              <Text style={[s.actionBtnText, liked && { color: 'white' }]}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={18} color={c.textMuted} />
              <Text style={s.actionBtnText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color={c.textMuted} />
              <Text style={s.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={() => flashHint('Added to My List')}>
              <Ionicons name="add-outline" size={20} color={c.textMuted} />
              <Text style={s.actionBtnText}>My List</Text>
            </TouchableOpacity>
          </View>

          {!locked && !localUri ? (
            <View style={s.adStack}>
              <AdBanner style={s.adUnit} horizontalPadding={64} />
              <NendPlayAdCard placement="media" style={s.adUnit} />
            </View>
          ) : null}

          <View style={s.tabRow}>
            {['overview', 'episodes', 'related', 'comments'].map((tab) => (
              <TouchableOpacity key={tab} style={s.detailTab} onPress={() => setDetailsTab(tab)}>
                <Text style={[s.detailTabText, { color: detailsTab === tab ? c.primary : c.textMuted }]}>
                  {tab === 'related' ? 'More Like This' : tab === 'comments' ? 'Comments' : tab[0].toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {detailsTab === 'overview' ? (
            <View style={{ flexDirection: width > 420 ? 'row' : 'column', gap: 18 }}>
              <Text style={[s.description, { flex: 1 }]}>
                {media?.description || 'No overview has been added for this media yet.'}
              </Text>
              <View style={[s.twoColInfo, width <= 420 && { borderLeftWidth: 0, paddingLeft: 0 }]}>
                <Text style={s.meta}>Director    {media?.director || 'NendPlay Studios'}</Text>
                <Text style={s.meta}>Cast        {castText}</Text>
                <Text style={s.meta}>Genre       {genreText}</Text>
              </View>
            </View>
          ) : null}

          {detailsTab === 'episodes' && collectionItems.length > 1 ? (
            <View>
              {collectionItems.map((item) => {
                const active = item._id === mediaId
                const itemThumb = mediaService.getThumbnailUrl(item) || item.thumbnailUrl || ''
                return (
                  <TouchableOpacity
                    key={item._id}
                    style={[s.episodeCard, active && { borderColor: c.primary }]}
                    onPress={() => !active && openCollectionItem(item)}>
                    <View style={s.episodeThumb}>
                      {itemThumb ? (
                        <Image source={{ uri: itemThumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
                    <Text style={s.episodeMeta}>{formatTime(item.duration || 0)}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}

          {detailsTab === 'episodes' && collectionItems.length <= 1 ? (
            <Text style={s.description}>No episodes or parts are attached to this media yet.</Text>
          ) : null}

          {detailsTab === 'related' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {(moreLikeThis.length ? moreLikeThis : collectionItems.slice(0, 6)).map((item) => {
                const itemThumb = mediaService.getThumbnailUrl(item) || item.thumbnailUrl || ''
                return (
                  <TouchableOpacity key={item._id} style={{ width: 126 }} onPress={() => openCollectionItem(item)}>
                    <View style={[s.poster, { width: 126, height: 82 }]}>
                      {itemThumb ? (
                        <Image source={{ uri: itemThumb }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : null}
                    </View>
                    <Text style={s.episodeTitle} numberOfLines={2}>{item.title}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          ) : null}

          {detailsTab === 'comments' ? (
            <View style={{ gap: 10 }}>
              <Text style={s.description}>Comments will appear here when viewers start discussing this media.</Text>
              <TouchableOpacity style={s.actionBtn} onPress={() => flashHint('Comment composer coming soon')}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.textMuted} />
                <Text style={s.actionBtnText}>Add comment</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {nextUp ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 }}>
                <Text style={[s.rowTitle, { flex: 1 }]}>Next Up</Text>
                <Text style={s.meta}>Auto Play</Text>
                <Switch
                  value={autoPlayNext}
                  onValueChange={setAutoPlayNext}
                  trackColor={{ false: c.surfaceHigh, true: c.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity style={s.episodeCard} onPress={() => openCollectionItem(nextUp)}>
                <View style={s.episodeThumb}>
                  {(mediaService.getThumbnailUrl(nextUp) || nextUp.thumbnailUrl) ? (
                    <Image
                      source={{ uri: mediaService.getThumbnailUrl(nextUp) || nextUp.thumbnailUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.episodeTitle} numberOfLines={2}>{nextUp.title}</Text>
                  <Text style={s.episodeMeta}>{getCollectionLabel(nextUp)}</Text>
                </View>
                <Text style={s.episodeMeta}>{formatTime(nextUp.duration || 0)}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!locked && !localUri ? <NativeAdvancedAd style={s.adUnit} /> : null}
        </View>
      </ScrollView>

      {!locked && !playbackError ? (
        <View style={[s.bottomMini, { paddingBottom: Math.max(10, insets.bottom) }]}>
          <View style={[s.episodeThumb, { width: 64, height: 42 }]}>
            {thumbnailUri ? <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
          </View>
          <Text style={[s.episodeTitle, { flex: 1 }]} numberOfLines={2}>{media?.title}</Text>
          <TouchableOpacity onPress={togglePlay}>
            <Ionicons name={playing ? 'pause' : 'play'} size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={playNextCollectionItem}>
            <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
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
