// src/screens/AdvertiseScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Linking, Modal,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import useThemeStore from '../stores/themeStore'
import { adService } from '../services/index'

const AD_TYPES = [
  { value: 'banner', label: 'Banner' },
  { value: 'video', label: 'Video' },
  { value: 'overlay', label: 'Overlay' },
]

const PLACEMENTS = [
  { value: 'home', label: 'Home' },
  { value: 'media', label: 'Media' },
  { value: 'news', label: 'News' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'profile', label: 'Profile' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'live_event', label: 'Live Events' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'novels', label: 'NovelHub' },
  { value: 'all', label: 'Everywhere' },
]

const STATUS_COLORS = {
  pending_payment: '#F59E0B', pending_review: '#60A5FA',
  active: '#34D399', paused: '#94A3B8',
  expired: '#6B7280', rejected: '#EF4444',
}

export default function AdvertiseScreen({ navigation }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [myAds, setMyAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentGateway, setPaymentGateway] = useState('paystack')
  const [quote, setQuote] = useState(null)
  const [creativeAsset, setCreativeAsset] = useState(null)
  const [form, setForm] = useState({
    advertiserName: '', title: '', description: '',
    targetUrl: '', mediaUrl: '', adType: 'banner',
    placement: 'home', durationDays: 7, gateway: 'paystack',
  })

  useEffect(() => { fetchMyAds() }, [])

  useEffect(() => {
    if (form.adType && form.placement && form.durationDays) fetchQuote()
  }, [form.adType, form.placement, form.durationDays])

  const fetchMyAds = async () => {
    try {
      const res = await adService.getMyAds()
      setMyAds(res.data.data.ads)
    } catch {} finally { setLoading(false) }
  }

  const fetchQuote = async () => {
    try {
      const res = await adService.getPricing({
        adType: form.adType,
        placement: form.placement,
        durationDays: form.durationDays,
      })
      setQuote(res.data.data.quote)
    } catch {}
  }

  const pickCreative = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Allow photo library access to choose an ad creative.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.9,
    })
    if (result.canceled || !result.assets?.[0]) return
    setCreativeAsset(result.assets[0])
  }

  const handleSubmit = async () => {
    if (!form.advertiserName || !form.title) {
      Alert.alert('Error', 'Please fill in advertiser name and title')
      return
    }
    setSubmitting(true)
    try {
      let payload = form
      if (creativeAsset) {
        payload = new FormData()
        Object.entries(form).forEach(([key, value]) => payload.append(key, String(value ?? '')))
        const rawExtension = creativeAsset.uri.split('.').pop()?.toLowerCase() || 'jpg'
        const isVideo = creativeAsset.type === 'video' || creativeAsset.mimeType?.startsWith('video/')
        const extension = rawExtension.split('?')[0] || (isVideo ? 'mp4' : 'jpg')
        payload.append('creative', {
          uri: creativeAsset.uri,
          name: `ad-creative.${extension}`,
          type: creativeAsset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        })
      }
      const res = await adService.submit(payload)
      const { paymentUrl, transactionRef } = res.data.data
      setPaymentRef(transactionRef)
      setPaymentGateway(form.gateway)
      Alert.alert(
        'Ad Submitted!',
        'Complete payment, then return here to verify. Paid ads go through review before serving.',
        [
          { text: 'Pay Now', onPress: () => Linking.openURL(paymentUrl) },
          { text: 'Later', style: 'cancel' },
        ]
      )
      setShowForm(false)
      fetchMyAds()
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  const verifyPayment = async () => {
    if (!paymentRef) {
      Alert.alert('Reference Required', 'Submit an ad payment first.')
      return
    }
    setVerifying(true)
    try {
      const res = await adService.verify({ transactionRef: paymentRef, gateway: paymentGateway })
      Alert.alert('Payment Verified', res.data.message || 'Your ad is pending review.')
      setPaymentRef('')
      fetchMyAds()
    } catch (err) {
      Alert.alert('Verification Failed', err.response?.data?.message || 'Could not verify payment.')
    } finally {
      setVerifying(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      const res = await adService.toggle(id)
      Alert.alert('Updated', res.data.message)
      fetchMyAds()
    } catch { Alert.alert('Error', 'Failed to update ad') }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12,
        backgroundColor: c.bgDeep, borderBottomWidth: 1, borderBottomColor: c.border,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={c.text} />
          </TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Advertise</Text>
        </View>
        <TouchableOpacity onPress={() => setShowForm(true)}
          style={{ backgroundColor: c.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="add" size={16} color="white" />
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>Create Ad</Text>
        </TouchableOpacity>
      </View>

      {paymentRef ? (
        <View style={{
          margin: 16,
          marginBottom: 0,
          backgroundColor: c.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
        }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>Payment verification pending</Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>Reference: {paymentRef}</Text>
          <TouchableOpacity
            onPress={verifyPayment}
            disabled={verifying}
            style={{ marginTop: 10, backgroundColor: c.primary, padding: 11, borderRadius: 10, alignItems: 'center' }}>
            {verifying
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={{ color: 'white', fontWeight: '800' }}>I have paid</Text>
            }
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.primary} size="large" />
        </View>
      ) : myAds.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Ionicons name="megaphone-outline" size={48} color={c.textMuted} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>No ads yet</Text>
          <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center' }}>
            Create your first ad to reach millions of NendPlay users
          </Text>
          <TouchableOpacity style={{ backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 }}
            onPress={() => setShowForm(true)}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Create Ad</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {myAds.map((ad) => (
            <View key={ad._id} style={{
              backgroundColor: c.surface, borderRadius: 14, padding: 14,
              borderWidth: 1, borderColor: c.border, marginBottom: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {ad.title}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                    {ad.adType} · {ad.placement}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                  backgroundColor: `${STATUS_COLORS[ad.status]}22`,
                }}>
                  <Text style={{ color: STATUS_COLORS[ad.status], fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                    {ad.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>👁 {ad.impressions}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>🖱 {ad.clicks}</Text>
                {ad.expiryDate && (
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    Expires {new Date(ad.expiryDate).toLocaleDateString()}
                  </Text>
                )}
              </View>

              {['active', 'paused'].includes(ad.status) && (
                <TouchableOpacity
                  style={{ marginTop: 10, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
                  onPress={() => handleToggle(ad._id)}>
                  <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>
                    {ad.status === 'active' ? '⏸ Pause Ad' : '▶ Resume Ad'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create ad modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{
            backgroundColor: c.surface, borderTopLeftRadius: 24,
            borderTopRightRadius: 24, padding: 24, maxHeight: '90%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>Create Ad</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'advertiserName', placeholder: 'Advertiser name *' },
                { key: 'title', placeholder: 'Ad title *' },
                { key: 'description', placeholder: 'Description' },
                { key: 'targetUrl', placeholder: 'Target URL' },
                { key: 'mediaUrl', placeholder: 'Ad media URL' },
              ].map(({ key, placeholder }) => (
                <TextInput key={key}
                  style={{
                    backgroundColor: c.surfaceHigh, borderRadius: 10, padding: 12,
                    color: c.text, fontSize: 14, marginBottom: 10,
                    borderWidth: 1, borderColor: c.border,
                  }}
                  placeholder={placeholder} placeholderTextColor={c.textMuted}
                  value={form[key]}
                  onChangeText={(v) => setForm({ ...form, [key]: v })} />
              ))}

              <TouchableOpacity
                onPress={pickCreative}
                style={{
                  backgroundColor: c.surfaceHigh,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  marginBottom: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                <Ionicons name="image-outline" size={18} color={c.textMuted} />
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700', flex: 1 }}>
                  {creativeAsset ? (creativeAsset.fileName || 'Creative selected') : 'Choose image or video creative'}
                </Text>
              </TouchableOpacity>

              {/* Ad type */}
              <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>Ad Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {AD_TYPES.map(({ value, label }) => (
                  <TouchableOpacity key={value} onPress={() => setForm({ ...form, adType: value })}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                      backgroundColor: form.adType === value ? c.primary : c.surfaceHigh,
                    }}>
                    <Text style={{ color: form.adType === value ? 'white' : c.textMuted, fontSize: 12, fontWeight: '600' }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Placement */}
              <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>Placement</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {PLACEMENTS.map(({ value, label }) => (
                  <TouchableOpacity key={value} onPress={() => setForm({ ...form, placement: value })}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: form.placement === value ? c.primary : c.surfaceHigh,
                    }}>
                    <Text style={{ color: form.placement === value ? 'white' : c.textMuted, fontSize: 12 }}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Duration */}
              <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 6, fontWeight: '600' }}>
                Duration: {form.durationDays} days
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[1, 3, 7, 14, 30].map((d) => (
                  <TouchableOpacity key={d} onPress={() => setForm({ ...form, durationDays: d })}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                      backgroundColor: form.durationDays === d ? c.primary : c.surfaceHigh,
                    }}>
                    <Text style={{ color: form.durationDays === d ? 'white' : c.textMuted, fontSize: 12 }}>
                      {d}d
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price quote */}
              {quote && (
                <View style={{ backgroundColor: c.surfaceHigh, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <Text style={{ color: c.primary, fontSize: 16, fontWeight: '800' }}>
                    Total: ₦{quote.totalNaira?.toLocaleString()}
                  </Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                    {quote.breakdown}
                  </Text>
                </View>
              )}

              {/* Gateway */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {['paystack', 'flutterwave'].map((gw) => (
                  <TouchableOpacity key={gw} onPress={() => setForm({ ...form, gateway: gw })}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                      backgroundColor: form.gateway === gw ? c.primary : c.surfaceHigh,
                    }}>
                    <Text style={{ color: form.gateway === gw ? 'white' : c.textMuted, fontSize: 13, textTransform: 'capitalize' }}>
                      {gw}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
                  onPress={() => setShowForm(false)}>
                  <Text style={{ color: c.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center' }}
                  onPress={handleSubmit} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="white" size="small" />
                    : <Text style={{ color: 'white', fontWeight: '700' }}>Submit & Pay</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}
