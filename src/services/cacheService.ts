// WhatsApp-like Local Persistence & Fast Data Sync Cache Engine

const CACHE_PREFIX = 'orbit_cache_v2_';

class CacheService {
  private memoryCache: Map<string, any> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('orbit_app_cache_db', 1);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('app_cache')) {
            db.createObjectStore('app_cache');
          }
        };
        req.onsuccess = (e) => {
          resolve((e.target as IDBOpenDBRequest).result);
        };
        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  public isDataSaverEnabled(): boolean {
    return localStorage.getItem('orbit_data_saver_mode') === 'true';
  }

  public setDataSaverMode(enabled: boolean): void {
    localStorage.setItem('orbit_data_saver_mode', enabled ? 'true' : 'false');
  }

  // Synchronous read from memory / localStorage for 0ms zero-latency render
  public getSync<T>(key: string): T | null {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.memoryCache.set(key, parsed);
        return parsed as T;
      }
    } catch {
      /* quota exceeded or storage disabled */
    }
    return null;
  }

  // Asynchronous read from IndexedDB with fallback to memory
  public async getAsync<T>(key: string): Promise<T | null> {
    const syncVal = this.getSync<T>(key);
    if (syncVal) return syncVal;

    const db = await this.dbPromise;
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('app_cache', 'readonly');
        const store = tx.objectStore('app_cache');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result) {
            this.memoryCache.set(key, req.result);
            resolve(req.result as T);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  // Save to memory, localStorage, and IndexedDB
  public set<T>(key: string, data: T): void {
    if (data === undefined || data === null) return;

    this.memoryCache.set(key, data);

    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    } catch {
      /* ignore storage quota exceeded */
    }

    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction('app_cache', 'readwrite');
          const store = tx.objectStore('app_cache');
          store.put(data, key);
        } catch {
          /* ignore */
        }
      });
    }
  }

  public remove(key: string): void {
    this.memoryCache.delete(key);
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch {}
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction('app_cache', 'readwrite');
          const store = tx.objectStore('app_cache');
          store.delete(key);
        } catch {}
      });
    }
  }

  public clearAllCache(): void {
    this.memoryCache.clear();
    try {
      Object.keys(localStorage).forEach((k) => {
        if (
          (k.startsWith(CACHE_PREFIX) || k.startsWith('orbit_')) &&
          k !== 'orbit_jwt_token' &&
          !k.startsWith('orbit_app_lang') &&
          !k.startsWith('orbit_theme_') &&
          !k.startsWith('orbit_hide_read_receipts')
        ) {
          localStorage.removeItem(k);
        }
      });
    } catch {}
    if (this.dbPromise) {
      this.dbPromise.then((db) => {
        if (!db) return;
        try {
          const tx = db.transaction('app_cache', 'readwrite');
          const store = tx.objectStore('app_cache');
          store.clear();
        } catch {}
      });
    }
  }

  // Specialized WhatsApp-like helpers
  public getCachedContacts(): any[] | null {
    return this.getSync<any[]>('contacts');
  }

  public setCachedContacts(contacts: any[]): void {
    this.set('contacts', contacts);
  }

  public getCachedNews(): any[] | null {
    const memory = this.getSync<any[]>('news');
    if (memory && Array.isArray(memory)) return memory;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('orbit_news_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return null;
  }

  public setCachedNews(news: any[]): void {
    if (!Array.isArray(news)) return;
    this.set('news', news);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('orbit_news_cache', JSON.stringify(news));
      } catch {}
    }
  }

  public getCachedStories(): any[] | null {
    const memory = this.getSync<any[]>('stories');
    if (memory && Array.isArray(memory)) return memory;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('orbit_stories_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return null;
  }

  public setCachedStories(stories: any[]): void {
    if (!Array.isArray(stories)) return;
    this.set('stories', stories);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('orbit_stories_cache', JSON.stringify(stories));
      } catch {}
    }
  }

  public getCachedMessages(contactId: string): any[] | null {
    return this.getSync<any[]>(`messages_${contactId}`);
  }

  public setCachedMessages(contactId: string, messages: any[]): void {
    this.set(`messages_${contactId}`, messages);
  }
}

export const cacheService = new CacheService();
