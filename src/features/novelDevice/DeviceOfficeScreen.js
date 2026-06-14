import React, { useEffect, useMemo, useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, FlatList, Alert, Modal,
  ScrollView, ActivityIndicator, Linking, Platform,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as LegacyFileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'

const STORAGE_KEY = 'nendplay:novelhub:device-documents'

const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/epub+zip',
  'application/rtf',
]

const FILTERS = [
  { key: 'all', label: 'All', icon: 'albums-outline' },
  { key: 'pdf', label: 'PDF', icon: 'document-text-outline' },
  { key: 'word', label: 'Word', icon: 'reader-outline' },
  { key: 'sheet', label: 'Sheets', icon: 'grid-outline' },
  { key: 'slide', label: 'Slides', icon: 'easel-outline' },
  { key: 'text', label: 'Text', icon: 'text-outline' },
  { key: 'ebook', label: 'Ebooks', icon: 'book-outline' },
]

const READ_URI_PERMISSION = 1

const MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  epub: 'application/epub+zip',
  rtf: 'application/rtf',
}

function getExtension(name = '') {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'file'
}

function getDocType(file = {}) {
  const ext = getExtension(file.name)
  if (ext === 'pdf') return 'pdf'
  if (['doc', 'docx', 'rtf'].includes(ext)) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  if (['ppt', 'pptx'].includes(ext)) return 'slide'
  if (['txt'].includes(ext)) return 'text'
  if (['epub'].includes(ext)) return 'ebook'
  return 'other'
}

function formatSize(bytes = 0) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDocIcon(type) {
  const icons = {
    pdf: 'document-text',
    word: 'reader',
    sheet: 'grid',
    slide: 'easel',
    text: 'text',
    ebook: 'book',
    other: 'document',
  }
  return icons[type] || icons.other
}

function getMimeType(item = {}) {
  return item.mimeType || MIME_TYPES[getExtension(item.name)] || 'application/octet-stream'
}

function getFallbackMimeTypes(item = {}) {
  const ext = getExtension(item.name)
  const type = getDocType(item)
  const fallbacks = {
    pdf: ['application/pdf', 'application/*'],
    word: [
      MIME_TYPES[ext],
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'application/*',
    ],
    sheet: [
      MIME_TYPES[ext],
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/*',
    ],
    slide: [
      MIME_TYPES[ext],
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/*',
    ],
    text: ['text/plain', 'text/*'],
    ebook: ['application/epub+zip', 'application/*'],
    other: ['application/octet-stream', 'application/*'],
  }
  return [...new Set([getMimeType(item), ...(fallbacks[type] || fallbacks.other)].filter(Boolean))]
}

export default function DeviceOfficeScreen({ theme }) {
  const c = theme.colors
  const [documents, setDocuments] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(null)
  const [previewText, setPreviewText] = useState('')
  const [sheetPreview, setSheetPreview] = useState([])
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY)
        setDocuments(saved ? JSON.parse(saved) : [])
      } catch {
        setDocuments([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveDocuments = async (items) => {
    setDocuments(items)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }

  const importDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.length) return

      const nextDocs = result.assets.map((file) => ({
        id: `${file.uri}-${Date.now()}-${file.name}`,
        name: file.name || 'Untitled document',
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size,
        type: getDocType(file),
        importedAt: Date.now(),
      }))

      const known = new Set(documents.map((item) => `${item.name}:${item.size || 0}`))
      const merged = [
        ...nextDocs.filter((item) => !known.has(`${item.name}:${item.size || 0}`)),
        ...documents,
      ].slice(0, 120)
      await saveDocuments(merged)
    } catch {
      Alert.alert('Document access failed', 'NendPlay could not open the document picker.')
    }
  }

  const openDocument = async (item) => {
    try {
      if (Platform.OS === 'android') {
        const data = item.uri.startsWith('file://')
          ? await LegacyFileSystem.getContentUriAsync(item.uri)
          : item.uri

        const mimeTypes = getFallbackMimeTypes(item)
        let lastError = null
        for (const type of mimeTypes) {
          try {
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data,
              type,
              flags: READ_URI_PERMISSION,
            })
            lastError = null
            break
          } catch (error) {
            lastError = error
          }
        }
        if (lastError) throw lastError
      } else {
        await Linking.openURL(item.uri)
      }
      const reordered = [item, ...documents.filter((doc) => doc.id !== item.id)]
      await saveDocuments(reordered)
    } catch {
      const ext = getExtension(item.name).toUpperCase()
      Alert.alert(
        'Open document',
        `${ext} files need a compatible viewer on your phone, such as WPS Office, Microsoft Office, Google Docs/Sheets/Slides, Adobe Reader, or another office app. You can still keep the file in NP Office and preview supported text/CSV files inside NendPlay.`
      )
    }
  }

  const previewDocument = async (item) => {
    setPreview(item)
    setPreviewText('')
    setSheetPreview([])
    const ext = getExtension(item.name)
    const canReadText = ['txt', 'csv'].includes(ext)
    if (!canReadText) return

    setPreviewLoading(true)
    try {
      const text = await FileSystem.readAsStringAsync(item.uri)
      if (ext === 'csv') {
        const rows = text
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(0, 40)
          .map((row) => row.split(',').map((cell) => cell.trim()).slice(0, 8))
        setSheetPreview(rows)
      } else {
        setPreviewText(text.slice(0, 12000))
      }
    } catch {
      setPreviewText('Preview is unavailable for this file. Use Open to view it with a document app.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const removeDocument = async (item) => {
    Alert.alert('Remove from Device list', `Remove "${item.name}" from NendPlay recent documents?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => saveDocuments(documents.filter((doc) => doc.id !== item.id)),
      },
    ])
  }

  const visibleDocuments = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return documents.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false
      if (!terms.length) return true
      const text = `${item.name} ${item.type} ${getExtension(item.name)} ${item.mimeType || ''}`.toLowerCase()
      return terms.every((term) => text.includes(term))
    })
  }, [documents, filter, query])

  const renderDocument = ({ item }) => (
    <TouchableOpacity
      onPress={() => previewDocument(item)}
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}>
      <View style={{
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: c.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name={getDocIcon(item.type)} size={23} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
          {item.type.toUpperCase()} | {formatSize(item.size)} | {getExtension(item.name).toUpperCase()}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => openDocument(item)}
            style={{ backgroundColor: c.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => previewDocument(item)}
            style={{ backgroundColor: c.surfaceHigh, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 }}>
            <Text style={{ color: c.text, fontSize: 12, fontWeight: '900' }}>Preview</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={() => removeDocument(item)} style={{ padding: 4 }}>
        <Ionicons name="close-circle-outline" size={20} color={c.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{
          padding: 16,
          borderRadius: 22,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: c.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="documents" size={25} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>
                NendPlay Office
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
                PDF, Word, Excel, PowerPoint, TXT, CSV, EPUB
              </Text>
            </View>
            <TouchableOpacity
              onPress={importDocuments}
              style={{ backgroundColor: c.primary, borderRadius: 14, padding: 11 }}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 14,
          paddingHorizontal: 12,
        }}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search local documents"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, color: c.text, paddingVertical: 12 }}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={visibleDocuments}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        ListHeaderComponent={
          <FlatList
            horizontal
            data={FILTERS}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 14 }}
            renderItem={({ item }) => {
              const active = filter === item.key
              return (
                <TouchableOpacity
                  onPress={() => setFilter(item.key)}
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
                  <Ionicons name={item.icon} size={14} color={active ? '#FFFFFF' : c.textMuted} />
                  <Text style={{ color: active ? '#FFFFFF' : c.textMuted, fontSize: 12, fontWeight: '900' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingHorizontal: 30, paddingTop: 60 }}>
            <Ionicons name="folder-open-outline" size={48} color={c.textMuted} />
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>
              {query || filter !== 'all' ? 'No matching documents' : 'No device documents yet'}
            </Text>
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 7, lineHeight: 20 }}>
              Import files from your phone to build a WPS-style document workspace in NendPlay.
            </Text>
            <TouchableOpacity
              onPress={importDocuments}
              style={{ marginTop: 16, backgroundColor: c.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Add Documents</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      <Modal visible={Boolean(preview)} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }}>
          <View style={{
            maxHeight: '78%',
            backgroundColor: c.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 18,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Ionicons name={getDocIcon(preview?.type)} size={24} color={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>
                  {preview?.name}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 3 }}>
                  {preview?.type?.toUpperCase()} | {formatSize(preview?.size)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreview(null)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {previewLoading ? (
              <ActivityIndicator color={c.primary} style={{ marginVertical: 40 }} />
            ) : sheetPreview.length ? (
              <ScrollView horizontal style={{ backgroundColor: c.bg, borderRadius: 14, maxHeight: 340 }}>
                <ScrollView>
                  {sheetPreview.map((row, rowIndex) => (
                    <View key={`row-${rowIndex}`} style={{ flexDirection: 'row' }}>
                      {row.map((cell, cellIndex) => (
                        <View
                          key={`${rowIndex}-${cellIndex}`}
                          style={{
                            width: 120,
                            minHeight: 42,
                            padding: 9,
                            borderRightWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: c.border,
                            backgroundColor: rowIndex === 0 ? c.surfaceHigh : c.bg,
                          }}>
                          <Text
                            style={{
                              color: c.text,
                              fontSize: 12,
                              fontWeight: rowIndex === 0 ? '900' : '600',
                            }}
                            numberOfLines={2}>
                            {cell || '-'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </ScrollView>
            ) : previewText ? (
              <ScrollView style={{ backgroundColor: c.bg, borderRadius: 14, padding: 12, maxHeight: 340 }}>
                <Text style={{ color: c.text, fontSize: 14, lineHeight: 22 }}>{previewText}</Text>
              </ScrollView>
            ) : (
              <View style={{ backgroundColor: c.bg, borderRadius: 16, padding: 18, alignItems: 'center' }}>
                <Ionicons name="eye-outline" size={34} color={c.textMuted} />
                <Text style={{ color: c.text, fontWeight: '900', marginTop: 10 }}>
                  Preview ready
                </Text>
                <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                  CSV and text files preview inside NendPlay. Excel workbooks open through WPS Office, Microsoft Excel, Google Sheets, or another compatible app installed on your phone.
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => preview && openDocument(preview)}
              style={{ marginTop: 14, backgroundColor: c.primary, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Open Document</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}
