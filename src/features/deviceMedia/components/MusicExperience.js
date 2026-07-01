import React, { useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import useDeviceMediaStore from '../stores/deviceMediaStore'
import AdBanner from '../../../components/ads/AdBanner'
import NativeAdvancedAd from '../../../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../../../components/ads/NendPlayAdCard'
import {
  SORT_OPTIONS,
  buildMusicRows,
  cleanTitle,
  formatDuration,
  getSourceForUri,
  searchAssets,
  sortAssets,
} from '../utils/mediaUtils'
import { EmptyState, LoadingSkeleton } from './DeviceMediaShell'

const { width } = Dimensions.get('window')

const MAIN_SECTIONS = [
  { key: 'home', label: 'Music Home', icon: 'home' },
  { key: 'library', label: 'My Music', icon: 'musical-notes' },
  { key: 'stream', label: 'Stream', icon: 'radio' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'radio', label: 'Radio', icon: 'cellular' },
  { key: 'profile', label: 'Profile', icon: 'person-outline' },
]

const LOCAL_TABS = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'folders', label: 'Folders' },
]

const FEATURE_CARDS = [
  { icon: 'sparkles', title: 'Daily Mix', body: 'Made for you' },
  { icon: 'heart', title: 'Made For You', body: 'Smart picks' },
  { icon: 'flame', title: 'Top 100 Nigeria', body: 'Updated weekly' },
  { icon: 'trophy', title: 'Gospel Top 50', body: 'Weekly chart' },
  { icon: 'time', title: 'Recently Played', body: 'Quick access' },
  { icon: 'person-add', title: 'Follow Artist', body: 'Get updates' },
  { icon: 'cloud-upload', title: 'Upload Music', body: 'For creators' },
  { icon: 'share-social', title: 'Share Status', body: 'Express yourself' },
]

function getArtist(asset) {
  return asset.artist || asset.author || 'Unknown Artist'
}

function getAlbum(asset) {
  return asset.albumTitle || asset.album || 'Unknown Album'
}

function getFolder(asset) {
  const uri = asset.localUri || asset.uri || ''
  const parts = uri.split('/').filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : 'Device Music'
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

function MusicChip({ theme, active, label, icon, onPress }) {
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

function SectionTitle({ theme, title, action = 'More', onPress }) {
  const c = theme.colors
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '900' }}>{title}</Text>
      <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800' }}>{action}</Text>
        <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
      </TouchableOpacity>
    </View>
  )
}

function DeviceMusicAdStack({ theme, compact = false }) {
  const c = theme.colors
  return (
    <View style={{
      marginBottom: compact ? 10 : 16,
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

function Sidebar({ theme, visible, active, onClose, onSelect, selected }) {
  const c = theme.colors
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' }}>
        <TouchableOpacity
          activeOpacity={1}
          style={{
            width: Math.min(286, width * 0.78),
            flex: 1,
            paddingTop: 52,
            paddingHorizontal: 16,
            backgroundColor: c.bgDeep,
            borderRightWidth: 1,
            borderRightColor: c.border,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-notes" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>NendPlay</Text>
              <Text style={{ color: c.primary, fontWeight: '900' }}>Music</Text>
            </View>
          </View>

          {MAIN_SECTIONS.map((item) => {
            const selectedItem = active === item.key
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  onSelect(item.key)
                  onClose()
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 13,
                  borderRadius: 13,
                  marginBottom: 6,
                  backgroundColor: selectedItem ? c.surface : 'transparent',
                }}>
                <Ionicons name={item.icon} size={20} color={selectedItem ? c.primary : c.textMuted} />
                <Text style={{ color: selectedItem ? c.text : c.textMuted, fontWeight: '800' }}>{item.label}</Text>
              </TouchableOpacity>
            )
          })}

          <View style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}>
            <Text style={{ color: '#FACC15', fontWeight: '900' }}>Go Premium</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
              Ad-free. Download. Offline. Play unlimited.
            </Text>
            <TouchableOpacity style={{ backgroundColor: c.primary, borderRadius: 10, paddingVertical: 10, marginTop: 12 }}>
              <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '900' }}>Try Premium</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }} />
          {selected ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 10,
              borderRadius: 14,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              marginBottom: 22,
            }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-note" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(selected.filename)}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>Local music</Text>
              </View>
              <Ionicons name="headset" size={18} color={c.textMuted} />
            </View>
          ) : null}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

function NowPlayingDeck({ theme, asset, uri, queue, onNext, onPrev }) {
  const c = theme.colors
  const {
    addHistory,
    shuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    toggleFavorite,
    favorites,
    setMusicQueue,
  } = useDeviceMediaStore()
  const [playing, setPlaying] = useState(true)
  const [sleepTimer, setSleepTimer] = useState(null)

  const player = useVideoPlayer(getSourceForUri(uri, asset?.filename), (player) => {
    player.staysActiveInBackground = true
    player.showNowPlayingNotification = true
    player.audioMixingMode = 'auto'
    player.play()
  })

  useEffect(() => {
    if (!asset) return
    addHistory(asset, 'audio')
    setMusicQueue(queue)
  }, [asset?.id, uri, queue.length])

  useEffect(() => {
    if (!sleepTimer) return undefined
    const timer = setTimeout(() => {
      player.pause()
      setPlaying(false)
      setSleepTimer(null)
    }, sleepTimer * 60000)
    return () => clearTimeout(timer)
  }, [sleepTimer, uri])

  const favorite = Boolean(favorites[asset?.id || asset?.uri])
  const toggle = () => {
    if (playing) {
      player.pause()
      setPlaying(false)
    } else {
      player.play()
      setPlaying(true)
    }
  }

  return (
    <View style={{
      padding: 18,
      borderRadius: 28,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.15, backgroundColor: c.primary }} />
      <View style={{
        alignSelf: 'center',
        width: Math.min(260, width - 96),
        aspectRatio: 1,
        borderRadius: 26,
        backgroundColor: c.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Ionicons name="disc" size={92} color={c.textMuted} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '900' }} numberOfLines={2}>
            {cleanTitle(asset?.filename || 'Select a song')}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 6 }}>NendPlay Music</Text>
        </View>
        {asset ? (
          <TouchableOpacity onPress={() => toggleFavorite(asset)}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={26} color={favorite ? '#F43F5E' : c.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surfaceHigh, marginTop: 18, overflow: 'hidden' }}>
        <View style={{ width: '34%', height: '100%', backgroundColor: c.primary }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>1:24</Text>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(asset?.duration || 176)}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 18 }}>
        <TouchableOpacity onPress={toggleShuffle} style={{ opacity: shuffle ? 1 : 0.45 }}>
          <Ionicons name="shuffle" size={24} color={shuffle ? c.primary : c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPrev} style={{ padding: 8 }}>
          <Ionicons name="play-skip-back" size={25} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggle} style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={31} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={{ padding: 8 }}>
          <Ionicons name="play-skip-forward" size={25} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat}>
          <Ionicons name="repeat" size={24} color={repeatMode === 'off' ? c.textMuted : c.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        {[15, 30, 60].map((mins) => (
          <MusicChip
            key={mins}
            theme={theme}
            active={sleepTimer === mins}
            label={`${mins}m sleep`}
            icon="moon-outline"
            onPress={() => setSleepTimer(sleepTimer === mins ? null : mins)}
          />
        ))}
      </View>
    </View>
  )
}

function SongArtwork({ theme, active = false, size = 54 }) {
  const c = theme.colors
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: Math.max(12, size * 0.25),
      backgroundColor: active ? c.primary : c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: active ? c.primary : c.border,
    }}>
      <Ionicons name={active ? 'volume-high' : 'musical-note'} size={Math.round(size * 0.44)} color={active ? '#FFFFFF' : c.primary} />
    </View>
  )
}

function SongRow({ theme, item, index, selected, favorite, onPress }) {
  const c = theme.colors
  const active = selected?.id === item.id
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: active ? c.surface : 'transparent',
      }}>
      <Text style={{ width: 18, color: active ? c.primary : c.textMuted, fontWeight: '900', textAlign: 'center' }}>{index + 1}</Text>
      <SongArtwork theme={theme} active={active} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(item.filename)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
          {getArtist(item)} | {formatDuration(item.duration)}
        </Text>
      </View>
      {favorite ? <Ionicons name="heart" size={18} color="#F43F5E" /> : null}
      <Ionicons name="ellipsis-vertical" size={18} color={c.textMuted} />
    </TouchableOpacity>
  )
}

function HorizontalCards({ theme, title, items, onPress, large = false }) {
  const c = theme.colors
  if (!items.length) return null
  return (
    <View style={{ marginBottom: 20 }}>
      <SectionTitle theme={theme} title={title} />
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPress(item)} style={{ width: large ? 136 : 116 }}>
            <SongArtwork theme={theme} size={large ? 136 : 116} />
            <Text style={{ color: c.text, fontWeight: '900', marginTop: 8, fontSize: 13 }} numberOfLines={2}>
              {cleanTitle(item.filename)}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{getArtist(item)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function MusicHome({ theme, music, visibleSongs, rows, history, favorites, selected, openSong, setSection }) {
  const c = theme.colors
  const recentIds = new Set(history.filter((item) => item.mediaType === 'audio').map((item) => item.id))
  const recentSongs = visibleSongs.filter((item) => recentIds.has(item.id)).slice(0, 6)
  const continueSongs = recentSongs.length ? recentSongs : visibleSongs.slice(0, 6)
  const trending = rows[0]?.items?.slice(0, 8) || visibleSongs.slice(0, 8)
  const releases = rows[1]?.items?.slice(0, 8) || visibleSongs.slice(4, 12)

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 136 }}>
      <HorizontalCards theme={theme} title="Continue Listening" items={continueSongs} onPress={openSong} large />

      <View style={{ marginBottom: 20 }}>
        <SectionTitle theme={theme} title="Trending Songs" onPress={() => setSection('library')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {trending.map((item, index) => (
            <View key={item.id} style={{ width: (width - 48) / 2 }}>
              <SongRow
                theme={theme}
                item={item}
                index={index}
                selected={selected}
                favorite={Boolean(favorites[item.id || item.uri])}
                onPress={() => openSong(item)}
              />
            </View>
          ))}
        </View>
      </View>

      <DeviceMusicAdStack theme={theme} compact />
      <HorizontalCards theme={theme} title="New Releases" items={releases} onPress={openSong} large />
      <HorizontalCards theme={theme} title="Recommended For You" items={visibleSongs.slice(8, 18)} onPress={openSong} large />

      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14 }}>
        <Text style={{ color: c.primary, textAlign: 'center', fontWeight: '900', marginBottom: 12 }}>MORE ADDICTIVE FEATURES</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {FEATURE_CARDS.map((item) => (
            <View key={item.title} style={{
              width: (width - 52) / 2,
              padding: 13,
              borderRadius: 16,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            }}>
              <Ionicons name={item.icon} size={20} color={c.primary} />
              <Text style={{ color: c.text, fontWeight: '900', marginTop: 8 }}>{item.title}</Text>
              <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 3 }}>{item.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function MyMusic({ theme, music, visibleSongs, localTab, setLocalTab, sortMode, setSortMode, selected, favorites, openSong, loadMore, hasMore, loading }) {
  const c = theme.colors
  const artists = useMemo(() => groupAssets(music, getArtist), [music])
  const albums = useMemo(() => groupAssets(music, getAlbum), [music])
  const folders = useMemo(() => groupAssets(music, getFolder), [music])
  const cards = [
    { label: 'Songs', value: music.length, icon: 'musical-note', tab: 'songs' },
    { label: 'Artists', value: artists.length, icon: 'person', tab: 'artists' },
    { label: 'Albums', value: albums.length, icon: 'disc', tab: 'albums' },
    { label: 'Folders', value: folders.length, icon: 'folder', tab: 'folders' },
  ]

  const renderGroup = (item, icon) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>{item.count} song{item.count === 1 ? '' : 's'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </View>
  )

  const data = localTab === 'artists' ? artists : localTab === 'albums' ? albums : localTab === 'folders' ? folders : visibleSongs

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      onEndReached={localTab === 'songs' ? loadMore : undefined}
      onEndReachedThreshold={0.65}
      contentContainerStyle={{ padding: 16, paddingBottom: 136 }}
      ListHeaderComponent={
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {cards.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => setLocalTab(item.tab)}
                style={{
                  width: (width - 52) / 2,
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: localTab === item.tab ? c.primary : c.surface,
                  borderWidth: 1,
                  borderColor: localTab === item.tab ? c.primary : c.border,
                }}>
                <Ionicons name={item.icon} size={22} color={localTab === item.tab ? '#FFFFFF' : c.primary} />
                <Text style={{ color: localTab === item.tab ? '#FFFFFF' : c.text, fontWeight: '900', marginTop: 10 }}>{item.label}</Text>
                <Text style={{ color: localTab === item.tab ? '#EDE9FE' : c.textMuted, fontSize: 12, marginTop: 2 }}>{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Recently Played', value: 'Quick access', icon: 'time-outline' },
              { label: 'Favorites', value: 'Liked songs', icon: 'heart' },
              { label: 'Playlists', value: 'Create local mixes', icon: 'list' },
              { label: 'Recently Added', value: 'Newest files', icon: 'add-circle-outline' },
            ].map((row) => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <Ionicons name={row.icon} size={20} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '900' }}>{row.label}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>{row.value}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </View>
            ))}
          </View>

          <FlatList
            data={LOCAL_TABS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 12 }}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <MusicChip theme={theme} active={localTab === item.key} label={item.label} onPress={() => setLocalTab(item.key)} />
            )}
          />

          {localTab === 'songs' ? (
            <>
              <FlatList
                data={SORT_OPTIONS}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 12 }}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                  <MusicChip theme={theme} active={sortMode === item.key} label={item.label} icon={item.icon} onPress={() => setSortMode(item.key)} />
                )}
              />
              <TouchableOpacity
                onPress={() => visibleSongs[0] && openSong(visibleSongs[0])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Ionicons name="shuffle" size={19} color="#F43F5E" />
                <Text style={{ color: c.text, fontWeight: '900' }}>Shuffle Play</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </>
      }
      ListEmptyComponent={loading ? <LoadingSkeleton theme={theme} label="Scanning music..." /> : (
        <EmptyState theme={theme} icon="musical-notes-outline" title="No music found" body="Allow audio access or add songs to your phone storage." />
      )}
      renderItem={({ item, index }) => (
        localTab === 'songs'
          ? (
            <SongRow
              theme={theme}
              item={item}
              index={index}
              selected={selected}
              favorite={Boolean(favorites[item.id || item.uri])}
              onPress={() => openSong(item)}
            />
          )
          : renderGroup(item, localTab === 'artists' ? 'person-circle' : localTab === 'albums' ? 'disc' : 'folder')
      )}
      ListFooterComponent={localTab === 'songs' && hasMore ? <LoadingSkeleton theme={theme} label="Loading more songs..." /> : null}
    />
  )
}

function StreamSection({ theme, rows, visibleSongs, openSong }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 136 }}>
      <HorizontalCards theme={theme} title="Featured Playlists" items={(rows[0]?.items || visibleSongs).slice(0, 8)} onPress={openSong} large />
      <HorizontalCards theme={theme} title="Top Charts" items={(rows[3]?.items || visibleSongs).slice(0, 8)} onPress={openSong} large />
      <DeviceMusicAdStack theme={theme} compact />
      <HorizontalCards theme={theme} title="New Albums" items={(rows[1]?.items || visibleSongs).slice(0, 8)} onPress={openSong} large />
      <HorizontalCards theme={theme} title="Podcasts" items={(rows[5]?.items || visibleSongs).slice(0, 8)} onPress={openSong} />
    </ScrollView>
  )
}

function SearchSection({ theme, query, setQuery, results, selected, favorites, openSong }) {
  const c = theme.colors
  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 136 }}
      ListHeaderComponent={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, marginBottom: 16 }}>
            <Ionicons name="search" size={20} color={c.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search songs, artists, albums..."
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, color: c.text, paddingVertical: 14 }}
            />
            {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={c.textMuted} /></TouchableOpacity> : null}
          </View>
          <Text style={{ color: c.text, fontWeight: '900', fontSize: 18, marginBottom: 8 }}>
            {query.trim() ? `${results.length} Search Result${results.length === 1 ? '' : 's'}` : 'Top Searched Songs'}
          </Text>
        </>
      }
      ListEmptyComponent={<EmptyState theme={theme} icon="search-outline" title="No matching music" body="Try another song, artist, album, folder, or keyword." />}
      renderItem={({ item, index }) => (
        <SongRow
          theme={theme}
          item={item}
          index={index}
          selected={selected}
          favorite={Boolean(favorites[item.id || item.uri])}
          onPress={() => openSong(item)}
        />
      )}
    />
  )
}

function SimpleSection({ theme, icon, title, body, children }) {
  const c = theme.colors
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 136 }}>
      <View style={{
        padding: 22,
        borderRadius: 24,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
      }}>
        <Ionicons name={icon} size={44} color={c.primary} />
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '900', marginTop: 12 }}>{title}</Text>
        <Text style={{ color: c.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>{body}</Text>
      </View>
      {children}
    </ScrollView>
  )
}

function MiniPlayer({ theme, selected, onOpen, onNext }) {
  const c = theme.colors
  if (!selected) return null
  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.92}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 14,
        borderRadius: 22,
        padding: 12,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
      <SongArtwork theme={theme} active size={44} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(selected.filename)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 11 }} numberOfLines={1}>{getArtist(selected)}</Text>
      </View>
      <TouchableOpacity onPress={onNext} style={{ padding: 8 }}>
        <Ionicons name="play-skip-forward" size={22} color={c.primary} />
      </TouchableOpacity>
      <Ionicons name="list" size={22} color={c.textMuted} />
    </TouchableOpacity>
  )
}

function FullPlayerModalContent({ theme, selected, onNext, onPrev }) {
  const c = theme.colors
  if (!selected) return null
  return (
    <View style={{
      padding: 18,
      borderRadius: 28,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.15, backgroundColor: c.primary }} />
      <View style={{
        alignSelf: 'center',
        width: Math.min(260, width - 96),
        aspectRatio: 1,
        borderRadius: 26,
        backgroundColor: c.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Ionicons name="disc" size={92} color={c.textMuted} />
      </View>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '900', marginTop: 22 }} numberOfLines={2}>
        {cleanTitle(selected.filename)}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 6 }}>{getArtist(selected)}</Text>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surfaceHigh, marginTop: 22, overflow: 'hidden' }}>
        <View style={{ width: '34%', height: '100%', backgroundColor: c.primary }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>1:24</Text>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(selected.duration || 176)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: 26 }}>
        <Ionicons name="shuffle" size={24} color={c.textMuted} />
        <TouchableOpacity onPress={onPrev} style={{ padding: 8 }}>
          <Ionicons name="play-skip-back" size={28} color={c.text} />
        </TouchableOpacity>
        <View style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="pause" size={32} color="#FFFFFF" />
        </View>
        <TouchableOpacity onPress={onNext} style={{ padding: 8 }}>
          <Ionicons name="play-skip-forward" size={28} color={c.text} />
        </TouchableOpacity>
        <Ionicons name="repeat" size={24} color={c.primary} />
      </View>
      <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 18, fontSize: 12 }}>
        Playback continues from the mini-player while this screen gives a full music view.
      </Text>
    </View>
  )
}

export default function MusicExperience({ theme, music, loading, loadMore, hasMore }) {
  const c = theme.colors
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [mainSection, setMainSection] = useState('home')
  const [localTab, setLocalTab] = useState('songs')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [selectedUri, setSelectedUri] = useState('')
  const { shuffle, repeatMode, history, favorites } = useDeviceMediaStore()

  const visibleSongs = useMemo(() => (
    sortAssets(searchAssets(music, mainSection === 'search' ? query : ''), sortMode)
  ), [music, query, sortMode, mainSection])

  const searchResults = useMemo(() => sortAssets(searchAssets(music, query), sortMode), [music, query, sortMode])
  const musicRows = useMemo(() => buildMusicRows(music), [music])
  const selectedIndex = selected ? visibleSongs.findIndex((item) => item.id === selected.id) : -1

  const openSong = (asset) => {
    setSelected(asset)
    setSelectedUri(asset.localUri || asset.uri)
  }

  const playNext = () => {
    const queue = visibleSongs.length ? visibleSongs : music
    if (!queue.length) return
    if (repeatMode === 'one' && selected) {
      openSong(selected)
      return
    }
    if (shuffle) {
      openSong(queue[Math.floor(Math.random() * queue.length)])
      return
    }
    openSong(queue[selectedIndex >= 0 ? (selectedIndex + 1) % queue.length : 0])
  }

  const playPrev = () => {
    const queue = visibleSongs.length ? visibleSongs : music
    if (!queue.length) return
    openSong(queue[selectedIndex > 0 ? selectedIndex - 1 : queue.length - 1])
  }

  const renderContent = () => {
    if (mainSection === 'library') {
      return (
        <MyMusic
          theme={theme}
          music={music}
          visibleSongs={visibleSongs}
          localTab={localTab}
          setLocalTab={setLocalTab}
          sortMode={sortMode}
          setSortMode={setSortMode}
          selected={selected}
          favorites={favorites}
          openSong={openSong}
          loadMore={loadMore}
          hasMore={hasMore}
          loading={loading}
        />
      )
    }
    if (mainSection === 'stream') {
      return <StreamSection theme={theme} rows={musicRows} visibleSongs={visibleSongs} openSong={openSong} />
    }
    if (mainSection === 'search') {
      return <SearchSection theme={theme} query={query} setQuery={setQuery} results={searchResults} selected={selected} favorites={favorites} openSong={openSong} />
    }
    if (mainSection === 'radio') {
      return (
        <SimpleSection
          theme={theme}
          icon="radio"
          title="NendPlay Radio"
          body="Internet radio, live channels, and mood stations are structured here for future streaming sources.">
          <DeviceMusicAdStack theme={theme} />
        </SimpleSection>
      )
    }
    if (mainSection === 'profile') {
      return (
        <SimpleSection
          theme={theme}
          icon="person-circle"
          title="Music Profile"
          body={`${history.filter((item) => item.mediaType === 'audio').length} recently played songs and ${Object.keys(favorites).length} favorites saved on this device.`}>
          <View style={{ marginTop: 16 }}>
            <SectionTitle theme={theme} title="Features You Will Love" action="" />
            {[
              'Play local and streaming music together',
              'Background play and notification player ready',
              'Lyrics, playlist, and recommendations structure',
              'Offline downloads and multi-file format support',
            ].map((item) => (
              <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color={c.primary} />
                <Text style={{ color: c.text, flex: 1 }}>{item}</Text>
              </View>
            ))}
          </View>
        </SimpleSection>
      )
    }
    return (
      <MusicHome
        theme={theme}
        music={music}
        visibleSongs={visibleSongs}
        rows={musicRows}
        history={history}
        favorites={favorites}
        selected={selected}
        openSong={openSong}
        setSection={setMainSection}
      />
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: c.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setSidebarOpen(true)}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="menu" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>Music</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '800' }}>Local songs, streaming, playlists, radio</Text>
          </View>
          <TouchableOpacity onPress={() => setMainSection('search')} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={20} color={c.text} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={MAIN_SECTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <MusicChip theme={theme} active={mainSection === item.key} label={item.label} icon={item.icon} onPress={() => setMainSection(item.key)} />
          )}
        />
      </View>

      {renderContent()}

      {selectedUri ? (
        <View style={{ position: 'absolute', left: -10000, top: -10000, width: 1, height: 1 }}>
          <NowPlayingDeck
            key={selectedUri}
            theme={theme}
            asset={selected}
            uri={selectedUri}
            queue={visibleSongs}
            onNext={playNext}
            onPrev={playPrev}
          />
        </View>
      ) : null}

      <MiniPlayer theme={theme} selected={selected} onOpen={() => setPlayerOpen(true)} onNext={playNext} />
      <Sidebar theme={theme} visible={sidebarOpen} active={mainSection} onClose={() => setSidebarOpen(false)} onSelect={setMainSection} selected={selected} />

      <Modal visible={playerOpen} animationType="slide" onRequestClose={() => setPlayerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.bgDeep, paddingTop: 46, paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => setPlayerOpen(false)} style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Ionicons name="chevron-down" size={24} color={c.text} />
          </TouchableOpacity>
          <FullPlayerModalContent theme={theme} selected={selected} onNext={playNext} onPrev={playPrev} />
        </View>
      </Modal>
    </View>
  )
}
