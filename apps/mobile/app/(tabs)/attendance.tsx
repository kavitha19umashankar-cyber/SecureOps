import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import * as Location from 'expo-location'
import { CheckCircle, XCircle, MapPin } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { isWithinGeofence } from '@secureops/utils'

interface SiteOption {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  radiusMeters: number
}

interface AttendanceRecord {
  id: string
  status: string
  clockInTime?: string
  clockOutTime?: string
  verifiedInGeofence: boolean
  overtimeMinutes: number
}

export default function AttendanceScreen() {
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [selectedSite, setSelectedSite] = useState<SiteOption | null>(null)
  const [locPermission, setLocPermission] = useState<boolean | null>(null)
  const qc = useQueryClient()

  const { data: sites } = useQuery({
    queryKey: ['my-sites'],
    queryFn: () => api.get<{ success: boolean; data: SiteOption[] }>('/sites').then((r) => r.data.data),
  })

  const { data: todayAttendance } = useQuery({
    queryKey: ['my-attendance-today'],
    queryFn: () => {
      const today = new Date().toISOString().split('T')[0]!
      return api.get<{ success: boolean; data: AttendanceRecord[] }>('/attendance/my', {
        params: { from: today, to: today },
      }).then((r) => r.data.data[0] ?? null)
    },
    refetchInterval: 30_000,
  })

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      setLocPermission(status === 'granted')
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 50 })
      }
    })()
  }, [])

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error('Location unavailable')
      if (!selectedSite) throw new Error('Select a site')

      return api.post('/attendance/clock-in', {
        siteId: selectedSite.id,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        isMockLocation: false,
        deviceId: 'device-001',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] })
      Alert.alert('Clocked In!', `You have successfully clocked in at ${selectedSite?.name}`)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      Alert.alert('Clock-In Failed', e.response?.data?.message ?? 'Unable to clock in')
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!location || !todayAttendance) throw new Error('No active attendance')
      return api.post('/attendance/clock-out', {
        attendanceId: todayAttendance.id,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-attendance-today'] })
      Alert.alert('Clocked Out!', 'Your shift has been recorded.')
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      Alert.alert('Error', e.response?.data?.message ?? 'Unable to clock out')
    },
  })

  const isWithinSite = location && selectedSite
    ? isWithinGeofence(location.lat, location.lng, selectedSite.lat, selectedSite.lng, selectedSite.radiusMeters)
    : false

  const isClockedIn = !!todayAttendance?.clockInTime && !todayAttendance?.clockOutTime

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Attendance</Text>

        {/* Location status */}
        <View style={[styles.locCard, { backgroundColor: locPermission ? '#ecfdf5' : '#fef2f2' }]}>
          <MapPin size={18} color={locPermission ? '#059669' : '#dc2626'} />
          <Text style={{ color: locPermission ? '#059669' : '#dc2626', fontSize: 13, flex: 1 }}>
            {locPermission === null
              ? 'Requesting location permission...'
              : locPermission
                ? location
                  ? `Location acquired (±${Math.round(location.accuracy)}m)`
                  : 'Getting your location...'
                : 'Location permission denied. Cannot clock in.'}
          </Text>
        </View>

        {/* Site selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Site</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {sites?.map((site) => (
                <TouchableOpacity
                  key={site.id}
                  style={[styles.siteChip, selectedSite?.id === site.id && styles.siteChipActive]}
                  onPress={() => setSelectedSite(site)}
                >
                  <Text style={[styles.siteChipText, selectedSite?.id === site.id && { color: '#fff' }]}>
                    {site.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Geofence indicator */}
        {selectedSite && location && (
          <View style={[styles.geofenceCard, { backgroundColor: isWithinSite ? '#ecfdf5' : '#fef2f2' }]}>
            {isWithinSite
              ? <CheckCircle size={18} color="#059669" />
              : <XCircle size={18} color="#dc2626" />}
            <Text style={{ color: isWithinSite ? '#059669' : '#dc2626', fontSize: 13 }}>
              {isWithinSite
                ? `You are within ${selectedSite.radiusMeters}m of ${selectedSite.name}`
                : `You are outside the site boundary (${selectedSite.radiusMeters}m radius)`}
            </Text>
          </View>
        )}

        {/* Clock in/out button */}
        {!isClockedIn ? (
          <TouchableOpacity
            style={[styles.clockBtn, { backgroundColor: '#2563eb' }, (!isWithinSite || !selectedSite) && styles.btnDisabled]}
            onPress={() => clockInMutation.mutate()}
            disabled={!isWithinSite || !selectedSite || clockInMutation.isPending}
            activeOpacity={0.8}
          >
            {clockInMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.clockBtnText}>Clock In</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={styles.activeShift}>
              <CheckCircle size={20} color="#059669" />
              <View>
                <Text style={styles.activeShiftLabel}>Shift Active</Text>
                <Text style={styles.activeShiftTime}>
                  Since {todayAttendance.clockInTime
                    ? new Date(todayAttendance.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.clockBtn, { backgroundColor: '#dc2626' }]}
              onPress={() => clockOutMutation.mutate()}
              disabled={clockOutMutation.isPending}
              activeOpacity={0.8}
            >
              {clockOutMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.clockBtnText}>Clock Out</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Today's record */}
        {todayAttendance && (
          <View style={styles.recordCard}>
            <Text style={styles.recordTitle}>Today's Record</Text>
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>Status</Text>
              <Text style={styles.recordValue}>{todayAttendance.status}</Text>
            </View>
            {todayAttendance.clockInTime && (
              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Clock In</Text>
                <Text style={styles.recordValue}>
                  {new Date(todayAttendance.clockInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {todayAttendance.clockOutTime && (
              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Clock Out</Text>
                <Text style={styles.recordValue}>
                  {new Date(todayAttendance.clockOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {todayAttendance.overtimeMinutes > 0 && (
              <View style={styles.recordRow}>
                <Text style={styles.recordLabel}>Overtime</Text>
                <Text style={[styles.recordValue, { color: '#2563eb' }]}>
                  {Math.floor(todayAttendance.overtimeMinutes / 60)}h {todayAttendance.overtimeMinutes % 60}m
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827' },
  locCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
  section: {},
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  siteChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  siteChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  siteChipText: { fontSize: 13, color: '#374151' },
  geofenceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12 },
  clockBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  clockBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  btnDisabled: { opacity: 0.4 },
  activeShift: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ecfdf5', padding: 14, borderRadius: 12 },
  activeShiftLabel: { fontWeight: '600', color: '#059669' },
  activeShiftTime: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  recordCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', gap: 8 },
  recordTitle: { fontWeight: '600', fontSize: 14, color: '#374151', marginBottom: 4 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recordLabel: { color: '#6b7280', fontSize: 13 },
  recordValue: { color: '#111827', fontSize: 13, fontWeight: '500' },
})
