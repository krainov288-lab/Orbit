import { NewsItem } from '../types';

const SAVED_NEWS_KEY = 'orbit_saved_news_items';

/**
 * Get all saved news items from localStorage
 */
export function getSavedNewsItems(): NewsItem[] {
  try {
    const data = localStorage.getItem(SAVED_NEWS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Check if a news item is saved by ID
 */
export function isNewsItemSaved(id: string): boolean {
  const items = getSavedNewsItems();
  return items.some((item) => item.id === id);
}

/**
 * Toggle saved status for a news item
 */
export function toggleSaveNewsItem(newsItem: NewsItem): boolean {
  const items = getSavedNewsItems();
  const existsIdx = items.findIndex((item) => item.id === newsItem.id);
  let isSaved = false;

  if (existsIdx !== -1) {
    items.splice(existsIdx, 1);
    isSaved = false;
  } else {
    items.unshift({ ...newsItem, timestamp: newsItem.timestamp || new Date().toLocaleDateString('ru-RU') });
    isSaved = true;
  }

  try {
    localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('orbit_saved_news_updated'));
  } catch (err) {
    console.error('Failed to save news items to localStorage', err);
  }

  return isSaved;
}

/**
 * Remove saved news item by ID
 */
export function removeSavedNewsItem(id: string): void {
  const items = getSavedNewsItems();
  const updated = items.filter((item) => item.id !== id);
  try {
    localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('orbit_saved_news_updated'));
  } catch (err) {
    console.error('Failed to remove saved news item', err);
  }
}

/**
 * Clear all saved news items
 */
export function clearAllSavedNewsItems(): void {
  try {
    localStorage.removeItem(SAVED_NEWS_KEY);
    window.dispatchEvent(new CustomEvent('orbit_saved_news_updated'));
  } catch (err) {
    console.error('Failed to clear saved news items', err);
  }
}
