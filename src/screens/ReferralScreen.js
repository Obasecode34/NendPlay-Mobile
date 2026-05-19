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

export default function ReferralScreen({ navigation }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await referralService.getDashboard()
      setDashboard(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  const handleShare = async () => {
    const link = `https://nendplay.app/register?ref=${dashboard.referralCode}`
    try {
      await Share.share({
        message: `Join NendPlay with my referral code and get a free subscription! ${link}`,
        url: link,
      })
    } catch {}
  }

  const handleCopy = () => {
    const link = `https://nendplay.app/register?ref=${dashboard.referralCode}`
    Clipboard.setString(link)
    Alert.alert('Copied!', 'Referral link copied to clipboard')
  }

  const handleCheckReward = async () => {
    setChecking(true)
    try {
      const res = await referralService.checkReward()
      Alert.alert('Reward Check', res.data.message)
      fetchDashboard()
    } catch {} finally { setChecking(false) }
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  )

  if (!dashboard) return null

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
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Referrals</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Referral code card */}
        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            🎁 Your Referral Code
          </Text>
          <View style={{ backgroundColor: c.bgDeep, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: c.primary, fontSize: 18, fontWeight: '900', letterSpacing: 2 }}>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
            <View>
              <Text style={{ color: c.text, fontSize: 28, fontWeight: '900' }}>{dashboard.referralCount}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>Total referrals</Text>
            </View>
            {dashboard.nextTier && (
              <View style={{ flex: 1, marginLeft: 20 }}>
                <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 6 }}>
                  {dashboard.nextTier.referralsNeeded} more for {dashboard.nextTier.plan}
                </Text>
                <View style={{ height: 6, backgroundColor: c.surfaceHigh, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{
                    height: '100%', backgroundColor: c.primary, borderRadius: 3,
                    width: `${Math.min(90, (dashboard.referralCount / dashboard.nextTier.minReferrals) * 100 + 5)}%`,
                  }} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Active reward */}
        {dashboard.currentReward && (
          <View style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FBBF24', marginBottom: 16 }}>
            <Text style={{ color: '#FBBF24', fontSize: 15, fontWeight: '800' }}>
              🏆 Active Reward: {dashboard.currentReward.plan?.charAt(0).toUpperCase() + dashboard.currentReward.plan?.slice(1)}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>
              {dashboard.currentReward.daysRemaining} days remaining
            </Text>
          </View>
        )}

        {/* Tiers */}
        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 16 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Reward Tiers</Text>
          {dashboard.allTiers?.map((tier) => {
            const unlocked = dashboard.referralCount >= tier.minReferrals
            return (
              <View key={tier.id} style={{
                flexDirection: 'row', alignItems: 'center', padding: 12,
                borderRadius: 10, marginBottom: 8,
                backgroundColor: unlocked ? c.surfaceHigh : 'transparent',
                borderWidth: 1, borderColor: unlocked ? c.primary : c.border,
                opacity: unlocked ? 1 : 0.6,
              }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: unlocked ? c.primary : c.surfaceHigh, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {unlocked
                    ? <Ionicons name="checkmark" size={18} color="white" />
                    : <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{tier.minReferrals}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>
                    {tier.minReferrals} referrals
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {tier.plan?.charAt(0).toUpperCase() + tier.plan?.slice(1)} for {tier.durationDays} days
                  </Text>
                </View>
                {unlocked && <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>✓ Unlocked</Text>}
              </View>
            )
          })}

          <TouchableOpacity
            style={{ marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
            onPress={handleCheckReward} disabled={checking}>
            {checking
              ? <ActivityIndicator color={c.primary} size="small" />
              : <Text style={{ color: c.textMuted, fontSize: 13 }}>Check for rewards</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Referral history */}
        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            People You Referred ({dashboard.referrals?.length || 0})
          </Text>
          {dashboard.referrals?.length === 0 ? (
            <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 }}>
              No referrals yet. Share your link to get started!
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
                {ref.rewardGranted && <Text style={{ color: c.primary, fontSize: 11 }}>✓ Counted</Text>}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  )
}
