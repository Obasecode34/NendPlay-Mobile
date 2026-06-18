// src/screens/SubscriptionScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { subscriptionService } from '../services/index'
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

const PLAN_COLORS = {
  mobile: '#60A5FA', basic: '#34D399', standard: '#A78BFA', premium: '#FBBF24',
}
const PLAN_ICONS = { mobile: '📱', basic: '💻', standard: '⭐', premium: '👑' }

export default function SubscriptionScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { user, isAuthenticated } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [plans, setPlans] = useState([])
  const [currentSub, setCurrentSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(null)
  const [gateway, setGateway] = useState('paystack')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const plansPromise = subscriptionService.getPlans()
      const subPromise = isAuthenticated
        ? subscriptionService.getMySubscription()
        : Promise.resolve({ data: { data: null } })
      const [plansRes, subRes] = await Promise.all([plansPromise, subPromise])
      setPlans(plansRes.data.data.plans)
      setCurrentSub(subRes.data.data)
    } catch {} finally { setLoading(false) }
  }

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      Alert.alert('Account Required', 'Create an account or sign in before subscribing to a package.', [
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        { text: 'Create Account', onPress: () => navigation.navigate('Register') },
        { text: 'Cancel', style: 'cancel' },
      ])
      return
    }
    if (!user?.email) {
      Alert.alert('Email Required', 'Please add an email to your profile first')
      return
    }
    setSubscribing(planId)
    try {
      const res = await subscriptionService.initialize({ planId, gateway })
      const { paymentUrl, transactionRef } = res.data.data
      await Linking.openURL(paymentUrl)
      Alert.alert(
        'Complete Payment',
        'After paying, come back and enter your transaction reference to activate.',
        [{ text: 'OK' }]
      )
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to initialize payment')
    } finally { setSubscribing(null) }
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} size="large" />
    </View>
  )

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
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Choose Plan</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <AdBanner style={{ marginHorizontal: 0 }} horizontalPadding={64} />
        <NendPlayAdCard placement="subscription" style={{ marginHorizontal: 0 }} />
        <NativeAdvancedAd style={{ marginHorizontal: 0 }} />

        {/* Gateway */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <Text style={{ color: c.textMuted, fontSize: 13, alignSelf: 'center' }}>Pay with:</Text>
          {['paystack', 'flutterwave'].map((gw) => (
            <TouchableOpacity key={gw} onPress={() => setGateway(gw)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: gateway === gw ? c.primary : c.surface,
                borderWidth: 1, borderColor: gateway === gw ? c.primary : c.border,
              }}>
              <Text style={{ color: gateway === gw ? 'white' : c.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                {gw}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {plans.map((plan) => {
          const isActive = currentSub?.plan === plan.id && currentSub?.isActive
          const color = PLAN_COLORS[plan.id]
          return (
            <View key={plan.id} style={{
              backgroundColor: c.surface, borderRadius: 16, padding: 16,
              borderWidth: isActive ? 2 : 1,
              borderColor: isActive ? color : c.border, marginBottom: 14,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 28 }}>{PLAN_ICONS[plan.id]}</Text>
                  <Text style={{ color, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{plan.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: c.text, fontSize: 24, fontWeight: '900' }}>
                    ₦{plan.monthlyPriceNaira?.toLocaleString()}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>/month</Text>
                </View>
              </View>

              {[
                `${plan.maxConcurrentStreams} simultaneous stream${plan.maxConcurrentStreams > 1 ? 's' : ''}`,
                `${plan.maxDownloadDevices} download device${plan.maxDownloadDevices > 1 ? 's' : ''}`,
                'Ad-free experience',
                'Live events included',
              ].map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color={color} />
                  <Text style={{ color: c.textMuted, fontSize: 13 }}>{f}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={{
                  marginTop: 12, padding: 13, borderRadius: 12, alignItems: 'center',
                  backgroundColor: isActive ? `${color}22` : color,
                }}
                onPress={() => !isActive && handleSubscribe(plan.id)}
                disabled={subscribing === plan.id || isActive}>
                {subscribing === plan.id
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={{ color: isActive ? color : 'white', fontWeight: '800', fontSize: 15 }}>
                      {isActive ? '✓ Current Plan' : 'Subscribe'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
