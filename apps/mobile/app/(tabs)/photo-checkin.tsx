import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useRef } from 'react'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { Camera, CheckCircle, X } from 'lucide-react-native'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface Site { id: string; name: string }

export default function PhotoCheckinScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [capturedUri, setCapturedUri] = useState<string | null>(null)
  const cameraRef = useRef<CameraView>(null)
  const qc = useQueryClient()

  const { data: sites } = useQuery({
    queryKey: ['my-sites'],
    queryFn: () => api.get<{ success: boolean; data: Site[] }>('/sites').then((r) => r.data.data),
  })

  const { data: todayCheckins } = useQuery({
    queryKey: ['my-photo-checkins'],
    queryFn: () => {
      const today = new Date().toISOString().split('T')[0]!
      return api.get<{ success: boolean; data: Array<{ id: string; capturedAt: string; isLate: boolean }> }>('/photo-checkins/my', {
        params: { date: today },
      }).then((r) => r.data.data)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (uri: string) => {
      if (!selectedSite) throw new Error('Select a site')

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const formData = new FormData()
      formData.append('photo', {
        uri,
        name: `checkin_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob)

      return api.post(
        `/photo-checkins?siteId=${selectedSite.id}&lat=${loc.coords.latitude}&lng=${loc.coords.longitude}&intervalNumber=${(todayCheckins?.length ?? 0) + 1}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-photo-checkins'] })
      setCapturedUri(null)
      setIsCameraOpen(false)
      Alert.alert('Photo Submitted!', 'Your photo check-in has been recorded.')
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      Alert.alert('Error', e.response?.data?.message ?? 'Failed to submit photo')
    },
  })

  const takePicture = async () => {
    if (!cameraRef.current) return
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false })
    if (photo?.uri) {
      setCapturedUri(photo.uri)
      setIsCameraOpen(false)
    }
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scroll}>
          <Text style={styles.heading}>Photo Check-In</Text>
          <View style={styles.permCard}>
            <Camera size={32} color="#9ca3af" />
            <Text style={styles.permText}>Camera permission is required for photo check-in</Text>
            <TouchableOpacity style={styles.btn} onPress={requestPermission}>
              <Text style={styles.btnText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  if (isCameraOpen) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsCameraOpen(false)}>
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.scroll}>
        <Text style={styles.heading}>Photo Check-In</Text>

        {/* Site selector */}
        <Text style={styles.label}>Select Site</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {sites?.map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[styles.chip, selectedSite?.id === site.id && styles.chipActive]}
              onPress={() => setSelectedSite(site)}
            >
              <Text style={[styles.chipText, selectedSite?.id === site.id && { color: '#fff' }]}>{site.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Captured photo preview */}
        {capturedUri ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: capturedUri }} style={styles.preview} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#6b7280' }]} onPress={() => setCapturedUri(null)}>
                <Text style={styles.btnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { flex: 1 }, !selectedSite && styles.btnDisabled]}
                onPress={() => uploadMutation.mutate(capturedUri)}
                disabled={!selectedSite || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.cameraBtn, !selectedSite && styles.btnDisabled]}
            onPress={() => setIsCameraOpen(true)}
            disabled={!selectedSite}
          >
            <Camera size={28} color="#2563eb" />
            <Text style={styles.cameraBtnText}>Take Photo Check-In</Text>
            <Text style={styles.cameraBtnSub}>Live photo only — camera roll not accepted</Text>
          </TouchableOpacity>
        )}

        {/* Today's submissions */}
        <Text style={styles.label}>Today's Submissions ({todayCheckins?.length ?? 0})</Text>
        {todayCheckins?.map((c, i) => (
          <View key={c.id} style={styles.recordRow}>
            <CheckCircle size={16} color="#059669" />
            <Text style={styles.recordText}>Check-in #{i + 1} — {new Date(c.capturedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
            {c.isLate && <Text style={styles.lateText}>Late</Text>}
          </View>
        ))}
        {todayCheckins?.length === 0 && (
          <Text style={styles.emptyText}>No photo check-ins today</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, color: '#374151' },
  permCard: { alignItems: 'center', gap: 12, padding: 24, backgroundColor: '#fff', borderRadius: 16, marginTop: 20 },
  permText: { color: '#6b7280', textAlign: 'center', fontSize: 14 },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  cameraBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 2, borderColor: '#2563eb', borderStyle: 'dashed' },
  cameraBtnText: { fontWeight: '600', color: '#2563eb', fontSize: 16 },
  cameraBtnSub: { color: '#9ca3af', fontSize: 12 },
  previewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, overflow: 'hidden' },
  preview: { width: '100%', height: 250, borderRadius: 10 },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 48, gap: 20 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  closeBtn: { position: 'absolute', top: 48, right: 20, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12 },
  recordText: { flex: 1, color: '#374151', fontSize: 13 },
  lateText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#9ca3af', fontSize: 13 },
})
