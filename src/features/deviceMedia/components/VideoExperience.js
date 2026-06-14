import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, FlatList, Image,
  Dimensions, StyleSheet, PanResponder, Pressable,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import useDeviceMediaStore from '../stores/deviceMediaStore'
import {
  PLAYBACK_SPEEDS, SORT_OPTIONS, cleanTitle,
  formatDuration, formatSize, getAssetSize, getSourceForUri, searchAssets, sortAssets,
} from '../utils/mediaUtils'
import { EmptyState, LoadingSkeleton } from './DeviceMediaShell'

const { width } = Dimensions.get('window')

function ToolbarChip({ theme, active, label, icon, onPress }) {
  const c = theme.colors
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: active ? c.primary : c.surface,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}>
      {icon ? <Ionicons name={icon} size={14} color={active ? '#FFFFFF' : c.textMuted} /> : null}
      <Text style={{ color: active ? '#FFFFFF' : c.textMuted, fontSize: 12, fontWeight: '800' }}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function ControlButton({ icon, label, color = '#FFFFFF', onPress, size = 24 }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ alignItems: 'center', justifyContent: 'center', minWidth: 42 }}>
      <Ionicons name={icon} size={size} color={color} />
      {label ? (
        <Text style={{ color, fontSize: 10, fontWeight: '900', marginTop: 2 }}>{label}</Text>
      ) : null}
    </TouchableOpacity>
  )
}

function CinematicVideoPlayer({ asset, uri, theme, onClose }) {
  const c = theme.colors
  const videoRef = useRef(null)
  const lastTap = useRef({ time: 0, side: null })
  const [controlsVisible, setControlsVisible] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(asset?.duration || 0)
  const [progressWidth, setProgressWidth] = useState(1)
  const [overlay, setOverlay] = useState('')
  const [speedOpen, setSpeedOpen] = useState(false)
  const [tracksOpen, setTracksOpen] = useState(false)
  const [volume, setVolume] = useState(1)
  const [virtualBrightness, setVirtualBrightness] = useState(0.75)
  const { videoSettings, setPlaybackRate, saveProgress, addHistory, toggleFavorite, favorites } = useDeviceMediaStore()

  const player = useVideoPlayer(getSourceForUri(uri, asset?.filename), (player) => {
    player.timeUpdateEventInterval = 3
    player.playbackRate = videoSettings.playbackRate
    player.volume = volume
    player.staysActiveInBackground = true
    player.showNowPlayingNotification = true
    player.keepScreenOnWhilePlaying = true
    player.bufferOptions = {
      preferredForwardBufferDuration: 20,
      waitsToMinimizeStalling: true,
    }
    player.play()
  })

  useEffect(() => {
    if (!asset) return undefined
    addHistory(asset, 'video')
    const timer = setInterval(() => {
      const current = player.currentTime || 0
      const total = player.duration || asset.duration || 0
      setPosition(current)
      setDuration(total)
      setPlaying(Boolean(player.playing))
      saveProgress(asset, current, total)
    }, 5000)
    return () => clearInterval(timer)
  }, [asset?.id, uri])

  useEffect(() => {
    const timer = setInterval(() => {
      setPosition(player.currentTime || 0)
      setDuration(player.duration || asset?.duration || 0)
      setPlaying(Boolean(player.playing))
    }, 500)
    return () => clearInterval(timer)
  }, [uri, asset?.duration])

  const flash = (message) => {
    setOverlay(message)
    setTimeout(() => setOverlay(''), 900)
  }

  const seekBy = (seconds) => {
    try {
      player.seekBy(seconds)
      setPosition(Math.max(0, (player.currentTime || 0) + seconds))
      flash(seconds > 0 ? '+10s' : '-10s')
    } catch {}
  }

  const togglePlay = () => {
    if (playing) {
      player.pause()
      setPlaying(false)
      return
    }
    player.play()
    setPlaying(true)
  }

  const seekToRatio = (x) => {
    if (!duration) return
    const ratio = Math.max(0, Math.min(1, x / progressWidth))
    const next = ratio * duration
    player.currentTime = next
    setPosition(next)
  }

  const handleOverlayPress = (side) => {
    setControlsVisible((value) => !value)
    handleTap(side)
  }

  const handleTap = (side) => {
    const now = Date.now()
    if (lastTap.current.side === side && now - lastTap.current.time < 360) {
      seekBy(side === 'left' ? -10 : 10)
      lastTap.current = { time: 0, side: null }
      return
    }
    lastTap.current = { time: now, side }
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 18 || Math.abs(gesture.dy) > 18,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        const delta = gesture.dx > 0 ? 15 : -15
        try { player.seekBy(delta) } catch {}
        flash(delta > 0 ? '+15s' : '-15s')
        return
      }
      const next = Math.max(0, Math.min(1, volume + (gesture.dy < 0 ? 0.1 : -0.1)))
      setVolume(next)
      player.volume = next
      setVirtualBrightness(Math.max(0.2, Math.min(1, virtualBrightness + (gesture.dy < 0 ? 0.08 : -0.08))))
      flash(`Volume ${Math.round(next * 100)}%`)
    },
  })

  const favorite = Boolean(favorites[asset?.id || asset?.uri])
  const audioTracks = player.availableAudioTracks || []
  const subtitleTracks = player.availableSubtitleTracks || []
  const progressPercent = duration ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0

  return (
    <View style={{ backgroundColor: '#000' }}>
      <View {...panResponder.panHandlers}>
        <VideoView
          ref={videoRef}
          player={player}
          style={{ width: '100%', height: Math.min(width * 0.64, 280), backgroundColor: '#000' }}
          nativeControls={false}
          contentFit="contain"
          surfaceType="surfaceView"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
          fullscreenOptions={{ enable: true, orientation: 'default', autoExitOnRotate: false }}
        />
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1 }} onPress={() => handleOverlayPress('left')} />
          <Pressable style={{ flex: 1 }} onPress={() => handleOverlayPress('right')} />
        </View>
        {controlsVisible ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.26)' }} />
            <View
              pointerEvents="box-none"
              style={{
                ...StyleSheet.absoluteFillObject,
                justifyContent: 'space-between',
                padding: 12,
              }}>
            <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ flex: 1, color: '#FFFFFF', fontWeight: '900' }} numberOfLines={1}>
                {cleanTitle(asset?.filename || 'Online stream')}
              </Text>
              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {asset ? (
                  <TouchableOpacity onPress={() => toggleFavorite(asset)}>
                    <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? '#F43F5E' : '#FFFFFF'} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setTracksOpen((value) => !value)}>
                  <Ionicons name="options-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={23} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
              <ControlButton icon="play-back" label="10s" onPress={() => seekBy(-10)} />
              <TouchableOpacity
                onPress={togglePlay}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: c.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name={playing ? 'pause' : 'play'} size={34} color="#FFFFFF" />
              </TouchableOpacity>
              <ControlButton icon="play-forward" label="10s" onPress={() => seekBy(10)} />
            </View>

            <View pointerEvents="box-none">
              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                  {formatDuration(position)}
                </Text>
                <TouchableOpacity onPress={() => setSpeedOpen((value) => !value)}>
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>
                    {videoSettings.playbackRate}x
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
                  {formatDuration(duration)}
                </Text>
              </View>
              <Pressable
                onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width || 1)}
                onPress={(event) => seekToRatio(event.nativeEvent.locationX)}
                style={{ height: 18, justifyContent: 'center' }}>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
                  <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: c.primary }} />
                </View>
              </Pressable>
            </View>
            </View>
          </View>
        ) : null}
        {overlay ? (
          <View style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '42%',
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 22,
            backgroundColor: 'rgba(0,0,0,0.68)',
          }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{overlay}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 14, backgroundColor: c.bgDeep, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
              {cleanTitle(asset?.filename || 'Online stream')}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
              {formatDuration(asset?.duration || player.duration)} | NendPlay local player
            </Text>
          </View>
          {asset ? (
            <TouchableOpacity onPress={() => toggleFavorite(asset)}>
              <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={23} color={favorite ? '#F43F5E' : c.textMuted} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setSpeedOpen((value) => !value)}>
            <Text style={{ color: c.primary, fontWeight: '900' }}>{videoSettings.playbackRate}x</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTracksOpen((value) => !value)}>
            <Ionicons name="options-outline" size={23} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={23} color={c.text} />
          </TouchableOpacity>
        </View>

        {speedOpen ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {PLAYBACK_SPEEDS.map((speed) => (
              <ToolbarChip
                key={speed}
                theme={theme}
                active={videoSettings.playbackRate === speed}
                label={`${speed}x`}
                onPress={() => {
                  player.playbackRate = speed
                  setPlaybackRate(speed)
                }}
              />
            ))}
          </View>
        ) : null}

        {tracksOpen ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '900' }}>
              Audio tracks: {audioTracks.length || 'default'} | Subtitles: {subtitleTracks.length || 'none detected'}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18 }}>
              Subtitle styling is saved for future SRT/VTT import. Native track switching activates when the current video exposes audio or subtitle tracks.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function VideoExperience({ theme, videos, loading, loadMore, hasMore }) {
  const c = theme.colors
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [layout, setLayout] = useState('grid')
  const [selected, setSelected] = useState(null)
  const [selectedUri, setSelectedUri] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const { favorites, history } = useDeviceMediaStore()

  const visibleVideos = useMemo(() => (
    sortAssets(searchAssets(videos, query), sortMode)
  ), [videos, query, sortMode])

  const openAsset = async (asset) => {
    setSelected(asset)
    setSelectedUri(asset.localUri || asset.uri)
  }

  const openStream = () => {
    if (!streamUrl.trim()) return
    setSelected({ id: streamUrl, uri: streamUrl, filename: streamUrl, duration: 0 })
    setSelectedUri(streamUrl.trim())
  }

  const renderCard = ({ item }) => {
    const favorite = Boolean(favorites[item.id || item.uri])
    if (layout === 'grid') {
      return (
        <TouchableOpacity style={{ width: (width - 42) / 2, marginBottom: 16 }} onPress={() => openAsset(item)}>
          <View style={{
            width: '100%',
            height: 118,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: c.surface,
          }}>
            <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.76)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{formatDuration(item.duration)}</Text>
            </View>
            {favorite ? (
              <Ionicons name="heart" size={18} color="#F43F5E" style={{ position: 'absolute', right: 8, top: 8 }} />
            ) : null}
          </View>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '900', marginTop: 8 }} numberOfLines={2}>
            {cleanTitle(item.filename)}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 3 }}>
            {formatSize(getAssetSize(item)) || 'Local video'}
          </Text>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        onPress={() => openAsset(item)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ width: 86, height: 60, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface }}>
          <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(item.filename)}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
            {formatDuration(item.duration)} | {formatSize(getAssetSize(item)) || 'Local'}
          </Text>
        </View>
        <Ionicons name="play-circle" size={26} color={c.primary} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {selectedUri ? (
        <CinematicVideoPlayer
          key={selectedUri}
          asset={selected}
          uri={selectedUri}
          theme={theme}
          onClose={() => {
            setSelected(null)
            setSelectedUri('')
          }}
        />
      ) : null}

      <View style={{
        margin: 16,
        padding: 14,
        borderRadius: 20,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: '900' }}>NendPlay Media Center</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
          {videos.length} local videos | {Object.keys(favorites).length} favorites | {history.length} recent plays
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <TextInput
            value={streamUrl}
            onChangeText={setStreamUrl}
            placeholder="Stream URL, MP4, M3U8/HLS"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            style={{ flex: 1, color: c.text, backgroundColor: c.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          />
          <TouchableOpacity onPress={openStream} style={{ backgroundColor: c.primary, borderRadius: 12, padding: 11 }}>
            <Ionicons name="radio" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search videos instantly"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, color: c.text, paddingVertical: 12 }}
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={c.textMuted} /></TouchableOpacity> : null}
        </View>
        {query.trim() ? (
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', marginTop: 8 }}>
            {visibleVideos.length} result{visibleVideos.length === 1 ? '' : 's'} for "{query.trim()}"
          </Text>
        ) : null}
      </View>

      <FlatList
        key={`video-${layout}`}
        data={visibleVideos}
        numColumns={layout === 'grid' ? 2 : 1}
        columnWrapperStyle={layout === 'grid' ? { gap: 10, paddingHorizontal: 16 } : null}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.65}
        ListHeaderComponent={
          <>
            <FlatList
              data={SORT_OPTIONS}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <ToolbarChip theme={theme} active={sortMode === item.key} label={item.label} icon={item.icon} onPress={() => setSortMode(item.key)} />
              )}
              ListFooterComponent={
                <TouchableOpacity onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')} style={{ marginLeft: 4, padding: 9 }}>
                  <Ionicons name={layout === 'grid' ? 'list' : 'grid'} size={22} color={c.text} />
                </TouchableOpacity>
              }
            />
          </>
        }
        ListEmptyComponent={loading ? <LoadingSkeleton theme={theme} /> : (
          <EmptyState
            theme={theme}
            icon={query.trim() ? 'search-outline' : 'videocam-outline'}
            title={query.trim() ? 'No matching videos' : 'No videos found'}
            body={query.trim() ? 'Try another title, folder, format, or keyword.' : 'Allow full video access or add video files to your phone gallery.'}
          />
        )}
        renderItem={renderCard}
        ListFooterComponent={hasMore ? <LoadingSkeleton theme={theme} label="Loading more videos..." /> : null}
        contentContainerStyle={{ paddingBottom: 110 }}
      />
    </View>
  )
}
