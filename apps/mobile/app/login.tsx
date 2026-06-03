import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../store/auth'
import { api } from '../lib/api'
import type { LoginResponse } from '@secureops/types'

export default function LoginScreen() {
  const router = useRouter()
  const { login } = useAuthStore()

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const sendOtp = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number')
      return
    }
    if (!subdomain) {
      Alert.alert('Error', 'Enter your agency code')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/otp/send', { phone, tenantSubdomain: subdomain })
      setStep('otp')
      Alert.alert('OTP Sent', 'Enter the 6-digit OTP sent to your phone')
    } catch {
      Alert.alert('Error', 'Failed to send OTP. Check your phone number and agency code.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP')
      return
    }
    setLoading(true)
    try {
      const res = await api.post<{ success: boolean; data: LoginResponse }>('/auth/otp/verify', {
        phone, otp, tenantSubdomain: subdomain,
      })
      login(res.data.data)
      router.replace('/(tabs)/home')
    } catch {
      Alert.alert('Error', 'Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.appName}>SecureOps</Text>
        </View>

        <Text style={styles.title}>{step === 'phone' ? 'Sign In' : 'Enter OTP'}</Text>
        <Text style={styles.subtitle}>
          {step === 'phone' ? 'Enter your mobile number to continue' : `OTP sent to +91 ${phone}`}
        </Text>

        {step === 'phone' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Agency Code (e.g. quickguard)"
              value={subdomain}
              onChangeText={setSubdomain}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Mobile Number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <TouchableOpacity style={styles.btn} onPress={sendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="6-digit OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={verifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify & Login</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')} style={styles.backBtn}>
              <Text style={styles.backText}>Back to Phone</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1d4ed8', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  logoText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  appName: { fontSize: 20, fontWeight: '700', color: '#111827' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12, color: '#111827' },
  otpInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backBtn: { marginTop: 14, alignItems: 'center' },
  backText: { color: '#6b7280', fontSize: 14 },
})
