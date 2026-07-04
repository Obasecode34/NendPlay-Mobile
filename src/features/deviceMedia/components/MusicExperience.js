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

function getAssetKey(asset = {}) {
  return asset.id || asset.uri || asset.localUri || asset.filename
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
        keyExtractor={(item) => getAssetKey(item)}
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

function MyMusic({ theme, music, visibleSongs, localTab, setLocalTab, sortMode, setSortMode, selected, favorites, history, playlists, openSong, loadMore, hasMore, loading }) {
  const c = theme.colors
  const [openedGroup, setOpenedGroup] = useState(null)
  const [quickMode, setQuickMode] = useState(null)
  const artists = useMemo(() => groupAssets(music, getArtist), [music])
  const albums = useMemo(() => groupAssets(music, getAlbum), [music])
  const folders = useMemo(() => groupAssets(music, getFolder), [music])
  const favoriteSongs = useMemo(() => music.filter((item) => favorites[getAssetKey(item)]), [music, favorites])
  const recentlyPlayedSongs = useMemo(() => {
    const audioHistory = history.filter((item) => item.mediaType === 'audio')
    return audioHistory
      .map((entry) => music.find((item) => getAssetKey(item) === entry.id || item.uri === entry.uri))
      .filter(Boolean)
  }, [history, music])
  const recentlyAddedSongs = useMemo(() => sortAssets(music, 'recent'), [music])
  const cards = [
    { label: 'Songs', value: music.length, icon: 'musical-note', tab: 'songs' },
    { label: 'Artists', value: artists.length, icon: 'person', tab: 'artists' },
    { label: 'Albums', value: albums.length, icon: 'disc', tab: 'albums' },
    { label: 'Folders', value: folders.length, icon: 'folder', tab: 'folders' },
  ]

  const renderGroup = (item, icon) => (
    <TouchableOpacity onPress={() => setOpenedGroup(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>{item.count} song{item.count === 1 ? '' : 's'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </TouchableOpacity>
  )

  const quickSongs = quickMode === 'recentlyPlayed'
    ? recentlyPlayedSongs
    : quickMode === 'favorites'
      ? favoriteSongs
      : quickMode === 'recentlyAdded'
        ? recentlyAddedSongs
        : null
  const data = openedGroup
    ? openedGroup.items
    : quickSongs
      ? quickSongs
      : localTab === 'artists'
        ? artists
        : localTab === 'albums'
          ? albums
          : localTab === 'folders'
            ? folders
            : visibleSongs

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => getAssetKey(item)}
      onEndReached={localTab === 'songs' ? loadMore : undefined}
      onEndReachedThreshold={0.65}
      contentContainerStyle={{ padding: 16, paddingBottom: 136 }}
      ListHeaderComponent={
        <>
          {openedGroup || quickMode ? (
            <TouchableOpacity
              onPress={() => {
                setOpenedGroup(null)
                setQuickMode(null)
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Ionicons name="arrow-back" size={22} color={c.text} />
              <View>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>
                  {openedGroup?.title || (quickMode === 'recentlyPlayed' ? 'Recently Played' : quickMode === 'favorites' ? 'Favorites' : 'Recently Added')}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {data.length} song{data.length === 1 ? '' : 's'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {!openedGroup && !quickMode ? (
          <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {cards.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => {
                  setOpenedGroup(null)
                  setQuickMode(null)
                  setLocalTab(item.tab)
                }}
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
              { label: 'Recently Played', value: `${recentlyPlayedSongs.length} songs`, icon: 'time-outline', mode: 'recentlyPlayed' },
              { label: 'Favorites', value: `${favoriteSongs.length} liked songs`, icon: 'heart', mode: 'favorites' },
              { label: 'Playlists', value: `${playlists.length} playlists`, icon: 'list', mode: 'playlists' },
              { label: 'Recently Added', value: `${recentlyAddedSongs.length} newest files`, icon: 'add-circle-outline', mode: 'recentlyAdded' },
            ].map((row) => (
              <TouchableOpacity
                key={row.label}
                onPress={() => {
                  if (row.mode === 'playlists') {
                    setLocalTab('songs')
                    setQuickMode(null)
                    setOpenedGroup({
                      id: 'playlists',
                      title: 'Playlists',
                      count: music.length,
                      items: playlists.length
                        ? music.filter((item) => playlists.some((playlist) => playlist.assets?.includes(getAssetKey(item))))
                        : music,
                    })
                    return
                  }
                  setOpenedGroup(null)
                  setQuickMode(row.mode)
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                <Ionicons name={row.icon} size={20} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '900' }}>{row.label}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>{row.value}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
          </>
          ) : null}

          {!openedGroup && !quickMode ? <FlatList
            data={LOCAL_TABS}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 12 }}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <MusicChip theme={theme} active={localTab === item.key} label={item.label} onPress={() => setLocalTab(item.key)} />
            )}
          /> : null}

          {!openedGroup && !quickMode && localTab === 'songs' ? (
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
        openedGroup || quickMode || localTab === 'songs'
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
      keyExtractor={(item) => getAssetKey(item)}
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

function FullPlayerModalContent({ theme, selected, playing, position, duration, favorite, repeatMode, shuffle, onClose, onToggle, onNext, onPrev, onSeek, onFavorite, onShuffle, onRepeat }) {
  const c = theme.colors
  if (!selected) return null
  const safeDuration = duration || selected.duration || 0
  const progress = safeDuration ? Math.max(0, Math.min(100, (position / safeDuration) * 100)) : 0
  return (
    <View style={{ flex: 1, padding: 18 }}>
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.22, backgroundColor: c.primary }} />
      <TouchableOpacity onPress={onClose} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-down" size={30} color={c.text} />
      </TouchableOpacity>
      <View style={{
        alignSelf: 'center',
        width: Math.min(300, width - 58),
        aspectRatio: 1,
        borderRadius: 18,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.border,
        marginTop: 18,
      }}>
        <Ionicons name="disc" size={118} color={c.textMuted} />
      </View>
      <Text style={{ color: c.text, fontSize: 25, fontWeight: '900', marginTop: 28 }} numberOfLines={2}>
        {cleanTitle(selected.filename)}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 6 }}>{getArtist(selected)}</Text>
      <TouchableOpacity
        onPress={(event) => {
          const ratio = (event.nativeEvent.locationX || 0) / Math.max(1, width - 36)
          onSeek(safeDuration * ratio)
        }}
        style={{ height: 5, borderRadius: 3, backgroundColor: c.surfaceHigh, marginTop: 24, overflow: 'hidden' }}>
        <View style={{ width: `${progress}%`, height: '100%', backgroundColor: c.primary }} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(position)}</Text>
        <Text style={{ color: c.textMuted, fontSize: 11 }}>{formatDuration(safeDuration)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 26 }}>
        <TouchableOpacity onPress={onFavorite}><Ionicons name={favorite ? 'heart' : 'heart-outline'} size={27} color={favorite ? '#F43F5E' : c.textMuted} /></TouchableOpacity>
        <Ionicons name="add-circle-outline" size={27} color={c.textMuted} />
        <Ionicons name="download-outline" size={27} color={c.textMuted} />
        <Ionicons name="list" size={27} color={c.textMuted} />
        <Ionicons name="ellipsis-vertical" size={27} color={c.textMuted} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 38 }}>
        <TouchableOpacity onPress={onShuffle} style={{ opacity: shuffle ? 1 : 0.5 }}>
          <Ionicons name="shuffle" size={26} color={shuffle ? c.primary : c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPrev} style={{ padding: 8 }}>
          <Ionicons name="play-skip-back" size={34} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onToggle()} style={{
          width: 78,
          height: 78,
          borderRadius: 39,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={38} color={c.bgDeep} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={{ padding: 8 }}>
          <Ionicons name="play-skip-forward" size={34} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRepeat}>
          <Ionicons name="repeat" size={26} color={repeatMode === 'off' ? c.textMuted : c.primary} />
        </TouchableOpacity>
      </View>
      <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 28, fontSize: 13 }}>
        Lyrics
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
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const {
    shuffle,
    repeatMode,
    history,
    favorites,
    playlists,
    addHistory,
    setMusicQueue,
    toggleFavorite,
    toggleShuffle,
    cycleRepeat,
  } = useDeviceMediaStore()
  const player = useVideoPlayer(undefined, (player) => {
    player.staysActiveInBackground = true
    player.showNowPlayingNotification = true
    player.audioMixingMode = 'auto'
  })

  const visibleSongs = useMemo(() => (
    sortAssets(searchAssets(music, mainSection === 'search' ? query : ''), sortMode)
  ), [music, query, sortMode, mainSection])

  const searchResults = useMemo(() => sortAssets(searchAssets(music, query), sortMode), [music, query, sortMode])
  const musicRows = useMemo(() => buildMusicRows(music), [music])
  const selectedIndex = selected ? visibleSongs.findIndex((item) => item.id === selected.id) : -1

  const openSong = (asset) => {
    if (!asset) return
    const uri = asset.localUri || asset.uri
    if (!uri) return
    setSelected(asset)
    setSelectedUri(uri)
  }

  useEffect(() => {
    if (!selected || !selectedUri) return
    try {
      player.staysActiveInBackground = true
      player.showNowPlayingNotification = true
      player.audioMixingMode = 'auto'
      player.replace(getSourceForUri(selectedUri, selected.filename))
      player.play()
      setPlaying(true)
      addHistory(selected, 'audio')
      setMusicQueue(visibleSongs.length ? visibleSongs : music)
    } catch {}
  }, [selectedUri, selected?.id])

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const current = Number(player.currentTime || 0)
        const total = Number(player.duration || selected?.duration || 0)
        setPosition(current)
        setDuration(total)
        setPlaying(Boolean(player.playing))
        if (total > 0 && current >= Math.max(1, total - 0.5)) {
          if (repeatMode === 'one' && selected) {
            player.currentTime = 0
            player.play()
            return
          }
          playNext()
        }
      } catch {}
    }, 700)
    return () => clearInterval(timer)
  }, [player, selected?.id, repeatMode, visibleSongs.length, music.length])

  const togglePlayback = (forced) => {
    try {
      const shouldPlay = typeof forced === 'boolean' ? forced : !playing
      if (shouldPlay) player.play()
      else player.pause()
      setPlaying(shouldPlay)
    } catch {}
  }

  const seekTo = (seconds) => {
    try {
      player.currentTime = Math.max(0, Math.min(seconds || 0, duration || selected?.duration || 0))
    } catch {}
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
          history={history}
          playlists={playlists}
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

      <MiniPlayer theme={theme} selected={selected} onOpen={() => setPlayerOpen(true)} onNext={playNext} />
      <Sidebar theme={theme} visible={sidebarOpen} active={mainSection} onClose={() => setSidebarOpen(false)} onSelect={setMainSection} selected={selected} />

      <Modal visible={playerOpen} animationType="slide" onRequestClose={() => setPlayerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: c.bgDeep, paddingTop: 34 }}>
          <FullPlayerModalContent
            theme={theme}
            selected={selected}
            playing={playing}
            position={position}
            duration={duration}
            favorite={Boolean(favorites[getAssetKey(selected)])}
            repeatMode={repeatMode}
            shuffle={shuffle}
            onClose={() => setPlayerOpen(false)}
            onToggle={togglePlayback}
            onNext={playNext}
            onPrev={playPrev}
            onSeek={seekTo}
            onFavorite={() => selected && toggleFavorite(selected)}
            onShuffle={toggleShuffle}
            onRepeat={cycleRepeat}
          />
        </View>
      </Modal>
    </View>
  )
}
