export function hasAdFreeAccess(user) {
  if (!user) return false
  if (user.isSubscriptionActive) return true
  if (user.subscriptionPlan && user.subscriptionPlan !== 'none' && user.subscriptionExpiry) {
    return new Date(user.subscriptionExpiry) > new Date()
  }
  if (user.adFreeUntil) return new Date(user.adFreeUntil) > new Date()
  return false
}
