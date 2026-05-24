import Parser from 'rss-parser';

const parser = new Parser();

// Free RSS sources for AI news (no API keys required)
// Use this when enabling Phase 1 automation
export const FREE_RSS_SOURCES = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'news' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'news' },
  { name: 'The Decoder', url: 'https://the-decoder.com/feed/', category: 'news' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', category: 'research' },
  { name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed', category: 'research' },
  { name: 'Reddit r/MachineLearning', url: 'https://www.reddit.com/r/MachineLearning.rss', category: 'news' },
  { name: 'arXiv CS.AI', url: 'http://export.arxiv.org/rss/cs.AI', category: 'research' },
];

export interface RSSItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  published_at: string;
  category: string;
}

/**
 * Fetch items from a single RSS feed
 * Phase 0: This is exported for Phase 1 automation
 */
export async function fetchRSSFeed(url: string, sourceName: string, defaultCategory: string) {
  try {
    const feed = await parser.parseURL(url);

    const items: RSSItem[] = feed.items.slice(0, 10).map((item) => ({
      title: item.title || 'No title',
      url: item.link || '',
      summary: (item.contentSnippet || item.content || item.description || 'No summary').slice(0, 500),
      source: sourceName,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      category: defaultCategory,
    }));

    return items;
  } catch (err) {
    console.error(`Failed to fetch RSS feed ${sourceName}:`, err);
    return [];
  }
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100);
}