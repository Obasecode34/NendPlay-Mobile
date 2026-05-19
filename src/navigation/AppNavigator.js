// src/navigation/AppNavigator.js
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, Platform } from 'react-native'
import useThemeStore from '../stores/themeStore'

// Screens
import HomeScreen from '../screens/HomeScreen'
import NovelHubScreen from '../screens/NovelHubScreen'
import ShortsScreen from '../screens/ShortsScreen'
import DownloadsScreen from '../screens/DownloadsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import MediaPlayerScreen from '../screens/MediaPlayerScreen'
import SubscriptionScreen from '../screens/SubscriptionScreen'
import ReferralScreen from '../screens/ReferralScreen'
import AdvertiseScreen from '../screens/AdvertiseScreen'

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
      <Stack.Screen name="Subscribe" component={SubscriptionScreen} />
      <Stack.Screen name="Referrals" component={ReferralScreen} />
      <Stack.Screen name="Advertise" component={AdvertiseScreen} />
    </Stack.Navigator>
  )
}

export default function AppNavigator() {
  const { theme } = useThemeStore()
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
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            NovelHub: focused ? 'book' : 'book-outline',
            Shorts: focused ? 'play-circle' : 'play-circle-outline',
            Downloads: focused ? 'download' : 'download-outline',
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
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
