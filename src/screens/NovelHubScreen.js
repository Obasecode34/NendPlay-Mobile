// src/screens/NovelHubScreen.js
import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal,
  ScrollView, RefreshControl, Share,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Device from 'expo-device'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { downloadService, novelService } from '../services/index'
import { saveDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloadStore'
import DownloadsScreen from './DownloadsScreen'
import DeviceOfficeScreen from '../features/novelDevice/DeviceOfficeScreen'

const TOP_TABS = [
  { key: 'novels', label: 'NovelHub', icon: 'book-outline' },
  { key: 'downloads', label: 'Downloads', icon: 'download-outline' },
  { key: 'device', label: 'NP Office', icon: 'phone-portrait-outline' },
]

const PDF_GENRES = [
  { key: 'business', label: 'Business', icon: 'briefcase-outline' },
  { key: 'love', label: 'Love', icon: 'heart-outline' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline' },
  { key: 'drama', label: 'Drama', icon: 'film-outline' },
  { key: 'fiction', label: 'Fiction', icon: 'library-outline' },
  { key: 'non-fiction', label: 'Non-Fiction', icon: 'newspaper-outline' },
  { key: 'mystery', label: 'Mystery', icon: 'search-outline' },
  { key: 'horror', label: 'Horror', icon: 'skull-outline' },
  { key: 'fan-fiction', label: 'Fan Fiction', icon: 'sparkles-outline' },
  { key: 'sci-fi', label: 'Sci-Fi', icon: 'planet-outline' },
  { key: 'urban', label: 'Urban', icon: 'business-outline' },
  { key: 'teen', label: 'Teen', icon: 'school-outline' },
  { key: 'military-history', label: 'Military & History', icon: 'shield-outline' },
  { key: 'games-sport', label: 'Games & Sport', icon: 'game-controller-outline' },
  { key: 'literature', label: 'Literature', icon: 'reader-outline' },
  { key: 'eastern-fantasy', label: 'Eastern Fantasy', icon: 'compass-outline' },
  { key: 'western-fantasy', label: 'Western Fantasy', icon: 'trail-sign-outline' },
]

const LICENSE_TYPES = [
  { key: 'unknown', label: 'Rights not set yet' },
  { key: 'public_domain', label: 'Public domain' },
  { key: 'cc0', label: 'CC0' },
  { key: 'cc_by', label: 'CC BY' },
  { key: 'cc_by_sa', label: 'CC BY-SA' },
  { key: 'cc_by_nc', label: 'CC BY-NC' },
  { key: 'owned', label: 'Owned' },
  { key: 'permission_granted', label: 'Permission granted' },
]

const CATALOG_LIMIT = 60

function normalizeGenre(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getDocumentGenre(item = {}) {
  const raw = item.category || item.genre || item.tags?.[0] || 'fiction'
  const normalized = normalizeGenre(raw)
  return PDF_GENRES.some((genre) => genre.key === normalized) ? normalized : 'fiction'
}

function scoreDocument(item = {}) {
  return (item.viewCount || 0) + (item.downloadCount || 0) * 2 + (item.likeCount || 0) * 3 + (item.forkCount || 0) * 2
}

function getCoverColors(item = {}) {
  const palettes = [
    ['#173B5F', '#4F46E5'],
    ['#064E3B', '#0D9488'],
    ['#4C1D95', '#DB2777'],
    ['#7F1D1D', '#EA580C'],
    ['#111827', '#475569'],
    ['#312E81', '#0891B2'],
  ]
  const seed = `${item._id || item.title || ''}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[seed % palettes.length]
}

export default function NovelHubScreen() {
  const { theme } = useThemeStore()
  const { isAuthenticated } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [activeTopTab, setActiveTopTab] = useState('novels')
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [activeGenre, setActiveGenre] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedPdf, setSelectedPdf] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', author: '', description: '', category: 'fiction', file: null,
    licenseType: 'unknown', sourceName: '', sourceUrl: '', licenseUrl: '',
    attributionText: '', rightsSummary: '', requiresAttribution: false,
  })

  useEffect(() => { fetchDocuments() }, [])

  const fetchDocuments = async (query = '', pageToLoad = 1, append = false, genre = activeGenre) => {
    try {
      const params = { limit: CATALOG_LIMIT, page: pageToLoad, fileType: 'pdf' }
      if (query) params.search = query
      if (genre && genre !== 'all') params.category = genre
      const res = await novelService.getAll(params)
      const next = res.data.data.documents || []
      const pagination = res.data.data.pagination || {}
      setDocuments((current) => append ? [...current, ...next] : next)
      setPage(pageToLoad)
      setHasMore(pageToLoad < (pagination.pages || 1))
    } catch {
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadMoreDocuments = () => {
    if (loading || !hasMore) return
    fetchDocuments(search, page + 1, true)
  }

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets?.[0]) {
        setUploadForm({ ...uploadForm, file: result.assets[0] })
      }
    } catch { Alert.alert('Error', 'Failed to pick file') }
  }

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title) {
      Alert.alert('Error', 'Please provide a title and PDF file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('document', {
        uri: uploadForm.file.uri,
        name: uploadForm.file.name,
        type: uploadForm.file.mimeType || 'application/pdf',
      })
      formData.append('title', uploadForm.title)
      formData.append('author', uploadForm.author)
      formData.append('description', uploadForm.description)
      formData.append('category', uploadForm.category)
      formData.append('genre', uploadForm.category)
      formData.append('licenseType', uploadForm.licenseType)
      formData.append('sourceName', uploadForm.sourceName)
      formData.append('sourceUrl', uploadForm.sourceUrl)
      formData.append('licenseUrl', uploadForm.licenseUrl)
      formData.append('attributionText', uploadForm.attributionText)
      formData.append('rightsSummary', uploadForm.rightsSummary)
      formData.append('requiresAttribution', uploadForm.requiresAttribution.toString())
      await novelService.upload(formData)
      Alert.alert('Success', 'PDF uploaded to NovelHub.')
      setShowUpload(false)
      setUploadForm({
        title: '', author: '', description: '', category: 'fiction', file: null,
        licenseType: 'unknown', sourceName: '', sourceUrl: '', licenseUrl: '',
        attributionText: '', rightsSummary: '', requiresAttribution: false,
      })
      fetchDocuments(search, 1, false)
    } catch (err) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Please try again')
    } finally { setUploading(false) }
  }

  const handleFork = async (id) => {
    try {
      await novelService.fork(id)
      Alert.alert('Forked!', 'You now have your own copy of this PDF.')
      fetchDocuments(search, 1, false)
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Fork failed')
    }
  }

  const handleDownload = async (id) => {
    try {
      const res = await novelService.download(id)
      Alert.alert('PDF Ready', `File URL: ${res.data.data.fileUrl}\n\nOpen in browser to read or download.`)
    } catch { Alert.alert('Error', 'Download failed') }
  }

  const openReader = (item) => {
    setSelectedPdf(item)
  }

  const sharePdf = async (item = selectedPdf) => {
    if (!item) return
    try {
      const res = await novelService.download(item._id)
      const fileUrl = res.data.data.fileUrl
      await Share.share({
        title: item.title,
        message: `${item.title}\n${fileUrl}`,
        url: fileUrl,
      })
    } catch {
      Alert.alert('Share failed', 'Unable to prepare this PDF link right now.')
    }
  }

  const downloadPdf = async (item = selectedPdf) => {
    if (!item) return
    setDownloadingPdf(true)
    try {
      const deviceId = Device.osInternalBuildId || 'mobile-device'
      const res = await downloadService.authorize({
        contentType: 'document',
        contentId: item._id,
        deviceId,
        platform: 'mobile',
      })
      if (res.data.data.alreadyDownloaded) {
        Alert.alert('Already Downloaded', 'This PDF is already in your NovelHub Downloads tab.')
        setActiveTopTab('downloads')
        setSelectedPdf(null)
        return
      }
      const fileUrl = res.data.data.fileUrl || item.fileUrl
      const savedFile = await saveDownloadFile({
        fileUrl,
        contentType: 'document',
        contentId: item._id,
        title: item.title || res.data.data.title || 'pdf',
        mimeType: item.mimeType || res.data.data.mimeType || 'application/pdf',
      })
      await upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'document',
        contentId: item._id,
        storageKey: savedFile.storageKey,
        storedFileSize: savedFile.storedFileSize || item.fileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: item.title || res.data.data.title || 'pdf',
          thumbnailUrl: item.thumbnailUrl || '',
          type: item.fileType || 'pdf',
          category: item.category || item.genre || '',
          mimeType: item.mimeType || res.data.data.mimeType || 'application/pdf',
          fileUrl,
          licenseType: item.licenseType || 'unknown',
          sourceName: item.sourceName || '',
          sourceUrl: item.sourceUrl || '',
          licenseUrl: item.licenseUrl || '',
          attributionText: item.attributionText || '',
        },
      })
      if (res.data.data.download?._id) {
        await downloadService.complete({
          downloadId: res.data.data.download._id,
          storageKey: savedFile.storageKey,
          storedFileSize: savedFile.storedFileSize || item.fileSize || res.data.data.fileSize || 0,
        })
        Alert.alert('Downloaded', 'Full PDF access is now available in NovelHub Downloads.')
        setActiveTopTab('downloads')
      } else {
        Alert.alert('Downloaded', 'This PDF was saved on this device with full read-only access in your NovelHub Downloads tab.')
      }
      setSelectedPdf(null)
    } catch (err) {
      Alert.alert('Download Failed', err.response?.data?.message || 'Unable to prepare this PDF download.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const genreMap = useMemo(() => PDF_GENRES.reduce((acc, genre) => {
    acc[genre.key] = genre
    return acc
  }, {}), [])

  const rankedDocuments = useMemo(() => (
    [...documents].sort((a, b) => scoreDocument(b) - scoreDocument(a))
  ), [documents])

  const recentDocuments = useMemo(() => documents.slice(0, 10), [documents])
  const bestDocuments = useMemo(() => rankedDocuments.slice(0, 8), [rankedDocuments])
  const categorySections = useMemo(() => PDF_GENRES.map((genre) => ({
    ...genre,
    items: documents.filter((item) => getDocumentGenre(item) === genre.key).slice(0, 6),
  })).filter((section) => section.items.length), [documents])

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: c.bgDeep,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { color: c.text, fontSize: 22, fontWeight: '900' },
    topTabs: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bg,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
    },
    topTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
    },
    topTabText: { fontSize: 12, fontWeight: '900' },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    uploadBtnText: { color: 'white', fontSize: 13, fontWeight: '900' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 10 },
    section: { marginBottom: 26 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    sectionTitle: { color: c.text, fontSize: 24, fontWeight: '900' },
    viewAll: { color: c.textMuted, fontSize: 14, fontWeight: '800' },
    cover: {
      borderRadius: 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    coverTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' },
    genreBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(16,185,129,0.18)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    genreBadgeText: { color: '#22C55E', fontSize: 11, fontWeight: '900' },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: c.surfaceHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })

  const selectGenre = (genre) => {
    setActiveGenre(genre)
    setLoading(true)
    fetchDocuments(search, 1, false, genre)
  }

  const renderTopTabs = () => (
    <View style={s.topTabs}>
      {TOP_TABS.map((tab) => {
        const active = activeTopTab === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTopTab(tab.key)}
            style={[s.topTab, { backgroundColor: active ? c.primary : 'transparent' }]}>
            <Ionicons name={tab.icon} size={15} color={active ? '#FFFFFF' : c.textMuted} />
            <Text style={[s.topTabText, { color: active ? '#FFFFFF' : c.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderCover = (item, size = 132) => {
    const [from, to] = getCoverColors(item)
    const genre = genreMap[getDocumentGenre(item)] || PDF_GENRES[4]
    return (
      <TouchableOpacity onPress={() => openReader(item)} style={{ width: size }}>
        <View style={[s.cover, { width: size, height: size * 1.42, backgroundColor: from }]}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: to, opacity: 0.34 }} />
          <Ionicons name="document-text" size={26} color="rgba(255,255,255,0.78)" />
          <Text style={s.coverTitle} numberOfLines={4}>{item.title}</Text>
          <View style={s.genreBadge}>
            <Text style={s.genreBadgeText}>{genre.label}</Text>
          </View>
        </View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '900', marginTop: 8 }} numberOfLines={2}>
          {item.title}
        </Text>
      </TouchableOpacity>
    )
  }

  const SectionHeader = ({ title, onPress }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={s.viewAll}>View all</Text>
      </TouchableOpacity>
    </View>
  )

  const DocumentRail = ({ title, items, size = 132, onViewAll }) => {
    if (!items.length) return null
    return (
      <View style={s.section}>
        <SectionHeader title={title} onPress={onViewAll} />
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
          renderItem={({ item }) => renderCover(item, size)}
        />
      </View>
    )
  }

  const RankingRail = () => {
    const rows = rankedDocuments.slice(0, 3)
    if (!rows.length) return null
    return (
      <View style={s.section}>
        <SectionHeader title="Ranking" onPress={() => selectGenre('all')} />
        <FlatList
          horizontal
          data={[rows]}
          keyExtractor={() => 'ranking'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={() => (
            <View style={{
              width: 310,
              padding: 16,
              borderRadius: 18,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              gap: 12,
            }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginBottom: 2 }}>Must Read</Text>
              {rows.map((item, index) => {
                const genre = genreMap[getDocumentGenre(item)] || PDF_GENRES[4]
                return (
                  <TouchableOpacity key={item._id} onPress={() => openReader(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ color: index === 0 ? '#FACC15' : index === 1 ? '#FB923C' : '#EC4899', fontSize: 22, fontWeight: '900', width: 24 }}>
                      {index + 1}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{item.title}</Text>
                      <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '800', marginTop: 4 }}>{genre.label}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        />
      </View>
    )
  }

  const GenreChips = () => (
    <View style={s.section}>
      <SectionHeader title="Genres" onPress={() => selectGenre('all')} />
      <FlatList
        horizontal
        data={[{ key: 'all', label: 'All', icon: 'albums-outline' }, ...PDF_GENRES]}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        renderItem={({ item }) => {
          const active = activeGenre === item.key
          return (
            <TouchableOpacity
              onPress={() => selectGenre(item.key)}
              style={{
                minWidth: 142,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 14,
                backgroundColor: active ? c.primary : c.surface,
                borderWidth: 1,
                borderColor: active ? c.primary : c.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
              <Ionicons name={item.icon} size={17} color={active ? '#FFFFFF' : c.textMuted} />
              <Text style={{ color: active ? '#FFFFFF' : c.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )

  const FeaturedList = () => {
    const items = rankedDocuments.slice(6, 16)
    if (!items.length) return null
    return (
      <View style={s.section}>
        <SectionHeader title="Featured For You" onPress={() => selectGenre('all')} />
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          {items.map((item) => {
            const genre = genreMap[getDocumentGenre(item)] || PDF_GENRES[4]
            return (
              <TouchableOpacity key={item._id} onPress={() => openReader(item)} style={{ flexDirection: 'row', gap: 14 }}>
                {renderCover(item, 86)}
                <View style={{ flex: 1, paddingTop: 8 }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7 }} numberOfLines={2}>
                    {item.description || item.author || 'PDF document available in NovelHub.'}
                  </Text>
                  <View style={[s.genreBadge, { marginTop: 9 }]}>
                    <Text style={s.genreBadgeText}>{genre.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    )
  }

  const ReaderModal = () => {
    if (!selectedPdf) return null
    const genre = genreMap[getDocumentGenre(selectedPdf)] || PDF_GENRES[4]
    const chapterOne = selectedPdf.description || selectedPdf.author
      ? `${selectedPdf.description || ''}${selectedPdf.author ? `\n\nAuthor: ${selectedPdf.author}` : ''}`
      : 'Chapter One preview is available inside NendPlay. Download the PDF to continue reading the complete document from chapter two onward.'

    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedPdf(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' }}>
          <View style={{
            maxHeight: '88%',
            backgroundColor: c.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}>
            <View style={{ padding: 16, backgroundColor: c.bgDeep, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 19, fontWeight: '900' }} numberOfLines={2}>
                    {selectedPdf.title}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 5 }}>
                    {genre.label} | Chapter One Preview
                  </Text>
                </View>
                <TouchableOpacity onPress={() => sharePdf(selectedPdf)} style={{ padding: 8 }}>
                  <Ionicons name="share-social-outline" size={22} color={c.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedPdf(null)} style={{ padding: 8 }}>
                  <Ionicons name="close" size={24} color={c.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
              <View style={{
                padding: 18,
                borderRadius: 20,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
              }}>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '900', marginBottom: 12 }}>
                  Chapter One
                </Text>
                <Text style={{ color: c.text, fontSize: 15, lineHeight: 24 }}>
                  {chapterOne}
                </Text>
                {(selectedPdf.licenseType && selectedPdf.licenseType !== 'unknown') || selectedPdf.sourceName || selectedPdf.attributionText ? (
                  <View style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: c.bgDeep,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}>
                    <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Rights</Text>
                    <Text style={{ color: c.text, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                      {selectedPdf.attributionText || selectedPdf.sourceName || selectedPdf.licenseType}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{
                marginTop: 16,
                padding: 18,
                borderRadius: 20,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
              }}>
                <Ionicons name="lock-closed-outline" size={34} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 10 }}>
                  Chapter Two is locked
                </Text>
                <Text style={{ color: c.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 7 }}>
                  Download this PDF to unlock full access in the NovelHub Downloads tab. Downloaded PDFs are read-only.
                </Text>
                <TouchableOpacity
                  onPress={() => downloadPdf(selectedPdf)}
                  disabled={downloadingPdf}
                  style={{
                    marginTop: 16,
                    backgroundColor: c.primary,
                    borderRadius: 16,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    minWidth: 180,
                    alignItems: 'center',
                  }}>
                  {downloadingPdf ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Download Full PDF</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    )
  }

  const renderNovelCatalog = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); fetchDocuments(search, 1, false) }}
        tintColor={c.primary} />}
      onMomentumScrollEnd={({ nativeEvent }) => {
        const nearBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 260
        if (nearBottom) loadMoreDocuments()
      }}
      contentContainerStyle={{ paddingVertical: 16, paddingBottom: 120 }}>
      <DocumentRail title="History" items={recentDocuments} size={96} onViewAll={() => selectGenre('all')} />
      <DocumentRail title="Best Novels" items={bestDocuments} size={122} onViewAll={() => selectGenre('all')} />
      <RankingRail />
      <GenreChips />
      {categorySections.map((section) => (
        <DocumentRail
          key={section.key}
          title={section.label}
          items={section.items}
          size={112}
          onViewAll={() => selectGenre(section.key)}
        />
      ))}
      <FeaturedList />
      {hasMore ? (
        <TouchableOpacity
          onPress={loadMoreDocuments}
          style={{ alignSelf: 'center', marginTop: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 11 }}>
          <Text style={{ color: c.text, fontWeight: '900' }}>Load more PDFs</Text>
        </TouchableOpacity>
      ) : null}
      {!documents.length ? (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <Ionicons name="book-outline" size={46} color={c.textMuted} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>No PDF documents yet</Text>
          <Text style={{ color: c.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
            Upload PDFs by genre to build the NovelHub catalog.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.title}>NovelHub</Text>
          {activeTopTab === 'novels' && isAuthenticated && (
            <TouchableOpacity style={s.uploadBtn} onPress={() => setShowUpload(true)}>
              <Ionicons name="cloud-upload-outline" size={14} color="white" />
              <Text style={s.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>
        {renderTopTabs()}
        {activeTopTab === 'novels' ? (
          <View style={s.searchWrap}>
            <Ionicons name="search" size={14} color={c.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search PDF novels, authors, genres..."
              placeholderTextColor={c.textMuted}
              value={search}
              onChangeText={(value) => {
                setSearch(value)
                setLoading(true)
                fetchDocuments(value, 1, false)
              }}
            />
          </View>
        ) : null}
      </View>

      {activeTopTab === 'downloads' ? (
        <DownloadsScreen embedded contentType="document" />
      ) : activeTopTab === 'device' ? (
        <DeviceOfficeScreen theme={theme} />
      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : renderNovelCatalog()}
      <ReaderModal />

      <Modal visible={showUpload} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>Upload PDF</Text>
              <TouchableOpacity onPress={() => setShowUpload(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { placeholder: 'Title *', key: 'title' },
                { placeholder: 'Author', key: 'author' },
                { placeholder: 'Description', key: 'description' },
              ].map(({ placeholder, key }) => (
                <TextInput key={key}
                  style={{
                    backgroundColor: c.surfaceHigh,
                    borderRadius: 10,
                    padding: 12,
                    color: c.text,
                    fontSize: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                  placeholder={placeholder}
                  placeholderTextColor={c.textMuted}
                  value={uploadForm[key]}
                  onChangeText={(value) => setUploadForm({ ...uploadForm, [key]: value })} />
              ))}

              <Text style={{ color: c.text, fontWeight: '900', marginBottom: 8 }}>Genre</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {PDF_GENRES.map((genre) => {
                  const active = uploadForm.category === genre.key
                  return (
                    <TouchableOpacity
                      key={genre.key}
                      onPress={() => setUploadForm({ ...uploadForm, category: genre.key })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        backgroundColor: active ? c.primary : c.surfaceHigh,
                      }}>
                      <Ionicons name={genre.icon} size={13} color={active ? '#FFFFFF' : c.textMuted} />
                      <Text style={{ color: active ? '#FFFFFF' : c.textMuted, fontSize: 11, fontWeight: '900' }}>
                        {genre.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={{ color: c.text, fontWeight: '900', marginBottom: 8 }}>Rights and source</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {LICENSE_TYPES.map((license) => {
                  const active = uploadForm.licenseType === license.key
                  return (
                    <TouchableOpacity
                      key={license.key}
                      onPress={() => setUploadForm({ ...uploadForm, licenseType: license.key })}
                      style={{
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        backgroundColor: active ? c.primary : c.surfaceHigh,
                      }}>
                      <Text style={{ color: active ? '#FFFFFF' : c.textMuted, fontSize: 11, fontWeight: '900' }}>
                        {license.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {[
                { placeholder: 'Source name e.g. Project Gutenberg', key: 'sourceName' },
                { placeholder: 'Source URL', key: 'sourceUrl' },
                { placeholder: 'License URL', key: 'licenseUrl' },
                { placeholder: 'Attribution text', key: 'attributionText' },
                { placeholder: 'Rights notes / proof summary', key: 'rightsSummary' },
              ].map(({ placeholder, key }) => (
                <TextInput key={key}
                  style={{
                    backgroundColor: c.surfaceHigh,
                    borderRadius: 10,
                    padding: 12,
                    color: c.text,
                    fontSize: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                  placeholder={placeholder}
                  placeholderTextColor={c.textMuted}
                  value={uploadForm[key]}
                  multiline={key === 'attributionText' || key === 'rightsSummary'}
                  onChangeText={(value) => setUploadForm({ ...uploadForm, [key]: value })} />
              ))}

              <TouchableOpacity
                onPress={() => setUploadForm({ ...uploadForm, requiresAttribution: !uploadForm.requiresAttribution })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Ionicons
                  name={uploadForm.requiresAttribution ? 'checkbox-outline' : 'square-outline'}
                  size={20}
                  color={uploadForm.requiresAttribution ? c.primary : c.textMuted}
                />
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800' }}>Show attribution for this PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  borderWidth: 2,
                  borderColor: c.border,
                  borderStyle: 'dashed',
                  borderRadius: 12,
                  padding: 20,
                  alignItems: 'center',
                  marginBottom: 16,
                }}
                onPress={handlePickFile}>
                <Ionicons name="document-outline" size={28} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 14, marginTop: 8, fontWeight: '900' }}>
                  {uploadForm.file ? uploadForm.file.name : 'Tap to select PDF'}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
                  PDF documents only for NovelHub
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
                  onPress={() => setShowUpload(false)}>
                  <Text style={{ color: c.textMuted, fontWeight: '900' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center' }}
                  onPress={handleUpload} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: 'white', fontWeight: '900' }}>Upload</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
