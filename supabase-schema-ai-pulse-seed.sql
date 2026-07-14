-- AI Pulse Hub - Manual Seed Data
-- Run this in Supabase SQL Editor to add initial content
-- This is for Phase 0 - Manual Curation (Zero Cost MVP)

-- =====================================================
-- SEED AI ARTICLES (Manually Curated)
-- =====================================================

INSERT INTO ai_articles (title, slug, summary, content, source_url, source_name, category, published_at, impact_summary, thumbnail_url)
VALUES (
  'OpenAI Releases GPT-4.5 with Enhanced Reasoning',
  'openai-gpt-4-5-enhanced-reasoning',
  'OpenAI has announced GPT-4.5, showing 40% improvement in complex reasoning tasks. This breakthrough has major implications for enterprise automation and code generation workflows.',
  'OpenAI today announced the release of GPT-4.5, the latest iteration of their flagship language model. The new model demonstrates significant improvements in complex reasoning, particularly in multi-step problem-solving and logical deduction tasks.

Key Improvements:
- 40% better performance on reasoning benchmarks
- Enhanced code generation and debugging capabilities
- Reduced hallucination rates by 25%
- Improved multilingual support

Enterprise Implications:
Businesses can expect to see faster automation of complex workflows, from customer service to data analysis. Development teams will benefit from more accurate code suggestions and automated testing capabilities.

The model is expected to roll out to enterprise customers starting next month, with consumer availability following in Q3 2026.',
  'https://openai.com',
  'OpenAI',
  'models',
  '2026-05-24T10:30:00Z',
  'This advancement means developers can automate more complex tasks faster. Track how your team adapts to AI-assisted development with ImpactlyAI.',
  'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800'
),
(
  'Anthropic Claude 3.5 Haiku Now Available',
  'anthropic-claude-3-5-haiku-launch',
  'Anthropic has launched Claude 3.5 Haiku, a new mid-tier model that balances cost and performance. Ideal for customer service automation and content generation at scale.',
  'Anthropic today announced the general availability of Claude 3.5 Haiku, positioning it between the ultra-fast Haiku and the ultra-capable Opus models.

Key Features:
- 50% cost reduction compared to Opus
- Strong performance on customer service tasks
- Fine-tuning support for brand voice
- Real-time response capabilities

Use Cases:
Customer support teams can now automate 70%+ of inquiries while maintaining quality. Marketing teams report 3x faster content production without sacrificing brand alignment.

Pricing starts at $0.25 per 1M tokens for input and $1.25 per 1M tokens for output.',
  'https://anthropic.com',
  'Anthropic',
  'models',
  '2026-05-24T09:15:00Z',
  'Content teams can produce 3x more output. Measure your team''s content velocity and strategic impact with ImpactlyAI.',
  'https://images.unsplash.com/photo-1679904771728-3eb601ffb5a9?w=800'
),
(
  'AI Startup Funding Reaches $500M This Week',
  'ai-startup-funding-500m-may-2026',
  'Notable recipients include Anthropic ($200M), Merch.ai ($150M), plus 12 other AI startups. Total funding up 25% compared to last week, signaling continued investor confidence.',
  'Venture capital investment in AI startups reached $500 million this week alone, marking a 25% increase from the previous week and 45% year-over-year growth.

Top Rounds:
- Anthropic: $200M Series D (valuation: $18B)
- Merch.ai: $150M Series B (consumer AI commerce)
- DataMind: $75M Series A (enterprise analytics)
- 12 additional startups ranging from $5M-$50M

Focus Areas:
Enterprise AI applications continue to dominate, followed by developer tools and healthcare AI. Consumer-facing AI apps saw a 60% decrease in funding as the market consolidates.

Analyst Take:
''We''re seeing a maturity in AI investing. VCs are moving away from hype and toward proven business models with clear paths to profitability,'' says Sarah Chen, Partner at Andreessen Horowitz.',
  'https://techcrunch.com',
  'TechCrunch',
  'funding',
  '2026-05-23T14:00:00Z',
  'The influx of capital means more AI tools for teams. Track how new tools impact your team''s productivity timeline.',
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800'
),
(
  'GitHub Copilot Workspace Launches in Beta',
  'github-copilot-workspace-beta',
  'GitHub has launched Copilot Workspace in beta - an AI-powered development environment that understands entire codebases. Expected to significantly impact software engineering workflows and productivity.',
  'GitHub today announced the beta launch of Copilot Workspace, a revolutionary development environment that goes beyond line completion to understand and work with entire codebases.

Key Capabilities:
- Full codebase understanding and navigation
- Automated refactoring suggestions
- Test generation from feature descriptions
- Natural language to code conversion
- Integration with issue trackers

Early User Results:
Beta testers report 40-60% reduction in time spent on routine development tasks. Junior developers on average reduced ramp-up time from 3 months to 3 weeks.

Availability:
Workspace is available to Copilot Business and Enterprise customers starting today. Individual pricing expected in Q3 2026.',
  'https://github.com',
  'GitHub',
  'tools',
  '2026-05-23T08:00:00Z',
  'Engineering teams using Copilot Workspace report 50% faster delivery. Track your team''s velocity improvements after AI tool adoption.',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800'
),
(
  'Google DeepMind Announces AlphaFold 3',
  'googled-deepmind-alphafold-3',
  'DeepMind''s AlphaFold 3 represents a breakthrough in protein structure prediction with 30% improved accuracy. Could accelerate drug discovery timelines by years.',
  'Google DeepMind has unveiled AlphaFold 3, the latest iteration of their protein structure prediction system, with significant improvements in accuracy and scope.

Major Advances:
- 30% improved accuracy on membrane proteins
- Prediction of protein-ligand complexes
- Support for nucleic acid structures
- Faster inference times (10x speedup)

Industry Impact:
Pharmaceutical companies expect to reduce early-stage drug discovery timelines from 18 months to 6 months. Academic labs now have access to predictions that previously required expensive crystallography.

Open Access:
AlphaFold 3 predictions for 200+ million proteins are now publicly available through the AlphaFold Protein Structure Database.',
  'https://deepmind.google',
  'Google DeepMind',
  'research',
  '2026-05-22T16:00:00Z',
  'Healthcare teams adopting AI-powered drug discovery tools need outcome tracking. Measure research productivity with ImpactlyAI.',
  'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800'
);

-- =====================================================
-- SEED AI IMPACT CARDS (Industry Impacts)
-- =====================================================

INSERT INTO ai_impact_cards (slug, industry, industry_display_name, what_changed, impact_level, companies_involved, future_prediction, opportunities, risks, tools)
VALUES
(
  'hr-recruiting-ai',
  'hr',
  'HR & Recruiting',
  'AI automates resume screening, interview scheduling, and initial candidate assessment. HR teams are shifting from administrative tasks to strategic workforce planning.',
  'high',
  '{HireVue, Pymetrics, Eightfold AI, LinkedIn}' ,
  'By 2027, 80% of initial resume screening will be AI-driven. HR professionals who adapt to AI collaboration will see 30% career growth, while those who resist may face reduced market value.',
  ARRAY['HR teams can focus on strategic initiatives', 'Faster time-to-hire by 40-60%', 'Reduced unconscious bias in screening', 'Better candidate matching and retention'],
  ARRAY['Administrative HR roles may decrease', 'Need for AI literacy in HR teams', 'Potential for algorithmic bias if not monitored'],
  '{HireVue, Eightfold AI, HireEZ, Indeed AI}'
),
(
  'software-engineering-ai',
  'engineering',
  'Software Engineering',
  'AI pair programmers and code generation tools are becoming standard in development workflows. Engineering teams are seeing 2-3x productivity increases with proper adoption.',
  'high',
  '{GitHub, GitLab, Amazon, Replit}',
  'Junior developer roles will shift toward AI oversight and code review. Senior engineers who leverage AI can multiply output 2-3x. Traditional coding bootcamps will be disrupted.',
  ARRAY['Developers can focus on architecture vs boilerplate', 'Faster onboarding for junior developers', 'Reduced bugs through AI-assisted testing', 'More time for innovation'],
  ARRAY['Commoditization of basic coding skills', 'Security concerns with AI-generated code', 'Over-reliance on AI tools', 'Potential job displacement for junior roles'],
  '{GitHub Copilot, Cursor, Replit Ghostwriter, Amazon CodeWhisperer}'
),
(
  'healthcare-diagnostic-ai',
  'healthcare',
  'Healthcare',
  'AI for medical imaging, drug discovery, and patient triage is rapidly advancing. Diagnostic accuracy improvements of 20-30% are being documented across multiple conditions.',
  'high',
  '{Google Health, Tempus, Butterfly Network, Insilico Medicine}',
  'AI will become standard in radiology by 2026. Healthcare workers who embrace AI augmentation will deliver better patient outcomes. Administrative burden on clinicians will drop 40%.',
  ARRAY['Earlier disease detection through AI imaging', 'Faster drug discovery timelines', 'Reduced administrative burden on clinicians', 'Better patient triage and resource allocation'],
  ARRAY['Regulatory approval challenges', 'Data privacy concerns', 'Need for human oversight in critical decisions', 'Potential liability questions'],
  '{Tempus, Butterfly Network, Aidoc, PathAI}'
),
(
  'marketing-content-ai',
  'marketing',
  'Marketing & Content',
  'AI content generation is transforming copywriting, design, and campaign optimization. Marketing teams are producing 5-10x more content while reducing costs.',
  'medium',
  '{Jasper, Copy.ai, Canva, Midjourney}',
  'Marketing teams will need fewer content creators but more AI Prompt engineers and content strategists. Entry-level content roles will decline 40% while strategic roles grow 50%.',
  ARRAY['Faster content production at lower cost', 'Personalization at scale', 'Data-driven campaign optimization', 'A/B testing at unprecedented speed'],
  ARRAY['Content saturation and quality concerns', 'Copyright and originality issues', 'Reduced demand for entry-level content work', 'Brand consistency challenges'],
  '{Jasper, Midjourney, Surfer SEO, Copy.ai, Canva Magic}'
),
(
  'finance-ai-adoption',
  'finance',
  'Finance & Accounting',
  'AI is automating financial analysis, fraud detection, and compliance reporting. Banks report 50% reduction in false positives for fraud detection.',
  'medium',
  '{JPMorgan Chase, Goldman Sachs, Stripe, Plaid}',
  'Traditional financial analysts will need to pivot to strategic advisory roles. AI-augmented analysts will outperform pure human analysts by 3x in accuracy and speed.',
  ARRAY['Automated financial analysis and reporting', 'Improved fraud detection accuracy', 'Faster compliance and audit processes', 'Better investment recommendations'],
  ARRAY['Job displacement for routine analysis', 'Over-reliance on AI predictions', 'Regulatory compliance uncertainty', 'Systemic risk from AI herd behavior'],
  '{JPMorgan COIN, BlackRock Aladdin, Stripe Sigma, Plaid AI}'
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that articles were inserted
SELECT COUNT(*) as article_count FROM ai_articles;
SELECT slug, title, category, published_at FROM ai_articles ORDER BY published_at DESC;

-- Check that impact cards were inserted
SELECT COUNT(*) as impact_card_count FROM ai_impact_cards;
SELECT slug, industry_display_name, impact_level FROM ai_impact_cards ORDER BY industry;