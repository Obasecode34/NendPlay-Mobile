// src/screens/LoginScreen.js
import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import useThemeStore from '../stores/themeStore'
import useAuthStore from '../services/authStore.native'
import { authService } from '../services/index'

const BIOMETRIC_LOGIN_KEY = 'nendplay_biometric_login'

export default function LoginScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { setAuth } = useAuthStore()
  const c = theme.colors

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetForm, setResetForm] = useState({ identifier: '', token: '', newPassword: '' })
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [hasSavedBiometricLogin, setHasSavedBiometricLogin] = useState(false)

  useEffect(() => {
    checkBiometricLogin()
  }, [])

  const checkBiometricLogin = async () => {
    try {
      const [hardware, enrolled, savedLogin] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY),
      ])
      setBiometricReady(hardware && enrolled)
      setHasSavedBiometricLogin(Boolean(savedLogin))
    } catch {
      setBiometricReady(false)
      setHasSavedBiometricLogin(false)
    }
  }

  const saveBiometricLogin = async (identifier, password) => {
    if (!biometricReady) return
    Alert.alert(
      'Enable fingerprint sign in?',
      'Use your fingerprint to sign in faster next time on this phone.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              await SecureStore.setItemAsync(
                BIOMETRIC_LOGIN_KEY,
                JSON.stringify({ identifier, password }),
              )
              setHasSavedBiometricLogin(true)
            } catch {}
          },
        },
      ],
    )
  }

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      Alert.alert('Error', 'Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const res = await authService.login({ email: form.email.trim(), password: form.password })
      const { user, accessToken, refreshToken } = res.data.data
      await setAuth(user, accessToken, refreshToken)
      if (!hasSavedBiometricLogin) {
        await saveBiometricLogin(form.email.trim(), form.password)
      }
      navigation.navigate('MainTabs')
    } catch (err) {
      const message = err.response?.data?.message ||
        (err.code === 'ECONNABORTED'
          ? 'The backend took too long to respond. Make sure it is running and your phone is on the same network.'
          : err.request
            ? 'Cannot reach the backend. Start the backend server and make sure your phone is on the same Wi-Fi/hotspot as this computer.'
            : 'Please try again')
      Alert.alert('Login Failed', message)
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    try {
      const savedLogin = await SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY)
      if (!savedLogin) {
        Alert.alert('Fingerprint Sign In', 'Sign in once with your password, then enable fingerprint sign in.')
        return
      }
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to NendPlay',
        fallbackLabel: 'Use password',
        disableDeviceFallback: false,
      })
      if (!auth.success) return

      const credentials = JSON.parse(savedLogin)
      setLoading(true)
      const res = await authService.login(credentials)
      const { user, accessToken, refreshToken } = res.data.data
      await setAuth(user, accessToken, refreshToken)
      navigation.navigate('MainTabs')
    } catch (err) {
      Alert.alert('Fingerprint Sign In Failed', err.response?.data?.message || 'Please sign in with your password.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const identifier = resetForm.identifier || form.email
    if (!identifier) {
      Alert.alert('Password Recovery', 'Enter your email or username first.')
      return
    }

    setLoading(true)
    try {
      const res = await authService.forgotPassword({ identifier })
      const resetToken = res.data?.data?.resetToken
      setResetForm((current) => ({
        ...current,
        identifier,
        token: resetToken || current.token,
      }))
      Alert.alert(
        'Password Recovery',
        resetToken
          ? 'A development reset token was generated and filled in for testing.'
          : 'If this account exists, reset instructions have been prepared.',
      )
    } catch (err) {
      Alert.alert('Password Recovery Failed', err.response?.data?.message || 'Please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetForm.token || !resetForm.newPassword) {
      Alert.alert('Password Recovery', 'Enter the reset token and your new password.')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword({
        token: resetForm.token.trim(),
        newPassword: resetForm.newPassword,
      })
      Alert.alert('Password Updated', 'You can now sign in with your new password.')
      setResetMode(false)
      setForm({ email: resetForm.identifier || form.email, password: '' })
      setResetForm({ identifier: '', token: '', newPassword: '' })
    } catch (err) {
      Alert.alert('Password Reset Failed', err.response?.data?.message || 'Please try again')
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
    textButton: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8, paddingVertical: 6 },
    panel: {
      backgroundColor: c.surface, borderColor: c.border, borderWidth: 1,
      borderRadius: 16, padding: 14, marginTop: 14,
    },
    panelTitle: { color: c.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    panelText: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
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

        <Text style={s.label}>Email Address</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={s.input}
            placeholder="Enter email address"
            placeholderTextColor={c.textMuted}
            value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
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

        <TouchableOpacity
          style={s.textButton}
          onPress={() => {
            setResetMode(!resetMode)
            setResetForm({ ...resetForm, identifier: resetForm.identifier || form.email })
          }}>
          <Text style={s.footerLink}>{resetMode ? 'Back to sign in' : 'Forgot password?'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="white" />
            : <>
                <Text style={s.btnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
          }
        </TouchableOpacity>

        {biometricReady && (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}
            onPress={handleBiometricLogin}
            disabled={loading}>
            <Ionicons name="finger-print" size={20} color={c.primary} />
            <Text style={[s.btnText, { color: c.text }]}>
              Sign In with Fingerprint
            </Text>
          </TouchableOpacity>
        )}

        {resetMode && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Recover password</Text>
            <Text style={s.panelText}>
              Enter your email address, request a reset token, then set a new password.
            </Text>

            <Text style={s.label}>Email Address</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor={c.textMuted}
                value={resetForm.identifier}
                onChangeText={(v) => setResetForm({ ...resetForm, identifier: v })}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={[s.btn, { marginTop: 0 }]} onPress={handleForgotPassword} disabled={loading}>
              <Text style={s.btnText}>Get Reset Token</Text>
            </TouchableOpacity>

            <Text style={s.label}>Reset Token</Text>
            <View style={s.inputWrap}>
              <Ionicons name="key-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.input}
                placeholder="Paste reset token"
                placeholderTextColor={c.textMuted}
                value={resetForm.token}
                onChangeText={(v) => setResetForm({ ...resetForm, token: v })}
                autoCapitalize="none"
              />
            </View>

            <Text style={s.label}>New Password</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.input}
                placeholder="Min. 6 characters"
                placeholderTextColor={c.textMuted}
                value={resetForm.newPassword}
                onChangeText={(v) => setResetForm({ ...resetForm, newPassword: v })}
                secureTextEntry={!showResetPassword}
              />
              <TouchableOpacity onPress={() => setShowResetPassword(!showResetPassword)}>
                <Ionicons name={showResetPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={handleResetPassword} disabled={loading}>
              <Text style={s.btnText}>Reset Password</Text>
            </TouchableOpacity>
          </View>
        )}

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
