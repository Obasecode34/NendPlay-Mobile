import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import * as FileSystem from 'expo-file-system'
import useThemeStore from '../stores/themeStore'

function getExtension(value = '') {
  const clean = String(value).split('?')[0].split('#')[0]
  const match = clean.match(/\.([a-z0-9]{2,6})$/i)
  return match?.[1]?.toLowerCase() || ''
}

export default function DocumentReaderScreen({ route, navigation }) {
  const { document = {} } = route.params || {}
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const [loading, setLoading] = useState(true)
  const [html, setHtml] = useState('')
  const [plainText, setPlainText] = useState('')
  const [error, setError] = useState('')
  const localUri = document.localUri || document.storageKey || document.fileUrl
  const title = document.title || 'Downloaded document'
  const mimeType = document.mimeType || ''
  const extension = getExtension(localUri || title)
  const isText = ['txt', 'csv', 'md', 'json'].includes(extension) || mimeType.startsWith('text/')
  const isLocalFile = String(localUri || '').startsWith(FileSystem.documentDirectory)

  useEffect(() => {
    loadDocument()
  }, [localUri])

  const loadDocument = async () => {
    setLoading(true)
    setError('')
    try {
      if (!localUri) throw new Error('No readable document file was found.')
      const info = isLocalFile ? await FileSystem.getInfoAsync(localUri) : { exists: true }
      if (!info.exists && isLocalFile) {
        throw new Error('This offline document file is missing from the device.')
      }

      if (isText) {
        const text = isLocalFile
          ? await FileSystem.readAsStringAsync(localUri)
          : await fetch(localUri).then((res) => {
              if (!res.ok) throw new Error(`Document request failed with status ${res.status}.`)
              return res.text()
            })
        setPlainText(text)
        return
      }

      const base64 = isLocalFile
        ? await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 })
        : ''
      const source = base64
        ? `data:${mimeType || 'application/pdf'};base64,${base64}`
        : localUri
      setHtml(`
        <!doctype html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              html, body { margin: 0; height: 100%; background: #111; color: #fff; font-family: sans-serif; }
              iframe, object, embed { border: 0; width: 100%; height: 100%; }
              .fallback { padding: 24px; line-height: 1.5; }
            </style>
          </head>
          <body>
            <object data="${source}" type="${mimeType || 'application/pdf'}">
              <iframe src="${source}"></iframe>
              <div class="fallback">This document is saved offline, but this device WebView cannot preview this file type.</div>
            </object>
          </body>
        </html>
      `)
    } catch (err) {
      setError(err.message || 'Unable to open this document.')
    } finally {
      setLoading(false)
    }
  }

  const source = useMemo(() => ({ html, baseUrl: FileSystem.documentDirectory }), [html])

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 14,
      paddingBottom: 12,
      backgroundColor: c.bgDeep,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, color: c.text, fontSize: 16, fontWeight: '900' },
    badge: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorTitle: { color: c.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
    errorText: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
    textPage: { padding: 18, paddingBottom: 40 },
    textContent: { color: c.text, fontSize: 15, lineHeight: 24 },
  })

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <Text style={s.badge}>Read-only</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="document-text-outline" size={44} color={c.textMuted} />
          <Text style={s.errorTitle}>Document saved offline</Text>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : plainText ? (
        <ScrollView contentContainerStyle={s.textPage}>
          <Text selectable style={s.textContent}>{plainText}</Text>
        </ScrollView>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={source}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          startInLoadingState
          onError={() => Alert.alert('Reader', 'This document could not be previewed in the in-app reader.')}
        />
      )}
    </View>
  )
}
