"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Terminal, FileText, ChevronRight, User, RefreshCw, MessageSquare } from "lucide-react";

interface Preset {
  role: string;
  label: string;
  icon: React.ElementType;
  rawInput: string;
  tones: {
    [key: string]: {
      accomplishment: string;
      appraisal: string;
    };
  };
}

const PRESETS: Preset[] = [
  {
    role: "general",
    label: "General / Operations",
    icon: User,
    rawInput: "Organized our file system and made a tracking sheet for vendor invoices.",
    tones: {
      data: {
        accomplishment: "Standardized the digital document repository and engineered an automated vendor invoice tracking system.",
        appraisal: "During this review period, I took the initiative to audit and restructure our department's digital filing systems, standardizing asset organization across 5 core divisions. Additionally, I designed and implemented a centralized vendor invoice tracker using automated scripts. This unified workspace reduced invoice routing delays by 40%, cut down search times for active vendor records from hours to seconds, and eliminated manual data duplication errors."
      },
      collaborative: {
        accomplishment: "Partnered with finance and administration to build an easier digital invoicing and filing workspace.",
        appraisal: "I focused heavily on cross-departmental alignment this period, collaborating closely with both the Finance and Administration teams. Understanding their recurring friction points, I actively designed and rolled out an accessible digital invoicing tracker. By organizing training sessions and gathering user feedback, I successfully onboarded 12 team members, ensuring that vendor documents are now centralized and seamlessly tracked by all key stakeholders."
      },
      leadership: {
        accomplishment: "Led the migration of team directories and built a vendor invoice system to save administrative hours.",
        appraisal: "I demonstrated strong leadership by identifying a critical operational bottleneck in our billing workflow. I took full ownership of auditing our digital filing repository and spearheaded the design of an automated invoice tracker. I defined standard operating procedures, coordinated routing protocols with our accounts payable department, and established a framework that now saves our administrative staff roughly 8 hours of manual tracking per week."
      }
    }
  },
  {
    role: "marketing",
    label: "Marketing",
    icon: MessageSquare,
    rawInput: "Updated the website copy and ran a small email newsletter that got new signups.",
    tones: {
      data: {
        accomplishment: "Redesigned core landing page messaging and launched a targeted email campaign that grew subscribers.",
        appraisal: "This quarter, I executed a data-driven landing page optimization campaign, completely overhauling above-the-fold copywriting and conversion funnels. In parallel, I structured and launched a bi-weekly newsletter cycle targeting cold leads. These changes directly triggered an 18% improvement in website visitor-to-lead conversion rate and generated 450+ new marketing qualified leads (MQLs) within 30 days."
      },
      collaborative: {
        accomplishment: "Worked with design and product teams to update website copy and coordinate an email campaign.",
        appraisal: "I collaborated extensively with the Product and Design teams to realign our website's value propositions, ensuring consistent product-led messaging across all touchpoints. By facilitating brainstorming sessions, I translated technical specs into customer-facing copy. Additionally, I partnered with our operations team to release a successful newsletter campaign, building a cross-functional workflow that will serve as our launch blueprint."
      },
      leadership: {
        accomplishment: "Spearheaded website message repositioning and established our new email newsletter growth engine.",
        appraisal: "Recognizing that our web conversion rate had plateaued, I took ownership of our positioning strategy. I drove the repositioning of our homepage copywriting and established a brand-new weekly newsletter stream. By defining the content roadmap, setting key performance metrics, and managing the creative execution, I successfully built a repeatable subscriber acquisition engine that delivers a steady 8% week-over-week audience growth."
      }
    }
  },
  {
    role: "sales",
    label: "Sales / Success",
    icon: Sparkles,
    rawInput: "Helped a big customer who wanted to cancel and got them to renew their contract.",
    tones: {
      data: {
        accomplishment: "Successfully resolved churn risk with a major enterprise account and secured a multi-year renewal.",
        appraisal: "I actively managed high-risk client relationships this quarter, identifying a critical churn risk in our largest enterprise account. By conducting an in-depth account health audit and identifying under-utilized features, I presented a tailored success plan. This strategic intervention successfully reversed their cancellation request, secured a $120,000 multi-year contract renewal, and unlocked an additional $15,000 in account expansion revenue."
      },
      collaborative: {
        accomplishment: "Partnered with product and support teams to address key client issues and secure their renewal.",
        appraisal: "When our major enterprise client flagged critical product friction, I acted as the primary bridge between the client, our Support, and Product Engineering teams. I coordinated daily syncs, prioritized their feedback into our engineering sprint, and kept the client fully updated. Thanks to this unified team effort and transparent communication, we resolved their issues and secured their enthusiastic long-term renewal."
      },
      leadership: {
        accomplishment: "Established an account recovery framework to salvage major accounts and prevent revenue churn.",
        appraisal: "Confronted with potential contract cancellations, I developed and spearheaded a new 'Account Rescue Protocol'. I took direct ownership of our primary enterprise account during a critical transition period, coordinating cross-functional resources to address product gaps. The success of this methodology not only salvaged a major account but has now been adopted as our official team-wide playbook for handling high-risk accounts."
      }
    }
  },
  {
    role: "engineering",
    label: "Engineering",
    icon: Terminal,
    rawInput: "Fixed the lag in database queries and made the dashboard load faster.",
    tones: {
      data: {
        accomplishment: "Optimized complex SQL queries and indexed database tables to slash dashboard load times.",
        appraisal: "During this review period, I identified and resolved a critical latency issue in our primary analytics dashboard. By auditing active database sessions, refactoring inefficient nested queries, and implementing optimal database indexing, I successfully reduced SQL query execution times by 68%. This directly improved the dashboard's average page load time from 4.2 seconds down to a highly responsive 1.1 seconds."
      },
      collaborative: {
        accomplishment: "Worked closely with frontend devs and QA to identify performance bottlenecks and speed up the page.",
        appraisal: "To tackle dashboard load delays, I collaborated closely with frontend developers and QA engineers. I organized a performance workshop to profile our API layer, aligning the team on a unified caching strategy. By working together to deploy redis middleware and resolve query bottlenecks, we achieved a smooth page experience, vastly improving usability for our client base."
      },
      leadership: {
        accomplishment: "Led the performance task force to optimize core data models and establish site speed standards.",
        appraisal: "Recognizing that loading latency was impacting user retention, I initiated and led a performance optimization task force. I took charge of auditing our core data access layers, delegating optimization tasks, and setting strict load-time SLA benchmarks. Under my guidance, the team restructured our indexing schema, resulting in an immediate 70% decrease in server latency and establishing new optimization templates for future features."
      }
    }
  }
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://worklog-ai-7qh6.onrender.com";

export default function PlaygroundWidget() {
  const [activeRole, setActiveRole] = useState("general");
  const [activeTone, setActiveTone] = useState("data");
  const [userInput, setUserInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [generatedAccomplishment, setGeneratedAccomplishment] = useState("");

  const currentPreset = PRESETS.find((p) => p.role === activeRole) || PRESETS[0];

  // Sync preset text on role change ONLY if the input is empty or matches one of the presets
  useEffect(() => {
    const isPreset = PRESETS.some((p) => p.rawInput === userInput) || userInput.trim() === "";
    if (isPreset) {
      setUserInput(currentPreset.rawInput);
    }
  }, [activeRole, currentPreset.rawInput]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setShowResult(false);
    setDisplayedText("");
    setGeneratedAccomplishment("");

    try {
      const response = await fetch(`${API_URL}/api/appraisal/playground-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userInput,
          role: activeRole,
          tone: activeTone,
        }),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const resData = await response.json();
      if (resData.success && resData.data) {
        const { accomplishment, appraisal } = resData.data;
        setGeneratedAccomplishment(accomplishment);
        startTyping(appraisal);
        return;
      }
    } catch (error) {
      console.warn("Dynamic playground generation failed, falling back to preset static text:", error);
    }

    // Graceful Fallback
    const presetData = currentPreset.tones[activeTone];
    setGeneratedAccomplishment(presetData.accomplishment);
    startTyping(presetData.appraisal);
  };

  const startTyping = (targetText: string) => {
    setIsGenerating(false);
    setIsTyping(true);
    setShowResult(true);

    let index = 0;
    const interval = setInterval(() => {
      if (index < targetText.length) {
        setDisplayedText(targetText.substring(0, index + 5));
        index += 5;
      } else {
        setDisplayedText(targetText);
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 10);
  };

  return (
    <div className="w-full max-w-4xl mx-auto glass rounded-3xl p-6 md:p-8 relative overflow-hidden border border-white/5 shadow-2xl">
      {/* Background soft glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Left Side: Inputs */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-medium text-sm mb-4 tracking-wide uppercase">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Interactive Playground</span>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">
              Try the AI Appraisal Generator
            </h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Select your role, pick a communication tone, and see how simple bullet points turn into high-impact self-appraisals.
            </p>

            {/* Role selection */}
            <div className="mb-4">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                1. Select Profession
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => {
                  const IconComponent = preset.icon;
                  return (
                    <button
                      key={preset.role}
                      onClick={() => {
                        if (!isGenerating && !isTyping) {
                          setActiveRole(preset.role);
                        }
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        activeRole === preset.role
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                          : "border-white/5 bg-white/2 hover:bg-white/5 text-gray-400 hover:text-white"
                      }`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tone Selection */}
            <div className="mb-4">
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                2. Pick Writing Tone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "data", label: "Data-Driven" },
                  { id: "collaborative", label: "Collaborative" },
                  { id: "leadership", label: "Leadership" }
                ].map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => {
                      if (!isGenerating && !isTyping) {
                        setActiveTone(tone.id);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      activeTone === tone.id
                        ? "bg-purple-500/10 border-purple-500/30 text-purple-300"
                        : "border-white/5 bg-white/2 hover:bg-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bullet Point Input */}
            <div>
              <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">
                3. Raw Achievement
              </label>
              <textarea
                value={userInput}
                onChange={(e) => {
                  if (!isGenerating && !isTyping) {
                    setUserInput(e.target.value);
                  }
                }}
                rows={3}
                className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
                placeholder="What did you work on this week?"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || isTyping || !userInput.trim()}
            className="w-full flex items-center justify-center gap-2 p-3.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer select-none"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing data points...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Appraisal Draft</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Interactive AI Output Workspace */}
        <div className="lg:col-span-7 flex flex-col min-h-[360px] bg-black/50 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
          {/* Editor Header Bar */}
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/50"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/50"></span>
              </div>
              <span className="text-[11px] font-mono text-gray-500 ml-2">appraisal_draft.md</span>
            </div>
            {showResult && (
              <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
                Mistral AI Powered
              </span>
            )}
          </div>

          {/* AI Generation Loader State */}
          {isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              {/* Animated Pipeline */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <Terminal className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono text-center max-w-[200px]">
                Structuring logs into STAR narrative, mapping company values...
              </div>
            </div>
          )}

          {/* Initial State */}
          {!isGenerating && !showResult && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-gray-400 text-sm font-semibold mb-1">Workspace Ready</p>
              <p className="text-gray-600 text-xs max-w-[240px]">
                Click the generate button to transform your raw bullet accomplishments into a promotion-ready narrative.
              </p>
            </div>
          )}

          {/* Result Typing State / Output */}
          {showResult && (
            <div className="flex-1 flex flex-col justify-between relative">
              <div className="text-sm leading-relaxed font-sans text-gray-300 prose prose-invert select-text pb-20">
                <p className="font-semibold text-white border-b border-white/5 pb-2 mb-3">
                  Key Accomplishments (Q4 Review):
                </p>
                <div className="text-xs font-mono text-gray-500 mb-4 bg-white/2 p-2.5 rounded border border-white/5">
                  <span className="text-indigo-400">Accomplishment:</span> {generatedAccomplishment || currentPreset.tones[activeTone].accomplishment}
                </div>
                <p className="whitespace-pre-line text-[13px] md:text-sm">
                  {displayedText}
                  {isTyping && <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse"></span>}
                </p>
              </div>

              {/* Dynamic Blurred Overlay with Sign Up CTA */}
              {!isTyping && (
                <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/95 to-transparent flex items-end justify-center pb-2">
                  <div className="w-full glass rounded-xl border border-white/10 p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                    <div className="text-center sm:text-left">
                      <p className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
                        Unlock Full Performance Document
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Export STAR reviews, career reflections, and AI chat critiques.
                      </p>
                    </div>
                    <a
                      href="https://app.impactlyai.com/login"
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-indigo-500/20 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Join Free</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
