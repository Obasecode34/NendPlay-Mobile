import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { rewardService } from '../services/index'
import RewardedAdButton from '../components/ads/RewardedAdButton'

const GOLD = '#F5C542'
const GOLD_DARK = '#7A5A00'

const DEFAULT_REWARDS = [
  { id: 'adfree_1d', label: 'Ad-free for 1 day', coins: 5, kind: 'ad_free', days: 1 },
  { id: 'adfree_7d', label: 'Ad-free for 7 days', coins: 15, kind: 'ad_free', days: 7 },
  { id: 'adfree_30d', label: 'Ad-free for 30 days', coins: 45, kind: 'ad_free', days: 30 },
  { id: 'plan_mobile', label: 'Mobile plan', coins: 50, kind: 'plan', plan: 'mobile', days: 30 },
  { id: 'plan_basic', label: 'Basic plan', coins: 60, kind: 'plan', plan: 'basic', days: 30 },
  { id: 'plan_standard', label: 'Standard plan', coins: 70, kind: 'plan', plan: 'standard', days: 30 },
  { id: 'plan_premium', label: 'Premium plan', coins: 80, kind: 'plan', plan: 'premium', days: 30 },
]

const EARN_TASKS = [
  {
    id: 'short_ad',
    title: 'Watch Short Video AD',
    subtitle: 'Quick rewarded ad',
    coins: 1,
    icon: 'play-circle-outline',
  },
  {
    id: 'premium_ad',
    title: 'Watch Premium Video AD',
    subtitle: 'Higher value rewarded ad',
    coins: 2,
    icon: 'diamond-outline',
  },
  {
    id: 'rewarded_interstitial_ad',
    title: 'Watch Rewarded Interstitial AD',
    subtitle: 'Full-screen rewarded ad',
    coins: 2,
    icon: 'phone-portrait-outline',
    adKind: 'RewardedInterstitial',
  },
]

function formatDate(date) {
  if (!date) return null
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function RewardCard({ reward, coins, onRedeem, redeeming }) {
  const unlocked = coins >= reward.coins
  const title = reward.kind === 'ad_free'
    ? `${reward.days} ${reward.days === 1 ? 'day' : 'days'}`
    : `${reward.plan?.charAt(0).toUpperCase()}${reward.plan?.slice(1)}`

  return (
    <View style={styles.rewardCard}>
      <Text style={styles.rewardTitle}>{title}</Text>
      <View style={styles.coinRow}>
        <Ionicons name="star" size={20} color={GOLD} />
        <Text style={styles.rewardCoins}>{reward.coins}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={!unlocked || redeeming}
        onPress={() => onRedeem(reward)}
        style={[styles.redeemBtn, !unlocked && styles.redeemBtnDisabled]}>
        {redeeming ? (
          <ActivityIndicator color="#0F0F10" size="small" />
        ) : (
          <Text style={[styles.redeemText, !unlocked && styles.redeemTextDisabled]}>
            {unlocked ? 'Redeem' : `${reward.coins - coins} left`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

export default function RewardsScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { user, isAuthenticated, updateUser } = useAuthStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [redeemingId, setRedeemingId] = useState(null)
  const [paidDays, setPaidDays] = useState(1)
  const [gateway, setGateway] = useState('paystack')
  const [paymentRef, setPaymentRef] = useState(null)
  const [paying, setPaying] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)

  const coins = status?.coins ?? user?.rewardCoins ?? 0
  const pricePerDay = status?.paidAdFree?.pricePerDayNaira || 99
  const paidTotal = paidDays * pricePerDay
  const rewards = status?.rewards?.length ? status.rewards : DEFAULT_REWARDS
  const adFreeRewards = rewards.filter((item) => item.kind === 'ad_free')
  const planRewards = rewards.filter((item) => item.kind === 'plan')
  const nextReward = useMemo(
    () => rewards.find((item) => coins < item.coins),
    [coins, rewards]
  )

  const syncUserFromStatus = useCallback((nextStatus) => {
    if (!nextStatus) return
    updateUser({
      rewardCoins: nextStatus.coins,
      adFreeUntil: nextStatus.adFreeUntil,
      isAdFreeActive: nextStatus.isAdFreeActive,
      subscriptionPlan: nextStatus.subscriptionPlan,
      subscriptionExpiry: nextStatus.subscriptionExpiry,
      isSubscriptionActive: Boolean(
        nextStatus.subscriptionPlan &&
        nextStatus.subscriptionPlan !== 'none' &&
        nextStatus.subscriptionExpiry &&
        new Date(nextStatus.subscriptionExpiry) > new Date()
      ),
    })
  }, [updateUser])

  const loadStatus = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    try {
      const res = await rewardService.getStatus()
      setStatus(res.data.data)
      syncUserFromStatus(res.data.data)
    } catch (err) {
      Alert.alert('Rewards unavailable', err.response?.data?.message || 'Could not load reward balance.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAuthenticated, syncUserFromStatus])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleRefresh = () => {
    setRefreshing(true)
    loadStatus(true)
  }

  const handleEarn = async (task) => {
    try {
      const res = await rewardService.earnFromAd({
        coins: task.coins,
        source: task.id,
      })
      const nextStatus = res.data.data
      setStatus(nextStatus)
      syncUserFromStatus(nextStatus)
      Alert.alert('Coins added', `You earned ${task.coins} reward coin${task.coins > 1 ? 's' : ''}.`)
    } catch (err) {
      Alert.alert('Reward failed', err.response?.data?.message || 'Could not add your reward coins.')
    }
  }

  const handleRedeem = (reward) => {
    Alert.alert(
      'Redeem reward',
      `Use ${reward.coins} coins for ${reward.label}? You can also keep watching ads to earn more coins.`,
      [
        { text: 'Keep earning', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setRedeemingId(reward.id)
            try {
              const res = await rewardService.redeem({ rewardId: reward.id })
              const nextStatus = res.data.data
              setStatus(nextStatus)
              syncUserFromStatus(nextStatus)
              Alert.alert('Reward redeemed', `${reward.label} is now active.`)
            } catch (err) {
              Alert.alert('Redeem failed', err.response?.data?.message || 'Could not redeem this reward.')
            } finally {
              setRedeemingId(null)
            }
          },
        },
      ]
    )
  }

  const handleBuyAdFree = async () => {
    if (!user?.email) {
      Alert.alert('Email required', 'Please add an email address to your profile before buying ad-free days.')
      return
    }
    setPaying(true)
    try {
      const res = await rewardService.initializePaidAdFree({ days: paidDays, gateway })
      const data = res.data.data
      setPaymentRef(data.transactionRef)
      await Linking.openURL(data.paymentUrl)
      Alert.alert(
        'Complete Payment',
        `After paying ₦${data.amountNaira.toLocaleString()}, return here and tap "I have paid". Your reference is ${data.transactionRef}.`
      )
    } catch (err) {
      Alert.alert('Payment failed', err.response?.data?.message || 'Could not start ad-free payment.')
    } finally {
      setPaying(false)
    }
  }

  const handleVerifyPaidAdFree = async () => {
    if (!paymentRef) return
    setVerifyingPayment(true)
    try {
      const res = await rewardService.verifyPaidAdFree({ transactionRef: paymentRef, gateway })
      const nextStatus = res.data.data.status
      setStatus(nextStatus)
      syncUserFromStatus(nextStatus)
      setPaymentRef(null)
      Alert.alert('Ad-free activated', `Your ad-free package is active until ${formatDate(nextStatus.adFreeUntil)}.`)
    } catch (err) {
      Alert.alert('Not verified yet', err.response?.data?.message || 'Payment has not been confirmed yet. Try again after payment is complete.')
    } finally {
      setVerifyingPayment(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#101010' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rewards</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.guestCard}>
          <Ionicons name="star" size={34} color={GOLD} />
          <Text style={styles.guestTitle}>Sign in to earn coins</Text>
          <Text style={styles.guestCopy}>
            Reward coins are saved to your account so your ad-free days and free plans stay with you.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.primaryText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.secondaryText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, backgroundColor: '#101010' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get points and get ad free</Text>
        <View style={styles.coinPill}>
          <Ionicons name="star" size={18} color={GOLD} />
          <Text style={styles.coinPillText}>{coins}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={GOLD} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GOLD} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.profileName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.profileName || user?.username || 'NendPlay user'}</Text>
              <Text style={styles.profileSub}>
                {status?.isAdFreeActive
                  ? `Ad-free active until ${formatDate(status.adFreeUntil)}`
                  : nextReward
                    ? `${nextReward.coins - coins} more coins to unlock ${nextReward.label}`
                    : 'All rewards are unlocked. Choose one to redeem.'}
              </Text>
            </View>
          </View>

          <View style={styles.policyNotice}>
            <Ionicons name="information-circle-outline" size={18} color={GOLD} />
            <Text style={styles.policyNoticeText}>
              Reward coins are optional NendPlay rewards. They have no cash value, cannot be transferred, and are only used for NendPlay ad-free access or plans.
            </Text>
          </View>

          <View style={styles.paidPanel}>
            <Text style={styles.paidTitle}>Buy ad-free days</Text>
            <Text style={styles.paidCopy}>
              No ads, no coins needed. Pick your days and pay ₦{pricePerDay.toLocaleString()} per day.
            </Text>
            <View style={styles.dayPicker}>
              <TouchableOpacity
                style={styles.dayBtn}
                onPress={() => setPaidDays((value) => Math.max(1, value - 1))}>
                <Ionicons name="remove" size={20} color="#111111" />
              </TouchableOpacity>
              <View style={styles.dayCount}>
                <Text style={styles.dayNumber}>{paidDays}</Text>
                <Text style={styles.dayLabel}>{paidDays === 1 ? 'day' : 'days'}</Text>
              </View>
              <TouchableOpacity
                style={styles.dayBtn}
                onPress={() => setPaidDays((value) => Math.min(365, value + 1))}>
                <Ionicons name="add" size={20} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={styles.gatewayRow}>
              {['paystack', 'flutterwave'].map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setGateway(item)}
                  style={[styles.gatewayChip, gateway === item && styles.gatewayChipActive]}>
                  <Text style={[styles.gatewayText, gateway === item && styles.gatewayTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₦{paidTotal.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              disabled={paying}
              onPress={handleBuyAdFree}
              style={styles.buyBtn}>
              {paying ? <ActivityIndicator color="#111111" size="small" /> : <Text style={styles.buyText}>Pay for ad-free</Text>}
            </TouchableOpacity>
            {paymentRef ? (
              <TouchableOpacity
                disabled={verifyingPayment}
                onPress={handleVerifyPaidAdFree}
                style={styles.verifyBtn}>
                {verifyingPayment ? <ActivityIndicator color={GOLD} size="small" /> : <Text style={styles.verifyText}>I have paid. Activate ad-free</Text>}
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.benefitPanel}>
            <Text style={styles.sectionGold}>Get your Premium benefits</Text>
            <View style={styles.benefitRow}>
              {[
                ['ban-outline', 'No ads'],
                ['phone-portrait-outline', 'Mobile access'],
                ['download-outline', 'Downloads'],
              ].map(([icon, label]) => (
                <View key={label} style={styles.benefitItem}>
                  <Ionicons name={icon} size={28} color={GOLD} />
                  <Text style={styles.benefitText}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.rewardGrid}>
              {adFreeRewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  coins={coins}
                  redeeming={redeemingId === reward.id}
                  onRedeem={handleRedeem}
                />
              ))}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionGold}>Redeem free plans</Text>
            <Text style={styles.muted}>30 days each</Text>
          </View>
          <View style={styles.planGrid}>
            {planRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                coins={coins}
                redeeming={redeemingId === reward.id}
                onRedeem={handleRedeem}
              />
            ))}
          </View>

          <View style={styles.sectionBanner}>
            <Text style={styles.sectionGold}>Complete tasks to get points</Text>
          </View>

          <View style={styles.taskList}>
            {EARN_TASKS.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskIcon}>
                  <Ionicons name={task.icon} size={26} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskSub}>{task.subtitle}</Text>
                  <View style={styles.taskCoinRow}>
                    <Ionicons name="star" size={16} color={GOLD} />
                    <Text style={styles.taskCoinText}>+{task.coins}</Text>
                  </View>
                </View>
                <RewardedAdButton
                  rewardDescription={`${task.coins} reward coin${task.coins > 1 ? 's' : ''}`}
                  label="Watch"
                  adKind={task.adKind || 'Rewarded'}
                  onReward={() => handleEarn(task)}
                  style={styles.watchBtn}
                />
              </View>
            ))}
          </View>

          {status?.history?.length ? (
            <>
              <Text style={styles.historyTitle}>Recent activity</Text>
              <View style={styles.historyList}>
                {status.history.slice(0, 6).map((item) => (
                  <View key={item._id} style={styles.historyRow}>
                    <View>
                      <Text style={styles.historyLabel}>
                        {item.type === 'earn' ? 'Coins earned' : 'Reward redeemed'}
                      </Text>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.historyCoins, item.coins < 0 && { color: '#EF4444' }]}>
                      {item.coins > 0 ? `+${item.coins}` : item.coins}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center' },
  coinPill: {
    minWidth: 70,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(245,197,66,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coinPillText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileRow: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#111111', fontSize: 20, fontWeight: '900' },
  profileName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  profileSub: { color: '#B8B8B8', fontSize: 12, marginTop: 3, lineHeight: 17 },
  policyNotice: {
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(245,197,66,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.22)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  policyNoticeText: { color: '#D9D0AF', flex: 1, fontSize: 12, lineHeight: 17 },
  paidPanel: {
    marginHorizontal: 18,
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#1D1E22',
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.28)',
  },
  paidTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  paidCopy: { color: '#B8B8B8', fontSize: 13, lineHeight: 19, marginTop: 5 },
  dayPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 },
  dayBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  dayCount: { minWidth: 110, alignItems: 'center' },
  dayNumber: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
  dayLabel: { color: '#B8B8B8', fontSize: 12, fontWeight: '800' },
  gatewayRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  gatewayChip: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: '#2B2B2B', borderWidth: 1, borderColor: '#3A3A3A' },
  gatewayChipActive: { backgroundColor: 'rgba(245,197,66,0.18)', borderColor: GOLD },
  gatewayText: { color: '#A8A8A8', fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  gatewayTextActive: { color: GOLD },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  totalLabel: { color: '#A8A8A8', fontSize: 14, fontWeight: '800' },
  totalValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  buyBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  buyText: { color: '#111111', fontSize: 15, fontWeight: '900' },
  verifyBtn: { backgroundColor: '#101010', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: 'rgba(245,197,66,0.45)' },
  verifyText: { color: GOLD, fontSize: 14, fontWeight: '900' },
  benefitPanel: {
    marginHorizontal: 0,
    paddingTop: 22,
    paddingHorizontal: 28,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(245,197,66,0.36)',
    backgroundColor: '#050505',
  },
  sectionGold: { color: GOLD, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  benefitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 20 },
  benefitItem: { flex: 1, alignItems: 'center', gap: 8 },
  benefitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rewardCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 102,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#202020',
  },
  rewardTitle: { color: '#D9D9D9', fontSize: 14, fontWeight: '800', textAlign: 'center', paddingTop: 16 },
  coinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  rewardCoins: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  redeemBtn: { backgroundColor: GOLD, paddingVertical: 12, alignItems: 'center' },
  redeemBtnDisabled: { backgroundColor: GOLD_DARK },
  redeemText: { color: '#111111', fontSize: 16, fontWeight: '900' },
  redeemTextDisabled: { color: 'rgba(0,0,0,0.58)' },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  muted: { color: '#A5A5A5', fontSize: 12, fontWeight: '700' },
  planGrid: { paddingHorizontal: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionBanner: {
    marginTop: 26,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(245,197,66,0.3)',
    backgroundColor: '#050505',
  },
  taskList: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  taskCard: {
    backgroundColor: '#1D1E22',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(245,197,66,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  taskSub: { color: '#A8A8A8', fontSize: 12, marginTop: 3 },
  taskCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  taskCoinText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  watchBtn: {
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 16,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#3A3A3A',
    borderWidth: 0,
  },
  historyTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 26, marginHorizontal: 18 },
  historyList: { marginHorizontal: 16, marginTop: 12, gap: 8 },
  historyRow: {
    backgroundColor: '#1D1E22',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  historyDate: { color: '#999999', fontSize: 11, marginTop: 3 },
  historyCoins: { color: GOLD, fontSize: 17, fontWeight: '900' },
  guestCard: {
    margin: 18,
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#1D1E22',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,197,66,0.25)',
  },
  guestTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 12 },
  guestCopy: { color: '#B8B8B8', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 18 },
  primaryBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
  primaryText: { color: '#111111', fontSize: 15, fontWeight: '900' },
  secondaryBtn: { marginTop: 10, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, width: '100%', alignItems: 'center', backgroundColor: '#303030' },
  secondaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
})
