import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as Location from 'expo-location'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react-native'
import { api } from '../../lib/api'

const schema = z.object({
  siteId: z.string().min(1, 'Select a site'),
  category: z.enum(['theft','fire','medical','harassment','trespass','equipment_damage','fight','suspicious_activity','accident','other']),
  severity: z.enum(['low','medium','high','critical']),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Provide more detail'),
})

type FormValues = z.infer<typeof schema>

const CATEGORIES = ['theft','fire','medical','harassment','trespass','equipment_damage','fight','suspicious_activity','accident','other']
const SEVERITIES = ['low','medium','high','critical']

const severityColor: Record<string, string> = { low: '#059669', medium: '#d97706', high: '#ea580c', critical: '#dc2626' }

export default function IncidentsScreen() {
  const [tab, setTab] = useState<'report' | 'history'>('report')
  const qc = useQueryClient()

  const { data: sites } = useQuery({
    queryKey: ['my-sites'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/sites').then((r) => r.data.data),
  })

  const { data: myIncidents } = useQuery({
    queryKey: ['my-incidents'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; title: string; severity: string; status: string; occurredAt: string }> }>('/incidents').then((r) => r.data.data),
    enabled: tab === 'history',
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { severity: 'medium', category: 'other' },
  })

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)
      return api.post('/incidents', {
        ...data,
        lat: loc?.coords.latitude,
        lng: loc?.coords.longitude,
        occurredAt: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-incidents'] })
      reset()
      Alert.alert('Incident Reported', 'Your incident has been submitted and your supervisor has been notified.')
    },
    onError: () => {
      Alert.alert('Error', 'Failed to submit incident. Please try again.')
    },
  })

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Incidents</Text>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'report' && styles.tabActive]} onPress={() => setTab('report')}>
            <Text style={[styles.tabText, tab === 'report' && styles.tabTextActive]}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>History</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'report' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Site */}
          <Text style={styles.label}>Site *</Text>
          <Controller control={control} name="siteId" render={({ field: { value, onChange } }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sites?.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, value === s.id && styles.chipActive]}
                  onPress={() => onChange(s.id)}
                >
                  <Text style={[styles.chipText, value === s.id && { color: '#fff' }]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )} />
          {errors.siteId && <Text style={styles.error}>{errors.siteId.message}</Text>}

          {/* Category */}
          <Text style={styles.label}>Category *</Text>
          <Controller control={control} name="category" render={({ field: { value, onChange } }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, value === c && styles.chipActive]} onPress={() => onChange(c)}>
                  <Text style={[styles.chipText, value === c && { color: '#fff' }]}>{c.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )} />

          {/* Severity */}
          <Text style={styles.label}>Severity *</Text>
          <Controller control={control} name="severity" render={({ field: { value, onChange } }) => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, value === s && { backgroundColor: severityColor[s], borderColor: severityColor[s] ?? '#d1d5db' }]}
                  onPress={() => onChange(s)}
                >
                  <Text style={[styles.chipText, value === s && { color: '#fff' }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )} />

          {/* Title */}
          <Text style={styles.label}>Title *</Text>
          <Controller control={control} name="title" render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Brief title of the incident"
            />
          )} />
          {errors.title && <Text style={styles.error}>{errors.title.message}</Text>}

          {/* Description */}
          <Text style={styles.label}>Description *</Text>
          <Controller control={control} name="description" render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              placeholder="Describe what happened in detail..."
            />
          )} />
          {errors.description && <Text style={styles.error}>{errors.description.message}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, mutation.isPending && styles.btnDisabled]}
            onPress={handleSubmit((d) => mutation.mutate(d))}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Incident Report</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {myIncidents?.map((inc) => (
            <View key={inc.id} style={styles.incCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={styles.incTitle} numberOfLines={2}>{inc.title}</Text>
                <Text style={[styles.incSeverity, { color: severityColor[inc.severity] ?? '#374151' }]}>{inc.severity}</Text>
              </View>
              <Text style={styles.incStatus}>{inc.status.replace('_', ' ')}</Text>
              <Text style={styles.incDate}>{new Date(inc.occurredAt).toLocaleDateString('en-IN')}</Text>
            </View>
          ))}
          {!myIncidents?.length && (
            <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
              <AlertTriangle size={36} color="#d1d5db" />
              <Text style={{ color: '#9ca3af' }}>No incidents reported</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  tabText: { color: '#6b7280', fontWeight: '500', fontSize: 14 },
  tabTextActive: { color: '#111827' },
  scroll: { padding: 20, gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#374151' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff', color: '#111827' },
  error: { color: '#dc2626', fontSize: 12 },
  submitBtn: { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  incCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  incTitle: { flex: 1, fontWeight: '600', color: '#111827', fontSize: 14 },
  incSeverity: { fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },
  incStatus: { color: '#6b7280', fontSize: 12, textTransform: 'capitalize' },
  incDate: { color: '#9ca3af', fontSize: 11 },
})
