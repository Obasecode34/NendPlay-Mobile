import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Image, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import useAuthStore from '../services/authStore.native'
import { newsService } from '../services/index'

const TABS = [
  { key: 'for-you', label: 'For you' },
  { key: 'headlines', label: 'Headlines' },
  { key: 'local', label: 'Local' },
  { key: 'nigeria', label: 'Nigeria' },
  { key: 'world', label: 'World' },
  { key: 'business', label: 'Business' },
  { key: 'technology', label: 'Technology' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'sports', label: 'Sports' },
  { key: 'science', label: 'Science' },
  { key: 'health', label: 'Health' },
]

const SECTION_TABS = [
  { key: 'news', label: 'News' },
  { key: 'career', label: 'Career' },
  { key: 'unspoken', label: 'Unspoken' },
]

const CAREER_JOB_MODES = [
  { key: 'on-site', label: 'On-Site Jobs' },
  { key: 'remote', label: 'Remote Jobs' },
  { key: 'hybrid', label: 'Hybrid Jobs' },
]

const CAREER_TABS = [
  { key: 'for-you', label: 'All Categories' },
  'Agriculture', 'Arts & Entertainment', 'Business', 'Construction', 'Education',
  'Engineering', 'Finance', 'Government', 'Healthcare', 'Information Technology',
  'Law', 'Manufacturing', 'Media & Communications', 'Military', 'Science',
  'Social Services', 'Sports', 'Transportation', 'Hospitality & Tourism',
  'Skilled Trades', 'Environmental Services', 'Virtual Assistance',
].map((item) => (typeof item === 'string' ? { key: item.toLowerCase(), label: item } : item))

const PAGE_LIMIT = 24
const BLUE = '#1A73E8'
const TEXT = '#101418'
const MUTED = '#5F6368'
const DIVIDER = '#E8EAED'
const BG = '#FFFFFF'
const SOFT_BG = '#F4F6FA'

function timeAgo(value) {
  if (!value) return 'Today'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function sourceInitial(source = 'N') {
  return source.trim().charAt(0).toUpperCase() || 'N'
}

function SourceRow({ item }) {
  return (
    <View style={styles.sourceRow}>
      <View style={styles.sourceMark}>
        <Text style={styles.sourceMarkText}>{sourceInitial(item.source)}</Text>
      </View>
      <Text style={styles.sourceText} numberOfLines={1}>{item.source || 'NendPlay News'}</Text>
    </View>
  )
}

function MoreButton() {
  return (
    <TouchableOpacity style={styles.moreButton} activeOpacity={0.75}>
      <Ionicons name="ellipsis-vertical" size={19} color="#8B8F96" />
    </TouchableOpacity>
  )
}

function HeroStory({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => onPress(item)} style={styles.heroStory}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.heroImage} resizeMode="cover" />
      ) : (
        <View style={[styles.heroImage, styles.emptyImage]}>
          <Ionicons name="newspaper-outline" size={46} color={BLUE} />
        </View>
      )}
      <View style={styles.storyBody}>
        <SourceRow item={item} />
        <Text style={styles.heroTitle} numberOfLines={3}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{timeAgo(item.publishedAt)}</Text>
          <MoreButton />
        </View>
      </View>
    </TouchableOpacity>
  )
}

function CompactStory({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(item)} style={styles.compactStory}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <SourceRow item={item} />
        <Text style={styles.compactTitle} numberOfLines={3}>{item.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{timeAgo(item.publishedAt)}</Text>
          <MoreButton />
        </View>
      </View>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} resizeMode="cover" />
      ) : null}
    </TouchableOpacity>
  )
}

function RelatedRail({ items, onPress }) {
  if (!items.length) return null
  return (
    <View style={styles.relatedWrap}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
        data={items}
        keyExtractor={(item, index) => `related-${item.id}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.86} onPress={() => onPress(item)} style={styles.relatedCard}>
            <SourceRow item={item} />
            <Text style={styles.relatedTitle} numberOfLines={3}>{item.title}</Text>
            <View style={styles.relatedMeta}>
              <Text style={styles.timeText}>{timeAgo(item.publishedAt)}</Text>
              <MoreButton />
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity activeOpacity={0.86} style={styles.coverageButton}>
        <Ionicons name="newspaper-outline" size={18} color={BLUE} />
        <Text style={styles.coverageText}>Full Coverage of this story</Text>
      </TouchableOpacity>
    </View>
  )
}

function SectionTitle({ children }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{children}</Text>
      <Ionicons name="chevron-forward" size={25} color={BLUE} />
    </View>
  )
}

export default function DailyNewsScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const [articles, setArticles] = useState([])
  const [activeSection, setActiveSection] = useState('news')
  const [activeTab, setActiveTab] = useState('for-you')
  const [activeJobMode, setActiveJobMode] = useState('on-site')
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [source, setSource] = useState('fallback')
  const [locationInfo, setLocationInfo] = useState({
    country: 'Nigeria',
    countryCode: 'NG',
    city: '',
    region: '',
  })

  useEffect(() => {
    detectLocation()
  }, [])

  const params = useMemo(() => ({
    section: activeSection,
    tab: activeTab,
    jobMode: activeSection === 'career' ? activeJobMode : undefined,
    search: search.trim(),
    country: locationInfo.countryCode || locationInfo.country || 'NG',
    city: locationInfo.city,
    region: locationInfo.region,
    limit: PAGE_LIMIT,
  }), [activeSection, activeTab, activeJobMode, search, locationInfo])

  useEffect(() => {
    fetchNews(1, false)
  }, [params])

  const detectLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') return

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest })
      const places = await Location.reverseGeocodeAsync(current.coords)
      const place = places?.[0]
      if (!place) return

      setLocationInfo({
        country: place.country || 'Nigeria',
        countryCode: place.isoCountryCode || 'NG',
        city: place.city || place.district || '',
        region: place.region || '',
      })
    } catch {}
  }

  const fetchNews = async (pageToLoad = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const response = await newsService.getDaily({ ...params, page: pageToLoad })
      const payload = response.data.data || {}
      const nextArticles = payload.articles || []
      const pagination = payload.pagination || {}
      setArticles((current) => append ? [...current, ...nextArticles] : nextArticles)
      setPage(pageToLoad)
      setHasMore(pageToLoad < (pagination.pages || 1))
      setSource(payload.source || 'fallback')
    } catch {
      setArticles([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const refresh = useCallback(() => {
    setRefreshing(true)
    fetchNews(1, false)
  }, [params])

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return
    fetchNews(page + 1, true)
  }

  const openArticle = async (article) => {
    if (article.kind === 'nendplay' || article.body || article.mediaFiles?.length) {
      navigation.navigate('NewsDetail', { newsId: article._id || article.id, article })
      return
    }
    if (!article.url) return
    try {
      await Linking.openURL(article.url)
    } catch {}
  }

  const topStory = articles[0]
  const secondStory = articles[1]
  const relatedStories = articles.slice(2, 4)
  const remainingStories = articles.slice(4)
  const categoryTabs = activeSection === 'career' ? CAREER_TABS : TABS
  const activeTabLabel = categoryTabs.find((tab) => tab.key === activeTab)?.label || 'For you'
  const localLabel = locationInfo.city || locationInfo.region || locationInfo.country || 'Local'

  const header = (
    <View>
      <View style={[styles.topHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.goBack()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={25} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.brandWrap}>
          <Text style={styles.brandBlue}>NendPlay</Text>
          <Text style={styles.brandDark}> {SECTION_TABS.find((item) => item.key === activeSection)?.label || 'News'}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setSearchOpen((value) => !value)} style={styles.headerIcon}>
          <Ionicons name="search" size={27} color={TEXT} />
        </TouchableOpacity>
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={MUTED} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search live news"
            placeholderTextColor={MUTED}
            style={styles.searchInput}
            autoFocus
          />
          {search.length ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={MUTED} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sectionList}
        data={SECTION_TABS}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          const active = item.key === activeSection
          return (
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => {
                setActiveSection(item.key)
                setActiveTab('for-you')
                if (item.key === 'career') setActiveJobMode('on-site')
              }}
              style={[styles.sectionPill, active && styles.sectionPillActive]}>
              <Text style={[styles.sectionPillText, active && styles.sectionPillTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )
        }}
      />

      {activeSection === 'career' ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.jobModeList}
          data={CAREER_JOB_MODES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            const active = item.key === activeJobMode
            return (
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => setActiveJobMode(item.key)}
                style={[styles.jobModePill, active && styles.jobModePillActive]}>
                <Text style={[styles.jobModeText, active && styles.jobModeTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            )
          }}
        />
      ) : null}

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabList}
        data={categoryTabs}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          const active = item.key === activeTab
          const label = item.key === 'local' ? localLabel : item.label
          return (
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setActiveTab(item.key)}
              style={[styles.tabPill, active && styles.tabPillActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          )
        }}
      />

      <View style={styles.dividerBand} />

      {activeTab === 'for-you' && <SectionTitle>{activeSection === 'news' ? 'For you' : SECTION_TABS.find((item) => item.key === activeSection)?.label}</SectionTitle>}
      {activeTab !== 'for-you' && (
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{activeTabLabel}</Text>
          <Text style={styles.categorySub}>
            {activeTab === 'local'
              ? `Live updates near ${localLabel}`
              : source === 'fallback'
                ? (activeSection === 'news'
                  ? 'Briefing mode until a news API key is added'
                  : activeSection === 'career'
                    ? 'Career opportunities from NendPlay'
                    : 'Fresh posts from NendPlay')
                : 'Live headlines from trusted publishers'}
          </Text>
        </View>
      )}

      {topStory ? <HeroStory item={topStory} onPress={openArticle} /> : null}
      {secondStory ? <CompactStory item={secondStory} onPress={openArticle} /> : null}
      <RelatedRail items={relatedStories} onPress={openArticle} />
      {activeTab === 'for-you' && remainingStories.length > 0 ? (
        <View style={styles.picksHeader}>
          <Text style={styles.picksText}>Picks for you</Text>
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={remainingStories}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item, index }) => (
          index % 3 === 0
            ? <HeroStory item={item} onPress={openArticle} />
            : <CompactStory item={item} onPress={openArticle} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 70 }}>
              <ActivityIndicator color={BLUE} size="large" />
            </View>
          ) : articles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={52} color={MUTED} />
              <Text style={styles.emptyTitle}>No stories found</Text>
              <Text style={styles.emptyText}>Try another topic or search term.</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BLUE} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={BLUE} style={{ marginVertical: 22 }} /> : <View style={{ height: 28 }} />
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topHeader: {
    backgroundColor: SOFT_BG,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWrap: { flexDirection: 'row', alignItems: 'center' },
  brandBlue: { color: BLUE, fontSize: 22, fontWeight: '800' },
  brandDark: { color: '#3C4043', fontSize: 22, fontWeight: '700' },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: -6,
    marginBottom: 8,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DIVIDER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },
  sectionList: {
    backgroundColor: SOFT_BG,
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  sectionPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  sectionPillActive: { backgroundColor: BLUE, borderColor: BLUE },
  sectionPillText: { color: TEXT, fontSize: 15, fontWeight: '800' },
  sectionPillTextActive: { color: '#FFFFFF' },
  jobModeList: {
    backgroundColor: SOFT_BG,
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  jobModePill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  jobModePillActive: { backgroundColor: '#0B3046', borderColor: '#0B3046' },
  jobModeText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  jobModeTextActive: { color: '#FFFFFF' },
  tabList: {
    backgroundColor: SOFT_BG,
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabPillActive: { backgroundColor: '#D2ECFF' },
  tabText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  tabTextActive: { color: '#0B3046' },
  dividerBand: { height: 8, backgroundColor: '#F1F3F7', borderTopWidth: 1, borderTopColor: '#EDF0F5' },
  sectionTitleWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: { color: BLUE, fontSize: 24, fontWeight: '800', marginRight: 4 },
  categoryHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  categoryTitle: { color: TEXT, fontSize: 24, fontWeight: '800' },
  categorySub: { color: MUTED, fontSize: 12, marginTop: 4 },
  heroStory: { paddingHorizontal: 16, paddingBottom: 15 },
  heroImage: { width: '100%', height: 158, borderRadius: 13, backgroundColor: '#DDE3EA' },
  emptyImage: { alignItems: 'center', justifyContent: 'center' },
  storyBody: { paddingTop: 10 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 21 },
  sourceMark: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sourceMarkText: { color: '#D93025', fontSize: 12, fontWeight: '900' },
  sourceText: { color: '#3C4043', fontSize: 13, flex: 1 },
  heroTitle: { color: '#050505', fontSize: 20, lineHeight: 26, fontWeight: '600', marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  timeText: { color: '#3C4043', fontSize: 12 },
  moreButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  compactStory: {
    marginHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compactTitle: { color: '#050505', fontSize: 18, lineHeight: 24, fontWeight: '600', marginTop: 6 },
  thumbImage: { width: 88, height: 76, borderRadius: 10, marginTop: 5 },
  relatedWrap: { paddingBottom: 14, borderTopWidth: 1, borderTopColor: DIVIDER },
  relatedCard: {
    width: 228,
    minHeight: 124,
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 13,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  relatedTitle: { color: TEXT, fontSize: 15, lineHeight: 21, marginTop: 8, fontWeight: '600' },
  relatedMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  coverageButton: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: DIVIDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  coverageText: { color: TEXT, fontSize: 15, fontWeight: '600' },
  picksHeader: { height: 56, backgroundColor: '#F1F3F7', justifyContent: 'center', paddingHorizontal: 16 },
  picksText: { color: '#673AB7', fontSize: 23, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTitle: { color: TEXT, fontSize: 20, fontWeight: '800', marginTop: 12 },
  emptyText: { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 6 },
})
