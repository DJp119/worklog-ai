import { useState } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle.mjs";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "How does the AI generate my self-appraisal?",
    answer: "Impactly AI processes your private weekly log entries, correlates them with your company's core values and appraisal goals, and drafts professional self-evaluation responses. By referencing your specific, concrete accomplishments throughout the year, the generated review is structured in a logical STAR (Situation, Task, Action, Result) format, ensuring your impact is clear and data-backed."
  },
  {
    question: "Is my corporate work log and appraisal data secure?",
    answer: "Absolutely. Security is our absolute priority. We implement database-level Row Level Security (RLS) to isolate user data completely, and encrypt all data in transit and at rest. We never sell your personal information or weekly check-ins, and we do not use your private logs to train large language models."
  },
  {
    question: "Can I customize the generated tone and appraisal criteria?",
    answer: "Yes. Impactly AI is fully customizable. You can set the writing tone (e.g., Assertive & Data-Driven, Collaborative, Leadership-focused), input your specific department OKRs, copy-paste company core values, or select a custom review period (weekly, quarterly, or yearly) to ensure the outputs match your corporate requirements perfectly."
  },
  {
    question: "Does the app support reminders so I don't forget to log weekly?",
    answer: "Yes. We offer automated, highly customizable email reminders (e.g., Monday morning at 9:00 AM) to prompt you to spend 5 minutes documenting your accomplishments before starting your week. This build-as-you-go approach completely eliminates the stress of appraisal season."
  },
  {
    question: "Is there a free trial or free tier available?",
    answer: "Yes. Impactly AI offers a robust free tier that allows you to keep unlimited weekly work logs, track consistency streaks, and generate full Q4 appraisal reports. No credit card is required to join. You can sign up via standard email or with single-click Google/GitHub OAuth directly on our login page."
  }
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Structured schema for Search Crawlers
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": FAQS.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="space-y-4">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="glass rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-5 md:p-6 text-left font-semibold text-white hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                  <span className="text-sm md:text-base">{faq.question}</span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 flex-shrink-0 ${
                    isOpen ? "rotate-180 text-indigo-400" : ""
                  }`}
                />
              </button>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isOpen ? "max-h-[250px] border-t border-white/5 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="p-5 md:p-6 text-xs md:text-sm text-gray-400 leading-relaxed bg-black/20">
                  {faq.answer}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
