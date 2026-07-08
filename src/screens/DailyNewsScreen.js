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
import AdBanner from '../components/ads/AdBanner'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

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

function estimateReadTime(item = {}) {
  const text = [item.header, item.title, item.subHeader, item.summary, item.body]
    .filter(Boolean)
    .join(' ')
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return 'Today'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function storyCategory(item = {}) {
  const categories = item.categories || item.category || item.tab
  const value = Array.isArray(categories) ? categories[0] : categories
  return String(value || item.section || 'News').replace(/-/g, ' ')
}

function getJobRequirements(item = {}) {
  const lines = String(item.body || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
  if (lines.length) return lines.slice(0, 4)
  return [item.subHeader || item.summary || 'Relevant experience and strong communication skills required.']
}

function getJobMeta(item = {}) {
  return {
    company: item.company || item.source || 'NendPlay Media',
    tagline: item.tagline || 'Empowering Jobs. Inspiring Futures.',
    title: item.header || item.title || 'Job Position / Title',
    location: item.location || item.jobLocation || 'Lagos, Nigeria',
    salary: item.salary || item.salaryRange || 'Salary disclosed during application',
    experience: item.experience || item.yearsExperience || item.subHeader || '2 - 4 years',
    deadline: formatDate(item.deadline || item.applicationDeadline || item.publishedAt || item.createdAt),
    appliedCount: item.appliedCount || item.applicationCount || 120,
    requirements: getJobRequirements(item),
  }
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
  const imageUrl = item.imageUrl || item.coverImage || item.thumbnailUrl
  const excerpt = item.subHeader || item.summary || item.body || ''

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)} style={styles.newsCard}>
      <View style={styles.newsImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.newsImage} resizeMode="cover" />
        ) : (
          <View style={[styles.newsImage, styles.emptyImage]}>
            <Ionicons name="newspaper-outline" size={46} color={BLUE} />
          </View>
        )}
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText} numberOfLines={1}>{storyCategory(item)}</Text>
        </View>
      </View>

      <View style={styles.newsCardBody}>
        <View style={styles.newsMetaRow}>
          <View style={styles.newsMetaItem}>
            <Ionicons name="calendar-outline" size={16} color="#5F6B7A" />
            <Text style={styles.newsMetaText}>{formatDate(item.publishedAt || item.createdAt)}</Text>
          </View>
          <Text style={styles.newsMetaDot}>•</Text>
          <View style={styles.newsMetaItem}>
            <Ionicons name="time-outline" size={16} color="#5F6B7A" />
            <Text style={styles.newsMetaText}>{estimateReadTime(item)}</Text>
          </View>
        </View>

        <Text style={styles.newsCardTitle} numberOfLines={3}>{item.header || item.title}</Text>
        {excerpt ? <Text style={styles.newsCardExcerpt} numberOfLines={3}>{excerpt}</Text> : null}

        <View style={styles.newsFooter}>
          <View style={styles.readMoreRow}>
            <Text style={styles.readMoreText}>Read more</Text>
            <Ionicons name="arrow-forward" size={22} color="#1354C8" />
          </View>
          <TouchableOpacity activeOpacity={0.75} style={styles.bookmarkButton}>
            <Ionicons name="bookmark-outline" size={24} color="#4B5563" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function CompactStory({ item, onPress }) {
  return <HeroStory item={item} onPress={onPress} />
}

function JobStory({ item, onPress }) {
  const job = getJobMeta(item)
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)} style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <View style={styles.jobBrandRow}>
          <View style={styles.jobLogo}>
            <Text style={styles.jobLogoN}>N</Text>
            <Text style={styles.jobLogoText}>NendPlay</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.jobCompanyRow}>
              <Text style={styles.jobCompany} numberOfLines={1}>{job.company}</Text>
              <Ionicons name="checkmark-circle" size={18} color={BLUE} />
            </View>
            <Text style={styles.jobTagline} numberOfLines={1}>{job.tagline}</Text>
          </View>
        </View>
        <View style={styles.jobNewPill}>
          <Text style={styles.jobNewText}>New</Text>
        </View>
      </View>

      <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>

      <View style={styles.jobDivider} />
      <View style={styles.jobInfoRow}>
        <View style={styles.jobIconBox}>
          <Ionicons name="location" size={24} color={BLUE} />
        </View>
        <Text style={styles.jobInfoLabel}>Location</Text>
        <Text style={styles.jobInfoValue} numberOfLines={1}>{job.location}</Text>
      </View>
      <View style={styles.jobInfoRow}>
        <View style={styles.jobIconBox}>
          <Ionicons name="cash" size={24} color={BLUE} />
        </View>
        <Text style={styles.jobInfoLabel}>Salary</Text>
        <Text style={styles.jobSalary} numberOfLines={1}>{job.salary}</Text>
      </View>

      <View style={styles.jobMetaBand}>
        <View style={styles.jobMetaItem}>
          <Ionicons name="time" size={19} color={BLUE} />
          <Text style={styles.jobMetaText}>{job.experience}</Text>
        </View>
        <Text style={styles.jobSlash}>//</Text>
        <View style={styles.jobMetaItem}>
          <Ionicons name="calendar" size={19} color={BLUE} />
          <Text style={styles.jobMetaText}>{job.deadline}</Text>
        </View>
      </View>

      <View style={styles.jobRequirementBlock}>
        <Text style={styles.jobRequirementTitle}>Requirements</Text>
        {job.requirements.slice(0, 3).map((requirement, index) => (
          <View key={`${requirement}-${index}`} style={styles.jobBulletRow}>
            <View style={styles.jobBullet} />
            <Text style={styles.jobBulletText} numberOfLines={1}>{requirement}</Text>
          </View>
        ))}
      </View>

      <View style={styles.jobCallout}>
        <View style={styles.jobStar}>
          <Ionicons name="star" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobCalloutTitle}>Be part of a growing team making impact every day.</Text>
          <Text style={styles.jobCalloutText}>Apply now and take the next step in your career.</Text>
        </View>
      </View>

      <View style={styles.jobFooter}>
        <View style={styles.jobApplied}>
          <Ionicons name="people" size={20} color={BLUE} />
          <Text style={styles.jobAppliedText}>{job.appliedCount}+ people applied</Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item)} style={styles.jobApplyButton}>
          <Ionicons name="send" size={18} color="#fff" />
          <Text style={styles.jobApplyText}>Apply Now</Text>
        </TouchableOpacity>
      </View>
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

function NewsFeedAd() {
  return (
    <View style={styles.feedAdWrap}>
      <AdBanner style={styles.feedAdBanner} />
      <NendPlayAdCard placement="news" style={styles.feedNativeAd} />
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

      {topStory ? (
        activeSection === 'career'
          ? <JobStory item={topStory} onPress={openArticle} />
          : <HeroStory item={topStory} onPress={openArticle} />
      ) : null}
      {secondStory ? (
        activeSection === 'career'
          ? <JobStory item={secondStory} onPress={openArticle} />
          : <CompactStory item={secondStory} onPress={openArticle} />
      ) : null}
      {activeSection === 'career' ? null : <RelatedRail items={relatedStories} onPress={openArticle} />}
      {(topStory || secondStory || relatedStories.length) ? <NewsFeedAd /> : null}
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
          <>
            {activeSection === 'career'
              ? <JobStory item={item} onPress={openArticle} />
              : index % 3 === 0
                ? <HeroStory item={item} onPress={openArticle} />
                : <CompactStory item={item} onPress={openArticle} />}
            {(index + 1) % 4 === 0 ? <NewsFeedAd /> : null}
          </>
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
  newsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  newsImageWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: '#DDE3EA',
    position: 'relative',
    overflow: 'hidden',
  },
  newsImage: { width: '100%', height: '100%' },
  categoryPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    maxWidth: '70%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BLUE,
  },
  categoryPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  newsCardBody: { padding: 14 },
  newsMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  newsMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newsMetaText: { color: '#5F6B7A', fontSize: 11, fontWeight: '700' },
  newsMetaDot: { color: '#5F6B7A', fontSize: 13, fontWeight: '900' },
  newsCardTitle: {
    color: '#07162B',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  newsCardExcerpt: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 9,
  },
  newsFooter: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readMoreText: { color: '#1354C8', fontSize: 14, fontWeight: '900' },
  bookmarkButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  jobCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#4C1D95',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  jobBrandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  jobLogo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  jobLogoN: { color: BLUE, fontSize: 28, fontWeight: '900', lineHeight: 28 },
  jobLogoText: { color: BLUE, fontSize: 10, fontWeight: '900', marginTop: -1 },
  jobCompanyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  jobCompany: { flexShrink: 1, color: '#090D1C', fontSize: 18, fontWeight: '900' },
  jobTagline: { color: '#4B5563', fontSize: 12, fontWeight: '700', marginTop: 2 },
  jobNewPill: { borderRadius: 12, backgroundColor: BLUE, paddingHorizontal: 14, paddingVertical: 8 },
  jobNewText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  jobTitle: { color: '#090D1C', fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 24 },
  jobDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  jobInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  jobIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobInfoLabel: { width: 74, color: '#090D1C', fontSize: 16, fontWeight: '900' },
  jobInfoValue: { flex: 1, color: '#111827', fontSize: 16, fontWeight: '700' },
  jobSalary: { flex: 1, color: BLUE, fontSize: 16, fontWeight: '900' },
  jobMetaBand: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F7F2FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  jobMetaText: { color: '#111827', fontSize: 14, fontWeight: '800' },
  jobSlash: { color: BLUE, fontSize: 20, fontWeight: '900' },
  jobRequirementBlock: { borderTopWidth: 1, borderTopColor: '#F0F1F5', marginTop: 18, paddingTop: 16 },
  jobRequirementTitle: { color: BLUE, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  jobBulletRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 },
  jobBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: BLUE },
  jobBulletText: { flex: 1, color: '#111827', fontSize: 14, lineHeight: 20 },
  jobCallout: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: BLUE,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FBF7FF',
  },
  jobStar: { width: 46, height: 46, borderRadius: 23, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  jobCalloutTitle: { color: '#090D1C', fontSize: 14, fontWeight: '900' },
  jobCalloutText: { color: '#374151', fontSize: 13, marginTop: 3 },
  jobFooter: { marginTop: 16, flexDirection: 'row', gap: 10 },
  jobApplied: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  jobAppliedText: { color: BLUE, fontSize: 13, fontWeight: '800' },
  jobApplyButton: {
    flex: 1,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 10,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  jobApplyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  feedAdWrap: { marginHorizontal: 16, marginTop: 10, marginBottom: 8 },
  feedAdBanner: { marginBottom: 8 },
  feedNativeAd: { marginHorizontal: 0 },
  heroStory: { paddingHorizontal: 16, paddingBottom: 15 },
  heroImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 13, backgroundColor: '#DDE3EA' },
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
