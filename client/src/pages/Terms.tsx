import { useTranslation } from 'react-i18next'
import { usePageMeta } from '../hooks/usePageMeta'

export default function Terms() {
  const { t, i18n } = useTranslation()
  usePageMeta({
    title: 'Terms of Service',
    description:
      'Terms governing your use of Impactly AI — the privacy-first AI self-appraisal generator. Read about acceptable use, accounts, billing, and our content policies.',
    path: '/terms',
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {t('terms.title').split(' ')[0]} &amp; <span className="gradient-text">{t('terms.title').split(' ').slice(1).join(' ')}</span>
        </h1>
        <p className="text-gray-400">{t('terms.lastUpdated', { date: new Date().toLocaleDateString(i18n.language) })}</p>
      </div>

      <div className="glass-strong rounded-2xl p-8 space-y-6 text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('terms.section1Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section1Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('terms.section2Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section2Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('terms.section3Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section3Body')}
          </p>
        </section>

        <section className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl mt-8">
          <h2 className="text-2xl font-bold text-red-400 mb-3">{t('terms.section4Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section4Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('terms.section5Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section5Body')}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">{t('terms.section6Title')}</h2>
          <p className="leading-relaxed">
            {t('terms.section6Body')}
          </p>
        </section>
      </div>
    </div>
  )
}
