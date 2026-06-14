// src/navigation/AppNavigator.js
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { Image, View, Text, Platform } from 'react-native'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'

// Screens
import HomeScreen from '../screens/HomeScreen'
import NovelHubScreen from '../screens/NovelHubScreen'
import ShortsScreen from '../screens/ShortsScreen'
import DownloadsScreen from '../screens/DownloadsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import MediaPlayerScreen from '../screens/MediaPlayerScreen'
import DocumentReaderScreen from '../screens/DocumentReaderScreen'
import SubscriptionScreen from '../screens/SubscriptionScreen'
import LoginScreen from '../screens/LoginScreen'
import RegisterScreen from '../screens/RegisterScreen'
import ReferralScreen from '../screens/ReferralScreen'
import RewardsScreen from '../screens/RewardsScreen'
import AdvertiseScreen from '../screens/AdvertiseScreen'
import DeviceMediaScreen from '../screens/DeviceMediaScreen'
import DailyNewsScreen from '../screens/DailyNewsScreen'
import NewsDetailScreen from '../screens/NewsDetailScreen'

const Tab = createBottomTabNavigator()
const Stack = createStackNavigator()

// Home stack (includes media player)
function HomeStack() {
  const { theme } = useThemeStore()
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.bg },
      }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MediaPlayer" component={MediaPlayerScreen} />
      <Stack.Screen name="DocumentReader" component={DocumentReaderScreen} />
      <Stack.Screen name="Subscribe" component={SubscriptionScreen} />
      <Stack.Screen name="Referrals" component={ReferralScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Advertise" component={AdvertiseScreen} />
      <Stack.Screen name="DeviceMedia" component={DeviceMediaScreen} />
      <Stack.Screen name="DailyNews" component={DailyNewsScreen} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
    </Stack.Navigator>
  )
}

function MainTabs() {
  const { theme } = useThemeStore()
  const { user } = useAuthStore()
  const c = theme.colors

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.bgDeep,
          borderTopColor: c.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Profile' && user?.profilePic) {
            return (
              <View
                style={{
                  width: size + 4,
                  height: size + 4,
                  borderRadius: (size + 4) / 2,
                  borderWidth: focused ? 2 : 1,
                  borderColor: focused ? c.primary : c.textMuted,
                  overflow: 'hidden',
                  backgroundColor: c.surface,
                }}>
                <Image
                  source={{ uri: user.profilePic }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
            )
          }

          const icons = {
            Home: focused ? 'home' : 'home-outline',
            NovelHub: focused ? 'book' : 'book-outline',
            Shorts: focused ? 'play-circle' : 'play-circle-outline',
            Downloads: focused ? 'download' : 'download-outline',
            Device: focused ? 'phone-portrait' : 'phone-portrait-outline',
            Profile: focused ? 'person' : 'person-outline',
          }
          return (
            <Ionicons
              name={icons[route.name] || 'ellipse'}
              size={size}
              color={color}
            />
          )
        },
      })}>
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="NovelHub" component={NovelHubScreen} />
      <Tab.Screen name="Shorts" component={ShortsScreen} />
      <Tab.Screen name="Downloads" component={DownloadsScreen} />
      <Tab.Screen
        name="Device"
        component={DeviceMediaScreen}
        options={{ tabBarLabel: 'Device' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { theme } = useThemeStore()
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.bg },
      }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="MediaPlayer" component={MediaPlayerScreen} />
      <Stack.Screen name="DocumentReader" component={DocumentReaderScreen} />
      <Stack.Screen name="Subscribe" component={SubscriptionScreen} />
      <Stack.Screen name="Referrals" component={ReferralScreen} />
      <Stack.Screen name="Rewards" component={RewardsScreen} />
      <Stack.Screen name="Advertise" component={AdvertiseScreen} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
    </Stack.Navigator>
  )
}
