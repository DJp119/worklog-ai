export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Privacy <span className="gradient-text">Policy</span>
        </h1>
        <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="glass-strong rounded-2xl p-8 space-y-6 text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">1. Information We Collect</h2>
          <p className="leading-relaxed">
            We collect information you provide directly to us, such as when you create or modify your account, use our services to log work entries, or communicate with us. This includes your email address, name, job title, and the content of your work logs and appraisals.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">2. How We Use Your Information</h2>
          <p className="leading-relaxed">
            We use the information we collect to provide, maintain, and improve our services. Specifically, your work log data is processed by AI models to generate self-appraisals for you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">3. Information Sharing</h2>
          <p className="leading-relaxed">
            We do not sell your personal data. Your data is only shared with necessary third-party service providers (such as AI processing APIs and database hosts) strictly for the purpose of operating the Worklog AI service.
          </p>
        </section>

        <section className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl mt-8">
          <h2 className="text-2xl font-bold text-red-400 mb-3">4. Data Security & Disclaimer</h2>
          <p className="leading-relaxed mb-4">
            We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access. However, internet transmissions are never completely secure.
          </p>
          <p className="leading-relaxed font-semibold text-white">
            Important Disclaimer regarding impactlyai.com:
          </p>
          <p className="leading-relaxed mt-2">
            By using this service, you acknowledge that <strong>impactlyai.com is not responsible</strong> for any data leaks, breaches, or unauthorized access to your information. You agree that no blame or liability shall fall upon impactlyai.com in the event that your data is compromised. Please exercise discretion and avoid entering highly sensitive or confidential company information.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">5. Data Retention</h2>
          <p className="leading-relaxed">
            We store your data for as long as your account is active. You may request the deletion of your account and associated data at any time.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">6. Contact Us</h2>
          <p className="leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us using the Feedback form available in the application.
          </p>
        </section>
      </div>
    </div>
  )
}
