import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { notificationService } from './index'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function getGuestPushId() {
  const storageKey = 'nendplay_push_guest_id'
  const existing = await SecureStore.getItemAsync(storageKey)
  if (existing) return existing

  const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
  await SecureStore.setItemAsync(storageKey, guestId)
  return guestId
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'NendPlay Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    })
  }

  const existingStatus = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus.status

  if (existingStatus.status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    finalStatus = requested.status
  }

  if (finalStatus !== 'granted') return null

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId

  if (!projectId) return null

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId })
  const token = tokenResult.data
  const guestId = await getGuestPushId()

  await notificationService.registerPushToken({
    token,
    guestId,
    platform: Platform.OS,
    deviceId: Device.osInternalBuildId || Device.deviceName || '',
  })

  return token
}
