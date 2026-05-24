"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Search, Zap, Calendar, Heart, ShieldAlert, Award } from "lucide-react";

export default function PainGrid() {
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
            <span className="text-[10px] text-red-400/70 font-mono uppercase tracking-widest block font-bold">The Painful Reality</span>
            <h4 className="text-lg font-bold text-white leading-tight">The "December Panic" Method</h4>
          </div>
        </div>

        <ul className="space-y-4">
          {[
            {
              title: "Staring at a Blank Appraisal Box",
              desc: "Paralysis sets in as you struggle to recall what you accomplished 6 months ago, leading to generic and underplayed self-reviews.",
              icon: AlertCircle
            },
            {
              title: "Frantic Scanning of Slack & Git",
              desc: "Wasting hours scrolling through hundreds of Slack channels, git logs, and calendar items on December 15th to find raw proof.",
              icon: Search
            },
            {
              title: "Recency Bias Minimizes Your Wins",
              desc: "Only remembering the tasks completed in the last 2 weeks, while major achievements from Q1 and Q2 are completely forgotten.",
              icon: Calendar
            },
            {
              title: "Underplayed Impact = Missed Promotions",
              desc: "Writing a modest appraisal because you lack structural data, letting others who write assertive reviews secure the raises.",
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
            <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest block font-bold">The Better Solution</span>
            <h4 className="text-lg font-bold text-white leading-tight">The Impactly AI Routine</h4>
          </div>
        </div>

        <ul className="space-y-4">
          {[
            {
              title: "Complete Database of Weekly Wins",
              desc: "A safe, private weekly archive of your accomplishments, challenges, and learnings. Organized automatically as you go.",
              icon: CheckCircle2
            },
            {
              title: "One-Click AI Appraisal Drafts",
              desc: "Mistral-powered models instantly compile a full-length, structured self-appraisal mapped directly to your goals in 5 seconds.",
              icon: Zap
            },
            {
              title: "Perfect Alignment with Company Values",
              desc: "Add your company's core values and target OKRs, and the AI weaves them flawlessly into your appraisal paragraphs.",
              icon: Heart
            },
            {
              title: "Promotion-Ready & Confident Reviews",
              desc: "Submit a highly professional, data-backed review outlining the exact value you generated. Secure the recognition you earned.",
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
