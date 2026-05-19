// src/screens/HomeScreen.js
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, Image, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { mediaService } from '../services/index'

const { width } = Dimensions.get('window')

const CATEGORIES = [
  { key: 'movie', label: 'Movies' },
  { key: 'music', label: 'Music' },
  { key: 'tv_show', label: 'TV Shows' },
  { key: 'podcast', label: 'Podcasts' },
  { key: 'comedy', label: 'Comedy' },
  { key: 'talk_show', label: 'Talk Shows' },
]

function MediaCard({ item, onPress, theme }) {
  const c = theme.colors
  return (
    <TouchableOpacity onPress={() => onPress(item)}
      style={{ width: 140, marginRight: 12 }}>
      <View style={{
        width: 140, height: 90, borderRadius: 10, overflow: 'hidden',
        backgroundColor: c.surface, marginBottom: 8,
      }}>
        {item.thumbnailUrl
          ? <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play-circle" size={32} color={c.primary} />
            </View>
        }
        {item.isLocked && (
          <View style={{
            position: 'absolute', top: 6, right: 6,
            backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6,
            padding: 3,
          }}>
            <Ionicons name="lock-closed" size={12} color="#FBBF24" />
          </View>
        )}
        {item.isLive && (
          <View style={{
            position: 'absolute', top: 6, left: 6,
            backgroundColor: '#EF4444', borderRadius: 4,
            paddingHorizontal: 6, paddingVertical: 2,
          }}>
            <Text style={{ color: 'white', fontSize: 9, fontWeight: '800' }}>LIVE</Text>
          </View>
        )}
      </View>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>
        {item.type?.replace('_', ' ')}
      </Text>
    </TouchableOpacity>
  )
}

function MediaRow({ title, items, onPress, theme }) {
  if (!items?.length) return null
  const c = theme.colors
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12, paddingHorizontal: 16 }}>
        {title}
      </Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <MediaCard item={item} onPress={onPress} theme={theme} />}
      />
    </View>
  )
}

export default function HomeScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [sections, setSections] = useState({})
  const [liveEvents, setLiveEvents] = useState([])
  const [featured, setFeatured] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => { fetchContent() }, [])

  const fetchContent = async () => {
    try {
      const [allRes, liveRes] = await Promise.all([
        mediaService.getAll({ limit: 60 }),
        mediaService.getLiveEvents({ limit: 5 }),
      ])
      const all = allRes.data.data.media
      if (all.length) setFeatured(all[0])
      const grouped = {}
      CATEGORIES.forEach(({ key, label }) => {
        const items = all.filter(m => m.type === key)
        if (items.length) grouped[label] = items
      })
      setSections(grouped)
      setLiveEvents(liveRes.data.data.media)
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }

  const handleSearch = async (query) => {
    setSearch(query)
    if (!query.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    try {
      const res = await mediaService.getAll({ search: query, limit: 20 })
      setSearchResults(res.data.data.media)
    } catch {}
    finally { setSearching(false) }
  }

  const handleMediaPress = (item) => {
    navigation.navigate('MediaPlayer', { mediaId: item._id })
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchContent()
  }, [])

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16, paddingBottom: 12,
      backgroundColor: c.bgDeep,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    greeting: { fontSize: 20, fontWeight: '800', color: c.text },
    greetingSub: { fontSize: 13, color: c.textMuted },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, gap: 8,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 11 },
    hero: {
      margin: 16, height: 200, borderRadius: 16, overflow: 'hidden',
      backgroundColor: c.surface,
    },
    heroImage: { width: '100%', height: '100%' },
    heroOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 16,
      background: 'transparent',
    },
    heroTitle: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 8 },
    playBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.primary, paddingHorizontal: 16,
      paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start',
    },
    playBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  })

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}
            </Text>
            <Text style={s.greetingSub}>{user?.profileName || user?.username || 'User'}</Text>
          </View>
          <View style={{
            width: 40, height: 40, borderRadius: 10, backgroundColor: c.primary,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: 'white', fontWeight: '900', fontSize: 16 }}>
              {user?.profileName?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search movies, music, shows..."
            placeholderTextColor={c.textMuted}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]) }}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : search.length > 0 ? (
        // Search results
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16 }}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleMediaPress(item)}
              style={{ flex: 1, marginBottom: 12 }}>
              <View style={{
                height: 100, borderRadius: 10, overflow: 'hidden',
                backgroundColor: c.surface, marginBottom: 6,
              }}>
                {item.thumbnailUrl
                  ? <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="play-circle" size={28} color={c.primary} />
                    </View>
                }
              </View>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searching ? <ActivityIndicator color={c.primary} /> :
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 40 }}>
              No results found
            </Text>
          }
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}>

          {/* Hero */}
          {featured && (
            <View style={s.hero}>
              {featured.thumbnailUrl
                ? <Image source={{ uri: featured.thumbnailUrl }} style={s.heroImage} resizeMode="cover" />
                : <View style={{ flex: 1, backgroundColor: c.surface }} />
              }
              <View style={[s.heroOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Text style={s.heroTitle} numberOfLines={2}>{featured.title}</Text>
                <TouchableOpacity style={s.playBtn} onPress={() => handleMediaPress(featured)}>
                  <Ionicons name="play" size={14} color="white" />
                  <Text style={s.playBtnText}>Play Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Live events */}
          {liveEvents.length > 0 && (
            <MediaRow title="🔴 Live Now" items={liveEvents} onPress={handleMediaPress} theme={theme} />
          )}

          {/* Content rows */}
          {Object.entries(sections).map(([title, items]) => (
            <MediaRow key={title} title={title} items={items} onPress={handleMediaPress} theme={theme} />
          ))}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  )
}
