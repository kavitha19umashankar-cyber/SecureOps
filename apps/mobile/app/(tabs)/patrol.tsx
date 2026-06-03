import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'
import * as Location from 'expo-location'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Route, MapPin, CheckCircle, Play, ChevronRight, Clock } from 'lucide-react-native'
import { api } from '../../lib/api'

interface Checkpoint {
  id: string; name: string; lat?: number; lng?: number
  qrCode?: string; expectedMinuteFromStart: number; order: number
}

interface PatrolRoute {
  id: string; name: string; checkpoints: Checkpoint[]; isActive: boolean
}

interface PatrolLog {
  id: string; routeId: string; completionRate: number
  startedAt?: string; completedAt?: string
  checkpointsVisited: Array<{ checkpointId: string; scannedAt: string; onTime: boolean }>
}

export default function PatrolScreen() {
  const qc = useQueryClient()
  const [activeLog, setActiveLog] = useState<PatrolLog | null>(null)
  const [activeRoute, setActiveRoute] = useState<PatrolRoute | null>(null)
  const [scanning, setScanning] = useState<string | null>(null)

  const { data: routes, isLoading } = useQuery<PatrolRoute[]>({
    queryKey: ['my-patrol-routes'],
    queryFn: (): Promise<PatrolRoute[]> =>
      api.get<{ success: boolean; data: PatrolRoute[] }>('/patrol-routes').then(r =>
        r.data.data.filter(r => r.isActive),
      ),
  })

  const startPatrol = useMutation({
    mutationFn: (routeId: string) => api.post<{ success: boolean; data: PatrolLog }>(`/patrol-routes/${routeId}/logs`),
    onSuccess: (res, routeId) => {
      const log = res.data.data
      const route = routes?.find(r => r.id === routeId) ?? null
      setActiveLog(log)
      setActiveRoute(route)
    },
    onError: () => Alert.alert('Error', 'Could not start patrol'),
  })

  const scanCheckpoint = useMutation({
    mutationFn: async ({ routeId, logId, checkpointId }: { routeId: string; logId: string; checkpointId: string }) => {
      let lat: number | undefined, lng: number | undefined
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
          lat = loc.coords.latitude
          lng = loc.coords.longitude
        }
      } catch { /* location optional */ }

      return api.post(`/patrol-routes/${routeId}/logs/${logId}/scans`, { checkpointId, lat, lng })
    },
    onSuccess: (res, { checkpointId }) => {
      const data = res.data?.data
      const visited = [...(activeLog?.checkpointsVisited ?? []), {
        checkpointId,
        scannedAt: new Date().toISOString(),
        onTime: data?.onTime ?? true,
      }]
      const completionRate = data?.completionRate ?? 0
      setActiveLog(prev => prev ? { ...prev, checkpointsVisited: visited, completionRate } : null)
      setScanning(null)

      if (completionRate >= 1) {
        Alert.alert('Patrol Complete! 🎉', `You completed the patrol with ${Math.round(completionRate * 100)}% coverage.`, [
          { text: 'OK', onPress: () => { setActiveLog(null); setActiveRoute(null) } },
        ])
      }
    },
    onError: () => { setScanning(null); Alert.alert('Error', 'Failed to scan checkpoint') },
  })

  const handleScan = async (cp: Checkpoint) => {
    if (!activeLog || !activeRoute) return
    setScanning(cp.id)
    scanCheckpoint.mutate({ routeId: activeRoute.id, logId: activeLog.id, checkpointId: cp.id })
  }

  const pct = Math.round((activeLog?.completionRate ?? 0) * 100)
  const visitedIds = new Set(activeLog?.checkpointsVisited.map(v => v.checkpointId) ?? [])

  // Active patrol view
  if (activeLog && activeRoute) {
    const sorted = [...activeRoute.checkpoints].sort((a, b) => a.order - b.order)

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.activeHeader}>
          <View style={styles.progressRow}>
            <Text style={styles.activeTitle}>{activeRoute.name}</Text>
            <Text style={styles.pct}>{pct}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {activeLog.checkpointsVisited.length} / {activeRoute.checkpoints.length} checkpoints scanned
          </Text>
        </View>

        <ScrollView style={styles.scroll}>
          <View style={{ padding: 16, gap: 10 }}>
            {sorted.map((cp, i) => {
              const done = visitedIds.has(cp.id)
              const visit = activeLog.checkpointsVisited.find(v => v.checkpointId === cp.id)
              const isScanningThis = scanning === cp.id

              return (
                <View key={cp.id} style={[styles.cpCard, done && styles.cpCardDone]}>
                  <View style={styles.cpLeft}>
                    <View style={[styles.cpNum, done && styles.cpNumDone]}>
                      {done ? <CheckCircle size={18} color="#10b981" /> : <Text style={styles.cpNumText}>{i + 1}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cpName, done && styles.cpNameDone]}>{cp.name}</Text>
                      {cp.expectedMinuteFromStart > 0 && (
                        <Text style={styles.cpMeta}><Clock size={11} color="#9ca3af" /> expected at {cp.expectedMinuteFromStart}min</Text>
                      )}
                      {visit && (
                        <Text style={styles.cpScanned}>
                          Scanned {new Date(visit.scannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {!visit.onTime && ' · off-route'}
                        </Text>
                      )}
                    </View>
                  </View>
                  {!done && (
                    <TouchableOpacity onPress={() => handleScan(cp)} disabled={isScanningThis} style={styles.scanBtn}>
                      {isScanningThis ? <ActivityIndicator size="small" color="#fff" /> : (
                        <>
                          <MapPin size={14} color="#fff" />
                          <Text style={styles.scanText}>Scan</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => Alert.alert('End Patrol', 'End patrol without completing all checkpoints?', [
            { text: 'Continue' },
            { text: 'End', style: 'destructive', onPress: () => { setActiveLog(null); setActiveRoute(null) } },
          ])} style={styles.endBtn}>
            <Text style={styles.endText}>End Patrol</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Route selection view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Patrol Routes</Text>
        <Text style={styles.subtitle}>Select a route to start patrolling</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color="#2563eb" style={{ marginTop: 40 }} />
        ) : !routes?.length ? (
          <View style={styles.empty}>
            <Route size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>No patrol routes assigned</Text>
            <Text style={styles.emptySubtext}>Contact your supervisor to assign patrol routes</Text>
          </View>
        ) : (
          <View style={{ padding: 16, gap: 12 }}>
            {routes.map(route => (
              <TouchableOpacity key={route.id} style={styles.routeCard}
                onPress={() => Alert.alert('Start Patrol', `Start "${route.name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Start', onPress: () => startPatrol.mutate(route.id) },
                ])}>
                <View style={styles.routeIcon}>
                  <Route size={20} color="#2563eb" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{route.name}</Text>
                  <Text style={styles.routeMeta}>{route.checkpoints?.length ?? 0} checkpoints</Text>
                </View>
                {startPatrol.isPending && startPatrol.variables === route.id ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <View style={styles.startRow}>
                    <Play size={14} color="#2563eb" />
                    <Text style={styles.startText}>Start</Text>
                    <ChevronRight size={16} color="#d1d5db" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  scroll: { flex: 1 },
  routeCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  routeIcon: { width: 44, height: 44, backgroundColor: '#eff6ff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  routeName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  routeMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  startText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  // Active patrol styles
  activeHeader: { backgroundColor: '#1d4ed8', padding: 20 },
  activeTitle: { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pct: { fontSize: 22, fontWeight: '800', color: '#fff' },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: '#34d399', borderRadius: 4 },
  progressLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  cpCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cpCardDone: { opacity: 0.7 },
  cpLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cpNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cpNumDone: { backgroundColor: '#d1fae5' },
  cpNumText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  cpName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cpNameDone: { textDecorationLine: 'line-through', color: '#9ca3af' },
  cpMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  cpScanned: { fontSize: 12, color: '#10b981', marginTop: 2 },
  scanBtn: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  scanText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  endBtn: { borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  endText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
})
