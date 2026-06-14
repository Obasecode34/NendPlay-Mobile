import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, FlatList, Dimensions } from 'react-native'
import { useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import useDeviceMediaStore from '../stores/deviceMediaStore'
import {
  SORT_OPTIONS, buildMusicRows, cleanTitle, formatDuration, getSourceForUri,
  searchAssets, sortAssets,
} from '../utils/mediaUtils'
import { EmptyState, LoadingSkeleton } from './DeviceMediaShell'

const { width } = Dimensions.get('window')

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

function NowPlayingDeck({ theme, asset, uri, queue, onNext, onPrev }) {
  const c = theme.colors
  const {
    addHistory, shuffle, toggleShuffle, repeatMode, cycleRepeat,
    toggleFavorite, favorites, setMusicQueue,
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
      margin: 16,
      padding: 18,
      borderRadius: 28,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.16, backgroundColor: c.primary }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{
          width: 92,
          height: 92,
          borderRadius: 24,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name="musical-notes" size={42} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>
            Now Playing
          </Text>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }} numberOfLines={2}>
            {cleanTitle(asset?.filename || 'Select a song')}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 6 }}>
            NendPlay Media | Local library
          </Text>
        </View>
        {asset ? (
          <TouchableOpacity onPress={() => toggleFavorite(asset)}>
            <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={24} color={favorite ? '#F43F5E' : c.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surfaceHigh, marginTop: 18, overflow: 'hidden' }}>
        <View style={{ width: '34%', height: '100%', backgroundColor: c.primary }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 18 }}>
        <TouchableOpacity onPress={toggleShuffle} style={{ opacity: shuffle ? 1 : 0.45 }}>
          <Ionicons name="shuffle" size={24} color={shuffle ? c.primary : c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPrev} style={{ padding: 8 }}>
          <Ionicons name="play-skip-back" size={25} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggle} style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={30} color="#FFFFFF" />
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

function MusicCarousel({ title, items, theme, onPress }) {
  const c = theme.colors
  if (!items.length) return null
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '900', paddingHorizontal: 16, marginBottom: 10 }}>
        {title}
      </Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPress(item)} style={{ width: 132 }}>
            <View style={{
              width: 132,
              height: 132,
              borderRadius: 22,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="musical-notes" size={42} color={c.primary} />
            </View>
            <Text style={{ color: c.text, fontWeight: '900', marginTop: 8, fontSize: 13 }} numberOfLines={2}>
              {cleanTitle(item.filename)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

export default function MusicExperience({ theme, music, loading, loadMore, hasMore }) {
  const c = theme.colors
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [selected, setSelected] = useState(null)
  const [selectedUri, setSelectedUri] = useState('')
  const { shuffle, repeatMode, history, favorites } = useDeviceMediaStore()

  const visibleSongs = useMemo(() => (
    sortAssets(searchAssets(music, query), sortMode)
  ), [music, query, sortMode])

  const musicRows = useMemo(() => buildMusicRows(music), [music])
  const selectedIndex = selected ? visibleSongs.findIndex((item) => item.id === selected.id) : -1

  const openSong = (asset) => {
    setSelected(asset)
    setSelectedUri(asset.localUri || asset.uri)
  }

  const playNext = () => {
    if (!visibleSongs.length) return
    if (repeatMode === 'one' && selected) {
      openSong(selected)
      return
    }
    if (shuffle) {
      openSong(visibleSongs[Math.floor(Math.random() * visibleSongs.length)])
      return
    }
    openSong(visibleSongs[selectedIndex >= 0 ? (selectedIndex + 1) % visibleSongs.length : 0])
  }

  const playPrev = () => {
    if (!visibleSongs.length) return
    openSong(visibleSongs[selectedIndex > 0 ? selectedIndex - 1 : visibleSongs.length - 1])
  }

  const renderSong = ({ item, index }) => {
    const isCurrent = selected?.id === item.id
    const favorite = Boolean(favorites[item.id || item.uri])
    return (
      <TouchableOpacity
        onPress={() => openSong(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          backgroundColor: isCurrent ? c.surface : 'transparent',
        }}>
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          backgroundColor: isCurrent ? c.primary : c.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={isCurrent ? 'volume-high' : 'musical-note'} size={21} color={isCurrent ? '#FFFFFF' : c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(item.filename)}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
            {formatDuration(item.duration)} | Song {index + 1}
          </Text>
        </View>
        {favorite ? <Ionicons name="heart" size={18} color="#F43F5E" /> : null}
        <Ionicons name="ellipsis-vertical" size={18} color={c.textMuted} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      {selectedUri ? (
        <NowPlayingDeck
          key={selectedUri}
          theme={theme}
          asset={selected}
          uri={selectedUri}
          queue={visibleSongs}
          onNext={playNext}
          onPrev={playPrev}
        />
      ) : (
        <View style={{
          margin: 16,
          padding: 20,
          borderRadius: 28,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
        }}>
          <Ionicons name="headset" size={42} color={c.primary} />
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginTop: 10 }}>
            {music.length} Songs Ready
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
            Boomplay-style local library with queues, favorites, history, and recommendation hooks.
          </Text>
          <TouchableOpacity
            onPress={() => visibleSongs[0] && openSong(visibleSongs[0])}
            style={{ marginTop: 14, backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Play Music</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums, playlists"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, color: c.text, paddingVertical: 12 }}
          />
          {query ? <TouchableOpacity onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={c.textMuted} /></TouchableOpacity> : null}
        </View>
        {query.trim() ? (
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', marginTop: 8 }}>
            {visibleSongs.length} result{visibleSongs.length === 1 ? '' : 's'} for "{query.trim()}"
          </Text>
        ) : null}
      </View>

      <FlatList
        data={visibleSongs}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.65}
        ListHeaderComponent={
          <>
            <FlatList
              data={SORT_OPTIONS}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 14 }}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <MusicChip theme={theme} active={sortMode === item.key} label={item.label} icon={item.icon} onPress={() => setSortMode(item.key)} />
              )}
            />
            {!query ? musicRows.map((row) => (
              <MusicCarousel key={row.key} title={row.label} items={row.items} theme={theme} onPress={openSong} />
            )) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ color: c.text, fontSize: 17, fontWeight: '900' }}>Songs</Text>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800' }}>
                {history.length} recent | {Object.keys(favorites).length} favorites
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={loading ? <LoadingSkeleton theme={theme} label="Scanning music..." /> : (
          <EmptyState
            theme={theme}
            icon={query.trim() ? 'search-outline' : 'musical-notes-outline'}
            title={query.trim() ? 'No matching music' : 'No music found'}
            body={query.trim() ? 'Try another song, artist, album, format, or keyword.' : 'Allow audio access or add songs to your phone storage.'}
          />
        )}
        renderItem={renderSong}
        ListFooterComponent={hasMore ? <LoadingSkeleton theme={theme} label="Loading more songs..." /> : null}
        contentContainerStyle={{ paddingBottom: 130 }}
      />

      {selected ? (
        <View style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 14,
          borderRadius: 20,
          padding: 12,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="musical-note" size={20} color="#FFFFFF" />
          </View>
          <Text style={{ flex: 1, color: c.text, fontWeight: '900' }} numberOfLines={1}>{cleanTitle(selected.filename)}</Text>
          <TouchableOpacity onPress={playNext}>
            <Ionicons name="play-skip-forward" size={22} color={c.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  )
}
