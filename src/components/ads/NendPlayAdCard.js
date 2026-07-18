import React, { useEffect, useState } from 'react'
import { Image, Linking, Pressable, Share, Text, TouchableOpacity, View } from 'react-native'
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
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor }}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor }}
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
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', backgroundColor }}
      resizeMode="cover"
    />
  )
}

export default function NendPlayAdCard({ placement = 'home', style, variant = 'default' }) {
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

  const shareAd = async (adData) => {
    const shareUrl = adData?.targetUrl || 'https://nendplay.com/advertise'
    try {
      await Share.share({
        title: adData?.title || 'Advertise on NendPlay',
        message: `${adData?.title || 'Advertise on NendPlay'}\n${shareUrl}`,
        url: shareUrl,
      })
    } catch {}
  }

  const renderShortsAd = (adData) => {
    const isFallback = !adData
    const displayAd = adData || {
      title: 'Advertise on NendPlay',
      advertiserName: 'NendPlay Ads',
      description: 'Reach movie, music, news, and NovelHub audiences across web and mobile.',
      targetUrl: 'https://nendplay.com/advertise',
    }
    const advertiser = displayAd.advertiserName || 'NendPlay Partner'
    const cta = displayAd.cta || displayAd.callToAction || 'Learn More'
    const handleOpen = isFallback
      ? () => Linking.openURL(displayAd.targetUrl).catch(() => {})
      : openAd

    return (
      <View style={[{
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#05050F',
      }, style]}>
        <Pressable onPress={handleOpen} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 }} />
        {displayAd.mediaUrl ? (
          <AdCreative ad={displayAd} backgroundColor="#05050F" />
        ) : (
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#07111F' }} />
        )}
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.18)' }} />

        <View style={{ position: 'absolute', left: 18, top: 18, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.primary, fontWeight: '900', fontSize: 17 }}>NPL</Text>
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>Sponsored</Text>
        </View>

        <View style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 72,
          zIndex: 3,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.22)',
          backgroundColor: 'rgba(255,255,255,0.18)',
          padding: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#111827', borderWidth: 2, borderColor: 'rgba(255,255,255,0.48)', alignItems: 'center', justifyContent: 'center' }}>
              {displayAd.logoUrl ? (
                <Image source={{ uri: displayAd.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ color: '#F6C85F', fontSize: 24, fontWeight: '900' }}>N</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900' }} numberOfLines={1}>
                {advertiser} <Ionicons name="checkmark-circle" size={17} color="#3B82F6" />
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 6 }} numberOfLines={1}>
                {displayAd.title}
              </Text>
              {displayAd.description ? (
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: 21, marginTop: 7 }} numberOfLines={2}>
                  {displayAd.description}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={handleOpen}
            style={{ marginTop: 18, borderRadius: 18, backgroundColor: '#F6C85F', paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#090909', fontSize: 19, fontWeight: '900' }}>{cta}</Text>
          </Pressable>
        </View>

        <Ionicons name="bookmark-outline" size={36} color="#FFFFFF" style={{ position: 'absolute', left: 20, bottom: 18, zIndex: 3 }} />
        <Pressable onPress={() => shareAd(displayAd)} hitSlop={10} style={{ position: 'absolute', right: 20, bottom: 18, zIndex: 4 }}>
          <Ionicons name="share-social-outline" size={36} color="#FFFFFF" />
        </Pressable>
      </View>
    )
  }

  if (hasAdFreeAccess(user) || loading) return null

  if (!ad) {
    if (!showHouseAds) return null
    if (variant === 'shorts') return renderShortsAd(null)
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => Linking.openURL('https://nendplay.com/advertise').catch(() => {})}
        style={[{
          marginHorizontal: 16,
          marginBottom: 18,
          borderRadius: 26,
          overflow: 'hidden',
          backgroundColor: '#081122',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          aspectRatio: 16 / 9,
          minHeight: 220,
        }, style]}
      >
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0B1020' }} />
        <View style={{ position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: c.primary, fontWeight: '900', fontSize: 15 }}>NPL</Text>
          </View>
          <View style={{ borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>Sponsored</Text>
          </View>
        </View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.46)', padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#111827', borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#F6C85F', fontSize: 22, fontWeight: '900' }}>N</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>NendPlay Ads <Ionicons name="checkmark-circle" size={16} color="#3B82F6" /></Text>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 3 }} numberOfLines={1}>Advertise on NendPlay</Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, marginTop: 4 }} numberOfLines={2}>
                Reach movie, music, news, and NovelHub audiences across web and mobile.
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Ionicons name="bookmark-outline" size={27} color="#FFFFFF" />
            <View style={{ borderRadius: 16, backgroundColor: '#F6C85F', paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#090909', fontSize: 15, fontWeight: '900' }}>Learn More</Text>
              <Ionicons name="chevron-forward" size={20} color="#090909" />
            </View>
            <Pressable onPress={() => shareAd({ title: 'Advertise on NendPlay', targetUrl: 'https://nendplay.com/advertise' })} hitSlop={10}>
              <Ionicons name="share-social-outline" size={27} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (variant === 'shorts') return renderShortsAd(ad)

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={openAd}
      style={[{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 26,
        overflow: 'hidden',
        backgroundColor: '#05050F',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        aspectRatio: 16 / 9,
        minHeight: 230,
      }, style]}
    >
      <AdCreative ad={ad} backgroundColor={c.surfaceHigh} />
      <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.20)' }} />
      <View style={{ position: 'absolute', left: 14, right: 14, top: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.primary, fontWeight: '900', fontSize: 15 }}>NPL</Text>
        </View>
        <View style={{ borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>Sponsored</Text>
        </View>
      </View>

      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.48)', padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: '#111827', borderWidth: 2, borderColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' }}>
            {ad.logoUrl ? (
              <Image source={{ uri: ad.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: '#F6C85F', fontSize: 22, fontWeight: '900' }}>N</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>
              {ad.advertiserName || 'NendPlay Partner'} <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 3 }} numberOfLines={1}>
              {ad.title}
            </Text>
            {ad.description ? (
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, marginTop: 4 }} numberOfLines={2}>
                {ad.description}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Ionicons name="bookmark-outline" size={27} color="#FFFFFF" />
          <View style={{ borderRadius: 16, backgroundColor: '#F6C85F', paddingHorizontal: 20, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#090909', fontSize: 15, fontWeight: '900' }}>{ad.cta || ad.callToAction || 'Learn More'}</Text>
            <Ionicons name="chevron-forward" size={20} color="#090909" />
          </View>
          <Pressable onPress={() => shareAd(ad)} hitSlop={10}>
            <Ionicons name="share-social-outline" size={27} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </TouchableOpacity>
  )
}
