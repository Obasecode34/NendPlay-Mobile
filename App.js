// App.js
import { registerRootComponent } from 'expo'
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import useAuthStore from './src/services/authStore.native'
import useThemeStore from './src/stores/themeStore'
import AppNavigator from './src/navigation/AppNavigator'
import AuthNavigator from './src/navigation/AuthNavigator'

export default function App() {
  const { isAuthenticated, isLoading, initAuth } = useAuthStore()
  const { theme, loadTheme } = useThemeStore()
  const c = theme.colors

  useEffect(() => {
    const init = async () => {
      await loadTheme()
      await initAuth()
    }
    init()
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={c.bgDeep} />
        {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}

registerRootComponent(App)