import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DEVICE_TABS } from '../utils/mediaUtils'

export function DeviceHeader({ theme, insets, navigation, activeTab, onTabChange }) {
  const c = theme.colors
  const s = StyleSheet.create({
    header: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 14,
      backgroundColor: c.bgDeep,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },
    title: { flex: 1, color: c.text, fontSize: 20, fontWeight: '900' },
    sub: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
    tabs: {
      flexDirection: 'row',
      alignSelf: 'center',
      marginTop: 14,
      padding: 4,
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    tab: {
      minWidth: 118,
      paddingVertical: 10,
      borderRadius: 20,
      alignItems: 'center',
    },
    tabText: { fontSize: 14, fontWeight: '900' },
  })

  return (
    <View style={s.header}>
      <View style={s.row}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>NendPlay Device</Text>
          <Text style={s.sub}>Local library, streaming links, future AI detection ready</Text>
        </View>
      </View>
      <View style={s.tabs}>
        {[
          { key: DEVICE_TABS.VIDEOS, label: 'Videos', icon: 'videocam' },
          { key: DEVICE_TABS.MUSIC, label: 'Music', icon: 'musical-notes' },
        ].map((tab) => {
          const active = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, active && { backgroundColor: c.primary }]}
              onPress={() => onTabChange(tab.key)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={tab.icon} size={16} color={active ? '#FFFFFF' : c.textMuted} />
                <Text style={[s.tabText, { color: active ? '#FFFFFF' : c.textMuted }]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

export function PermissionState({ theme, onRequest }) {
  const c = theme.colors
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Ionicons name="phone-portrait-outline" size={48} color={c.primary} />
      <Text style={{ color: c.text, fontSize: 19, fontWeight: '900', marginTop: 14 }}>
        Allow phone videos and music
      </Text>
      <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
        NendPlay reads media files already on this phone so you can watch and play them locally. Nothing is uploaded.
      </Text>
      <TouchableOpacity
        onPress={onRequest}
        style={{ backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 18 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Read Device Media</Text>
      </TouchableOpacity>
    </View>
  )
}

export function LoadingSkeleton({ theme, label = 'Scanning device media...' }) {
  const c = theme.colors
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: c.textMuted, fontWeight: '800', marginBottom: 14 }}>{label}</Text>
      {[0, 1, 2, 3, 4].map((item) => (
        <View
          key={item}
          style={{
            height: 72,
            borderRadius: 14,
            backgroundColor: c.surface,
            marginBottom: 12,
            opacity: 0.55 + item * 0.08,
          }}
        />
      ))}
    </View>
  )
}

export function EmptyState({ theme, icon, title, body }) {
  const c = theme.colors
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <Ionicons name={icon} size={44} color={c.textMuted} />
      <Text style={{ color: c.text, fontWeight: '900', marginTop: 10 }}>{title}</Text>
      <Text style={{ color: c.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
        {body}
      </Text>
    </View>
  )
}
