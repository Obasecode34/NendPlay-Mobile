import { useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { areAdsEnabled, getAdUnit } from './adUnits'
import { getMobileAdsModule } from './mobileAds'
import useAuthStore from '../../services/authStore.native'
import { hasAdFreeAccess } from './adEntitlements'

export default function useAppOpenAd(enabled = true) {
  const loaded = useRef(false)
  const shownOnce = useRef(false)
  const appState = useRef(AppState.currentState)
  const { user } = useAuthStore()
  const ads = getMobileAdsModule()
  const appOpenAd = useMemo(() => {
    if (hasAdFreeAccess(user) || !areAdsEnabled() || !ads?.AppOpenAd) return null
    const unitId = getAdUnit('AppOpen')
    if (!unitId) return null
    try {
      return ads.AppOpenAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      })
    } catch {
      return null
    }
  }, [ads, user])

  useEffect(() => {
    if (!enabled || !appOpenAd || !ads?.AdEventType) return undefined

    const unsubscribeLoaded = appOpenAd.addAdEventListener(ads.AdEventType.LOADED, () => {
      loaded.current = true
      if (!shownOnce.current) {
        shownOnce.current = true
        appOpenAd.show()
      }
    })
    const unsubscribeClosed = appOpenAd.addAdEventListener(ads.AdEventType.CLOSED, () => {
      loaded.current = false
      appOpenAd.load()
    })

    appOpenAd.load()

    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToForeground = appState.current.match(/inactive|background/) && nextState === 'active'
      appState.current = nextState
      if (returnedToForeground && loaded.current) {
        appOpenAd.show()
      }
    })

    return () => {
      unsubscribeLoaded()
      unsubscribeClosed()
      subscription.remove()
    }
  }, [ads, appOpenAd, enabled])
}
