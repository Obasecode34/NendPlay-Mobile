// src/screens/RegisterScreen.js
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

export default function RegisterScreen({ navigation }) {
  const { theme } = useThemeStore()
  const { setAuth } = useAuthStore()
  const c = theme.colors

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    profileName: '', email: '', username: '',
    password: '', confirmPassword: '', referralCode: '',
  })

  const getErrorMessage = (err) => {
    const data = err.response?.data
    if (Array.isArray(data?.errors) && data.errors.length) return data.errors[0]
    return data?.message || 'Please try again'
  }

  const handleRegister = async () => {
    if (form.password !== form.confirmPassword) {
      Alert.alert('Registration Failed', 'Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const payload = {
        email: form.email.trim(),
        profileName: form.profileName,
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        referralCode: form.referralCode || undefined,
      }

      const res = await authService.register(payload)
      const { user, accessToken, refreshToken } = res.data.data
      await setAuth(user, accessToken, refreshToken)
      navigation.navigate('MainTabs')
    } catch (err) {
      Alert.alert('Registration Failed', getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
    logo: {
      width: 56, height: 56, borderRadius: 14,
      backgroundColor: c.primary, alignItems: 'center',
      justifyContent: 'center', alignSelf: 'center', marginBottom: 12,
    },
    logoText: { color: 'white', fontSize: 24, fontWeight: '900' },
    title: { fontSize: 24, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginBottom: 24 },
    label: { fontSize: 13, color: c.textMuted, marginBottom: 6, fontWeight: '500' },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surface, borderRadius: 12,
      borderWidth: 1, borderColor: c.border, marginBottom: 14,
      paddingHorizontal: 14,
    },
    input: { flex: 1, color: c.text, fontSize: 15, paddingVertical: 13 },
    btn: {
      backgroundColor: c.primary, borderRadius: 12,
      paddingVertical: 15, alignItems: 'center',
      marginTop: 4, flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    btnText: { color: 'white', fontSize: 16, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 4 },
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
        <Text style={s.title}>Create account</Text>
        <Text style={s.subtitle}>Join millions on NendPlay</Text>

        <Text style={s.label}>Email Address</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} placeholder="your@email.com"
            placeholderTextColor={c.textMuted} value={form.email}
            onChangeText={(v) => setForm({ ...form, email: v })}
            keyboardType="email-address" autoCapitalize="none" />
        </View>

        <Text style={s.label}>Display Name</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} placeholder="Your name"
            placeholderTextColor={c.textMuted} value={form.profileName}
            onChangeText={(v) => setForm({ ...form, profileName: v })} />
        </View>

        <Text style={s.label}>Username</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} placeholder="your_username"
            placeholderTextColor={c.textMuted} value={form.username}
            onChangeText={(v) => setForm({ ...form, username: v })}
            autoCapitalize="none" />
        </View>

        <Text style={s.label}>Password</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} placeholder="Min. 6 characters"
            placeholderTextColor={c.textMuted} value={form.password}
            onChangeText={(v) => setForm({ ...form, password: v })}
            secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Confirm Password</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} placeholder="Repeat password"
            placeholderTextColor={c.textMuted} value={form.confirmPassword}
            onChangeText={(v) => setForm({ ...form, confirmPassword: v })}
            secureTextEntry={!showConfirmPassword} />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Referral Code <Text style={{ opacity: 0.5 }}>(optional)</Text></Text>
        <View style={s.inputWrap}>
          <TextInput style={[s.input, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
            placeholder="NP-XXXXXXXX" placeholderTextColor={c.textMuted}
            value={form.referralCode}
            onChangeText={(v) => setForm({ ...form, referralCode: v })}
            autoCapitalize="characters" />
        </View>

        <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="white" />
            : <>
                <Text style={s.btnText}>Create Account</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
          }
        </TouchableOpacity>

        <View style={s.footer}>
          <Text style={s.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={s.footerLink}> Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
