import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500 mb-6">Page not found</p>
        <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
