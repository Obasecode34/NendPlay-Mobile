// src/navigation/AuthNavigator.js
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import useThemeStore from '../stores/themeStore'
import LoginScreen from '../screens/LoginScreen'
import RegisterScreen from '../screens/RegisterScreen'

const Stack = createStackNavigator()

export default function AuthNavigator() {
  const { theme } = useThemeStore()
  return (
    <Stack.Navigator screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: theme.colors.bg },
    }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  )
}
