import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { User, FileText, LogOut, ChevronRight } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const { data: payslips } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; month: number; year: number; netSalary: string }> }>('/payroll/my-payslips').then((r) => r.data.data),
  })

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.role}>{user?.role?.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Recent payslips */}
        <Text style={styles.sectionLabel}>Recent Payslips</Text>
        <View style={styles.card}>
          {payslips?.slice(0, 3).map((p) => (
            <View key={p.id} style={styles.payslipRow}>
              <FileText size={16} color="#6b7280" />
              <Text style={styles.payslipLabel}>
                {new Date(p.year, p.month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
              </Text>
              <Text style={styles.payslipAmount}>₹{Number(p.netSalary).toLocaleString('en-IN')}</Text>
            </View>
          ))}
          {!payslips?.length && (
            <Text style={styles.empty}>No payslips available yet</Text>
          )}
        </View>

        {/* Actions */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <MenuItem label="My Attendance History" icon={<User size={16} color="#6b7280" />} onPress={() => {}} />
          <MenuItem label="Leave Applications" icon={<FileText size={16} color="#6b7280" />} onPress={() => {}} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#dc2626" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function MenuItem({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      {icon}
      <Text style={styles.menuLabel}>{label}</Text>
      <ChevronRight size={16} color="#9ca3af" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#2563eb' },
  name: { fontSize: 17, fontWeight: '700', color: '#111827' },
  role: { fontSize: 13, color: '#6b7280', textTransform: 'capitalize', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  payslipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  payslipLabel: { flex: 1, color: '#374151', fontSize: 14 },
  payslipAmount: { fontWeight: '600', color: '#059669', fontSize: 14 },
  empty: { color: '#9ca3af', fontSize: 13, padding: 14 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  menuLabel: { flex: 1, color: '#374151', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fecaca' },
  logoutText: { color: '#dc2626', fontWeight: '600', fontSize: 15 },
})
