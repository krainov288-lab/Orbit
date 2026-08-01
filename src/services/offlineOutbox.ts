import { haptics } from '../utils/haptics';

export interface OutboxItem {
  id: string;
  type: 'chat_message' | 'voice_note' | 'video_circle' | 'story' | 'news_post' | 'reel';
  title: string;
  payload: any;
  createdAt: number;
  status: 'pending' | 'syncing' | 'error';
  errorMsg?: string;
}

const OUTBOX_STORAGE_KEY = 'orbit_offline_outbox_v1';
const CACHE_SHELL_KEY = 'orbit_offline_cache_v1';

class OfflineOutboxService {
  private queue: OutboxItem[] = [];
  private listeners: Set<() => void> = new Set();
  private isProcessing = false;

  constructor() {
    this.loadFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineOutbox] Network restored! Syncing outbox...');
        haptics.notification();
        this.processQueue();
      });

      // Auto-check connection every 15s
      setInterval(() => {
        if (navigator.onLine && this.getPendingCount() > 0 && !this.isProcessing) {
          this.processQueue();
        }
      }, 15000);
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch (e) {
      this.queue = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (e) {
      console.error('[OfflineOutbox] Error saving queue to storage:', e);
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orbit_outbox_changed'));
    }
  }

  public isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  public getQueue(): OutboxItem[] {
    return [...this.queue];
  }

  public getPendingCount(): number {
    return this.queue.filter((item) => item.status !== 'syncing').length;
  }

  /**
   * Enqueue a media upload / post for background offline synchronization
   */
  public enqueue(
    type: OutboxItem['type'],
    title: string,
    payload: any
  ): OutboxItem {
    const item: OutboxItem = {
      id: 'outbox_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      type,
      title,
      payload,
      createdAt: Date.now(),
      status: 'pending',
    };

    this.queue.push(item);
    this.saveToStorage();
    haptics.medium();

    // Attempt processing immediately if online
    if (this.isOnline()) {
      setTimeout(() => this.processQueue(), 200);
    }

    return item;
  }

  public removeItem(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.saveToStorage();
  }

  public clearQueue() {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Process pending items in queue
   */
  public async processQueue(apiInstance?: any) {
    if (this.isProcessing || !this.isOnline() || this.queue.length === 0) return;

    this.isProcessing = true;
    this.notifyListeners();

    // Dynamically import api if not passed
    let currentApi = apiInstance;
    if (!currentApi) {
      try {
        const mod = await import('./api');
        currentApi = mod.api;
      } catch (e) {
        console.error('[OfflineOutbox] Could not import API service:', e);
        this.isProcessing = false;
        return;
      }
    }

    const pending = this.queue.filter((item) => item.status === 'pending');

    for (const item of pending) {
      if (!this.isOnline()) break;

      item.status = 'syncing';
      this.saveToStorage();

      try {
        if (item.type === 'chat_message' || item.type === 'voice_note' || item.type === 'video_circle') {
          const { recipientId, text, mediaUrl, mediaType, voiceDuration, replyTo } = item.payload;
          await currentApi.sendMessage(recipientId, text, mediaUrl, mediaType, voiceDuration, replyTo);
        } else if (item.type === 'story') {
          const { imageUrl, caption, options } = item.payload;
          await currentApi.createStory(imageUrl, caption, options);
        } else if (item.type === 'news_post') {
          const { title, summary, content, category, imageUrl, videoUrl, audioUrl, isReel, channelId } = item.payload;
          await currentApi.createNewsItem({
            title,
            summary,
            content,
            category,
            imageUrl,
            videoUrl,
            audioUrl,
            isReel,
            channelId,
          });
        }

        // Successfully synced!
        this.removeItem(item.id);
        haptics.success();
        console.log(`[OfflineOutbox] Synced item ${item.id} (${item.title})`);
      } catch (err: any) {
        console.error(`[OfflineOutbox] Error syncing item ${item.id}:`, err);
        item.status = 'error';
        item.errorMsg = err?.message || 'Ошибка сети';
        this.saveToStorage();
      }
    }

    this.isProcessing = false;
    this.notifyListeners();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('orbit_outbox_synced'));
    }
  }

  // --- Offline Shell Data Caching Utilities ---
  public cacheData(key: string, data: any) {
    try {
      localStorage.setItem(`${CACHE_SHELL_KEY}_${key}`, JSON.stringify(data));
    } catch (e) {}
  }

  public getCachedData<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${CACHE_SHELL_KEY}_${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
}

export const offlineOutbox = new OfflineOutboxService();
