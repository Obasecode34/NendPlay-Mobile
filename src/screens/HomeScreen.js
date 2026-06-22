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
import useAuthStore from '../services/authStore.native'
import { mediaService, novelService, notificationService } from '../services/index'
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

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
const HOME_TABS = [
  { label: 'All', icon: 'albums-outline' },
  { label: 'Movies', icon: 'film-outline' },
  { label: 'Series', icon: 'tv-outline' },
  { label: 'Shorts', icon: 'sparkles-outline' },
  { label: 'Live', icon: 'radio-outline' },
  { label: 'News', icon: 'newspaper-outline', route: 'DailyNews' },
  { label: 'NovelHub', icon: 'book-outline', route: 'NovelHub' },
  { label: 'Music', icon: 'musical-notes-outline' },
]
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
  { label: 'Australian Cinema', terms: ['australian cinema', 'australia', 'australian', 'aussie'] },
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
  if (tab === 'All') return true
  if (tab === 'Shorts') return isShortMedia(item)
  if (hasLabel(item, tab, ['navigationLabels', 'homeSections'])) return true
  if (tab === 'Movies') return item.type === 'movie'
  if (tab === 'Series') return item.type === 'series' || item.type === 'tv_show' || item.collectionType === 'series'
  if (tab === 'Live') return item.isLive || item.type === 'live'
  if (tab === 'Music') return item.type === 'music' || item.type === 'audio'
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

function NendPlayLogo() {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>NENDPL</Text>
        <View style={{ width: 17, height: 19, marginHorizontal: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: 7,
              borderBottomWidth: 7,
              borderLeftWidth: 12,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: '#8B5CF6',
              transform: [{ rotate: '-10deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
              left: 5,
              top: 7,
            }}
          />
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900' }}>Y</Text>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 21, gap: 6 }}>
        {'MEDIA'.split('').map((letter) => (
          <Text key={letter} style={{ color: '#B456FF', fontSize: 8, fontWeight: '900' }}>
            {letter}
          </Text>
        ))}
      </View>
    </View>
  )
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

function SectionHeader({ title, accent, onSeeAll, theme }) {
  const c = theme.colors
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>
        {title}{accent ? <Text> {accent}</Text> : null}
      </Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.75}>
          <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>See All</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

function LandscapeCard({ item, onPress, theme, progress }) {
  const c = theme.colors
  const thumbnailUri = getThumbnailUri(item)
  const value = progress ?? ((Math.abs(hashText(item._id || item.title)) % 65) + 25)
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={() => onPress(item)} style={{ width: 172, marginRight: 12 }}>
      <View style={{ height: 78, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#18112B', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-circle" size={28} color={c.primary} />
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' }} />
        <Text numberOfLines={2} style={{ position: 'absolute', left: 10, top: 10, right: 34, color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>
          {item.title}
        </Text>
        <View style={{ position: 'absolute', right: 8, top: 27, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.52)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={13} color="#FFFFFF" />
        </View>
        <View style={{ position: 'absolute', left: 10, right: 10, bottom: 9, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' }}>
          <View style={{ width: `${Math.min(value, 96)}%`, height: 4, borderRadius: 4, backgroundColor: c.primary }} />
        </View>
        <Text style={{ position: 'absolute', right: 10, bottom: 14, color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>{value}%</Text>
      </View>
    </TouchableOpacity>
  )
}

function PosterCard({ item, onPress, theme, width: cardWidth = 128, height: cardHeight = 176 }) {
  const c = theme.colors
  const thumbnailUri = getThumbnailUri(item)
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={() => onPress(item)} style={{ width: cardWidth, marginRight: 12 }}>
      <View style={{ width: cardWidth, height: cardHeight, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {thumbnailUri ? (
          <Image source={{ uri: thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1D1430', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-circle" size={32} color={c.primary} />
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 9, backgroundColor: 'rgba(0,0,0,0.48)' }}>
          <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 3 }}>
            {getCategoryLabel(item.type || 'movie')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function LiveCard({ item, onPress, theme }) {
  const c = theme.colors
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={() => onPress(item)} style={{ width: 180, marginRight: 12 }}>
      <View style={{ height: 104, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {getThumbnailUri(item) ? (
          <Image source={{ uri: getThumbnailUri(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#251044', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="radio" size={30} color="#EF4444" />
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
        <View style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}>
          <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>{item.title}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 10, marginTop: 3 }}>
            <Text style={{ color: '#EF4444' }}>● </Text>{Math.max(item.viewCount || 0, 1200).toLocaleString()} watching
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function DocumentCard({ item, onPress, theme }) {
  const c = theme.colors
  return (
    <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={{ width: 136, marginRight: 12 }}>
      <View style={{ height: 170, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {item.coverImage || item.coverUrl ? (
          <Image source={{ uri: item.coverImage || item.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1F1838', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="book" size={34} color={c.primary} />
          </View>
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 9, backgroundColor: 'rgba(0,0,0,0.58)' }}>
          <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 3 }}>
            {item.author || item.category || 'NovelHub'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function NewsMiniCard({ title, subtitle, icon, onPress, theme }) {
  const c = theme.colors
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={{ width: 188, minHeight: 72, marginRight: 12, borderRadius: 10, padding: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 52, height: 52, borderRadius: 9, backgroundColor: 'rgba(139,92,246,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontSize: 11, fontWeight: '900' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: c.textMuted, fontSize: 10, marginTop: 5 }}>{subtitle}</Text>
      </View>
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
  const { isAuthenticated } = useAuthStore()
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
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mediaPage, setMediaPage] = useState(1)
  const [hasMoreMedia, setHasMoreMedia] = useState(false)
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMoreSearch, setHasMoreSearch] = useState(false)
  const [activeHomeTab, setActiveHomeTab] = useState('All')
  const [activeCategory, setActiveCategory] = useState(CATEGORY_TILES[0])
  const heroRef = useRef(null)
  const scrollRef = useRef(null)
  const movieCategoryY = useRef(0)
  const firstCategoryY = useRef(0)

  useEffect(() => { fetchContent() }, [])

  useEffect(() => {
    let active = true
    const loadUnread = async () => {
      if (!isAuthenticated) {
        setUnreadCount(0)
        return
      }
      try {
        const res = await notificationService.getMine({ page: 1, limit: 1 })
        if (active) setUnreadCount(res.data?.data?.unread || 0)
      } catch {
        if (active) setUnreadCount(0)
      }
    }
    loadUnread()
    const timer = setInterval(loadUnread, 60000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [isAuthenticated])

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

  const openProfile = () => {
    const parentNavigation = navigation.getParent?.()
    if (parentNavigation) parentNavigation.navigate('Profile')
    else navigation.navigate('Profile')
  }

  const handleHomeTabPress = (tab) => {
    if (tab.route) {
      navigation.navigate(tab.route)
      return
    }
    setActiveHomeTab(tab.label)
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
  const rankedMedia = byPopularity(visibleMedia)
  const continueWatching = rankedMedia.slice(0, 6)
  const trendingMedia = rankedMedia.filter((item) => !isShortMedia(item)).slice(0, 14)
  const liveSectionItems = liveEvents.length ? liveEvents : rankedMedia.filter((item) => item.isLive || item.type === 'live').slice(0, 8)
  const musicItems = allMedia.filter((item) => item.type === 'music' || item.type === 'audio').slice(0, 10)
  const novelPreviewItems = documents.slice(0, 10)
  const newsHighlights = [
    { title: 'Global Leaders Meet for Peace Summit', subtitle: '2h ago', icon: 'earth-outline' },
    { title: 'Tech Innovation Changing the World', subtitle: '5h ago', icon: 'hardware-chip-outline' },
    { title: 'Sports Update: Local Team Wins Again', subtitle: '1h ago', icon: 'football-outline' },
    { title: 'Economy Shows Signs of Recovery', subtitle: '3h ago', icon: 'stats-chart-outline' },
  ]

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchContent(1, false)
  }, [allMedia])

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 6,
      paddingHorizontal: 14, paddingBottom: searchOpen ? 10 : 8,
      backgroundColor: '#030409',
      borderBottomWidth: 1, borderBottomColor: 'rgba(139,92,246,0.18)',
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 0 },
    headerIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    notificationBadge: {
      position: 'absolute',
      top: -3,
      right: -3,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#8B5CF6',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#030409',
    },
    notificationBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
    greeting: { fontSize: 20, fontWeight: '800', color: c.text },
    greetingSub: { fontSize: 13, color: c.textMuted },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, gap: 8,
      marginTop: 12,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 11 },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterChipText: { color: c.text, fontSize: 13, fontWeight: '800' },
    filterChipTextActive: { color: '#FFFFFF' },
    hero: {
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 18,
      height: 208,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    heroImage: { width: '100%', height: '100%' },
    heroGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.24)',
    },
    heroOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 18,
    },
    heroEyebrow: { color: c.primary, fontSize: 11, fontWeight: '900', marginBottom: 4 },
    heroTitle: { color: 'white', fontSize: 30, lineHeight: 34, fontWeight: '900', marginBottom: 8 },
    heroSubtitle: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, maxWidth: '72%' },
    ratingBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.68)',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 3,
      backgroundColor: 'rgba(0,0,0,0.34)',
    },
    ratingText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    playBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.primary, paddingHorizontal: 16,
      paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start',
    },
    playBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
    myListBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    myListText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    heroSlide: { width: HERO_WIDTH, height: 208 },
    heroDots: {
      position: 'absolute', alignSelf: 'center', bottom: 15, flexDirection: 'row',
      alignItems: 'center', gap: 6,
    },
    heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.64)' },
    heroDotActive: { backgroundColor: c.primary },
    musicCard: {
      width: 142,
      height: 112,
      marginRight: 12,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    musicOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.34)' },
    musicPlay: {
      position: 'absolute',
      left: 10,
      top: 38,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.54)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    musicTitle: { position: 'absolute', left: 10, right: 10, bottom: 24, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    musicSubtitle: { position: 'absolute', left: 10, bottom: 9, color: 'rgba(255,255,255,0.72)', fontSize: 10 },
    premiumCard: {
      marginHorizontal: 16,
      marginBottom: 24,
      minHeight: 90,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: '#7415B8',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
    },
    premiumIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    premiumTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
    premiumText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 16, marginTop: 3 },
    subscribeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    subscribeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  })

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <NendPlayLogo />
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIcon} onPress={() => setSearchOpen((value) => !value)} activeOpacity={0.82}>
              <Ionicons name="search-outline" size={19} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.headerIcon} onPress={openProfile} activeOpacity={0.82}>
              <Ionicons name="notifications-outline" size={19} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={s.notificationBadge}>
                  <Text style={s.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
        {searchOpen && (
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search movies, music, shows..."
              placeholderTextColor={c.textMuted}
              value={search}
              onChangeText={handleSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]) }}>
                <Ionicons name="close-circle" size={16} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
            {HOME_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.label}
                activeOpacity={0.82}
                onPress={() => handleHomeTabPress(tab)}
                style={[s.filterChip, activeHomeTab === tab.label && s.filterChipActive]}>
                <Ionicons name={tab.icon} size={14} color={activeHomeTab === tab.label ? '#FFFFFF' : c.text} />
                <Text style={[s.filterChipText, activeHomeTab === tab.label && s.filterChipTextActive]}>
                  {tab.label}
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
                  <TouchableOpacity activeOpacity={0.9} onPress={() => handleMediaPress(item)} style={s.heroSlide}>
                    {getThumbnailUri(item)
                      ? <Image source={{ uri: getThumbnailUri(item) }} style={s.heroImage} resizeMode="cover" />
                      : <View style={{ flex: 1, backgroundColor: c.surface }} />
                    }
                    <View style={s.heroGradient} />
                    <View style={s.ratingBadge}>
                      <Text style={s.ratingText}>{item.contentRating || 'PG-13'}</Text>
                    </View>
                    <View style={s.heroOverlay}>
                      <Text style={s.heroEyebrow}>NENDPLAY EXCLUSIVE</Text>
                      <Text style={s.heroTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.heroSubtitle} numberOfLines={2}>
                        {item.description || 'Stream premium entertainment, live moments, stories and music.'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity style={s.playBtn} onPress={() => handleMediaPress(item)}>
                          <Ionicons name="play" size={14} color="white" />
                          <Text style={s.playBtnText}>Watch Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.myListBtn}>
                          <Ionicons name="add" size={15} color="white" />
                          <Text style={s.myListText}>My List</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
              {featuredItems.length > 1 && (
                <View style={s.heroDots}>
                  {featuredItems.slice(0, 5).map((item, index) => (
                    <View
                      key={item._id}
                      style={[s.heroDot, index === featuredIndex % 5 && s.heroDotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {continueWatching.length > 0 && (
            <View style={{ marginBottom: 22 }}>
              <SectionHeader title="Continue Watching" onSeeAll={handleOpenMovieCategory} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {continueWatching.map((item) => (
                  <LandscapeCard key={item._id} item={item} onPress={handleMediaPress} theme={theme} />
                ))}
              </ScrollView>
            </View>
          )}

          {trendingMedia.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Trending Now" accent="🔥" onSeeAll={handleOpenMovieCategory} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {trendingMedia.map((item) => (
                  <PosterCard key={item._id} item={item} onPress={handleMediaPress} theme={theme} />
                ))}
              </ScrollView>
            </View>
          )}

          <AdBanner style={{ marginHorizontal: 16, marginBottom: 16 }} />
          <NendPlayAdCard placement="home" />

          {liveSectionItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Live Events" accent="● LIVE" onSeeAll={() => setActiveHomeTab('Live')} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {liveSectionItems.map((item) => (
                  <LiveCard key={item._id} item={item} onPress={handleMediaPress} theme={theme} />
                ))}
              </ScrollView>
            </View>
          )}

          {novelPreviewItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="NovelHub" accent="📖" onSeeAll={() => navigation.navigate('NovelHub')} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {novelPreviewItems.map((item) => (
                  <DocumentCard key={item._id} item={item} onPress={() => navigation.navigate('NovelHub')} theme={theme} />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="News Highlights" onSeeAll={() => navigation.navigate('DailyNews')} theme={theme} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {newsHighlights.map((item) => (
                <NewsMiniCard
                  key={item.title}
                  title={item.title}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onPress={() => navigation.navigate('DailyNews')}
                  theme={theme}
                />
              ))}
            </ScrollView>
          </View>

          {musicItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Music For You" onSeeAll={() => setActiveHomeTab('Music')} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {musicItems.map((item) => (
                  <TouchableOpacity key={item._id} activeOpacity={0.86} onPress={() => handleMediaPress(item)} style={s.musicCard}>
                    {getThumbnailUri(item) ? (
                      <Image source={{ uri: getThumbnailUri(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: '#1A1128' }} />
                    )}
                    <View style={s.musicOverlay} />
                    <View style={s.musicPlay}>
                      <Ionicons name="play" size={13} color="#FFFFFF" />
                    </View>
                    <Text numberOfLines={1} style={s.musicTitle}>{item.title}</Text>
                    <Text style={s.musicSubtitle}>Playlist</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity activeOpacity={0.86} onPress={() => navigation.navigate('Subscribe')} style={s.premiumCard}>
            <View style={s.premiumIcon}>
              <Ionicons name="gift" size={28} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.premiumTitle}>Go Premium Today!</Text>
              <Text style={s.premiumText} numberOfLines={2}>
                Unlock unlimited access and enjoy an ad-free experience.
              </Text>
            </View>
            <View style={s.subscribeButton}>
              <Text style={s.subscribeText}>Subscribe</Text>
              <Ionicons name="chevron-forward" size={17} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {activeHomeTab === 'Shorts' && shorts.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Shorts Videos" onSeeAll={() => {
                const parentNavigation = navigation.getParent?.()
                if (parentNavigation) parentNavigation.navigate('Shorts')
                else navigation.navigate('Shorts')
              }} theme={theme} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {shorts.slice(0, 16).map((item) => (
                  <PosterCard key={item._id} item={item} onPress={handleMediaPress} theme={theme} width={112} height={174} />
                ))}
              </ScrollView>
            </View>
          )}

          {genreSections.slice(0, 4).map((section, index) => (
            <React.Fragment key={section.genre}>
              <View style={{ marginBottom: 24 }}>
                <SectionHeader title={section.genre} onSeeAll={handleOpenMovieCategory} theme={theme} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                  {section.items.slice(0, 16).map((item) => (
                    <PosterCard key={item._id} item={item} onPress={handleMediaPress} theme={theme} width={118} height={166} />
                  ))}
                </ScrollView>
              </View>
              {index === 1 ? <NativeAdvancedAd /> : null}
            </React.Fragment>
          ))}

          {visibleMedia.length === 0 && (
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 20, marginHorizontal: 24 }}>
              No content found for {activeHomeTab}.
            </Text>
          )}

          {/* Live events */}
          {false && liveEvents.length > 0 && (
            <MediaRow title="🔴 Live Now" items={liveEvents} onPress={handleMediaPress} theme={theme} />
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
    </View>
  )
}
