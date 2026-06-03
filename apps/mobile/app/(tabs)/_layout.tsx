import { Tabs } from 'expo-router'
import { Home, Clock, Camera, AlertTriangle, User, CalendarDays, Route } from 'lucide-react-native'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f3f4f6',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attendance', tabBarIcon: ({ color }) => <Clock size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="photo-checkin"
        options={{ title: 'Photo', tabBarIcon: ({ color }) => <Camera size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="incidents"
        options={{ title: 'Incidents', tabBarIcon: ({ color }) => <AlertTriangle size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="leaves"
        options={{ title: 'Leaves', tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="patrol"
        options={{ title: 'Patrol', tabBarIcon: ({ color }) => <Route size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User size={22} color={color} /> }}
      />
    </Tabs>
  )
}
