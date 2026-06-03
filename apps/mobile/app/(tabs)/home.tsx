import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Shield, Clock, Camera, AlertTriangle, LogOut } from 'lucide-react-native'
import { useAuthStore } from '../../store/auth'
import { useRouter } from 'expo-router'

export default function HomeScreen() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Shield size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good {getTimeGreeting()}, {user?.name?.split(' ')[0]}</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={18} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Quick Action Cards */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionCard
            label="Clock In / Out"
            icon={<Clock size={28} color="#2563eb" />}
            bg="#eff6ff"
            onPress={() => router.push('/(tabs)/attendance')}
          />
          <ActionCard
            label="Photo Check-In"
            icon={<Camera size={28} color="#059669" />}
            bg="#ecfdf5"
            onPress={() => router.push('/(tabs)/photo-checkin')}
          />
          <ActionCard
            label="Report Incident"
            icon={<AlertTriangle size={28} color="#d97706" />}
            bg="#fffbeb"
            onPress={() => router.push('/(tabs)/incidents')}
          />
          <ActionCard
            label="SOS Alert"
            icon={<Shield size={28} color="#dc2626" />}
            bg="#fef2f2"
            onPress={() => Alert.alert('SOS', 'SOS alert sent to your supervisor!')}
          />
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Today's Reminders</Text>
          <Text style={styles.infoItem}>• Photo check-in every 2 hours during shift</Text>
          <Text style={styles.infoItem}>• Must be within 100m of site to clock in</Text>
          <Text style={styles.infoItem}>• Report any incidents immediately</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ActionCard({ label, icon, bg, onPress }: { label: string; icon: React.ReactNode; bg: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.cardLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function getTimeGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 18, fontWeight: '700', color: '#111827' },
  date: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  logoutBtn: { padding: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flex: 1, minWidth: '45%', borderRadius: 16, padding: 18, gap: 10, alignItems: 'center' },
  cardLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', gap: 6 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  infoItem: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
})
