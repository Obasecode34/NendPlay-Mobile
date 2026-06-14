// App.js
import { registerRootComponent } from 'expo'
import React, { useEffect } from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { AppState, View, ActivityIndicator, Modal, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import AsyncStorage from '@react-native-async-storage/async-storage'
import './src/utils/compactUiScale'
import useAuthStore from './src/services/authStore.native'
import useThemeStore from './src/stores/themeStore'
import AppNavigator from './src/navigation/AppNavigator'
import { registerForPushNotificationsAsync } from './src/services/pushNotifications'
import useAppOpenAd from './src/components/ads/useAppOpenAd'
import { initializeMobileAds } from './src/components/ads/mobileAds'
import { notificationService } from './src/services/index'

const navigationRef = createNavigationContainerRef()
const DISMISSED_POPUPS_KEY = 'nendplay-dismissed-popups'

function openNotificationTarget(data = {}) {
  if (!navigationRef.isReady()) return
  const contentType = data.contentType || ''
  const contentId = data.contentId || data.newsId || data.mediaId || ''

  if (contentType === 'news' && contentId) {
    navigationRef.navigate('NewsDetail', { newsId: contentId })
    return
  }

  if (contentType === 'media' && contentId) {
    navigationRef.navigate('MediaPlayer', { mediaId: contentId })
    return
  }

  if (data.screen === 'News') {
    navigationRef.navigate('MainTabs', { screen: 'Home', params: { screen: 'DailyNews' } })
  } else if (data.screen === 'Rewards') {
    navigationRef.navigate('Rewards')
  } else if (data.screen === 'Subscription') {
    navigationRef.navigate('Subscribe')
  } else if (data.screen === 'Downloads') {
    navigationRef.navigate('MainTabs', { screen: 'Downloads' })
  }
}

export default function App() {
  const { isAuthenticated, isLoading, initAuth } = useAuthStore()
  const { theme, loadTheme } = useThemeStore()
  const [adsReady, setAdsReady] = React.useState(false)
  const [popupNotice, setPopupNotice] = React.useState(null)
  const c = theme.colors
  useAppOpenAd(adsReady && !isLoading)

  useEffect(() => {
    const init = async () => {
      initializeMobileAds().then(setAdsReady)
      await loadTheme()
      await initAuth()
    }
    init()
  }, [])

  useEffect(() => {
    if (isLoading) return
    registerForPushNotificationsAsync().catch(() => {})
  }, [isLoading])

  useEffect(() => {
    if (!isAuthenticated) return
    registerForPushNotificationsAsync().catch(() => {})
  }, [isAuthenticated])

  useEffect(() => {
    if (isLoading) return undefined
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        registerForPushNotificationsAsync().catch(() => {})
        loadPublicPopups().catch(() => {})
      }
    })
    return () => subscription.remove()
  }, [isLoading])

  const getDismissedPopups = async () => {
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_POPUPS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  const dismissPopupNotice = async () => {
    if (popupNotice?._id) {
      const dismissed = await getDismissedPopups()
      const next = [...new Set([...dismissed, popupNotice._id])].slice(-100)
      await AsyncStorage.setItem(DISMISSED_POPUPS_KEY, JSON.stringify(next))
    }
    setPopupNotice(null)
  }

  const loadPublicPopups = async () => {
    const res = await notificationService.getPublicPopups({ limit: 5 })
    const notices = res.data?.data?.notifications || []
    const dismissed = await getDismissedPopups()
    const nextNotice = notices.find((item) => !dismissed.includes(item._id))
    if (nextNotice) setPopupNotice((current) => current || nextNotice)
  }

  useEffect(() => {
    if (isLoading) return undefined
    loadPublicPopups().catch(() => {})
    const id = setInterval(() => loadPublicPopups().catch(() => {}), 60000)
    return () => clearInterval(id)
  }, [isLoading])

  const openPopupNotice = async () => {
    if (!popupNotice) return
    const item = popupNotice
    await dismissPopupNotice()
    openNotificationTarget({
      screen: item.screen,
      contentType: item.contentType || item.data?.contentType,
      contentId: item.contentId || item.data?.contentId,
      newsId: item.data?.newsId,
      mediaId: item.data?.mediaId,
    })
  }

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openNotificationTarget(response.notification.request.content.data || {})
    })
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openNotificationTarget(response.notification.request.content.data || {})
      })
      .catch(() => {})
    return () => subscription.remove()
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={c.bgDeep} />
        <AppNavigator />
        <Modal visible={Boolean(popupNotice)} transparent animationType="fade" onRequestClose={dismissPopupNotice}>
          <View style={styles.popupBackdrop}>
            <View style={[styles.popupCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              {popupNotice?.imageUrl ? (
                <Image source={{ uri: popupNotice.imageUrl }} style={styles.popupImage} resizeMode="cover" />
              ) : null}
              <View style={styles.popupBody}>
                <Text style={[styles.popupEyebrow, { color: c.primary }]}>NendPlay Update</Text>
                <Text style={[styles.popupTitle, { color: c.text }]}>{popupNotice?.title}</Text>
                <Text style={[styles.popupText, { color: c.textMuted }]}>{popupNotice?.body}</Text>
                <View style={styles.popupActions}>
                  <TouchableOpacity
                    onPress={dismissPopupNotice}
                    style={[styles.popupButton, { backgroundColor: c.surfaceHigh }]}
                  >
                    <Text style={[styles.popupButtonText, { color: c.textMuted }]}>Later</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={openPopupNotice}
                    style={[styles.popupButton, { backgroundColor: c.primary }]}
                  >
                    <Text style={[styles.popupButtonText, { color: '#fff' }]}>Open</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  popupImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  popupBody: {
    padding: 18,
  },
  popupEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  popupTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  popupText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  popupActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  popupButton: {
    minWidth: 92,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  popupButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
})

registerRootComponent(App)
