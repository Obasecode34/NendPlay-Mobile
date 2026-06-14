let cachedModule
let checked = false
let initializationPromise = null

export function getMobileAdsModule() {
  if (checked) return cachedModule
  checked = true

  try {
    cachedModule = require('react-native-google-mobile-ads')
  } catch {
    cachedModule = null
  }

  return cachedModule
}

export function hasMobileAdsModule() {
  return Boolean(getMobileAdsModule())
}

export function initializeMobileAds() {
  const ads = getMobileAdsModule()
  const mobileAds = ads?.default || ads

  if (!mobileAds || typeof mobileAds !== 'function') {
    return Promise.resolve(false)
  }

  if (!initializationPromise) {
    initializationPromise = Promise.resolve()
      .then(() => mobileAds().initialize())
      .then(() => true)
      .catch(() => false)
  }

  return initializationPromise
}
