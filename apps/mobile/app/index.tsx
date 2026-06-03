import { Redirect } from 'expo-router'
import { useAuthStore } from '../store/auth'

export default function IndexPage() {
  const { isAuthenticated } = useAuthStore()
  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/login'} />
}
