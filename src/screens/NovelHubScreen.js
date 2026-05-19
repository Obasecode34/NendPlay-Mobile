// src/screens/NovelHubScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal,
  ScrollView, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { novelService } from '../services/index'

const FILE_ICONS = {
  pdf: '📄', docx: '📝', doc: '📝', txt: '📃',
  epub: '📚', pptx: '📊', ppt: '📊', xlsx: '📈',
  xls: '📈', csv: '📋', other: '📁',
}

export default function NovelHubScreen() {
  const { theme } = useThemeStore()
  const { isAuthenticated } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: '', author: '', description: '', category: 'general', file: null,
  })

  useEffect(() => { fetchDocuments() }, [])

  const fetchDocuments = async (query = '') => {
    try {
      const params = { limit: 40 }
      if (query) params.search = query
      const res = await novelService.getAll(params)
      setDocuments(res.data.data.documents)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain', 'application/epub+zip'],
        copyToCacheDirectory: true,
      })
      if (!result.canceled && result.assets?.[0]) {
        setUploadForm({ ...uploadForm, file: result.assets[0] })
      }
    } catch { Alert.alert('Error', 'Failed to pick file') }
  }

  const handleUpload = async () => {
    if (!uploadForm.file || !uploadForm.title) {
      Alert.alert('Error', 'Please provide a title and file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('document', {
        uri: uploadForm.file.uri,
        name: uploadForm.file.name,
        type: uploadForm.file.mimeType || 'application/octet-stream',
      })
      formData.append('title', uploadForm.title)
      formData.append('author', uploadForm.author)
      formData.append('description', uploadForm.description)
      formData.append('category', uploadForm.category)
      await novelService.upload(formData)
      Alert.alert('Success', 'Document uploaded!')
      setShowUpload(false)
      setUploadForm({ title: '', author: '', description: '', category: 'general', file: null })
      fetchDocuments()
    } catch (err) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Please try again')
    } finally { setUploading(false) }
  }

  const handleFork = async (id) => {
    try {
      await novelService.fork(id)
      Alert.alert('Forked!', 'You now have your own copy of this document')
      fetchDocuments()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Fork failed')
    }
  }

  const handleDownload = async (id) => {
    try {
      const res = await novelService.download(id)
      Alert.alert('Download Ready', `File URL: ${res.data.data.fileUrl}\n\nOpen in browser to download`)
    } catch { Alert.alert('Error', 'Download failed') }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8, paddingHorizontal: 16,
      paddingBottom: 12, backgroundColor: c.bgDeep,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { color: c.text, fontSize: 22, fontWeight: '800' },
    uploadBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.primary, paddingHorizontal: 14,
      paddingVertical: 8, borderRadius: 10,
    },
    uploadBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, gap: 8,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 10 },
    card: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      padding: 14, marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    fileIcon: { fontSize: 28 },
    typeBadge: {
      backgroundColor: c.surfaceHigh, paddingHorizontal: 8,
      paddingVertical: 3, borderRadius: 6,
    },
    typeBadgeText: { color: c.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    cardTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    cardAuthor: { color: c.textMuted, fontSize: 12 },
    stats: { flexDirection: 'row', gap: 12, marginVertical: 8 },
    stat: { color: c.textMuted, fontSize: 11 },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 4,
      backgroundColor: c.surfaceHigh, paddingVertical: 8,
      borderRadius: 8,
    },
    actionBtnText: { color: c.text, fontSize: 12, fontWeight: '600' },
    iconBtn: {
      width: 36, height: 36, borderRadius: 8,
      backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center',
    },
  })

  const renderItem = ({ item }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.fileIcon}>{FILE_ICONS[item.fileType] || '📁'}</Text>
        <View style={s.typeBadge}>
          <Text style={s.typeBadgeText}>{item.fileType}</Text>
        </View>
      </View>
      <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.author && <Text style={s.cardAuthor}>by {item.author}</Text>}
      <View style={s.stats}>
        <Text style={s.stat}>👁 {item.viewCount || 0}</Text>
        <Text style={s.stat}>⬇ {item.downloadCount || 0}</Text>
        <Text style={s.stat}>🍴 {item.forkCount || 0}</Text>
      </View>
      <View style={s.cardActions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => handleDownload(item._id)}>
          <Ionicons name="book-outline" size={14} color={c.text} />
          <Text style={s.actionBtnText}>Read</Text>
        </TouchableOpacity>
        {isAuthenticated && (
          <>
            <TouchableOpacity style={s.iconBtn} onPress={() => handleFork(item._id)}>
              <Ionicons name="copy-outline" size={16} color={c.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => novelService.like(item._id)}>
              <Ionicons name="heart-outline" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>
      {item.isFork && (
        <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 6 }}>Forked copy</Text>
      )}
    </View>
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.title}>NovelHub</Text>
          {isAuthenticated && (
            <TouchableOpacity style={s.uploadBtn} onPress={() => setShowUpload(true)}>
              <Ionicons name="cloud-upload-outline" size={14} color="white" />
              <Text style={s.uploadBtnText}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={14} color={c.textMuted} />
          <TextInput style={s.searchInput} placeholder="Search documents..."
            placeholderTextColor={c.textMuted} value={search}
            onChangeText={(v) => { setSearch(v); fetchDocuments(v) }} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDocuments(search) }}
            tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📚</Text>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
                No documents yet
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>
                Be the first to upload
              </Text>
            </View>
          }
        />
      )}

      {/* Upload Modal */}
      <Modal visible={showUpload} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Upload Document</Text>
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
                    backgroundColor: c.surfaceHigh, borderRadius: 10, padding: 12,
                    color: c.text, fontSize: 14, marginBottom: 12,
                    borderWidth: 1, borderColor: c.border,
                  }}
                  placeholder={placeholder} placeholderTextColor={c.textMuted}
                  value={uploadForm[key]}
                  onChangeText={(v) => setUploadForm({ ...uploadForm, [key]: v })} />
              ))}

              <TouchableOpacity
                style={{
                  borderWidth: 2, borderColor: c.border, borderStyle: 'dashed',
                  borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16,
                }}
                onPress={handlePickFile}>
                <Ionicons name="document-outline" size={28} color={c.primary} />
                <Text style={{ color: c.text, fontSize: 14, marginTop: 8, fontWeight: '600' }}>
                  {uploadForm.file ? uploadForm.file.name : 'Tap to select file'}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
                  PDF, DOCX, TXT, EPUB
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
                  onPress={() => setShowUpload(false)}>
                  <Text style={{ color: c.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center' }}
                  onPress={handleUpload} disabled={uploading}>
                  {uploading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: 'white', fontWeight: '700' }}>Upload</Text>
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
