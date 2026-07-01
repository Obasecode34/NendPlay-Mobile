import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import useDeviceMediaStore from '../stores/deviceMediaStore'
import AdBanner from '../../../components/ads/AdBanner'
import NativeAdvancedAd from '../../../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../../../components/ads/NendPlayAdCard'
import {
  PLAYBACK_SPEEDS,
  SORT_OPTIONS,
  cleanTitle,
  filterVideoAssets,
  formatDuration,
  formatSize,
  getAssetSize,
  getSourceForUri,
  getVideoBucket,
  searchAssets,
  sortAssets,
} from '../utils/mediaUtils'
import { EmptyState, LoadingSkeleton } from './DeviceMediaShell'

const { width } = Dimensions.get('window')

const VIDEO_TABS = [
  { key: 'videos', label: 'Videos', icon: 'play-circle' },
  { key: 'folders', label: 'Folders', icon: 'folder-outline' },
  { key: 'playlists', label: 'Playlists', icon: 'list' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
]

const VIDEO_FILTERS = [
  { key: 'all', label: 'All Videos' },
  { key: 'recent', label: 'Recently Added' },
  { key: 'played', label: 'Recently Played' },
  { key: 'favorites', label: 'Favorites' },
]

const QUICK_MORE = [
  { key: 'aspect', label: 'Aspect Ratio', icon: 'resize-outline' },
  { key: 'equalizer', label: 'Equalizer', icon: 'options-outline' },
  { key: 'audioOnly', label: 'Play as Audio', icon: 'musical-note' },
  { key: 'background', label: 'Background', icon: 'phone-portrait-outline' },
  { key: 'pip', label: 'Pop-up Play', icon: 'albums-outline' },
  { key: 'repeat', label: 'Repeat', icon: 'repeat' },
  { key: 'shuffle', label: 'Shuffle', icon: 'shuffle' },
  { key: 'ab', label: 'A-B Repeat', icon: 'swap-horizontal' },
  { key: 'playlist', label: 'Save Playlist', icon: 'images-outline' },
  { key: 'screenshot', label: 'Screenshot', icon: 'camera-outline' },
  { key: 'info', label: 'Playback Info', icon: 'information-circle-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
]

const GESTURE_GUIDE = [
  { title: 'Brightness', body: 'Swipe up/down on left', icon: 'sunny-outline' },
  { title: 'Volume', body: 'Swipe up/down on right', icon: 'volume-high-outline' },
  { title: 'Seek', body: 'Swipe left/right', icon: 'swap-horizontal-outline' },
  { title: 'Seek 10 sec', body: 'Double tap left/right', icon: 'play-forward-outline' },
  { title: 'Zoom', body: 'Pinch to zoom', icon: 'contract-outline' },
  { title: 'Playback Speed', body: 'Long press + swipe', icon: 'speedometer-outline' },
]

function getFolderName(asset) {
  const uri = asset.localUri || asset.uri || ''
  const parts = uri.split('/').filter(Boolean)
  if (parts.length > 1) return parts[parts.length - 2]
  const bucket = getVideoBucket(asset)
  return bucket === 'downloads' ? 'Downloaded' : bucket === 'series' ? 'TV Shows' : bucket === 'movies' ? 'Movies' : 'Camera'
}

function groupAssets(items, getKey) {
  return Object.values(items.reduce((acc, item) => {
    const key = getKey(item)
    if (!acc[key]) acc[key] = { id: key, title: key, count: 0, items: [] }
    acc[key].count += 1
    acc[key].items.push(item)
    return acc
  }, {})).sort((a, b) => a.title.localeCompare(b.title))
}

function resolvePoster(item) {
  return item?.localUri || item?.uri
}

function ToolbarChip({ theme, active, label, icon, onPress }) {
  const c = theme.colors
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: active ? '#FF9800' : c.surface,
        borderWidth: 1,
        borderColor: active ? '#FF9800' : c.border,
      }}>
      {icon ? <Ionicons name={icon} size={14} color={active ? '#080808' : c.textMuted} /> : null}
      <Text style={{ color: active ? '#080808' : c.textMuted, fontSize: 12, fontWeight: '900' }}>{label}</Text>
    </TouchableOpacity>
  )
}

function ControlButton({ icon, label, color = '#FFFFFF', onPress, size = 24 }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', justifyContent: 'center', minWidth: 42 }}>
      <Ionicons name={icon} size={size} color={color} />
      {label ? <Text style={{ color, fontSize: 10, fontWeight: '900', marginTop: 2 }}>{label}</Text> : null}
    </TouchableOpacity>
  )
}

function VideoAdStack({ theme, compact = false }) {
  const c = theme.colors
  return (
    <View style={{
      marginHorizontal: compact ? 0 : 16,
      marginBottom: compact ? 10 : 14,
      gap: 10,
      padding: 10,
      borderRadius: 18,
      backgroundColor: c.bgDeep,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <NendPlayAdCard placement="media" style={{ marginHorizontal: 0, marginBottom: 0 }} />
      <AdBanner style={{ marginHorizontal: 0, marginBottom: 0 }} horizontalPadding={64} />
      <NativeAdvancedAd style={{ marginHorizontal: 0, marginBottom: 0 }} />
    </View>
  )
}

function Sheet({ theme, visible, title, onClose, children }) {
  const c = theme.colors
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', padding: 18 }}>
        <Pressable style={{
          borderRadius: 16,
          backgroundColor: '#050505',
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900' }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function MoreSheet({ theme, visible, onClose, onOpenSubtitles, onOpenAudio, onOpenQueue, onOpenGestures }) {
  const c = theme.colors
  return (
    <Sheet theme={theme} visible={visible} title="More" onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {QUICK_MORE.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => {
              if (item.key === 'settings') onOpenGestures()
              if (item.key === 'playlist') onOpenQueue()
            }}
            style={{
              width: '30%',
              minHeight: 76,
              borderRadius: 12,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
            }}>
            <Ionicons name={item.icon} size={22} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 10, textAlign: 'center', marginTop: 8 }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <ToolbarChip theme={theme} label="Subtitles" icon="text-outline" onPress={onOpenSubtitles} />
        <ToolbarChip theme={theme} label="Audio" icon="volume-high-outline" onPress={onOpenAudio} />
      </View>
    </Sheet>
  )
}

function SubtitlesSheet({ theme, visible, onClose }) {
  const c = theme.colors
  const tracks = ['Disable', 'English (en.srt)', 'English (en.ass)', 'Hindi (hi.srt)', 'Download Subtitles', 'Subtitle Settings']
  return (
    <Sheet theme={theme} visible={visible} title="Subtitles" onClose={onClose}>
      {tracks.map((track, index) => (
        <View key={track} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: index < tracks.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
          <Text style={{ color: '#FFFFFF' }}>{track}</Text>
          <Ionicons name={index === 1 ? 'radio-button-on' : index > 3 ? (index === 4 ? 'download-outline' : 'settings-outline') : 'radio-button-off'} size={20} color={index === 1 ? '#FF9800' : '#FFFFFF'} />
        </View>
      ))}
    </Sheet>
  )
}

function AudioSheet({ theme, visible, onClose }) {
  const c = theme.colors
  const tracks = ['Audio Track #1 | English, AAC, 2.0', 'Audio Track #2 | Hindi, AAC, 5.1', 'Audio Track #3 | English, DTS, 5.1', 'Audio Settings']
  return (
    <Sheet theme={theme} visible={visible} title="Audio" onClose={onClose}>
      {tracks.map((track, index) => (
        <View key={track} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: index < tracks.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
          <Text style={{ color: '#FFFFFF', flex: 1 }}>{track}</Text>
          <Ionicons name={index === 0 ? 'radio-button-on' : index === 3 ? 'settings-outline' : 'radio-button-off'} size={20} color={index === 0 ? '#FF9800' : '#FFFFFF'} />
        </View>
      ))}
    </Sheet>
  )
}

function QueueSheet({ theme, visible, onClose, queue, selected, onPlay }) {
  const c = theme.colors
  return (
    <Sheet theme={theme} visible={visible} title="Play Queue" onClose={onClose}>
      <Text style={{ color: c.textMuted, marginBottom: 10 }}>{queue.length} videos</Text>
      {queue.slice(0, 8).map((item, index) => {
        const active = selected?.id === item.id
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => {
              onPlay(item)
              onClose()
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ color: active ? '#FF9800' : c.textMuted, width: 18 }}>{index + 1}</Text>
            <Image source={{ uri: resolvePoster(item) }} style={{ width: 56, height: 38, borderRadius: 7, backgroundColor: c.surface }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }} numberOfLines={1}>{cleanTitle(item.filename)}</Text>
              <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(item.duration)}</Text>
            </View>
            <Ionicons name="reorder-three-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )
      })}
    </Sheet>
  )
}

function GesturesSheet({ theme, visible, onClose }) {
  const c = theme.colors
  return (
    <Sheet theme={theme} visible={visible} title="Gestures" onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {GESTURE_GUIDE.map((item) => (
          <View key={item.title} style={{ width: '46%', padding: 12, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Ionicons name={item.icon} size={24} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '900', marginTop: 8 }}>{item.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4, lineHeight: 16 }}>{item.body}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  )
}

function CinematicVideoPlayer({ asset, uri, theme, queue, onClose, onNext, onPrev, onPlayAsset }) {
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
  const [moreOpen, setMoreOpen] = useState(false)
  const [subtitlesOpen, setSubtitlesOpen] = useState(false)
  const [audioOpen, setAudioOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [gesturesOpen, setGesturesOpen] = useState(false)
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

  const handleTap = (side) => {
    const now = Date.now()
    if (lastTap.current.side === side && now - lastTap.current.time < 360) {
      seekBy(side === 'left' ? -10 : 10)
      lastTap.current = { time: 0, side: null }
      return
    }
    lastTap.current = { time: now, side }
    setControlsVisible((value) => !value)
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
          <Pressable style={{ flex: 1 }} onPress={() => handleTap('left')} />
          <Pressable style={{ flex: 1 }} onPress={() => handleTap('right')} />
        </View>
        {controlsVisible ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' }} />
            <View pointerEvents="box-none" style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 12 }}>
              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={onClose} style={{ marginRight: 10 }}>
                  <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={{ flex: 1, color: '#FFFFFF', fontWeight: '900' }} numberOfLines={1}>
                  {cleanTitle(asset?.filename || 'Online stream')}
                </Text>
                <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                  {asset ? (
                    <TouchableOpacity onPress={() => toggleFavorite(asset)}>
                      <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={22} color={favorite ? '#F43F5E' : '#FFFFFF'} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setAudioOpen(true)}>
                    <Ionicons name="musical-note" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSubtitlesOpen(true)}>
                    <Ionicons name="chatbox-ellipses-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setQueueOpen(true)}>
                    <Ionicons name="cast-outline" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMoreOpen(true)}>
                    <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sunny-outline" size={20} color="#FFFFFF" />
                  <View style={{ width: 4, height: 104, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ height: `${Math.round(virtualBrightness * 100)}%`, backgroundColor: '#FF9800', borderRadius: 3 }} />
                  </View>
                </View>
                <ControlButton icon="arrow-undo-circle-outline" label="10" onPress={() => seekBy(-10)} size={46} />
                <TouchableOpacity
                  onPress={togglePlay}
                  style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={playing ? 'pause' : 'play'} size={42} color="#FFFFFF" />
                </TouchableOpacity>
                <ControlButton icon="arrow-redo-circle-outline" label="10" onPress={() => seekBy(10)} size={46} />
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Ionicons name="volume-high-outline" size={20} color="#FFFFFF" />
                  <View style={{ width: 4, height: 104, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ height: `${Math.round(volume * 100)}%`, backgroundColor: '#FF9800', borderRadius: 3 }} />
                  </View>
                </View>
              </View>

              <View pointerEvents="box-none">
                <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{formatDuration(position)}</Text>
                  <Pressable
                    onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width || 1)}
                    onPress={(event) => seekToRatio(event.nativeEvent.locationX)}
                    style={{ flex: 1, height: 18, justifyContent: 'center', marginHorizontal: 10 }}>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.32)', overflow: 'hidden' }}>
                      <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#FF9800' }} />
                    </View>
                  </Pressable>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{formatDuration(duration)}</Text>
                  <TouchableOpacity style={{ marginLeft: 12 }}>
                    <Ionicons name="scan-outline" size={23} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ControlButton icon="lock-closed-outline" label="Lock" />
                  <ControlButton icon="speedometer-outline" label="Speed" onPress={() => setSpeedOpen((value) => !value)} />
                  <ControlButton icon="volume-high-outline" label="Audio" onPress={() => setAudioOpen(true)} />
                  <ControlButton icon="text-outline" label="Subtitle" onPress={() => setSubtitlesOpen(true)} />
                  <ControlButton icon="play-skip-forward-outline" label="Next" onPress={onNext} />
                  <ControlButton icon="timer-outline" label="Sleep Timer" />
                  <ControlButton icon="ellipsis-horizontal" label="More" onPress={() => setMoreOpen(true)} />
                </View>
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

      {speedOpen ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', padding: 12, backgroundColor: '#050505' }}>
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

      <MoreSheet
        theme={theme}
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenSubtitles={() => setSubtitlesOpen(true)}
        onOpenAudio={() => setAudioOpen(true)}
        onOpenQueue={() => setQueueOpen(true)}
        onOpenGestures={() => setGesturesOpen(true)}
      />
      <SubtitlesSheet theme={theme} visible={subtitlesOpen} onClose={() => setSubtitlesOpen(false)} />
      <AudioSheet theme={theme} visible={audioOpen} onClose={() => setAudioOpen(false)} />
      <QueueSheet theme={theme} visible={queueOpen} onClose={() => setQueueOpen(false)} queue={queue} selected={asset} onPlay={onPlayAsset} />
      <GesturesSheet theme={theme} visible={gesturesOpen} onClose={() => setGesturesOpen(false)} />
    </View>
  )
}

function BottomTabs({ theme, active, onChange }) {
  const c = theme.colors
  return (
    <View style={{
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: '#060606',
      paddingVertical: 7,
    }}>
      {VIDEO_TABS.map((tab) => {
        const selected = active === tab.key
        return (
          <TouchableOpacity key={tab.key} onPress={() => onChange(tab.key)} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Ionicons name={tab.icon} size={19} color={selected ? '#FF9800' : '#FFFFFF'} />
            <Text style={{ color: selected ? '#FF9800' : '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{tab.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function VideoCard({ theme, item, favorite, onPress }) {
  const c = theme.colors
  return (
    <TouchableOpacity style={{ width: (width - 42) / 2, marginBottom: 16 }} onPress={onPress}>
      <View style={{ width: '100%', height: 112, borderRadius: 9, overflow: 'hidden', backgroundColor: c.surface }}>
        <Image source={{ uri: resolvePoster(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        {favorite ? <Ionicons name="heart" size={18} color="#F43F5E" style={{ position: 'absolute', right: 8, top: 8 }} /> : null}
        <Ionicons name="ellipsis-vertical" size={18} color="#FFFFFF" style={{ position: 'absolute', right: 6, bottom: 7 }} />
      </View>
      <Text style={{ color: c.text, fontSize: 13, fontWeight: '900', marginTop: 7 }} numberOfLines={2}>{cleanTitle(item.filename)}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 3 }}>
        {formatDuration(item.duration)} | {formatSize(getAssetSize(item)) || 'Local video'}
      </Text>
    </TouchableOpacity>
  )
}

function Header({ theme, query, setQuery, searchOpen, setSearchOpen, onMenu, onStream, streamUrl, setStreamUrl }) {
  const c = theme.colors
  return (
    <View style={{ padding: 14, backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={onMenu}>
          <Ionicons name="menu" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ color: '#FF9800', fontSize: 18, fontWeight: '900' }}>NendPlay</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', flex: 1 }}>Media</Text>
        <TouchableOpacity onPress={() => setSearchOpen((value) => !value)}>
          <Ionicons name="search" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {searchOpen ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search local videos" placeholderTextColor={c.textMuted} style={{ flex: 1, color: c.text, paddingVertical: 11 }} />
            {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={c.textMuted} /></TouchableOpacity> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={streamUrl}
              onChangeText={setStreamUrl}
              placeholder="Stream URL, MP4, M3U8/HLS"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              style={{ flex: 1, color: c.text, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
            />
            <TouchableOpacity onPress={onStream} style={{ backgroundColor: '#FF9800', borderRadius: 12, padding: 11 }}>
              <Ionicons name="radio" size={18} color="#050505" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  )
}

function FolderScreen({ theme, groups }) {
  const c = theme.colors
  return (
    <FlatList
      data={groups}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 92 }}
      renderItem={({ item }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }}>
          <Ionicons name="folder" size={38} color="#FFB13B" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '900' }}>{item.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.count} videos</Text>
          </View>
          <Ionicons name="ellipsis-vertical" size={18} color={c.textMuted} />
        </View>
      )}
      ListEmptyComponent={<EmptyState theme={theme} icon="folder-open-outline" title="No folders found" body="Video folders appear after NendPlay scans local videos." />}
    />
  )
}

function PlaylistScreen({ theme, videos, onPlay }) {
  const c = theme.colors
  const playlists = [
    { id: 'watch_later', title: 'Watch Later', items: videos.slice(0, 10) },
    { id: 'action', title: 'Action Movies', items: videos.filter((item) => /action|fight|war|battle/i.test(item.filename || '')).slice(0, 18) },
    { id: 'series', title: 'TV Shows', items: videos.filter((item) => getVideoBucket(item) === 'series').slice(0, 18) },
    { id: 'movies', title: 'Movies', items: videos.filter((item) => getVideoBucket(item) === 'movies').slice(0, 25) },
    { id: 'downloads', title: 'NendPlay Downloads', items: videos.filter((item) => getVideoBucket(item) === 'downloads').slice(0, 18) },
  ].filter((item) => item.items.length)

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 92 }}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => onPlay(item.items[0])} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Image source={{ uri: resolvePoster(item.items[0]) }} style={{ width: 72, height: 54, borderRadius: 9, backgroundColor: c.surface }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '900' }}>{item.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.items.length} videos</Text>
          </View>
          <Ionicons name="ellipsis-vertical" size={18} color={c.textMuted} />
        </TouchableOpacity>
      )}
      ListEmptyComponent={<EmptyState theme={theme} icon="list-outline" title="No playlists yet" body="Playlists will appear from watch later, folders, and saved collections." />}
    />
  )
}

function SettingsScreen({ theme }) {
  const c = theme.colors
  const { videoSettings } = useDeviceMediaStore()
  const [hideShort, setHideShort] = useState(false)
  const [mediaInfo, setMediaInfo] = useState(true)
  const [hardware, setHardware] = useState(true)
  const [background, setBackground] = useState(true)
  const [resume, setResume] = useState(true)
  const rows = [
    { section: 'General', title: 'Scan Media', body: 'Scan device for videos', icon: 'shield-checkmark-outline' },
    { title: 'Hide Short Videos', body: 'Hide videos shorter than 60s', icon: 'notifications-off-outline', value: hideShort, set: setHideShort },
    { title: 'Media Info', body: 'Show file info', icon: 'information-circle-outline', value: mediaInfo, set: setMediaInfo },
    { section: 'Playback', title: 'Hardware Acceleration', body: 'Use native acceleration', icon: 'play-forward-outline', value: hardware, set: setHardware },
    { title: 'Background Playback', body: 'Play in background', icon: 'play-skip-forward-outline', value: background, set: setBackground },
    { title: 'Resume Playback', body: 'Remember last position', icon: 'expand-outline', value: resume, set: setResume },
    { title: 'Default Playback Speed', body: `${videoSettings.playbackRate || 1}x`, icon: 'play-skip-forward-outline' },
    { title: 'Playback Gesture', body: 'Customize gestures', icon: 'hand-left-outline' },
  ]
  let currentSection = ''
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 92 }}>
      {rows.map((row) => {
        const section = row.section && row.section !== currentSection
        if (section) currentSection = row.section
        return (
          <View key={`${row.section || ''}_${row.title}`}>
            {section ? <Text style={{ color: '#FF9800', fontWeight: '900', marginTop: 12, marginBottom: 12 }}>{row.section}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 }}>
              <Ionicons name={row.icon} size={21} color="#FFFFFF" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '900' }}>{row.title}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>{row.body}</Text>
              </View>
              {typeof row.value === 'boolean' ? (
                <Switch value={row.value} onValueChange={row.set} trackColor={{ true: '#FF9800', false: '#444' }} thumbColor="#FFFFFF" />
              ) : null}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function MiniPlayer({ theme, selected, onOpen, onClose }) {
  const c = theme.colors
  if (!selected) return null
  return (
    <View style={{
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 54,
      backgroundColor: 'rgba(10,10,10,0.94)',
      borderTopWidth: 1,
      borderTopColor: c.border,
      borderRadius: 13,
      overflow: 'hidden',
    }}>
      <TouchableOpacity onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9 }}>
        <Image source={{ uri: resolvePoster(selected) }} style={{ width: 66, height: 42, borderRadius: 7, backgroundColor: c.surface }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(selected.filename)}</Text>
          <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(selected.duration)}</Text>
          <View style={{ height: 3, backgroundColor: c.surfaceHigh, marginTop: 5 }}>
            <View style={{ width: '34%', height: '100%', backgroundColor: '#FF9800' }} />
          </View>
        </View>
        <Ionicons name="pause" size={22} color="#FFFFFF" />
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  )
}

export default function VideoExperience({ theme, videos, loading, loadMore, hasMore }) {
  const c = theme.colors
  const [activeTab, setActiveTab] = useState('videos')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortMode, setSortMode] = useState('recent')
  const [selected, setSelected] = useState(null)
  const [selectedUri, setSelectedUri] = useState('')
  const [miniPlayer, setMiniPlayer] = useState(null)
  const [streamUrl, setStreamUrl] = useState('')
  const { favorites, history } = useDeviceMediaStore()

  const favoriteIds = useMemo(() => new Set(Object.keys(favorites)), [favorites])
  const historyIds = useMemo(() => new Set(history.filter((item) => item.mediaType === 'video').map((item) => item.id)), [history])

  const filteredVideos = useMemo(() => {
    let items = sortAssets(searchAssets(videos, query), sortMode)
    if (filter === 'played') items = items.filter((item) => historyIds.has(item.id))
    else if (filter === 'favorites') items = items.filter((item) => favoriteIds.has(item.id || item.uri))
    else if (filter !== 'all') items = filterVideoAssets(items, filter)
    return items
  }, [videos, query, sortMode, filter, favoriteIds, historyIds])

  const folders = useMemo(() => groupAssets(videos, getFolderName), [videos])
  const selectedIndex = selected ? filteredVideos.findIndex((item) => item.id === selected.id) : -1

  const openAsset = (asset) => {
    if (!asset) return
    setSelected(asset)
    setSelectedUri(asset.localUri || asset.uri)
    setMiniPlayer(asset)
  }

  const closePlayer = () => {
    setSelected(null)
    setSelectedUri('')
  }

  const openStream = () => {
    if (!streamUrl.trim()) return
    const asset = { id: streamUrl.trim(), uri: streamUrl.trim(), filename: streamUrl.trim(), duration: 0 }
    setSelected(asset)
    setSelectedUri(streamUrl.trim())
    setMiniPlayer(asset)
  }

  const playNext = () => {
    if (!filteredVideos.length) return
    openAsset(filteredVideos[selectedIndex >= 0 ? (selectedIndex + 1) % filteredVideos.length : 0])
  }

  const playPrev = () => {
    if (!filteredVideos.length) return
    openAsset(filteredVideos[selectedIndex > 0 ? selectedIndex - 1 : filteredVideos.length - 1])
  }

  const renderVideos = () => (
    <FlatList
      key="video-grid"
      data={filteredVideos}
      numColumns={2}
      columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
      keyExtractor={(item) => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.65}
      ListHeaderComponent={
        <>
          <FlatList
            data={VIDEO_FILTERS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <ToolbarChip theme={theme} active={filter === item.key} label={item.label} onPress={() => setFilter(item.key)} />}
          />
          <FlatList
            data={SORT_OPTIONS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => <ToolbarChip theme={theme} active={sortMode === item.key} label={item.label} icon={item.icon} onPress={() => setSortMode(item.key)} />}
          />
          <VideoAdStack theme={theme} />
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
      renderItem={({ item }) => (
        <VideoCard theme={theme} item={item} favorite={Boolean(favorites[item.id || item.uri])} onPress={() => openAsset(item)} />
      )}
      ListFooterComponent={hasMore ? <LoadingSkeleton theme={theme} label="Loading more videos..." /> : null}
      contentContainerStyle={{ paddingBottom: 118 }}
    />
  )

  const renderContent = () => {
    if (activeTab === 'folders') return <FolderScreen theme={theme} groups={folders} />
    if (activeTab === 'playlists') return <PlaylistScreen theme={theme} videos={videos} onPlay={openAsset} />
    if (activeTab === 'favorites') {
      const favoriteVideos = videos.filter((item) => favorites[item.id || item.uri])
      return (
        <FlatList
          key="favorites"
          data={favoriteVideos}
          numColumns={2}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 118 }}
          renderItem={({ item }) => <VideoCard theme={theme} item={item} favorite onPress={() => openAsset(item)} />}
          ListEmptyComponent={<EmptyState theme={theme} icon="heart-outline" title="No favorite videos" body="Tap the heart while watching to save videos here." />}
        />
      )
    }
    if (activeTab === 'settings') return <SettingsScreen theme={theme} />
    return renderVideos()
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <Header
        theme={theme}
        query={query}
        setQuery={setQuery}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        onMenu={() => setActiveTab('settings')}
        onStream={openStream}
        streamUrl={streamUrl}
        setStreamUrl={setStreamUrl}
      />

      {selectedUri ? (
        <CinematicVideoPlayer
          key={selectedUri}
          asset={selected}
          uri={selectedUri}
          theme={theme}
          queue={filteredVideos}
          onClose={closePlayer}
          onNext={playNext}
          onPrev={playPrev}
          onPlayAsset={openAsset}
        />
      ) : null}

      {renderContent()}
      <MiniPlayer theme={theme} selected={selectedUri ? null : miniPlayer} onOpen={() => openAsset(miniPlayer)} onClose={() => setMiniPlayer(null)} />
      <TouchableOpacity
        onPress={() => filteredVideos[0] && openAsset(filteredVideos[0])}
        style={{
          position: 'absolute',
          right: 18,
          bottom: 78,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: '#FF9800',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#FF9800',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}>
        <Ionicons name="play" size={30} color="#050505" />
      </TouchableOpacity>
      <BottomTabs theme={theme} active={activeTab} onChange={setActiveTab} />
    </View>
  )
}
