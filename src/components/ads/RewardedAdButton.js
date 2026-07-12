import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import useThemeStore from '../../stores/themeStore'
import { areAdsEnabled, areRewardedInterstitialsEnabled, areSsvRewardsEnabled, getAdUnit, shouldUseTestAds } from './adUnits'
import { getMobileAdsModule } from './mobileAds'
import useAuthStore from '../../services/authStore.native'

export default function RewardedAdButton({
  rewardDescription,
  label,
  onReward,
  adKind = 'Rewarded',
  style,
}) {
  const { theme } = useThemeStore()
  const { user } = useAuthStore()
  const c = theme.colors
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const ads = getMobileAdsModule()
  const userId = user?.id || user?._id
  const rewardedAd = useMemo(() => {
    const useRewardedInterstitial = adKind === 'RewardedInterstitial'
    if (useRewardedInterstitial && !areRewardedInterstitialsEnabled()) return null
    const AdClass = useRewardedInterstitial ? ads?.RewardedInterstitialAd : ads?.RewardedAd
    if (!AdClass) return null
    const unitId = getAdUnit(useRewardedInterstitial ? 'RewardedInterstitial' : 'Rewarded')
    if (!unitId) return null
    const useServerSideVerification = areSsvRewardsEnabled() && !shouldUseTestAds()
    try {
      return AdClass.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
        serverSideVerificationOptions: useServerSideVerification && userId ? {
          userId: String(userId),
          customData: useRewardedInterstitial ? 'nendplay_rewarded_interstitial_ad' : 'nendplay_rewarded_ad',
        } : undefined,
      })
    } catch {
      return null
    }
  }, [adKind, ads, userId])

  useEffect(() => {
    if (!rewardedAd || !ads?.RewardedAdEventType || !ads?.AdEventType) {
      setLoading(false)
      return undefined
    }

    const unsubscribeLoaded = rewardedAd.addAdEventListener(ads.RewardedAdEventType.LOADED, () => {
      setLoaded(true)
      setLoading(false)
    })
    const unsubscribeClosed = rewardedAd.addAdEventListener(ads.AdEventType.CLOSED, () => {
      setLoaded(false)
      setLoading(true)
      rewardedAd.load()
    })
    const unsubscribeReward = rewardedAd.addAdEventListener(ads.RewardedAdEventType.EARNED_REWARD, (reward) => {
      const shouldGrantClientReward = shouldUseTestAds() || !areSsvRewardsEnabled()
      if (shouldGrantClientReward) onReward?.(reward)
    })

    rewardedAd.load()

    return () => {
      unsubscribeLoaded()
      unsubscribeClosed()
      unsubscribeReward()
    }
  }, [ads, rewardedAd, onReward])

  if (!user || !areAdsEnabled() || !rewardedAd || !rewardDescription || typeof onReward !== 'function') return null

  const buttonLabel = label || `Watch ad to receive ${rewardDescription}`
  const adTitle = adKind === 'RewardedInterstitial' ? 'Rewarded interstitial ad' : 'Rewarded ad'
  const showRewardedAd = () => {
    if (!loaded) return
    Alert.alert(
      adTitle,
      `Watch this optional ad to receive ${rewardDescription}. This reward is granted by NendPlay, has no cash value, is not transferable, and can only be used inside NendPlay. You can cancel now and continue using NendPlay normally.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Watch Ad', onPress: () => rewardedAd.show() },
      ]
    )
  }

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={!loaded || loading}
      onPress={showRewardedAd}
      style={[{
        marginHorizontal: 16,
        marginBottom: 18,
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 16,
        backgroundColor: loaded ? c.surface : c.surfaceHigh,
        borderWidth: 1,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }, style]}>
      {loading ? (
        <ActivityIndicator color={c.primary} size="small" />
      ) : (
        <Ionicons name="gift-outline" size={18} color={c.primary} />
      )}
      <Text style={{ color: loaded ? c.text : c.textMuted, fontSize: 13, fontWeight: '900' }}>
        {loading ? `Preparing ${adTitle}` : buttonLabel}
      </Text>
    </TouchableOpacity>
  )
}
