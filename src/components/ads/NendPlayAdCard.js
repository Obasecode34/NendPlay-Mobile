import React, { useEffect, useState } from 'react'
import { Image, Linking, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import useAuthStore from '../../services/authStore.native'
import { adService } from '../../services'
import useThemeStore from '../../stores/themeStore'
import { hasAdFreeAccess } from './adEntitlements'

const getExpoExtra = () => (
  Constants.expoConfig?.extra ||
  Constants.manifest?.extra ||
  Constants.manifest2?.extra?.expoClient?.extra ||
  {}
)

const withTimeout = (promise, ms = 5000) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('ad request timed out')), ms)),
])

function AdVideoCreative({ uri, backgroundColor }) {
  const [muted, setMuted] = useState(true)
  const player = useVideoPlayer({ uri }, (player) => {
    player.loop = true
    player.muted = muted
  })

  useEffect(() => {
    player.play()
    return () => player.pause()
  }, [player])

  useEffect(() => {
    player.muted = muted
  }, [muted, player])

  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor }}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        style={{ width: '100%', height: '100%', backgroundColor }}
      />
      <Pressable
        onPress={() => setMuted((value) => !value)}
        hitSlop={10}
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  )
}

function AdCreative({ ad, backgroundColor }) {
  const isVideo = ad?.adType === 'video' || /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(ad?.mediaUrl || '')

  if (!ad?.mediaUrl) return null
  if (isVideo) return <AdVideoCreative uri={ad.mediaUrl} backgroundColor={backgroundColor} />
  return (
    <Image
      source={{ uri: ad.mediaUrl }}
      style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor }}
      resizeMode="contain"
    />
  )
}

export default function NendPlayAdCard({ placement = 'home', style }) {
  const { user } = useAuthStore()
  const { theme } = useThemeStore()
  const c = theme.colors
  const [ad, setAd] = useState(null)
  const [loading, setLoading] = useState(true)
  const showHouseAds = getExpoExtra().nendPlayHouseAdsEnabled !== false

  useEffect(() => {
    if (hasAdFreeAccess(user)) {
      setLoading(false)
      setAd(null)
      return undefined
    }

    let cancelled = false

    const loadAd = async () => {
      try {
        const res = await withTimeout(adService.serve({ placement, limit: 1 }))
        const nextAd = res.data?.data?.nativeAds?.[0]
        if (!cancelled) setAd(nextAd || null)
        if (nextAd?._id) adService.recordImpression(nextAd._id).catch(() => {})
      } catch {
        if (!cancelled) setAd(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAd()
    const interval = setInterval(loadAd, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [placement, user?.adFreeUntil, user?.isSubscriptionActive, user?.subscriptionExpiry, user?.subscriptionPlan])

  const openAd = async () => {
    if (!ad?._id) return
    try {
      const res = await adService.recordClick(ad._id)
      const targetUrl = res.data?.data?.targetUrl || ad.targetUrl
      if (targetUrl) Linking.openURL(targetUrl)
    } catch {
      if (ad.targetUrl) Linking.openURL(ad.targetUrl)
    }
  }

  if (hasAdFreeAccess(user) || loading) return null

  if (!ad) {
    if (!showHouseAds) return null
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => Linking.openURL('https://nendplay.com/advertise').catch(() => {})}
        style={[{
          marginHorizontal: 16,
          marginBottom: 18,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          padding: 14,
        }, style]}
      >
        <Text style={{
          alignSelf: 'flex-start',
          color: c.primary,
          backgroundColor: c.surfaceHigh,
          borderRadius: 8,
          overflow: 'hidden',
          paddingHorizontal: 8,
          paddingVertical: 3,
          fontSize: 10,
          fontWeight: '900',
          marginBottom: 8,
        }}>
          SPONSORED
        </Text>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }}>
          Advertise on NendPlay
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
          Reach movie, music, news, and NovelHub audiences across web and mobile.
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={openAd}
      style={[{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }, style]}
    >
      <AdCreative ad={ad} backgroundColor={c.surfaceHigh} />
      <View style={{ padding: 14 }}>
        <Text style={{
          alignSelf: 'flex-start',
          color: c.primary,
          backgroundColor: c.surfaceHigh,
          borderRadius: 8,
          overflow: 'hidden',
          paddingHorizontal: 8,
          paddingVertical: 3,
          fontSize: 10,
          fontWeight: '900',
          marginBottom: 8,
        }}>
          SPONSORED
        </Text>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }} numberOfLines={2}>
          {ad.title}
        </Text>
        {ad.description ? (
          <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 }} numberOfLines={3}>
            {ad.description}
          </Text>
        ) : null}
        {ad.advertiserName ? (
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', marginTop: 10 }} numberOfLines={1}>
            {ad.advertiserName}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}
