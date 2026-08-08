import { NewsItem } from '../types';

export interface SearchHistoryItem {
  id: string;
  query: string;
  enabled: boolean;
  timestamp: string;
}

export interface FeedSettings {
  safeMode: boolean;
  blockedCategories: string[]; // e.g. 'terrorism', 'violence', 'sexual_content', 'homicide', 'threats', 'politics', 'sensitive_topics', 'gambling_spam'
  customBlockedKeywords: string[];
  interestKeywords: string[];
  searchHistory: SearchHistoryItem[];
  feedMode: 'all' | 'interests_only' | 'recommendations';
  sortMode: 'newest' | 'popular' | 'relevance';
  alwaysShowOfficial: boolean;
  hideMediaOnly: boolean;
}

export const DEFAULT_FEED_SETTINGS: FeedSettings = {
  safeMode: true,
  blockedCategories: ['terrorism', 'violence', 'sexual_content', 'homicide', 'threats'],
  customBlockedKeywords: [],
  interestKeywords: ['Технологии', 'ИИ', 'Обновления', 'Дизайн', 'Новости ORBIT'],
  searchHistory: [
    { id: 'sh_1', query: 'Нейросети', enabled: true, timestamp: new Date().toISOString() },
    { id: 'sh_2', query: 'Обновления ORBIT', enabled: true, timestamp: new Date().toISOString() },
    { id: 'sh_3', query: 'UI Дизайн', enabled: false, timestamp: new Date().toISOString() },
  ],
  feedMode: 'recommendations',
  sortMode: 'newest',
  alwaysShowOfficial: true,
  hideMediaOnly: false,
};

export const SAFE_MODE_CATEGORY_DICTIONARY: Record<string, { label: string; keywords: string[] }> = {
  terrorism: {
    label: 'Терроризм и экстремизм',
    keywords: ['терроризм', 'террорист', 'экстремизм', 'теракт', 'взрыв', 'заложник', 'terrorism', 'explosion'],
  },
  violence: {
    label: 'Насилие и жестокость',
    keywords: ['насилие', 'жестокость', 'избиение', 'драка', 'пытки', 'кровь', 'violence', 'blood', 'fight'],
  },
  sexual_content: {
    label: 'Сексуальный контент & 18+',
    keywords: ['порно', 'эротика', 'сексуальн', '18+', 'пошлость', 'обнажен', 'nsfw', 'porn', 'sex'],
  },
  homicide: {
    label: 'Убийства и криминал',
    keywords: ['убийств', 'убит', 'труп', 'гибель', 'смерть', 'киллер', 'покушение', 'murder', 'kill'],
  },
  threats: {
    label: 'Угрозы и травля',
    keywords: ['угроз', 'шантаж', 'вымогательство', 'травля', 'буллинг', 'threat', 'harassment'],
  },
  politics: {
    label: 'Политика и госспоры',
    keywords: ['политика', 'выборы', 'депутат', 'партия', 'президент', 'правительство', 'санкции', 'митинг', 'politics'],
  },
  sensitive_topics: {
    label: 'Сложные темы & Трагедии',
    keywords: ['трагедия', 'депрессия', 'катастрофа', 'крушение', 'суицид', 'авария', 'паника', 'суд', 'tragedy'],
  },
  gambling_spam: {
    label: 'Азартные игры & Спам',
    keywords: ['казино', 'ставка', 'ставки', 'рулетка', 'выигрыш', 'криптопирамида', 'спам', 'casino', 'poker', 'betting'],
  },
};

/**
 * Helper to retrieve user feed settings from localStorage
 */
export function getStoredFeedSettings(userId?: string): FeedSettings {
  if (typeof window === 'undefined') return DEFAULT_FEED_SETTINGS;
  try {
    const key = `orbit_feed_settings_${userId || 'me'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_FEED_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_FEED_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_FEED_SETTINGS;
  }
}

/**
 * Helper to save user feed settings to localStorage and trigger change event
 */
export function saveFeedSettings(settings: FeedSettings, userId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const key = `orbit_feed_settings_${userId || 'me'}`;
    localStorage.setItem(key, JSON.stringify(settings));
    window.dispatchEvent(new Event('orbit_feed_settings_changed'));
  } catch (err) {
    console.error('Error saving feed settings:', err);
  }
}

/**
 * Add a new search query to the search history in settings
 */
export function addSearchQueryToHistory(query: string, userId?: string) {
  const clean = query.trim();
  if (!clean) return;
  const currentSettings = getStoredFeedSettings(userId);
  const history = currentSettings.searchHistory || [];

  const existingIdx = history.findIndex((item) => item.query.toLowerCase() === clean.toLowerCase());
  let updatedHistory: SearchHistoryItem[];

  if (existingIdx !== -1) {
    const existing = history[existingIdx];
    updatedHistory = [
      { ...existing, enabled: true, timestamp: new Date().toISOString() },
      ...history.filter((_, idx) => idx !== existingIdx),
    ];
  } else {
    updatedHistory = [
      {
        id: 'sh_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6),
        query: clean,
        enabled: true,
        timestamp: new Date().toISOString(),
      },
      ...history,
    ].slice(0, 30);
  }

  const newSettings = { ...currentSettings, searchHistory: updatedHistory };
  saveFeedSettings(newSettings, userId);
}

/**
 * Check if a news post is official system/platform news
 */
export function isOfficialNews(item: NewsItem): boolean {
  const tagLower = (item.tag || '').toLowerCase();
  const authorLower = (item.authorName || '').toLowerCase();
  const authorHandle = (item.authorHandle || '').toLowerCase();

  return (
    tagLower.includes('обновлен') ||
    tagLower.includes('dev') ||
    tagLower.includes('релиз') ||
    tagLower.includes('система') ||
    tagLower.includes('анонс') ||
    tagLower.includes('orbit') ||
    authorLower.includes('orbit') ||
    authorLower.includes('разраб') ||
    authorLower.includes('система') ||
    authorLower.includes('админ') ||
    authorHandle.includes('admin') ||
    authorHandle.includes('orbit')
  );
}

/**
 * Calculate keyword match relevance score for a post
 */
export function calculateRelevanceScore(item: NewsItem, keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0;

  const textToSearch = `${item.title || ''} ${item.content || ''} ${item.tag || ''} ${item.authorName || ''}`.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    const cleanKw = kw.trim().toLowerCase();
    if (!cleanKw) continue;
    if (textToSearch.includes(cleanKw)) {
      score += 10;
      // Bonus if keyword is in title or tag
      if ((item.title || '').toLowerCase().includes(cleanKw)) score += 5;
      if ((item.tag || '').toLowerCase().includes(cleanKw)) score += 5;
    }
  }

  return score;
}

/**
 * Main Algorithm: Filters and ranks news items based on user settings
 */
export function filterAndRankNews(newsList: NewsItem[], settings: FeedSettings): NewsItem[] {
  if (!newsList || newsList.length === 0) return [];

  const {
    safeMode,
    blockedCategories,
    customBlockedKeywords,
    interestKeywords,
    feedMode,
    sortMode,
    alwaysShowOfficial,
  } = settings;

  // Combine interestKeywords with enabled search history queries for relevance calculation
  const enabledSearchKeywords = (settings.searchHistory || [])
    .filter((s) => s.enabled && s.query && s.query.trim())
    .map((s) => s.query.trim());

  const activeKeywords = [...interestKeywords, ...enabledSearchKeywords];

  // 1. Prepare blocked keywords list from selected categories + custom keywords
  const activeBlockedKeywords: string[] = [];

  if (safeMode) {
    for (const catId of blockedCategories) {
      const catConfig = SAFE_MODE_CATEGORY_DICTIONARY[catId];
      if (catConfig) {
        activeBlockedKeywords.push(...catConfig.keywords);
      }
    }
    if (Array.isArray(customBlockedKeywords)) {
      activeBlockedKeywords.push(...customBlockedKeywords.map((k) => k.toLowerCase()));
    }
  }

  // 2. Filter posts
  const filtered = newsList.filter((item) => {
    const isOfficial = isOfficialNews(item);

    // Safe mode check
    if (safeMode && activeBlockedKeywords.length > 0) {
      const fullText = `${item.title || ''} ${item.content || ''} ${item.tag || ''}`.toLowerCase();
      const isBlocked = activeBlockedKeywords.some((word) => word && fullText.includes(word.toLowerCase()));
      if (isBlocked && !(isOfficial && alwaysShowOfficial)) {
        return false;
      }
    }

    // Feed mode check
    if (feedMode === 'interests_only') {
      if (isOfficial && alwaysShowOfficial) return true;
      const score = calculateRelevanceScore(item, activeKeywords);
      if (score === 0) return false;
    }

    return true;
  });

  // 3. Score & Rank items
  const scoredItems = filtered.map((item) => {
    const relevanceScore = calculateRelevanceScore(item, activeKeywords);
    const likes = item.likesCount || 0;
    const comments = item.commentsCount || 0;
    const popularityScore = likes * 2 + comments * 3;

    // Time score (newer posts get higher baseline)
    const timeMs = new Date(item.timestamp).getTime() || 0;

    return {
      item,
      relevanceScore,
      popularityScore,
      timeMs,
      isOfficial: isOfficialNews(item),
    };
  });

  // 4. Sort according to settings
  scoredItems.sort((a, b) => {
    // Recommendation mode combines relevance + popularity + recency
    if (feedMode === 'recommendations') {
      const scoreA = a.relevanceScore * 3 + a.popularityScore + (a.isOfficial && alwaysShowOfficial ? 20 : 0);
      const scoreB = b.relevanceScore * 3 + b.popularityScore + (b.isOfficial && alwaysShowOfficial ? 20 : 0);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.timeMs - a.timeMs;
    }

    if (sortMode === 'popular') {
      if (a.popularityScore !== b.popularityScore) {
        return b.popularityScore - a.popularityScore;
      }
      return b.timeMs - a.timeMs;
    }

    if (sortMode === 'relevance') {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.timeMs - a.timeMs;
    }

    // Default 'newest'
    return b.timeMs - a.timeMs;
  });

  return scoredItems.map((s) => s.item);
}
