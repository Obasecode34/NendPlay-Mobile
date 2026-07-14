// src/screens/ReferralScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Clipboard,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import { referralService } from '../services/index'
import AdBanner from '../components/ads/AdBanner'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

export default function ReferralScreen({ navigation }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await referralService.getDashboard()
      setDashboard(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  const getReferralLink = () => `https://nendplay.app/register?ref=${dashboard.referralCode}`

  const handleShare = async () => {
    const reward = dashboard.rewardPerReferral || 100
    const link = getReferralLink()
    try {
      await Share.share({
        message: `Join NendPlay with my referral code. I earn ${reward} coins after a successful referral: ${link}`,
        url: link,
      })
    } catch {}
  }

  const handleCopy = () => {
    Clipboard.setString(getReferralLink())
    Alert.alert('Copied', 'Referral link copied to clipboard.')
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  )

  if (!dashboard) return null

  const rewardPerReferral = dashboard.rewardPerReferral || 100

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12,
        backgroundColor: c.bgDeep, borderBottomWidth: 1, borderBottomColor: c.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={c.text} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Referral Rewards</Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Earn {rewardPerReferral} coins per successful referral</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            Your Referral Link
          </Text>
          <View style={{ backgroundColor: c.bgDeep, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: c.primary, fontSize: 16, fontWeight: '900', letterSpacing: 1, flex: 1 }} numberOfLines={1}>
              {dashboard.referralCode}
            </Text>
            <TouchableOpacity onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color={c.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={handleCopy} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: c.surfaceHigh, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <MetricCard label="Referrals" value={dashboard.referralCount || 0} colors={c} />
          <MetricCard label="Per Referral" value={rewardPerReferral} suffix="coins" colors={c} />
          <MetricCard label="Balance" value={dashboard.coinBalance || 0} suffix="coins" colors={c} />
        </View>

        <AdBanner style={{ marginBottom: 12 }} horizontalPadding={48} />
        <NendPlayAdCard placement="profile" style={{ marginBottom: 16 }} />

        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            People You Referred ({dashboard.referrals?.length || 0})
          </Text>
          {dashboard.referrals?.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
              No referrals yet. Share your link to start earning coins.
            </Text>
          ) : (
            dashboard.referrals.map((ref) => (
              <View key={ref.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ color: 'white', fontWeight: '900' }}>
                    {ref.referredUser?.profileName?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                    {ref.referredUser?.profileName || ref.referredUser?.username || 'User'}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 11 }}>
                    {new Date(ref.joinedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={{ color: '#FBBF24', fontSize: 12, fontWeight: '800' }}>
                  +{ref.coinsEarned || rewardPerReferral}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  )
}

function MetricCard({ label, value, suffix, colors }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }} numberOfLines={2}>
        {label}{suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  )
}
