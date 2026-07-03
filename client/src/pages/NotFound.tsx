import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFound() {
  usePageMeta({
    title: 'Page Not Found',
    path: '/404',
    noIndex: true,
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-futuristic px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold gradient-text mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/20 transition-all"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}
