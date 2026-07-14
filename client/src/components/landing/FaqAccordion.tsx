import { useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle.mjs";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQS: FAQItem[] = [
  {
    question: "landing.faq.q1",
    answer: "landing.faq.a1"
  },
  {
    question: "landing.faq.q2",
    answer: "landing.faq.a2"
  },
  {
    question: "landing.faq.q3",
    answer: "landing.faq.a3"
  },
  {
    question: "landing.faq.q4",
    answer: "landing.faq.a4"
  },
  {
    question: "landing.faq.q5",
    answer: "landing.faq.a5"
  }
];

export default function FaqAccordion() {
  const { t } = useTranslation();
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
      "name": t(faq.question),
      "acceptedAnswer": {
        "@type": "Answer",
        "text": t(faq.answer)
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
                  <span className="text-sm md:text-base">{t(faq.question)}</span>
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
                  {t(faq.answer)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
