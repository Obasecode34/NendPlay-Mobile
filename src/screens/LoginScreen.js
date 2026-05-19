// src/screens/LoginScreen.js
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { authService } from '../services/index'

export default function LoginScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { setAuth } = useAuthStore()
  const c = theme.colors

  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!form.identifier || !form.password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const res = await authService.login(form)
      const { user, accessToken, refreshToken } = res.data.data
      await setAuth(user, accessToken, refreshToken)
    } catch (err) {
      Alert.alert('Login Failed', err.response?.data?.message || 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: {
      width: 64, height: 64, borderRadius: 16,
      backgroundColor: c.primary, alignItems: 'center',
      justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
    },
    logoText: { color: 'white', fontSize: 28, fontWeight: '900' },
    title: { fontSize: 28, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginBottom: 32 },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 6, fontWeight: '500' },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, marginBottom: 16,
      paddingHorizontal: 14,
    },
    input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 14 },
    btn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 15, alignItems: 'center',
      marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, gap: 4 },
    footerText: { color: c.textMuted, fontSize: 14 },
    footerLink: { color: c.primary, fontSize: 14, fontWeight: '600' },
  })

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.logo}>
          <Text style={s.logoText}>N</Text>
        </View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to continue watching</Text>

        <Text style={s.label}>Email or Username</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.input}
            placeholder="Enter email or username"
            placeholderTextColor={c.textMuted}
            value={form.identifier}
            onChangeText={(v) => setForm({ ...form, identifier: v })}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <Text style={s.label}>Password</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.input}
            placeholder="Enter your password"
            placeholderTextColor={c.textMuted}
            value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="white" />
            : <>
                <Text style={s.btnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
          }
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={s.footerLink}> Create one</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
