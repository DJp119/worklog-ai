import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePostHog } from 'posthog-js/react';
import { Timeline } from '../../components/ai-pulse/Timeline';
import { ImpactCard } from '../../components/ai-pulse/ImpactCard';
import { ShareCard } from '../../components/ai-pulse/ShareCard';
import { BookmarkBtn } from '../../components/ai-pulse/BookmarkBtn';
import { SEOHead } from '../../components/ai-pulse/SEOHead';
import { apiRequest } from '../../lib/api';

// Article interface matching database schema
interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  source_name: string | null;
  source_url: string | null;
  category: string;
  published_at: string;
  thumbnail_url: string | null;
  views_count: number;
  bookmark_count: number;
}

// Impact Card interface matching database schema
interface ImpactCard {
  id: string;
  slug: string;
  industry: string;
  industry_display_name: string;
  what_changed: string;
  impact_level: 'high' | 'medium' | 'low';
  companies_involved: string[];
  future_prediction: string;
  opportunities: string[];
  risks: string[];
  tools: string[];
  created_at: string;
}

const categories = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'models', label: 'Models' },
  { id: 'startups', label: 'Startups' },
  { id: 'research', label: 'Research' },
  { id: 'tools', label: 'Tools' },
  { id: 'funding', label: 'Funding' },
  { id: 'india_ai', label: 'India AI' },
  { id: 'world_ai', label: 'World AI' },
  { id: 'open_source', label: 'Open Source' },
  { id: 'ai_news', label: 'AI News' },
];

// Timeline event interface for API-sourced articles
interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  category: 'model' | 'research' | 'startup' | 'tool' | 'news';
  summary: string;
  sourceUrl: string;
}

// Convert Article to TimelineEvent
function articleToTimelineEvent(article: Article): TimelineEvent {
  // Extract time from published_at
  const date = new Date(article.published_at);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

  // Map category
  let category: TimelineEvent['category'] = 'news';
  if (article.category === 'models') category = 'model';
  else if (article.category === 'startups') category = 'startup';
  else if (article.category === 'tools') category = 'tool';
  else if (article.category === 'research') category = 'research';

  return {
    id: article.id,
    time: timeStr,
    title: article.title,
    category,
    summary: article.summary,
    sourceUrl: article.source_url || '#',
  };
}

export const AIPulseHub: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showShareCard, setShowShareCard] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [impactCards, setImpactCards] = useState<ImpactCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'AI Pulse Hub - Daily AI News & Industry Impact | ImpactlyAI';
  }, []);

  // Fetch articles and impact cards from API (Phase 1: RSS Automation)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch articles from RSS-sourced API
        const articlesData = await apiRequest<Article[]>('/api/ai-pulse/articles');
        setArticles(articlesData);

        // Fetch impact cards from API
        const impactsData = await apiRequest<ImpactCard[]>('/api/ai-pulse/impact-cards');
        setImpactCards(impactsData);
      } catch (err) {
        console.error('Failed to fetch AI Pulse data:', err);
        setError('Failed to load content. Please refresh the page.');
        // Fallback to empty arrays - component will render empty state
        setArticles([]);
        setImpactCards([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Track page view
  useEffect(() => {
    posthog?.capture('ai_pulse_page_view', {
      user_id: user?.id || null,
      is_authenticated: !!user,
      selected_category: selectedCategory,
      article_count: articles.length,
      impact_count: impactCards.length,
    });
  }, [selectedCategory, articles.length, impactCards.length]);

  const handleCTAClick = () => {
    posthog?.capture('ai_pulse_cta_click', {
      user_id: user?.id || null,
      is_authenticated: !!user,
      cta_location: 'growth_banner',
    });
    navigate('/dashboard');
  };

  const handleShareClick = () => {
    posthog?.capture('ai_pulse_share_click', {
      user_id: user?.id || null,
      is_authenticated: !!user,
    });
    setShowShareCard(!showShareCard);
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    posthog?.capture('ai_pulse_category_filter', {
      category: categoryId,
    });
  };

  // Filter articles by category
  const filteredArticles = articles.filter((article) => {
    if (selectedCategory === 'all') return true;
    return article.category === selectedCategory;
  });

  // Convert articles to timeline events
  const timelineEvents: TimelineEvent[] = filteredArticles.map(articleToTimelineEvent);

  return (
    <>
      <SEOHead
        title="AI Pulse Hub"
        description="Your daily destination for AI trends, breakthroughs, and industry impact. Track how AI transforms HR, Engineering, Healthcare, Marketing and more."
      />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
        {/* Header */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  AI Pulse Hub
                </h1>
                <p className="text-gray-400">
                  Your daily destination for AI trends, breakthroughs, and industry impact
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleShareClick}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mt-6">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === cat.id
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <p className="mt-4 text-gray-400">Loading AI news and insights...</p>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div className="mb-8 p-8 text-center bg-white/5 rounded-xl border border-white/10">
              <p className="text-gray-400">No articles available yet. Check back soon for the latest AI news!</p>
            </div>
          )}

          {showShareCard && !loading && (
            <div className="mb-8 p-6 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Share AI Pulse Hub</h3>
              <ShareCard
                title="Daily AI News & Industry Impact"
                subtitle="Stay updated with the latest AI breakthroughs and trends"
                stat={String(articles.length)}
                statLabel="Articles"
              />
            </div>
          )}

          {/* Timeline Section - RSS-sourced articles */}
          {!loading && articles.length > 0 && (
            <div className="mb-12">
              <Timeline
                title="Today in AI"
                events={timelineEvents}
              />
            </div>
          )}

          {/* Impact Cards Section - API-sourced */}
          {!loading && impactCards.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6">AI Industry Impact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {impactCards.map((card) => (
                  <div key={card.id} className="relative">
                    <ImpactCard
                      industry={card.industry_display_name}
                      whatChanged={card.what_changed}
                      impactLevel={card.impact_level}
                      companiesInvolved={card.companies_involved}
                      opportunities={card.opportunities}
                      risks={card.risks}
                      tools={card.tools}
                      futurePrediction={card.future_prediction}
                    />
                    <div className="mt-4">
                      <BookmarkBtn
                        targetId={card.id}
                        targetType="impact_card"
                        isAuthenticated={!!user}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth CTA Banner */}
          <div className="bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-xl p-6 border border-indigo-500/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  How AI Trends Impact Your Work
                </h3>
                <p className="text-gray-300 text-sm">
                  These industry shifts directly affect your team's productivity, skill requirements,
                  and career trajectory. Track your own work outcomes and measure the impact of AI
                  adoption in your organization.
                </p>
              </div>
              <button
                onClick={handleCTAClick}
                className="flex-shrink-0 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white font-medium transition-colors"
              >
                Track Your Work →
              </button>
            </div>
          </div>

          {/* RSS Automation Notice */}
          <div className="mt-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-200">
              <svg className="w-4 h-4 inline mr-1 -mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {/* <strong>Automated RSS Feed:</strong> Articles are automatically collected from trusted AI news sources every 6 hours.
              Sources include TechCrunch AI, VentureBeat AI, MIT Technology Review, arXiv, and more. */}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};