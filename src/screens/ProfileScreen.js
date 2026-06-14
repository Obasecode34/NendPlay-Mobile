// src/screens/ProfileScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch, Image, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import * as ImagePicker from 'expo-image-picker'
import useThemeStore, { } from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { authService, mediaService, notificationService, subscriptionService } from '../services/index'
import { getAllThemes } from '../theme/themes'

const PROFILE_PAGE_LIMIT = 20

export default function ProfileScreen({ navigation }) {
  const { theme, setTheme, activeThemeId } = useThemeStore()
  const { user, isAuthenticated, logout, updateUser } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState(user?.profileName || '')
  const [saving, setSaving] = useState(false)
  const [accountForm, setAccountForm] = useState({
    profileName: user?.profileName || '',
    email: user?.email || '',
    username: user?.username || '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [savedMedia, setSavedMedia] = useState([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savedPage, setSavedPage] = useState(1)
  const [savedHasMore, setSavedHasMore] = useState(false)
  const [savedLoadingMore, setSavedLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState('account')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [notificationModalVisible, setNotificationModalVisible] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const themes = getAllThemes()

  const PLAN_COLORS = {
    none: c.textMuted, mobile: '#60A5FA', basic: '#34D399',
    standard: '#A78BFA', premium: '#FBBF24',
  }

  useEffect(() => {
    if (isAuthenticated) fetchSubscription()
    else setLoading(false)
  }, [isAuthenticated])
  useEffect(() => {
    setAccountForm({
      profileName: user?.profileName || '',
      email: user?.email || '',
      username: user?.username || '',
    })
  }, [user?.profileName, user?.email, user?.username])
  useEffect(() => {
    if (activeTab === 'saved' && isAuthenticated) {
      fetchSavedMedia(1, false)
    }
  }, [activeTab, isAuthenticated])
  useEffect(() => {
    if (isAuthenticated) fetchNotifications(false)
  }, [isAuthenticated])

  const fetchSubscription = async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    try {
      const res = await subscriptionService.getMySubscription()
      setSubscription(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  const fetchSavedMedia = async (pageToLoad = 1, append = false) => {
    if (!isAuthenticated) return
    if (append) setSavedLoadingMore(true)
    else setSavedLoading(true)
    try {
      const res = await mediaService.getSaved({ page: pageToLoad, limit: PROFILE_PAGE_LIMIT })
      const nextMedia = res.data.data.media || []
      const pagination = res.data.data.pagination || {}
      setSavedMedia((current) => append ? [...current, ...nextMedia] : nextMedia)
      setSavedPage(pageToLoad)
      setSavedHasMore(pageToLoad < (pagination.pages || 1))
    } catch {} finally {
      setSavedLoading(false)
      setSavedLoadingMore(false)
    }
  }

  const loadMoreSavedMedia = () => {
    if (!isAuthenticated || activeTab !== 'saved' || savedLoading || savedLoadingMore || !savedHasMore) return
    fetchSavedMedia(savedPage + 1, true)
  }

  const fetchNotifications = async (showLoader = true) => {
    if (!isAuthenticated) return
    if (showLoader) setNotificationsLoading(true)
    try {
      const res = await notificationService.getMine({ page: 1, limit: 30 })
      const data = res.data?.data || {}
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread || 0)
    } catch (err) {
      if (showLoader) {
        Alert.alert('Notifications', err.response?.data?.message || 'Could not load notifications.')
      }
    } finally {
      setNotificationsLoading(false)
    }
  }

  const openNotifications = async () => {
    setNotificationModalVisible(true)
    fetchNotifications(true)
  }

  const handleNotificationPress = async (item) => {
    try {
      if (!item.isRead) {
        await notificationService.markRead(item._id)
        setNotifications((current) => current.map((entry) => (
          entry._id === item._id ? { ...entry, isRead: true } : entry
        )))
        setUnreadCount((count) => Math.max(count - 1, 0))
      }
      setNotificationModalVisible(false)
      const linkedType = item.contentType || item.data?.contentType
      const linkedId = item.contentId || item.data?.contentId || item.data?.newsId || item.data?.mediaId
      if (linkedType === 'news' && linkedId) {
        navigation.navigate('NewsDetail', { newsId: linkedId })
        return
      }
      if (linkedType === 'media' && linkedId) {
        navigation.navigate('MediaPlayer', { mediaId: linkedId })
        return
      }
      const screenMap = {
        Home: () => navigation.navigate('Home'),
        Shorts: () => navigation.navigate('Shorts'),
        NovelHub: () => navigation.navigate('NovelHub'),
        News: () => navigation.navigate('Home', { screen: 'DailyNews' }),
        Rewards: () => navigation.navigate('Rewards'),
        Subscription: () => navigation.navigate('Subscribe'),
        Downloads: () => navigation.navigate('Downloads'),
        Profile: () => navigation.navigate('Profile'),
      }
      const action = screenMap[item.screen]
      if (action) action()
    } catch {
      Alert.alert('Notifications', 'Could not open notification.')
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch {
      Alert.alert('Notifications', 'Could not mark notifications as read.')
    }
  }

  const handleSaveName = async () => {
    setSaving(true)
    try {
      const res = await authService.updateProfile({ profileName: newName })
      updateUser(res.data.data.user)
      setEditName(false)
      Alert.alert('Success', 'Profile updated!')
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  const handleSaveAccount = async () => {
    if (!accountForm.profileName.trim() && !accountForm.username.trim()) {
      Alert.alert('Profile required', 'Please enter a profile name or username.')
      return
    }

    const payload = {
      profileName: accountForm.profileName.trim(),
    }
    if (accountForm.email.trim()) payload.email = accountForm.email.trim()
    if (accountForm.username.trim()) payload.username = accountForm.username.trim()

    setSaving(true)
    try {
      const res = await authService.updateProfile(payload)
      updateUser(res.data.data.user)
      Alert.alert('Success', 'Account details updated.')
    } catch (err) {
      Alert.alert('Update Failed', err.response?.data?.message || 'Could not update account details.')
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      Alert.alert('Password Required', 'New password must be at least 6 characters.')
      return
    }
    if (user?.authMethod === 'credentials' && !passwordForm.currentPassword) {
      Alert.alert('Current Password Required', 'Please enter your current password.')
      return
    }
    setSaving(true)
    try {
      await authService.changePassword(passwordForm)
      await SecureStore.deleteItemAsync('nendplay_biometric_login')
      setPasswordForm({ currentPassword: '', newPassword: '' })
      Alert.alert('Password Updated', 'Please sign in again with your new password.', [
        { text: 'OK', onPress: async () => { await logout() } },
      ])
    } catch (err) {
      Alert.alert('Password Failed', err.response?.data?.message || 'Could not update password.')
    } finally { setSaving(false) }
  }

  const handleChangeProfilePicture = async () => {
    if (!isAuthenticated || avatarUploading) return

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          'Photo Access Needed',
          'Allow NendPlay to access your photos so you can choose a profile picture.'
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const rawExtension = asset.uri.split('.').pop()?.toLowerCase() || 'jpg'
      const extension = rawExtension === 'jpg' ? 'jpg' : rawExtension
      const mimeType = asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`
      const formData = new FormData()
      formData.append('profilePic', {
        uri: asset.uri,
        name: `profile.${extension}`,
        type: mimeType,
      })

      setAvatarUploading(true)
      const res = await authService.updateProfilePicture(formData)
      updateUser(res.data.data.user)
      Alert.alert('Updated', 'Profile picture updated successfully.')
    } catch (err) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Could not update profile picture.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout() } },
    ])
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingTop: insets.top + 8, paddingHorizontal: 16,
      paddingBottom: 16, backgroundColor: c.bgDeep,
      borderBottomWidth: 1, borderBottomColor: c.border,
      alignItems: 'center',
    },
    avatar: {
      width: 72, height: 72, borderRadius: 20,
      backgroundColor: c.primary, alignItems: 'center',
      justifyContent: 'center', marginBottom: 12,
      overflow: 'visible',
    },
    avatarImage: { width: 72, height: 72, borderRadius: 20 },
    avatarEditBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 2,
      borderColor: c.bgDeep,
    },
    avatarText: { color: 'white', fontSize: 30, fontWeight: '900' },
    headerActions: {
      position: 'absolute',
      top: insets.top + 10,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bellButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    name: { color: c.text, fontSize: 20, fontWeight: '800' },
    username: { color: c.textMuted, fontSize: 13 },
    planBadge: {
      paddingHorizontal: 12, paddingVertical: 4,
      borderRadius: 20, marginTop: 8,
    },
    planText: { fontSize: 12, fontWeight: '700' },
    tabs: { flexDirection: 'row', padding: 16, gap: 8 },
    tab: {
      flex: 1, paddingVertical: 9, borderRadius: 10,
      alignItems: 'center', borderWidth: 1,
    },
    tabText: { fontSize: 13, fontWeight: '600' },
    section: {
      backgroundColor: c.surface, borderRadius: 14,
      borderWidth: 1, borderColor: c.border,
      marginHorizontal: 16, marginBottom: 16, overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderBottomWidth: 1, borderBottomColor: c.border,
    },
    rowLast: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14,
    },
    rowLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    rowValue: { color: c.textMuted, fontSize: 13 },
    inputLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    input: {
      color: c.text,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      marginBottom: 12,
    },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    logoutBtn: {
      marginHorizontal: 16, padding: 14, borderRadius: 14,
      backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center', gap: 8,
      marginBottom: 30,
    },
    logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
    authBtn: {
      marginHorizontal: 16, padding: 14, borderRadius: 14,
      alignItems: 'center', flexDirection: 'row',
      justifyContent: 'center', gap: 8, marginBottom: 12,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      justifyContent: 'flex-end',
    },
    notificationSheet: {
      maxHeight: '82%',
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: insets.bottom + 18,
    },
    notificationCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      marginBottom: 10,
    },
    notificationImage: { width: 58, height: 58, borderRadius: 12, backgroundColor: c.bgDeep },
    notificationTitle: { color: c.text, fontSize: 14, fontWeight: '900', marginBottom: 4 },
    notificationBody: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    notificationDate: { color: c.textMuted, fontSize: 11, marginTop: 8 },
  })

  if (!isAuthenticated) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>G</Text>
          </View>
          <Text style={s.name}>Guest Profile</Text>
          <Text style={[s.username, { textAlign: 'center', marginTop: 6 }]}>
            Watch, read, and download without an account. Create an account only when you want to subscribe.
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
          <View style={s.section}>
            <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Subscribe')}>
              <Text style={s.rowLabel}>Subscription</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.rowValue}>Account required</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.rowLast} onPress={() => setActiveTab('themes')}>
              <Text style={s.rowLabel}>Theme</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          {activeTab === 'themes' && (
            <View style={[s.section, { padding: 14 }]}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '900', marginBottom: 12 }}>
                Choose Theme
              </Text>
              {themes.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTheme(t.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                  }}>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{t.name}</Text>
                  {activeThemeId === t.id && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[s.authBtn, { backgroundColor: c.primary }]}
            onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.authBtn, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}
            onPress={() => navigation.navigate('Register')}>
            <Ionicons name="person-add-outline" size={20} color={c.primary} />
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '900' }}>Create Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Profile header */}
      <View style={s.header}>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.bellButton} onPress={openNotifications}>
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={22} color={c.primary} />
            {unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={s.avatar}
          onPress={handleChangeProfilePicture}
          disabled={avatarUploading}
          activeOpacity={0.85}>
          {user?.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={s.avatarImage} />
          ) : (
            <Text style={s.avatarText}>
              {user?.profileName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
            </Text>
          )}
          <View style={s.avatarEditBadge}>
            {avatarUploading ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <Ionicons name="camera" size={15} color={c.primary} />
            )}
          </View>
        </TouchableOpacity>

        {editName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              style={{
                backgroundColor: c.surface, borderRadius: 8, padding: 8,
                color: c.text, fontSize: 16, minWidth: 160,
                borderWidth: 1, borderColor: c.border,
              }}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <TouchableOpacity onPress={handleSaveName} disabled={saving}
              style={{ backgroundColor: c.primary, padding: 8, borderRadius: 8 }}>
              {saving
                ? <ActivityIndicator color="white" size="small" />
                : <Ionicons name="checkmark" size={18} color="white" />
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditName(false)}>
              <Ionicons name="close" size={22} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.nameRow}>
            <Text style={s.name}>{user?.profileName || user?.username || 'User'}</Text>
            <TouchableOpacity onPress={() => { setNewName(user?.profileName || ''); setEditName(true) }}>
              <Ionicons name="pencil" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {user?.username && <Text style={s.username}>@{user.username}</Text>}
        {user?.email && <Text style={s.username}>{user.email}</Text>}

        {subscription?.isActive && (
          <View style={[s.planBadge, { backgroundColor: `${PLAN_COLORS[subscription.plan]}22` }]}>
            <Text style={[s.planText, { color: PLAN_COLORS[subscription.plan] }]}>
              {subscription.plan?.charAt(0).toUpperCase() + subscription.plan?.slice(1)} Plan
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {['account', 'saved', 'themes', 'about'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, {
              backgroundColor: activeTab === tab ? c.primary : c.surface,
              borderColor: activeTab === tab ? c.primary : c.border,
            }]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabText, { color: activeTab === tab ? 'white' : c.textMuted }]}> 
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        onMomentumScrollEnd={({ nativeEvent }) => {
          const nearBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 260
          if (nearBottom) loadMoreSavedMedia()
        }}>
        {activeTab === 'account' && (
          <>
            {/* Profile details */}
            <View style={[s.section, { padding: 14 }]}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '900', marginBottom: 14 }}>
                Edit Profile
              </Text>

              <Text style={s.inputLabel}>Display Name</Text>
              <TextInput
                style={s.input}
                value={accountForm.profileName}
                onChangeText={(profileName) => setAccountForm({ ...accountForm, profileName })}
                placeholder="Display name"
                placeholderTextColor={c.textMuted}
              />

              <Text style={s.inputLabel}>Email</Text>
              <TextInput
                style={s.input}
                value={accountForm.email}
                onChangeText={(email) => setAccountForm({ ...accountForm, email })}
                placeholder="Email address"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={s.inputLabel}>Username</Text>
              <TextInput
                style={s.input}
                value={accountForm.username}
                onChangeText={(username) => setAccountForm({ ...accountForm, username })}
                placeholder="Username"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
              />

              <TouchableOpacity style={s.primaryBtn} onPress={handleSaveAccount} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="save-outline" size={17} color="#FFFFFF" />}
                <Text style={s.primaryBtnText}>Save Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Security */}
            <View style={[s.section, { padding: 14 }]}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '900', marginBottom: 6 }}>
                Password
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
                {user?.authMethod === 'google'
                  ? 'Add a password so you can sign in with email or username and password.'
                  : 'Change your account password.'}
              </Text>

              {user?.authMethod === 'credentials' ? (
                <>
                  <Text style={s.inputLabel}>Current Password</Text>
                  <TextInput
                    style={s.input}
                    value={passwordForm.currentPassword}
                    onChangeText={(currentPassword) => setPasswordForm({ ...passwordForm, currentPassword })}
                    placeholder="Current password"
                    placeholderTextColor={c.textMuted}
                    secureTextEntry
                  />
                </>
              ) : null}

              <Text style={s.inputLabel}>New Password</Text>
              <TextInput
                style={s.input}
                value={passwordForm.newPassword}
                onChangeText={(newPassword) => setPasswordForm({ ...passwordForm, newPassword })}
                placeholder="New password"
                placeholderTextColor={c.textMuted}
                secureTextEntry
              />

              <TouchableOpacity style={s.primaryBtn} onPress={handleChangePassword} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="key-outline" size={17} color="#FFFFFF" />}
                <Text style={s.primaryBtnText}>{user?.authMethod === 'google' ? 'Add Password' : 'Change Password'}</Text>
              </TouchableOpacity>
            </View>

            {/* Subscription */}
            <View style={s.section}>
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Subscribe')}>
                <Text style={s.rowLabel}>Subscription</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.rowValue, subscription?.isActive && { color: PLAN_COLORS[subscription.plan] }]}>
                    {subscription?.isActive
                      ? subscription.plan?.charAt(0).toUpperCase() + subscription.plan?.slice(1)
                      : 'None'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Rewards')}>
                <Text style={s.rowLabel}>Reward Coins</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.rowValue}>{user?.rewardCoins || 0} coins</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Referrals')}>
                <Text style={s.rowLabel}>Referral Rewards</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={s.rowLast} onPress={() => navigation.navigate('Advertise')}>
                <Text style={s.rowLabel}>Advertise</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {/* About */}
            <View style={s.section}>
              {['How to Use', 'Privacy Policy', 'Terms of Service'].map((item, i, arr) => (
                <TouchableOpacity
                  key={item}
                  style={i === arr.length - 1 ? s.rowLast : s.row}>
                  <Text style={s.rowLabel}>{item}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={s.logoutText}>Logout</Text>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'saved' && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
              Saved videos
            </Text>
            {savedLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={c.primary} size="large" />
              </View>
            ) : savedMedia.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center' }}>
                  Your saved shorts and videos will appear here.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {savedMedia.map((media) => (
                  <TouchableOpacity
                    key={media._id}
                    style={[s.section, { padding: 14 }]}
                    onPress={() => {
                      if (media.type === 'short') {
                        navigation.navigate('Shorts', { openId: media._id })
                        return
                      }
                      navigation.navigate('Home', {
                        screen: 'MediaPlayer',
                        params: { mediaId: media._id },
                      })
                    }}>
                    <Text style={[s.rowLabel, { marginBottom: 6 }]} numberOfLines={1}>
                      {media.title}
                    </Text>
                    <Text style={s.rowValue} numberOfLines={1}>
                      {media.type?.replace('_', ' ')} · {media.duration ? `${Math.floor(media.duration / 60)}:${String(media.duration % 60).padStart(2, '0')}` : 'Unknown duration'}
                    </Text>
                  </TouchableOpacity>
                ))}
                {savedLoadingMore ? (
                  <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} />
                ) : savedHasMore ? (
                  <TouchableOpacity
                    onPress={loadMoreSavedMedia}
                    style={{
                      alignSelf: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.border,
                    }}>
                    <Text style={{ color: c.text, fontWeight: '900' }}>Load more</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        )}

        {activeTab === 'themes' && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: 16 }}>
              Choose your NendPlay theme
            </Text>
            {['Dark Themes', 'Light Themes'].map((group) => (
              <View key={group} style={{ marginBottom: 20 }}>
                <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700',
                  letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                  {group}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {themes
                    .filter(t => group === 'Dark Themes' ? t.isDark : !t.isDark)
                    .map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setTheme(t.id)}
                        style={{
                          width: '47%', padding: 14, borderRadius: 14,
                          backgroundColor: t.colors.bg,
                          borderWidth: 2,
                          borderColor: activeThemeId === t.id ? t.colors.primary : 'transparent',
                        }}>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                          {t.preview.map((color, i) => (
                            <View key={i} style={{
                              width: 18, height: 18, borderRadius: 9,
                              backgroundColor: color, borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.2)',
                            }} />
                          ))}
                        </View>
                        <Text style={{ color: t.colors.accent, fontSize: 13, fontWeight: '700' }}>
                          {t.name}
                        </Text>
                        <Text style={{ color: t.colors.textMuted, fontSize: 11 }}>
                          {t.isDark ? 'Dark' : 'Light'}
                        </Text>
                        {activeThemeId === t.id && (
                          <View style={{
                            position: 'absolute', top: 8, right: 8,
                            backgroundColor: t.colors.primary,
                            borderRadius: 10, padding: 2,
                          }}>
                            <Ionicons name="checkmark" size={12} color="white" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'about' && (
          <View style={{ padding: 16 }}>
            <View style={s.section}>
              {[
                { label: 'App Name', value: 'NendPlay' },
                { label: 'Version', value: '1.0.0' },
                { label: 'Platform', value: 'Mobile (React Native)' },
                { label: 'By', value: 'Impact Model Ltd' },
              ].map(({ label, value }, i, arr) => (
                <View key={label} style={i === arr.length - 1 ? s.rowLast : s.row}>
                  <Text style={s.rowLabel}>{label}</Text>
                  <Text style={s.rowValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={notificationModalVisible} transparent animationType="slide" onRequestClose={() => setNotificationModalVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.notificationSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '900' }}>Notifications</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{unreadCount} unread</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={markAllNotificationsRead} style={[s.bellButton, { width: 40, height: 40 }]}>
                  <Ionicons name="checkmark-done" size={19} color={c.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={[s.bellButton, { width: 40, height: 40 }]}>
                  <Ionicons name="close" size={20} color={c.text} />
                </TouchableOpacity>
              </View>
            </View>

            {notificationsLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={c.primary} size="large" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Ionicons name="notifications-off-outline" size={42} color={c.textMuted} />
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '900', marginTop: 12 }}>No notifications yet</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Admin updates will appear here.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.map((item) => (
                  <TouchableOpacity key={item._id} style={s.notificationCard} onPress={() => handleNotificationPress(item)}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={s.notificationImage} />
                    ) : (
                      <View style={[s.notificationImage, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="notifications" size={24} color={c.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        {!item.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}
                        <Text style={s.notificationTitle} numberOfLines={2}>{item.title}</Text>
                      </View>
                      <Text style={s.notificationBody} numberOfLines={3}>{item.body}</Text>
                      <Text style={s.notificationDate}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}
