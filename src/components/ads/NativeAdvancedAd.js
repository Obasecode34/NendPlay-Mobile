import React, { useEffect, useState } from 'react'
import { Image, Text, TouchableOpacity, View } from 'react-native'
import useThemeStore from '../../stores/themeStore'
import { areAdsEnabled, getAdUnit } from './adUnits'
import { getMobileAdsModule } from './mobileAds'
import useAuthStore from '../../services/authStore.native'
import { hasAdFreeAccess } from './adEntitlements'

export default function NativeAdvancedAd({ style }) {
  const { theme } = useThemeStore()
  const { user } = useAuthStore()
  const c = theme.colors
  const [nativeAd, setNativeAd] = useState(null)
  const [failed, setFailed] = useState(false)
  const ads = getMobileAdsModule()
  const NativeAd = ads?.NativeAd
  const NativeAdView = ads?.NativeAdView
  const NativeAsset = ads?.NativeAsset
  const NativeAssetType = ads?.NativeAssetType
  const NativeMediaView = ads?.NativeMediaView
  const unitId = getAdUnit('Native')

  useEffect(() => {
    if (hasAdFreeAccess(user) || !areAdsEnabled() || !NativeAd || !unitId) return undefined

    let mounted = true
    let loadedAd = null
    setFailed(false)
    const timeout = setTimeout(() => {
      if (mounted && !loadedAd) setFailed(true)
    }, 8000)
    try {
      NativeAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      })
        .then((ad) => {
          loadedAd = ad
          clearTimeout(timeout)
          if (mounted) setNativeAd(ad)
        })
        .catch(() => {
          clearTimeout(timeout)
          if (mounted) setFailed(true)
        })
    } catch {
      clearTimeout(timeout)
      if (mounted) setFailed(true)
    }

    return () => {
      mounted = false
      clearTimeout(timeout)
      loadedAd?.destroy?.()
    }
  }, [NativeAd, unitId])

  if (hasAdFreeAccess(user) || !areAdsEnabled() || !unitId || !NativeAdView || !NativeAsset || !NativeAssetType || !NativeMediaView) return null
  if (failed) return null

  if (!nativeAd) {
    return (
      <View style={[{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 16,
        padding: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }, style]}>
        <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800' }}>Native ad loading</Text>
      </View>
    )
  }

  return (
    <NativeAdView
      nativeAd={nativeAd}
      style={[{
        marginHorizontal: 16,
        marginBottom: 18,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }, style]}>
      <NativeMediaView style={{ width: '100%', height: 160, backgroundColor: c.surfaceHigh }} resizeMode="cover" />
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
          AD
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={{ width: 44, height: 44, borderRadius: 10 }} />
            </NativeAsset>
          ) : null}
          <View style={{ flex: 1 }}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '900' }} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 10 }} numberOfLines={3}>
            {nativeAd.body}
          </Text>
        </NativeAsset>
        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <TouchableOpacity style={{
              marginTop: 12,
              backgroundColor: c.primary,
              borderRadius: 12,
              alignItems: 'center',
              paddingVertical: 11,
            }}>
              <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '900' }}>
                {nativeAd.callToAction}
              </Text>
            </TouchableOpacity>
          </NativeAsset>
        ) : null}
      </View>
    </NativeAdView>
  )
}
