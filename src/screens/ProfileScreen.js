// src/screens/ProfileScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore, { } from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { authService, subscriptionService } from '../services/index'
import { getAllThemes } from '../theme/themes'

export default function ProfileScreen({ navigation }) {
  const { theme, setTheme, activeThemeId } = useThemeStore()
  const { user, logout, updateUser } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState(user?.profileName || '')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('account')
  const themes = getAllThemes()

  const PLAN_COLORS = {
    none: c.textMuted, mobile: '#60A5FA', basic: '#34D399',
    standard: '#A78BFA', premium: '#FBBF24',
  }

  useEffect(() => { fetchSubscription() }, [])

  const fetchSubscription = async () => {
    try {
      const res = await subscriptionService.getMySubscription()
      setSubscription(res.data.data)
    } catch {} finally { setLoading(false) }
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
    },
    avatarText: { color: 'white', fontSize: 30, fontWeight: '900' },
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
    logoutBtn: {
      marginHorizontal: 16, padding: 14, borderRadius: 14,
      backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center',
      flexDirection: 'row', justifyContent: 'center', gap: 8,
      marginBottom: 30,
    },
    logoutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  })

  return (
    <View style={s.container}>
      {/* Profile header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {user?.profileName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
          </Text>
        </View>

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
        {['account', 'themes', 'about'].map((tab) => (
          <TouchableOpacity
            key={tab} style={[s.tab, {
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

      <ScrollView>
        {activeTab === 'account' && (
          <>
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
              <TouchableOpacity style={s.row} onPress={() => navigation.navigate('Referrals')}>
                <Text style={s.rowLabel}>Referrals & Rewards</Text>
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
    </View>
  )
}
