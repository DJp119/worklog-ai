import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Check from "lucide-react/dist/esm/icons/check.mjs";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import { joinWaitlist } from "../../lib/api";

const FREE_FEATURES = [
  "landing.pricing.freeFeature1",
  "landing.pricing.freeFeature2",
  "landing.pricing.freeFeature3",
  "landing.pricing.freeFeature4",
  "landing.pricing.freeFeature5",
  "landing.pricing.freeFeature6",
  "landing.pricing.freeFeature7",
  "landing.pricing.freeFeature8",
  "landing.pricing.freeFeature9",
  "landing.pricing.freeFeature10",
  "landing.pricing.freeFeature11",
];

const CORP_FEATURES = [
  "landing.pricing.corpFeature1",
  "landing.pricing.corpFeature2",
  "landing.pricing.corpFeature3",
  "landing.pricing.corpFeature4",
  "landing.pricing.corpFeature5",
  "landing.pricing.corpFeature6",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PricingSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleWaitlist = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setStatus("error");
      setErrorMsg(t("landing.pricing.waitlistInvalidEmail"));
      return;
    }
    setStatus("loading");
    setErrorMsg(null);
    try {
      await joinWaitlist(email, "pricing");
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(t("landing.pricing.waitlistError"));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 px-4 items-start">
      {/* Free — Individual */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/10 shadow-xl transition-all duration-300 card-hover">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white">{t("landing.pricing.freeName")}</h3>
          <p className="text-xs text-gray-500 mt-1">{t("landing.pricing.freeTagline")}</p>
          <div className="flex items-end gap-1 mt-5 mb-6">
            <span className="text-4xl font-extrabold gradient-text">{t("landing.pricing.freePrice")}</span>
            <span className="text-sm text-gray-500 mb-1">{t("landing.pricing.freePeriod")}</span>
          </div>

          <Link
            to={isLoggedIn ? "/dashboard" : "/login"}
            className="w-full inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-indigo-500/10"
          >
            <span>{t("landing.pricing.freeCta")}</span>
          </Link>
          <p className="text-[11px] text-gray-500 text-center mt-2">{t("landing.pricing.freeCtaSub")}</p>

          <ul className="mt-7 space-y-3">
            {FREE_FEATURES.map((key) => (
              <li key={key} className="flex gap-3 items-start">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-400" />
                <span className="text-xs md:text-sm text-gray-400 leading-relaxed">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Paid — Corporate Teams */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden border-indigo-500/20 hover:border-indigo-500/40 shadow-2xl transition-all duration-300 glow-primary bg-indigo-950/10 card-hover">
        <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white">{t("landing.pricing.corpName")}</h3>
          <p className="text-xs text-gray-500 mt-1">{t("landing.pricing.corpTagline")}</p>
          <div className="flex items-end gap-1 mt-5 mb-1">
            <span className="text-4xl font-extrabold gradient-text">{t("landing.pricing.corpPrice")}</span>
            <span className="text-sm text-gray-500 mb-1">{t("landing.pricing.corpPeriod")}</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-6">{t("landing.pricing.corpPriceNote")}</p>

          {status === "success" ? (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              {t("landing.pricing.waitlistSuccess")}
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex flex-col gap-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("landing.pricing.waitlistEmailPlaceholder")}
                disabled={status === "loading"}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full inline-flex items-center justify-center gap-1.5 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-indigo-500/10"
              >
                <span>{status === "loading" ? t("landing.pricing.waitlistJoining") : t("landing.pricing.corpCta")}</span>
                {status !== "loading" && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
          {status === "error" && errorMsg && (
            <p className="text-[11px] text-red-400 text-center mt-2">{errorMsg}</p>
          )}
          {status !== "success" && (
            <p className="text-[11px] text-gray-500 text-center mt-2">{t("landing.pricing.corpCtaSub")}</p>
          )}

          <p className="mt-7 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            {t("landing.pricing.corpEverything")}
          </p>
          <ul className="mt-3 space-y-3">
            {CORP_FEATURES.map((key) => (
              <li key={key} className="flex gap-3 items-start">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-400" />
                <span className="text-xs md:text-sm text-gray-300 leading-relaxed">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
