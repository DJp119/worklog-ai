export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Terms & <span className="gradient-text">Conditions</span>
        </h1>
        <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="glass-strong rounded-2xl p-8 space-y-6 text-gray-300">
        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p className="leading-relaxed">
            By accessing and using Worklog AI (provided by impactlyai.com), you accept and agree to be bound by the terms and provision of this agreement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">2. Description of Service</h2>
          <p className="leading-relaxed">
            Worklog AI provides a platform for users to log their weekly work activities and generate AI-powered self-appraisals. You are responsible for the data you input into the system.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">3. User Accounts</h2>
          <p className="leading-relaxed">
            To use certain features of the service, you must register for an account. You agree to provide accurate information and keep it updated. You are responsible for maintaining the confidentiality of your account and password.
          </p>
        </section>

        <section className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl mt-8">
          <h2 className="text-2xl font-bold text-red-400 mb-3">4. Limitation of Liability & Data Security</h2>
          <p className="leading-relaxed font-medium text-white mb-4">
            CRITICAL NOTICE REGARDING DATA LEAKS AND LIABILITY:
          </p>
          <p className="leading-relaxed mb-4">
            While we implement reasonable security measures, no system is entirely impenetrable. By using this service, you explicitly agree that:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-gray-300">
            <li><strong>impactlyai.com</strong>, its owners, employees, and affiliates shall <strong>NOT be held responsible or liable</strong> in any way for any data breaches, leaks, unauthorized access, or loss of information.</li>
            <li>You use this service at your own risk. Do not submit highly sensitive, classified, or proprietary company secrets that could cause harm if exposed.</li>
            <li>No blame, legal action, or claims for damages shall be brought against impactlyai.com or its operators in the event of a data security incident.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">5. Termination</h2>
          <p className="leading-relaxed">
            We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-white mb-3">6. Changes to Terms</h2>
          <p className="leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion.
          </p>
        </section>
      </div>
    </div>
  )
}
