import AlertCircle from "lucide-react/dist/esm/icons/alert-circle.mjs";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import Search from "lucide-react/dist/esm/icons/search.mjs";
import Zap from "lucide-react/dist/esm/icons/zap.mjs";
import Calendar from "lucide-react/dist/esm/icons/calendar.mjs";
import Heart from "lucide-react/dist/esm/icons/heart.mjs";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert.mjs";
import Award from "lucide-react/dist/esm/icons/award.mjs";
import { useTranslation } from "react-i18next";

export default function PainGrid() {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
      {/* The Old Way: Stress Card */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden border-red-500/10 hover:border-red-500/20 shadow-xl transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/5 to-transparent rounded-bl-full"></div>
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-red-400/70 font-mono uppercase tracking-widest block font-bold">{t('landing.painGrid.painfulReality')}</span>
            <h4 className="text-lg font-bold text-white leading-tight">{t('landing.painGrid.decemberPanic')}</h4>
          </div>
        </div>

        <ul className="space-y-4">
          {[
            {
              title: t('landing.painGrid.p1Title'),
              desc: t('landing.painGrid.p1Desc'),
              icon: AlertCircle
            },
            {
              title: t('landing.painGrid.p2Title'),
              desc: t('landing.painGrid.p2Desc'),
              icon: Search
            },
            {
              title: t('landing.painGrid.p3Title'),
              desc: t('landing.painGrid.p3Desc'),
              icon: Calendar
            },
            {
              title: t('landing.painGrid.p4Title'),
              desc: t('landing.painGrid.p4Desc'),
              icon: Award
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <li key={idx} className="flex gap-4 items-start group">
                <div className="mt-1 flex-shrink-0 text-red-500/60 group-hover:text-red-400 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-gray-200 mb-0.5">{item.title}</h5>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The New Way: Impactly Card */}
      <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden border-indigo-500/10 hover:border-indigo-500/35 shadow-2xl transition-all duration-300 glow-primary bg-indigo-950/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>

        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest block font-bold">{t('landing.painGrid.betterSolution')}</span>
            <h4 className="text-lg font-bold text-white leading-tight">{t('landing.painGrid.impactlyRoutine')}</h4>
          </div>
        </div>

        <ul className="space-y-4">
          {[
            {
              title: t('landing.painGrid.s1Title'),
              desc: t('landing.painGrid.s1Desc'),
              icon: CheckCircle2
            },
            {
              title: t('landing.painGrid.s2Title'),
              desc: t('landing.painGrid.s2Desc'),
              icon: Zap
            },
            {
              title: t('landing.painGrid.s3Title'),
              desc: t('landing.painGrid.s3Desc'),
              icon: Heart
            },
            {
              title: t('landing.painGrid.s4Title'),
              desc: t('landing.painGrid.s4Desc'),
              icon: Award
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <li key={idx} className="flex gap-4 items-start group">
                <div className="mt-1 flex-shrink-0 text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-white mb-0.5">{item.title}</h5>
                  <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
