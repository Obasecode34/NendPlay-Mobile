// src/screens/ShortsScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image,
  Pressable, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import * as Device from 'expo-device'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { downloadService, mediaService } from '../services/index'
import { saveDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloadStore'
import { addWatchHistory } from '../services/watchHistoryStore'
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

const { width, height } = Dimensions.get('window')
const ACTION_RAIL_BOTTOM = 64
const PUBLIC_WEB_URL = 'https://nendplay.com'

function formatCount(value = 0) {
  const count = Number(value) || 0
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  return `${count}`
}

function getCreator(item) {
  const creator = item.uploadedBy || {}
  return {
    name: creator.username || creator.profileName || 'creator',
    avatar: creator.profilePic || mediaService.getThumbnailUrl(item) || item.thumbnailUrl || '',
  }
}

function ActionButton({ icon, activeIcon, label, count, active, activeColor = '#FFFFFF', onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78} style={styles.actionButton}>
      <Ionicons
        name={active && activeIcon ? activeIcon : icon}
        size={30}
        color={active ? activeColor : '#FFFFFF'}
      />
      <Text style={styles.actionLabel} numberOfLines={1}>
        {count !== undefined ? formatCount(count) : label}
      </Text>
    </TouchableOpacity>
  )
}

function TopicPill({ icon, label, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.topicPill}>
      <Ionicons name={icon} size={20} color="#FFFFFF" />
      <Text style={styles.topicText}>{label}</Text>
    </TouchableOpacity>
  )
}

function getImmediateShortUrl(item) {
  const candidate = item?.streamUrl || item?.playbackUrl || item?.mediaUrl || item?.fileUrl || ''
  if (candidate) return mediaService.resolveStreamUrl(candidate)
  return item?._id ? mediaService.getStreamUrl(item._id) : ''
}

function ShortsAdItem({ itemHeight, isActive, onEnded, adType = 'nendplay' }) {
  useEffect(() => {
    if (!isActive) return undefined
    const timer = setTimeout(() => onEnded?.(), 15000)
    return () => clearTimeout(timer)
  }, [isActive, onEnded])

  const renderAd = () => {
    if (adType === 'banner') return <AdBanner style={{ marginHorizontal: 0, marginBottom: 0 }} />
    if (adType === 'native') return <NativeAdvancedAd style={{ marginHorizontal: 0, marginBottom: 0 }} />
    return <NendPlayAdCard placement="shorts" style={{ marginHorizontal: 0, marginBottom: 0 }} />
  }

  return (
    <View style={[styles.shortPage, { height: itemHeight, justifyContent: 'center', paddingVertical: 24 }]}>
      <View style={styles.shortsAdShell}>
        <Text style={styles.shortsAdLabel}>SPONSORED</Text>
        {renderAd()}
      </View>
    </View>
  )
}

function ShortItem({ item, isActive, theme, itemHeight, onPausedChange, onEnded }) {
  const c = theme.colors
  const creator = getCreator(item)
  const creatorId = item.uploadedBy?._id || item.uploadedBy?.id
  const { isAuthenticated } = useAuthStore()
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(item.uploadedBy?.subscriberCount || 0)
  const [isPaused, setIsPaused] = useState(false)
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(item.commentCount || item.comments?.length || 0)
  const [likeCount, setLikeCount] = useState(item.likeCount || 0)
  const [dislikeCount, setDislikeCount] = useState(item.dislikeCount || 0)
  const [comments, setComments] = useState(item.comments || [])
  const [loadingComments, setLoadingComments] = useState(false)
  const [progress, setProgress] = useState(0)

  const initialUrl = getImmediateShortUrl(item)
  const player = useVideoPlayer({
    uri: initialUrl,
    contentType: initialUrl.includes('.m3u8') ? 'hls' : 'auto',
  }, (player) => {
    player.loop = false
    if (isActive && !isPaused) player.play()
  })

  useEffect(() => {
    let cancelled = false
    const loadPlayback = async () => {
      try {
        const res = await mediaService.getPlayback(item._id)
        const playback = res.data.data.playback
        const resolvedUrl = mediaService.resolveStreamUrl(playback.streamUrl)
        if (cancelled || !resolvedUrl) return
        if (resolvedUrl === initialUrl) {
          if (isActive && !isPaused) player.play()
          return
        }
        player.replace({
          uri: resolvedUrl,
          contentType: playback.sourceType === 'hls' || resolvedUrl.includes('.m3u8') ? 'hls' : 'auto',
        })
        if (isActive && !isPaused) player.play()
      } catch {}
    }
    loadPlayback()
    return () => { cancelled = true }
  }, [item._id, initialUrl, isActive, isPaused, player])

  useEffect(() => {
    if (isActive && !isPaused) {
      player.play()
      return
    }
    player.pause()
  }, [isActive, isPaused, player])

  useEffect(() => {
    const subscription = player.addListener?.('playToEnd', () => {
      if (isActive) {
        addWatchHistory(item, { duration: item.duration || player.duration || 0 })
        onEnded?.()
      }
    })
    return () => subscription?.remove?.()
  }, [isActive, onEnded, player])

  useEffect(() => {
    if (isActive) {
      player.currentTime = 0
      setIsPaused(false)
      setShowCommentBox(false)
    }
  }, [isActive, player])

  useEffect(() => {
    if (isActive) {
      onPausedChange?.(isPaused)
    }
  }, [isActive, isPaused, onPausedChange])

  useEffect(() => {
    if (!isActive) return undefined
    const timer = setInterval(() => {
      const duration = player.duration || item.duration || 0
      if (!duration) {
        setProgress(0)
        return
      }
      setProgress(Math.min(player.currentTime / duration, 1))
    }, 250)
    return () => clearInterval(timer)
  }, [isActive, item.duration, player])

  const requireAuth = () => {
    if (isAuthenticated) return true
    Alert.alert('Login Required', 'Please login to use this feature.')
    return false
  }

  const handleLike = async () => {
    if (!requireAuth() || liked) return
    try {
      await mediaService.like(item._id)
      setLiked(true)
      setDisliked(false)
      setLikeCount((prev) => prev + 1)
    } catch {}
  }

  const handleDislike = async () => {
    if (!requireAuth() || disliked) return
    try {
      await mediaService.dislike(item._id)
      setDisliked(true)
      setLiked(false)
      setDislikeCount((prev) => prev + 1)
    } catch {}
  }

  const handleSave = async () => {
    if (!requireAuth()) return
    try {
      const res = await mediaService.save(item._id)
      setSaved(res.data.data.saved)
    } catch {
      Alert.alert('Save failed', 'Unable to save this video right now.')
    }
  }

  const handleDownload = async () => {
    try {
      const deviceId = Device.osInternalBuildId || 'mobile-device'
      const res = await downloadService.authorize({
        contentType: 'media',
        contentId: item._id,
        deviceId,
        platform: 'mobile',
      })

      if (res.data.data.alreadyDownloaded) {
        Alert.alert('Already Downloaded', 'This video is already in your downloads.')
        return
      }

      const rawFileUrl = res.data.data.fileUrl || item.mediaUrl || item.fileUrl || mediaService.getStreamUrl(item._id)
      const fileUrl = mediaService.resolveStreamUrl(rawFileUrl)
      const normalizedFileUrl = String(fileUrl || '').toLowerCase()
      const forceHls = Boolean(
        res.data.data.sourceType === 'hls' ||
        normalizedFileUrl.includes('.m3u8') ||
        normalizedFileUrl.includes('/hls') ||
        String(item.mimeType || res.data.data.mimeType || '').toLowerCase().includes('mpegurl')
      )
      const savedFile = await saveDownloadFile({
        fileUrl,
        contentType: 'media',
        contentId: item._id,
        title: item.title || 'short',
        mimeType: item.mimeType || res.data.data.mimeType,
        forceHls,
      })
      await upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'media',
        contentId: item._id,
        storageKey: savedFile.storageKey,
        storedFileSize: savedFile.storedFileSize || item.fileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: item.title || 'short',
          thumbnailUrl: item.thumbnailUrl || '',
          type: item.type || 'short',
          category: item.category || '',
          duration: item.duration || 0,
          mimeType: savedFile.isHlsPackage ? 'application/vnd.apple.mpegurl' : item.mimeType || res.data.data.mimeType || '',
          fileUrl,
        },
      })
      if (res.data.data.download?._id) {
        await downloadService.complete({
          downloadId: res.data.data.download._id,
          deviceId,
          storageKey: savedFile.storageKey,
          storedFileSize: savedFile.storedFileSize || item.fileSize || res.data.data.fileSize || 0,
        })
        Alert.alert('Downloaded', 'This video was added to your downloads.')
        return
      }
      Alert.alert('Downloaded', 'This short was saved on this device and is available in your Downloads tab for offline playback.')
    } catch (err) {
      Alert.alert('Download failed', err.response?.data?.message || 'Please try again later.')
    }
  }

  const handleSubscribe = async () => {
    if (!requireAuth() || !creatorId) return
    try {
      const res = await mediaService.subscribeCreator(creatorId)
      setSubscribed(res.data.data.subscribed)
      setSubscriberCount(res.data.data.subscriberCount || 0)
    } catch (err) {
      Alert.alert('Subscribe failed', err.response?.data?.message || 'Please try again.')
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        title: item.title,
        message: `${item.title} - Watch on NendPlay: ${PUBLIC_WEB_URL}/watch/${item._id}`,
      })
    } catch {}
  }

  const handleToggleComment = async () => {
    const nextState = !showCommentBox
    setShowCommentBox(nextState)
    if (!nextState) {
      setCommentText('')
      return
    }

    if (comments.length === 0) {
      setLoadingComments(true)
      try {
        const res = await mediaService.getById(item._id)
        setComments(res.data.data.media.comments || [])
      } catch {}
      setLoadingComments(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!requireAuth() || !commentText.trim()) return
    try {
      const res = await mediaService.comment(item._id, { text: commentText.trim() })
      setCommentCount((prev) => prev + 1)
      const newComment = res.data.data.comment
      if (newComment) setComments((prev) => [...prev, newComment])
      setCommentText('')
      setShowCommentBox(false)
    } catch {}
  }

  return (
    <View style={[styles.shortPage, { height: itemHeight }]}>
      <VideoView
        player={player}
        style={[styles.video, { height: itemHeight }]}
        contentFit="cover"
        nativeControls={false}
      />

      <Pressable onPress={() => setIsPaused((prev) => !prev)} style={styles.tapLayer} />

      {isPaused && (
        <View pointerEvents="none" style={styles.pauseOverlay}>
          <Ionicons name="play" size={64} color="#FFFFFF" />
        </View>
      )}

      <View style={styles.actionRail}>
        <ActionButton icon="thumbs-up-outline" activeIcon="thumbs-up" count={likeCount} active={liked} onPress={handleLike} />
        <ActionButton icon="thumbs-down-outline" activeIcon="thumbs-down" count={dislikeCount} active={disliked} onPress={handleDislike} />
        <ActionButton icon="chatbubble-ellipses-outline" count={commentCount} onPress={handleToggleComment} />
        <ActionButton icon="arrow-redo-outline" label="Share" onPress={handleShare} />
        <ActionButton icon="bookmark-outline" activeIcon="bookmark" label={saved ? 'Saved' : 'Save'} active={saved} onPress={handleSave} />
        <ActionButton icon="download-outline" label="Download" onPress={handleDownload} />
        <View style={styles.soundTile}>
          {creator.avatar ? (
            <Image source={{ uri: creator.avatar }} style={styles.soundImage} />
          ) : (
            <Ionicons name="musical-notes" size={20} color="#FFFFFF" />
          )}
        </View>
      </View>

      <View style={styles.captionArea}>
        <View style={styles.creatorRow}>
          <View style={styles.avatar}>
            {creator.avatar ? (
              <Image source={{ uri: creator.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{creator.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.creatorName} numberOfLines={1}>@{creator.name}</Text>
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={handleSubscribe}
            style={[styles.subscribeButton, subscribed && styles.subscribedButton]}>
            <Text style={[styles.subscribeText, subscribed && styles.subscribedText]}>
              {subscribed ? 'Subscribed' : 'Subscribe'}
            </Text>
          </TouchableOpacity>
        </View>
        {subscriberCount > 0 && (
          <Text style={styles.subscriberText}>{formatCount(subscriberCount)} subscribers</Text>
        )}

        <View style={styles.titleLine}>
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.titleText} numberOfLines={1}>{item.title}</Text>
        </View>
        {!!item.description && (
          <Text style={styles.descriptionText} numberOfLines={2}>{item.description}</Text>
        )}
      </View>

      {showCommentBox && (
        <View style={styles.commentPanel}>
          <Text style={styles.commentTitle}>Comments ({commentCount})</Text>
          <View style={styles.commentList}>
            {loadingComments ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : comments.length > 0 ? (
              comments.slice(-4).reverse().map((comment, index) => (
                <View key={`${comment._id || index}`} style={styles.commentItem}>
                  <Text style={styles.commentUser}>{comment.user?.username || comment.user || 'User'}</Text>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyComment}>No comments yet. Be the first to comment.</Text>
            )}
          </View>

          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.commentInput}
            multiline
          />
          <TouchableOpacity onPress={handleSubmitComment} style={[styles.postButton, { backgroundColor: c.primary }]}>
            <Text style={styles.postText}>Post</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.duration > 0 && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
          </Text>
        </View>
      )}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  )
}

export default function ShortsScreen({ route }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const listRef = useRef(null)
  const fetchingRef = useRef(false)
  const openId = route?.params?.openId

  const [shorts, setShorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [feedMode, setFeedMode] = useState('all')
  const [activePaused, setActivePaused] = useState(false)
  const [screenHeight, setScreenHeight] = useState(height)
  const headerHeight = insets.top + 64
  const itemHeight = Math.max(screenHeight - headerHeight, 1)

  useEffect(() => {
    let cancelled = false
    const loadOpenedShortFirst = async () => {
      if (!openId || page !== 1 || feedMode !== 'all') return
      try {
        const res = await mediaService.getById(openId)
        const fetched = res.data.data.media
        if (cancelled || !fetched) return
        setShorts((prev) => [fetched, ...prev.filter((short) => short._id !== fetched._id)])
        setActiveIndex(0)
        setLoading(false)
      } catch {}
    }
    loadOpenedShortFirst()
    return () => { cancelled = true }
  }, [openId, page, feedMode])

  useEffect(() => { fetchShorts() }, [page, feedMode])

  const fetchShorts = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const serviceCall = feedMode === 'subscriptions'
        ? mediaService.getSubscribedShorts
        : mediaService.getShorts
      const res = await serviceCall({ page, limit: 10 })
      const { media, pagination } = res.data.data
      setShorts(prev => {
        const nextMedia = Array.isArray(media) ? media : []
        if (page === 1) {
          const merged = openId
            ? [...prev.filter((short) => short._id === openId), ...nextMedia.filter((short) => short._id !== openId)]
            : nextMedia
          return merged
        }
        const seen = new Set(prev.map((short) => short._id))
        return [...prev, ...nextMedia.filter((short) => !seen.has(short._id))]
      })
      setHasMore(page < pagination.pages)
    } catch {} finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index)
    }
  }, [])

  useEffect(() => {
    if (!openId || shorts.length === 0 || loading) return
    const index = shorts.findIndex((short) => short._id === openId)
    if (index >= 0) {
      setActiveIndex(index)
      listRef.current?.scrollToIndex({ index, animated: true })
      return
    }

    let cancelled = false
    const loadOpenShort = async () => {
      try {
        const res = await mediaService.getById(openId)
        const fetched = res.data.data.media
        if (cancelled || !fetched) return
        setShorts((prev) => [fetched, ...prev.filter((short) => short._id !== fetched._id)])
        setActiveIndex(0)
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index: 0, animated: true })
        })
      } catch {}
    }
    loadOpenShort()
    return () => { cancelled = true }
  }, [openId, shorts, loading])

  const viewabilityConfig = { itemVisiblePercentThreshold: 70 }
  const feedItems = useMemo(() => {
    const items = []
    const adTypes = ['nendplay', 'banner', 'native']
    shorts.forEach((short, index) => {
      items.push(short)
      const playedCount = index + 1
      if (playedCount % 5 === 0) {
        const adNumber = playedCount / 5
        items.push({
          _id: `shorts-ad-${playedCount}`,
          isAd: true,
          adType: adTypes[(adNumber - 1) % adTypes.length],
        })
      }
    })
    return items
  }, [shorts])

  const switchFeedMode = (nextMode) => {
    if (nextMode === feedMode) return
    setFeedMode(nextMode)
    setShorts([])
    setActiveIndex(0)
    setActivePaused(false)
    setPage(1)
    setHasMore(true)
    setLoading(true)
  }

  const advanceToNext = useCallback((currentIndex) => {
    if (feedItems.length === 0) return
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % feedItems.length : 0
    setActiveIndex(nextIndex)
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true })
    })
    if (hasMore && nextIndex >= feedItems.length - 2) {
      setPage((prev) => prev + 1)
    }
  }, [feedItems.length, hasMore])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    )
  }

  if (shorts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flash-outline" size={40} color={c.textMuted} />
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>No Shorts yet</Text>
        <Text style={{ color: c.textMuted, fontSize: 14 }}>Upload videos under 3 minutes</Text>
      </View>
    )
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}
    >
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shorts</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => Alert.alert('Search', 'Shorts search is coming soon.')} style={styles.iconButton}>
              <Ionicons name="search-outline" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Shorts', 'Settings and report tools are coming soon.')} style={styles.iconButton}>
              <Ionicons name="ellipsis-vertical" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {activePaused && (
        <View style={[styles.topicRow, { top: headerHeight + 14 }]}>
          <TopicPill icon="albums-outline" label="Subscriptions" onPress={() => switchFeedMode('subscriptions')} />
          {feedMode === 'subscriptions' && (
            <TopicPill icon="sparkles-outline" label="All Shorts" onPress={() => switchFeedMode('all')} />
          )}
          <TopicPill icon="radio-outline" label="Live" onPress={() => Alert.alert('Live', 'Live Shorts filters are coming soon.')} />
          <TopicPill icon="camera-outline" label="Lens" onPress={() => Alert.alert('Lens', 'Camera effects are coming soon.')} />
        </View>
      )}

      <FlatList
        ref={listRef}
        data={feedItems}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          item.isAd ? (
            <ShortsAdItem
              itemHeight={itemHeight}
              isActive={index === activeIndex}
              adType={item.adType}
              onEnded={() => advanceToNext(index)}
            />
          ) : (
            <ShortItem
              item={item}
              isActive={index === activeIndex}
              theme={theme}
              itemHeight={itemHeight}
              onPausedChange={setActivePaused}
              onEnded={() => advanceToNext(index)}
            />
          )
        )}
        pagingEnabled
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: itemHeight, offset: itemHeight * index, index,
        })}
        onEndReached={() => { if (hasMore && !fetchingRef.current) setPage(p => p + 1) }}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  shortPage: { width, backgroundColor: '#000000' },
  shortsAdShell: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,30,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.45)',
  },
  shortsAdLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 10,
  },
  video: { width },
  tapLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pauseOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  headerWrap: { zIndex: 10, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, paddingHorizontal: 28,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topicRow: {
    position: 'absolute', left: 0, right: 0, zIndex: 12,
    flexDirection: 'row', gap: 10, paddingHorizontal: 28,
  },
  topicPill: {
    height: 46, paddingHorizontal: 16, borderRadius: 23, flexDirection: 'row',
    alignItems: 'center', gap: 8, backgroundColor: 'rgba(32,32,32,0.62)',
  },
  topicText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  actionRail: {
    position: 'absolute', right: 10, bottom: ACTION_RAIL_BOTTOM,
    alignItems: 'center', gap: 12, width: 70,
  },
  actionButton: { width: 70, alignItems: 'center' },
  actionLabel: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4,
  },
  soundTile: {
    width: 46, height: 46, borderRadius: 10, borderWidth: 2, borderColor: '#FFFFFF',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  soundImage: { width: '100%', height: '100%' },
  captionArea: { position: 'absolute', left: 14, right: 88, bottom: 24 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, overflow: 'hidden',
    backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  creatorName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', maxWidth: width * 0.36 },
  subscribeButton: {
    height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  subscribedButton: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  subscribeText: { color: '#111111', fontSize: 15, fontWeight: '800' },
  subscribedText: { color: '#FFFFFF' },
  subscriberText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  titleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1 },
  descriptionText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 19 },
  commentPanel: {
    position: 'absolute', left: 12, right: 12, bottom: 58,
    backgroundColor: 'rgba(0,0,0,0.92)', borderRadius: 16, padding: 12, maxHeight: 300,
  },
  commentTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  commentList: { maxHeight: 160 },
  commentItem: { marginBottom: 10 },
  commentUser: { color: '#FFFFFF', fontWeight: '800' },
  commentText: { color: 'rgba(255,255,255,0.82)', fontSize: 12 },
  emptyComment: { color: 'rgba(255,255,255,0.62)' },
  commentInput: {
    color: '#FFFFFF', minHeight: 44, paddingHorizontal: 12,
    borderColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderRadius: 8, marginTop: 10,
  },
  postButton: { marginTop: 10, alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  postText: { color: '#FFFFFF', fontWeight: '800' },
  durationBadge: {
    position: 'absolute', top: 98, right: 16, backgroundColor: 'rgba(0,0,0,0.56)',
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
  },
  durationText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'monospace' },
  progressTrack: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  progressFill: { height: '100%', backgroundColor: '#FF1744' },
})
