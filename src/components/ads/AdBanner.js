import React, { useMemo, useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { areAdsEnabled, getAdUnit } from './adUnits'
import { getMobileAdsModule } from './mobileAds'
import useAuthStore from '../../services/authStore.native'
import { hasAdFreeAccess } from './adEntitlements'

export default function AdBanner({ style, horizontalPadding = 32, onLoaded, onFailedToLoad }) {
  const { width } = useWindowDimensions()
  const { user } = useAuthStore()
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const ads = getMobileAdsModule()
  const BannerAd = ads?.BannerAd
  const BannerAdSize = ads?.BannerAdSize
  const bannerWidth = useMemo(
    () => Math.max(280, Math.floor(width - horizontalPadding)),
    [horizontalPadding, width]
  )

  if (hasAdFreeAccess(user) || !areAdsEnabled() || !BannerAd || !BannerAdSize || failed) return null

  return (
    <View style={[{
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: loaded ? undefined : 1,
      marginVertical: loaded ? 10 : 0,
      opacity: loaded ? 1 : 0,
    }, style]}>
      <BannerAd
        unitId={getAdUnit('Banner')}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={bannerWidth}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={(dimensions) => {
          setLoaded(true)
          onLoaded?.(dimensions)
        }}
        onAdFailedToLoad={(error) => {
          setFailed(true)
          onFailedToLoad?.(error)
        }}
      />
    </View>
  )
}
