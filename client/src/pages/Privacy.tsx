import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../hooks/usePageMeta'

export default function Privacy() {
  const { t, i18n } = useTranslation()
  usePageMeta({
    title: 'Privacy Policy',
    description:
      'How Impactly AI collects, uses, and protects your data. Row-Level Security, encryption in transit and at rest, and an explicit no-LLM-training policy on private work logs.',
    path: '/privacy',
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {t('privacy.title').split(' ')[0]} <span className="gradient-text">{t('privacy.title').split(' ').slice(1).join(' ')}</span>
        </h1>
        <p className="text-gray-400">{t('privacy.lastUpdated', { date: new Date().toLocaleDateString(i18n.language) })}</p>
      </div>

      <div className="glass-strong rounded-2xl p-8 space-y-6 text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section1Title')}</h2>
          <p className="leading-relaxed">
            {t('privacy.section1Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section2Title')}</h2>
          <p className="leading-relaxed">
            {t('privacy.section2Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section3Title')}</h2>
          <p className="leading-relaxed">
            {t('privacy.section3Body')}
          </p>
        </section>

        <section className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl mt-8">
          <h2 className="text-2xl font-bold text-red-400 mb-3">{t('privacy.section4Title')}</h2>
          <p className="leading-relaxed mb-4">
            {t('privacy.section4Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section5Title')}</h2>
          <p className="leading-relaxed">
            {t('privacy.section5Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('privacy.section6Title')}</h2>
          <p className="leading-relaxed">
            {t('privacy.section6Body')}
          </p>
        </section>
      </div>
    </div>
  )
}
