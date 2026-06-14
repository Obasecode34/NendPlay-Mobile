// src/screens/HomeScreen.js
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList, Image, ActivityIndicator,
  Dimensions, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import { mediaService, novelService } from '../services/index'
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'

const { width } = Dimensions.get('window')
const HERO_WIDTH = width - 32

const CATEGORY_LABELS = {
  movie: 'Movies',
  music: 'Music',
  tv_show: 'TV Shows',
  podcast: 'Podcasts',
  comedy: 'Comedy',
  talk_show: 'Talk Shows',
  short: 'Shorts',
}
const DEFAULT_CATEGORY_ORDER = [
  'movie', 'music', 'tv_show', 'podcast', 'comedy', 'talk_show', 'short',
]
const HOME_TABS = ['Shorts', 'Trending', 'Movie', 'Anime', 'Cartoon', 'Sports', 'WWE']
const HOME_PAGE_LIMIT = 120
const CATEGORY_TILES = [
  { label: 'All', icon: 'filter-outline', terms: [] },
  { label: 'Hollywood', terms: ['hollywood'] },
  { label: 'Nollywood', terms: ['nollywood', 'nigeria', 'naija'] },
  { label: 'Bollywood', terms: ['bollywood', 'india', 'hindi'] },
  { label: 'Western', terms: ['western', 'america', 'usa', 'united states'] },
  { label: 'K-Drama', terms: ['k-drama', 'kdrama', 'korean', 'korea'] },
  { label: 'Chinese Cinema', terms: ['chinese cinema', 'china', 'chinese', 'mandarin'] },
  { label: 'Hong Kong Cinema', terms: ['hong kong cinema', 'hong kong', 'cantonese'] },
  { label: 'Japanese Cinema', terms: ['japanese cinema', 'japan', 'japanese'] },
  { label: 'Philippine Cinema', terms: ['philippine cinema', 'philippines', 'philippine', 'filipino', 'tagalog'] },
  { label: 'European Cinema', terms: ['european cinema', 'europe', 'british', 'french', 'german', 'italian', 'spanish'] },
]
const MOVIE_GENRES = [
  'Action', 'Adventure', 'Sports', 'Martial Arts', 'Comedy', 'Drama', 'Romance',
  'Horror', 'Mystery', 'Crime', 'Fantasy', 'Science Fiction', 'Animation',
  'Family', 'Musical', 'Documentary', 'War', 'Western', 'Biography', 'WWE',
]

function getCategoryLabel(type) {
  if (!type) return 'Other'
  return CATEGORY_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function shuffleItems(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = current
  }
  return shuffled
}

function seededRandom(seed) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function hashText(value = '') {
  return String(value).split('').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0)
}

function seededShuffleItems(items, seed) {
  const shuffled = [...items]
  const random = seededRandom(Math.abs(seed) + 1)
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = current
  }
  return shuffled
}

function getGenrePinPosition(item, genre) {
  const pins = item.genrePins || {}
  const key = normalizeGenre(genre)
  const value = pins instanceof Map ? pins.get(key) : pins[key]
  const position = Number(value)
  return Number.isInteger(position) && position >= 1 && position <= 4 ? position : null
}

function orderGenreItems(items, genre, seed) {
  const pinned = []
  const unpinned = []

  items.forEach((item) => {
    const pinPosition = getGenrePinPosition(item, genre)
    if (pinPosition) pinned.push({ item, pinPosition })
    else unpinned.push(item)
  })

  const fixedItems = pinned
    .sort((a, b) => a.pinPosition - b.pinPosition || (a.item.featuredRank || 0) - (b.item.featuredRank || 0))
    .map(({ item }) => item)

  return [...fixedItems, ...seededShuffleItems(unpinned, seed + hashText(genre))]
}

function getSearchText(item) {
  return [
    item.title, item.description, item.type, item.category, item.genre,
    item.parentTitle, item.episodeTitle, item.collectionType,
    item.language, item.country, item.contentRating, item.releaseStatus,
    ...(item.genres || []), ...(item.categories || []), ...(item.navigationLabels || []),
    ...(item.tags || []), ...(item.homeSections || []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function getNormalizedLabels(item, fields) {
  return fields
    .flatMap((field) => {
      const value = item[field]
      return Array.isArray(value) ? value : [value]
    })
    .filter(Boolean)
    .map((value) => normalizeGenre(value))
}

function hasLabel(item, label, fields) {
  return getNormalizedLabels(item, fields).includes(normalizeGenre(label))
}

function matchesAny(item, terms) {
  if (!terms?.length) return true
  const text = getSearchText(item)
  return terms.some((term) => text.includes(term))
}

function isShortMedia(item) {
  const labels = [
    item.type,
    item.category,
    ...(item.categories || []),
    ...(item.navigationLabels || []),
    ...(item.homeSections || []),
  ].filter(Boolean).map((value) => String(value).toLowerCase())
  return item.type === 'short' || item.isShort || labels.includes('shorts') || labels.includes('short')
}

function matchesHomeTab(item, tab) {
  if (tab === 'Shorts') return isShortMedia(item)
  if (hasLabel(item, tab, ['navigationLabels', 'homeSections'])) return true
  if (tab === 'Movie') return item.type === 'movie'
  if (tab === 'Anime') return matchesAny(item, ['anime'])
  if (tab === 'Cartoon') return matchesAny(item, ['cartoon', 'animation', 'animated'])
  if (tab === 'Sports') return hasMovieGenre(item, 'Sports') || matchesAny(item, ['sports', 'sport', 'football', 'soccer', 'basketball', 'tennis', 'boxing', 'wrestling'])
  if (tab === 'WWE') return hasMovieGenre(item, 'WWE') || matchesAny(item, ['wwe', 'wrestling', 'wrestlemania', 'raw', 'smackdown'])
  return true
}

function normalizeGenre(value = '') {
  return String(value).trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
}

function getMediaGenres(item) {
  const values = [
    ...(item.genres || []),
    ...String(item.genre || '').split(','),
  ]
  return values.map(normalizeGenre).filter(Boolean)
}

function hasMovieGenre(item, genre) {
  return getMediaGenres(item).includes(normalizeGenre(genre))
}

function byPopularity(items) {
  return [...items].sort((a, b) => (
    ((b.viewCount || 0) * 3 + (b.likeCount || 0) * 2 + (b.commentCount || 0))
    - ((a.viewCount || 0) * 3 + (a.likeCount || 0) * 2 + (a.commentCount || 0))
  ))
}

function getThumbnailUri(item) {
  return mediaService.getThumbnailUrl(item) || item.thumbnailUrl || ''
}

function MediaCard({ item, onPress, theme }) {
  const c = theme.colors
  const thumbnailUri = getThumbnailUri(item)
  return (
    <TouchableOpacity onPress={() => onPress(item)}
      style={{ width: 140, marginRight: 12 }}>
      <View style={{
        width: 140, height: 90, borderRadius: 10, overflow: 'hidden',
        backgroundColor: c.surface, marginBottom: 8,
      }}>
        {thumbnailUri
          ? <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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

function MediaRow({ title, items, onPress, theme, onLayout }) {
  if (!items?.length) return null
  const c = theme.colors
  return (
    <View style={{ marginBottom: 24 }} onLayout={onLayout}>
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

function RankingRow({ title, items, onPress, theme, onLayout }) {
  if (!items?.length) return null
  const c = theme.colors
  return (
    <View style={{ marginBottom: 26 }} onLayout={onLayout}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 15, fontWeight: '700' }}>All ›</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {items.slice(0, 12).map((item, index) => (
          <TouchableOpacity key={item._id} activeOpacity={0.86} onPress={() => onPress(item)} style={{ width: 128 }}>
            <View style={{ width: 128, height: 190, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface }}>
              {getThumbnailUri(item) ? (
                <Image source={{ uri: getThumbnailUri(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play-circle" size={34} color={c.primary} />
                </View>
              )}
              <View style={{ position: 'absolute', top: 0, left: 0, backgroundColor: index < 3 ? '#FF7A1A' : 'rgba(0,0,0,0.78)', paddingHorizontal: 8, paddingVertical: 4, borderBottomRightRadius: 8 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{index + 1}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: c.surface, padding: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function CategoryTileRow({ categories, activeCategory, theme, onCategoryPress }) {
  const c = theme.colors
  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        marginBottom: 12,
      }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>
          Categories
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.label}
            activeOpacity={0.84}
            onPress={() => onCategoryPress(category)}
            style={{
              width: 132,
              height: 58,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: activeCategory === category.label ? c.primary : c.surfaceHigh,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderWidth: activeCategory === category.label ? 2 : 0,
              borderColor: '#FFFFFF',
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>{category.label}</Text>
            {category.icon && (
              <Ionicons name={category.icon} size={24} color="#FFFFFF" style={{ position: 'absolute', right: 14 }} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

function NovelPromo({ documents, theme, onPress }) {
  const c = theme.colors
  return (
    <View style={{ marginBottom: 28, paddingHorizontal: 16 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>Hot Novels</Text>
      <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={{ height: 118, borderRadius: 10, backgroundColor: '#063F32', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 }}>
        <View style={{ width: 92, height: 78, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 22 }}>
          <Ionicons name="book" size={36} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900' }}>NovelHub</Text>
          <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: 14, marginTop: 6 }} numberOfLines={1}>
            {documents.length ? `${documents.length} books, offline and daily updated` : 'Offline, free and daily updated'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={30} color="rgba(255,255,255,0.76)" />
      </TouchableOpacity>
    </View>
  )
}

export default function HomeScreen({ navigation }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [sections, setSections] = useState({})
  const [liveEvents, setLiveEvents] = useState([])
  const [allMedia, setAllMedia] = useState([])
  const [documents, setDocuments] = useState([])
  const [featuredItems, setFeaturedItems] = useState([])
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [shuffleSeed, setShuffleSeed] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [mediaPage, setMediaPage] = useState(1)
  const [hasMoreMedia, setHasMoreMedia] = useState(false)
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreSearch, setHasMoreSearch] = useState(false)
  const [activeHomeTab, setActiveHomeTab] = useState('Trending')
  const [activeCategory, setActiveCategory] = useState(CATEGORY_TILES[0])
  const heroRef = useRef(null)
  const scrollRef = useRef(null)
  const movieCategoryY = useRef(0)
  const firstCategoryY = useRef(0)

  useEffect(() => { fetchContent() }, [])

  useEffect(() => {
    if (featuredItems.length <= 1) return undefined
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredItems.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [featuredItems.length])

  useEffect(() => {
    const timer = setInterval(() => {
      setShuffleSeed(Date.now())
    }, 120000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!featuredItems.length) return
    heroRef.current?.scrollToOffset({
      offset: featuredIndex * HERO_WIDTH,
      animated: true,
    })
  }, [featuredIndex, featuredItems.length])

  const groupMedia = (items) => {
    const grouped = {}
    const typeOrder = [
      ...DEFAULT_CATEGORY_ORDER,
      ...Array.from(new Set(items.map((m) => m.type).filter((type) => type && !DEFAULT_CATEGORY_ORDER.includes(type)))),
    ]
    typeOrder.forEach((type) => {
      const typeItems = items.filter((m) => m.type === type)
      if (typeItems.length) grouped[getCategoryLabel(type)] = typeItems
    })
    return grouped
  }

  const fetchContent = async (pageToLoad = 1, append = false) => {
    try {
      const [allRes, liveRes, novelRes] = await Promise.all([
        mediaService.getAll({ limit: HOME_PAGE_LIMIT, page: pageToLoad }),
        mediaService.getLiveEvents({ limit: 5 }),
        novelService.getAll({ limit: 12 }),
      ])
      const nextMedia = allRes.data.data.media || []
      const pagination = allRes.data.data.pagination || {}
      const all = append ? [...allMedia, ...nextMedia] : nextMedia
      if (!append) setShuffleSeed(Date.now())
      setAllMedia(all)
      setMediaPage(pageToLoad)
      setHasMoreMedia(pageToLoad < (pagination.pages || 1))
      setDocuments(novelRes.data.data.documents || [])
      const movies = all.filter((item) => item.type === 'movie')
      const featured = all
        .filter((item) => item.isFeatured || item.homeSections?.includes('banner'))
        .sort((a, b) => (a.featuredRank || 0) - (b.featuredRank || 0))
      const heroItems = featured.length ? featured : shuffleItems(movies.length ? movies : all)
      setFeaturedItems(heroItems)
      setFeaturedIndex(0)
      setSections(groupMedia(all))
      setLiveEvents(liveRes.data.data.media)
    } catch {}
    finally { setLoading(false); setRefreshing(false); setLoadingMoreMedia(false) }
  }

  const handleSearch = async (query, pageToLoad = 1, append = false) => {
    setSearch(query)
    if (!query.trim()) {
      setSearchResults([])
      setSearching(false)
      setSearchPage(1)
      setHasMoreSearch(false)
      return
    }
    setSearching(true)
    try {
      const res = await mediaService.getAll({ search: query, limit: 20, page: pageToLoad })
      const next = res.data.data.media || []
      const pagination = res.data.data.pagination || {}
      setSearchResults((current) => append ? [...current, ...next] : next)
      setSearchPage(pageToLoad)
      setHasMoreSearch(pageToLoad < (pagination.pages || 1))
    } catch {}
    finally { setSearching(false) }
  }

  const loadMoreHomeMedia = () => {
    if (loadingMoreMedia || loading || !hasMoreMedia || search.length > 0) return
    setLoadingMoreMedia(true)
    fetchContent(mediaPage + 1, true)
  }

  const loadMoreSearch = () => {
    if (searching || !hasMoreSearch || !search.trim()) return
    handleSearch(search, searchPage + 1, true)
  }

  const handleMediaPress = (item) => {
    if (isShortMedia(item)) {
      const parentNavigation = navigation.getParent?.()
      if (parentNavigation) parentNavigation.navigate('Shorts', { openId: item._id })
      else navigation.navigate('Shorts', { openId: item._id })
      return
    }
    navigation.navigate('MediaPlayer', { mediaId: item._id })
  }

  const handleOpenMovieCategory = () => {
    const targetY = movieCategoryY.current || firstCategoryY.current
    scrollRef.current?.scrollTo({
      y: Math.max(targetY - 12, 0),
      animated: true,
    })
  }

  const tabMedia = allMedia.filter((item) => matchesHomeTab(item, activeHomeTab))
  const visibleMedia = tabMedia.filter((item) => (
    activeCategory.label === 'All'
    || hasLabel(item, activeCategory.label, ['category', 'categories'])
    || matchesAny(item, activeCategory.terms)
  ))
  const shorts = visibleMedia.filter(isShortMedia)
  const genreMovies = visibleMedia.filter((item) => !isShortMedia(item) && MOVIE_GENRES.some((genre) => hasMovieGenre(item, genre)))
  const genreSections = useMemo(() => MOVIE_GENRES.map((genre) => ({
    genre,
    items: orderGenreItems(genreMovies.filter((item) => hasMovieGenre(item, genre)), genre, shuffleSeed),
  })).filter((section) => section.items.length > 0), [genreMovies, shuffleSeed])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchContent(1, false)
  }, [allMedia])

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
    heroSlide: { width: HERO_WIDTH, height: 200 },
    heroDots: {
      position: 'absolute', right: 16, bottom: 16, flexDirection: 'row',
      alignItems: 'center', gap: 6,
    },
    heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
    heroDotActive: { width: 18, backgroundColor: '#FFFFFF' },
    floatingNewsButton: {
      position: 'absolute',
      right: 18,
      bottom: 86,
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.28)',
      shadowColor: c.primary,
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    floatingNewsBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#EF4444',
      borderWidth: 2,
      borderColor: c.bg,
    },
  })

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
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
          onEndReached={loadMoreSearch}
          onEndReachedThreshold={0.55}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleMediaPress(item)}
              style={{ flex: 1, marginBottom: 12 }}>
              <View style={{
                height: 100, borderRadius: 10, overflow: 'hidden',
                backgroundColor: c.surface, marginBottom: 6,
              }}>
                {getThumbnailUri(item)
                  ? <Image source={{ uri: getThumbnailUri(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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
          ListFooterComponent={
            hasMoreSearch ? <ActivityIndicator color={c.primary} style={{ marginVertical: 18 }} /> : null
          }
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          onMomentumScrollEnd={({ nativeEvent }) => {
            const nearBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 320
            if (nearBottom) loadMoreHomeMedia()
          }}>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 22 }}>
            {HOME_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.82}
                onPress={() => setActiveHomeTab(tab)}>
                <Text
                  style={{
                    color: activeHomeTab === tab ? c.text : c.textMuted,
                    fontSize: 18,
                    fontWeight: activeHomeTab === tab ? '900' : '700',
                  }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Hero */}
          {featuredItems.length > 0 && (
            <View style={s.hero}>
              <FlatList
                ref={heroRef}
                data={featuredItems}
                keyExtractor={(item) => item._id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({
                  length: HERO_WIDTH, offset: HERO_WIDTH * index, index,
                })}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / HERO_WIDTH)
                  setFeaturedIndex(nextIndex)
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.9} onPress={handleOpenMovieCategory} style={s.heroSlide}>
                    {getThumbnailUri(item)
                      ? <Image source={{ uri: getThumbnailUri(item) }} style={s.heroImage} resizeMode="cover" />
                      : <View style={{ flex: 1, backgroundColor: c.surface }} />
                    }
                    <View style={[s.heroOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                      <Text style={s.heroTitle} numberOfLines={2}>{item.title}</Text>
                      <TouchableOpacity style={s.playBtn} onPress={handleOpenMovieCategory}>
                        <Ionicons name="film" size={14} color="white" />
                        <Text style={s.playBtnText}>View Movies</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
              {featuredItems.length > 1 && (
                <View style={s.heroDots}>
                  {featuredItems.map((item, index) => (
                    <View
                      key={item._id}
                      style={[s.heroDot, index === featuredIndex && s.heroDotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <AdBanner style={{ marginHorizontal: 16 }} />
          <NativeAdvancedAd />
          <CategoryTileRow
            categories={CATEGORY_TILES}
            activeCategory={activeCategory.label}
            theme={theme}
            onCategoryPress={setActiveCategory}
          />

          {activeHomeTab === 'Shorts' ? (
            <>
              <RankingRow
                title="Shorts Videos"
                items={byPopularity(shorts).slice(0, 24)}
                onPress={handleMediaPress}
                theme={theme}
                onLayout={(event) => {
                  if (!firstCategoryY.current) firstCategoryY.current = event.nativeEvent.layout.y
                }}
              />
              <MediaRow
                title="More Shorts"
                items={shorts}
                onPress={handleMediaPress}
                theme={theme}
              />
            </>
          ) : (
            <>
              {genreSections.map((section, index) => (
                <MediaRow
                  key={section.genre}
                  title={section.genre}
                  items={section.items.slice(0, 24)}
                  onPress={handleMediaPress}
                  theme={theme}
                  onLayout={(event) => {
                    if (index === 0 && !firstCategoryY.current) firstCategoryY.current = event.nativeEvent.layout.y
                    if (index === 0) movieCategoryY.current = event.nativeEvent.layout.y
                  }}
                />
              ))}

              <NovelPromo documents={documents} theme={theme} onPress={() => navigation.navigate('NovelHub')} />
            </>
          )}

          {/* Live events */}
          {false && liveEvents.length > 0 && (
            <MediaRow title="🔴 Live Now" items={liveEvents} onPress={handleMediaPress} theme={theme} />
          )}

          {/* Content rows */}
          {false && activeHomeTab !== 'Shorts' && Object.entries(visibleSections).filter(([title]) => ![
            'Movies', 'TV Shows', 'Shorts', 'Comedy',
          ].includes(title)).map(([title, items], index) => (
            <MediaRow
              key={title}
              title={title}
              items={items}
              onPress={handleMediaPress}
              theme={theme}
              onLayout={(event) => {
                if (index === 0) firstCategoryY.current = event.nativeEvent.layout.y
                if (title === 'Movies') movieCategoryY.current = event.nativeEvent.layout.y
              }}
            />
          ))}

          {activeHomeTab !== 'Shorts' && genreSections.length === 0 && (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20, marginHorizontal: 24 }}>
              No movies found with the selected category and approved genres.
            </Text>
          )}

          {activeHomeTab === 'Shorts' && visibleMedia.length === 0 && (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20, marginHorizontal: 24 }}>
              No media found for {activeCategory.label} Shorts.
            </Text>
          )}

          {loadingMoreMedia ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: 18 }} />
          ) : hasMoreMedia ? (
            <TouchableOpacity
              onPress={loadMoreHomeMedia}
              style={{ alignSelf: 'center', marginTop: 4, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ color: c.text, fontWeight: '900' }}>Load more</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
      <TouchableOpacity
        activeOpacity={0.86}
        style={s.floatingNewsButton}
        onPress={() => navigation.navigate('DailyNews')}
        accessibilityRole="button"
        accessibilityLabel="Open news">
        <Ionicons name="planet" size={27} color="#FFFFFF" />
        <View style={s.floatingNewsBadge} />
      </TouchableOpacity>
    </View>
  )
}
