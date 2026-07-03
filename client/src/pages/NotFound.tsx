import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFound() {
  const { t } = useTranslation()
  usePageMeta({
    title: t('errors.notFound', 'Page Not Found'),
    noIndex: true, // Crucial: prevents Google from indexing garbage URLs
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-extrabold text-white mb-4 tracking-tight">
        4<span className="text-indigo-500">0</span>4
      </h1>
      <h2 className="text-2xl font-bold text-white mb-4">
        {t('errors.notFound', "We couldn't find that.")}
      </h2>
      <p className="text-gray-400 mb-8 max-w-md">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link
        to="/"
        className="px-6 py-3 rounded-lg font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
      >
        Return Home
      </Link>
    </div>
  )
}
