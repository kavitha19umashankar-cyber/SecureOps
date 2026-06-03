import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native'
import { api } from '../../lib/api'

interface LeaveRequest {
  id: string
  leaveType: string
  fromDate: string
  toDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
}

const LEAVE_TYPES = [
  { key: 'earned_leave', label: 'Earned Leave' },
  { key: 'casual_leave', label: 'Casual Leave' },
  { key: 'sick_leave', label: 'Sick Leave' },
  { key: 'loss_of_pay', label: 'Loss of Pay' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
}

const STATUS_BG: Record<string, string> = {
  pending: '#fef3c7',
  approved: '#d1fae5',
  rejected: '#fee2e2',
  cancelled: '#f3f4f6',
}

function StatusIcon({ status }: { status: string }) {
  const size = 16
  const color = STATUS_COLORS[status] ?? '#9ca3af'
  if (status === 'approved') return <CheckCircle size={size} color={color} />
  if (status === 'rejected') return <XCircle size={size} color={color} />
  return <Clock size={size} color={color} />
}

export default function LeavesScreen() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'list' | 'apply'>('list')
  const [leaveType, setLeaveType] = useState('casual_leave')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')

  const { data: leaves, isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['my-leaves'],
    queryFn: (): Promise<LeaveRequest[]> =>
      api.get<{ success: boolean; data: LeaveRequest[] }>('/leaves/my').then(r => r.data.data),
  })

  const applyMutation = useMutation({
    mutationFn: () => api.post('/leaves', { leaveType, fromDate, toDate, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leaves'] })
      setTab('list')
      setFromDate(''); setToDate(''); setReason('')
      Alert.alert('Success', 'Leave request submitted successfully')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit leave'
      Alert.alert('Error', msg)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/leaves/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-leaves'] }),
  })

  const daysBetween = (from: string, to: string) => {
    const d1 = new Date(from), d2 = new Date(to)
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaves</Text>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setTab('list')} style={[styles.tabBtn, tab === 'list' && styles.activeTab]}>
            <Text style={[styles.tabText, tab === 'list' && styles.activeTabText]}>My Leaves</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('apply')} style={[styles.tabBtn, tab === 'apply' && styles.activeTab]}>
            <Plus size={14} color={tab === 'apply' ? '#2563eb' : '#6b7280'} />
            <Text style={[styles.tabText, tab === 'apply' && styles.activeTabText]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'list' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} />
          ) : !leaves?.length ? (
            <View style={styles.empty}>
              <Calendar size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>No leave requests yet</Text>
              <TouchableOpacity onPress={() => setTab('apply')} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>Apply for Leave</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {leaves.map(leave => (
                <View key={leave.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.typeRow}>
                      <Text style={styles.leaveType}>{leave.leaveType.replace(/_/g, ' ')}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_BG[leave.status] ?? '#f3f4f6' }]}>
                        <StatusIcon status={leave.status} />
                        <Text style={[styles.statusText, { color: STATUS_COLORS[leave.status] ?? '#9ca3af' }]}>
                          {leave.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.dateRange}>
                      {formatDate(leave.fromDate)} → {formatDate(leave.toDate)} · {leave.days} day{leave.days !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={styles.reason} numberOfLines={2}>{leave.reason}</Text>
                  {leave.rejectionReason && (
                    <View style={styles.rejectionBox}>
                      <AlertCircle size={12} color="#ef4444" />
                      <Text style={styles.rejectionText}>{leave.rejectionReason}</Text>
                    </View>
                  )}
                  {leave.status === 'pending' && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Cancel', 'Cancel this leave request?', [
                        { text: 'No' },
                        { text: 'Yes', style: 'destructive', onPress: () => cancelMutation.mutate(leave.id) },
                      ])}
                      style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Cancel Request</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'apply' && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Leave Type</Text>
            <View style={styles.typeGrid}>
              {LEAVE_TYPES.map(lt => (
                <TouchableOpacity key={lt.key} onPress={() => setLeaveType(lt.key)}
                  style={[styles.typeOption, leaveType === lt.key && styles.typeOptionActive]}>
                  <Text style={[styles.typeOptionText, leaveType === lt.key && styles.typeOptionTextActive]}>
                    {lt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>From Date</Text>
            <TextInput
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              style={styles.input}
              keyboardType="numeric"
            />

            <Text style={styles.sectionTitle}>To Date</Text>
            <TextInput
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              style={styles.input}
              keyboardType="numeric"
            />

            {fromDate && toDate && (
              <View style={styles.daysInfo}>
                <Calendar size={16} color="#2563eb" />
                <Text style={styles.daysText}>{daysBetween(fromDate, toDate)} day(s) requested</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Briefly describe the reason for leave..."
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={() => {
                if (!fromDate || !toDate || !reason.trim()) {
                  Alert.alert('Missing Info', 'Please fill in all fields')
                  return
                }
                applyMutation.mutate()
              }}
              style={[styles.submitBtn, applyMutation.isPending && styles.submitBtnDisabled]}
              disabled={applyMutation.isPending}>
              {applyMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Submit Leave Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 4 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  activeTabText: { color: '#2563eb' },
  scroll: { flex: 1 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  cardHeader: { marginBottom: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  leaveType: { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dateRange: { fontSize: 13, color: '#6b7280' },
  reason: { fontSize: 13, color: '#374151', lineHeight: 18 },
  rejectionBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#fef2f2', padding: 8, borderRadius: 8 },
  rejectionText: { fontSize: 12, color: '#dc2626', flex: 1 },
  cancelBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8 },
  cancelText: { fontSize: 13, color: '#ef4444', fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: '#9ca3af' },
  applyBtn: { marginTop: 4, backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  applyBtnText: { color: '#fff', fontWeight: '600' },
  form: { padding: 20, gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  typeOptionActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  typeOptionText: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  typeOptionTextActive: { color: '#2563eb' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  textarea: { height: 100 },
  daysInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', padding: 12, borderRadius: 10, marginTop: 4 },
  daysText: { fontSize: 14, color: '#2563eb', fontWeight: '600' },
  submitBtn: { marginTop: 24, backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
