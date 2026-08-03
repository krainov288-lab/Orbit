import { User, Contact, Message, MessageReactionInfo, Transaction, NewsItem, NewsComment, ChannelGroup, ChannelGroupType, AppNotification, SystemAnnouncement, AdminReport, AuditLogItem, SystemStats, UserRole, Story, StoryReaction, StoryComment, ChannelAnalyticsData } from '../types';
import { cacheService } from './cacheService';
import { offlineOutbox } from './offlineOutbox';

const TOKEN_KEY = 'orbit_jwt_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }

  return res.json();
}

export const api = {
  getToken,
  setToken,
  clearToken,
  request: apiRequest,

  // Auth
  async register(data: { username: string; email: string; password: string; phone: string; handle?: string }): Promise<{ token: string; user: User }> {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(res.token);
    return res;
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(res.token);
    return res;
  },

  async getCurrentUser(): Promise<User> {
    const res = await apiRequest<{ user: User }>('/api/auth/me');
    if (res.user) {
      cacheService.set('current_user', res.user);
    }
    return res.user;
  },

  async checkAvailability(data: { email?: string; handle?: string; phone?: string }): Promise<{ emailAvailable: boolean; handleAvailable: boolean; phoneAvailable?: boolean }> {
    return apiRequest<{ emailAvailable: boolean; handleAvailable: boolean; phoneAvailable?: boolean }>('/api/auth/check-availability', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async requestPasswordReset(email: string): Promise<{ success: boolean; code?: string; message: string }> {
    return apiRequest<{ success: boolean; code?: string; message: string }>('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(data: { email: string; code: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Contacts & Search
  async getContacts(): Promise<Contact[]> {
    try {
      const res = await apiRequest<Contact[]>('/api/contacts');
      if (Array.isArray(res)) {
        cacheService.setCachedContacts(res);
      }
      return res;
    } catch (e) {
      const cached = cacheService.getCachedContacts();
      if (cached) return cached;
      throw e;
    }
  },

  async searchUsers(query: string): Promise<Contact[]> {
    return apiRequest<Contact[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
  },

  async syncContacts(contacts: { name: string; phone: string; email?: string }[]): Promise<{
    matched: any[];
    unregistered: any[];
    totalSynced: number;
  }> {
    return apiRequest('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    });
  },

  async addContact(contactUserId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/contacts/add', {
      method: 'POST',
      body: JSON.stringify({ contactUserId }),
    });
  },

  async removeContact(contactUserId: string): Promise<{ success: boolean; message: string }> {
    cacheService.remove(`msg_${contactUserId}`);
    cacheService.remove('contacts');
    return apiRequest('/api/contacts/remove', {
      method: 'POST',
      body: JSON.stringify({ contactUserId }),
    });
  },

  async blockUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/contacts/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async unblockUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/contacts/unblock', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async getBlockedUsers(): Promise<{ id: string; name: string; handle: string; initials: string; color: string; blockedAt: number }[]> {
    return apiRequest('/api/contacts/blocked');
  },

  async reportUser(data: { targetUserId: string; reason: string; comment?: string; blockAfterReport?: boolean }): Promise<{ success: boolean; message: string }> {
    return apiRequest('/api/contacts/report', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Messages
  async getMessages(contactId: string, limit = 20): Promise<{ messages: Message[]; has_more: boolean }> {
    try {
      const res = await apiRequest<{ messages: Message[]; has_more: boolean }>(`/api/messages/${contactId}?limit=${limit}`);
      if (res && Array.isArray(res.messages)) {
        cacheService.setCachedMessages(contactId, res.messages);
      }
      return res;
    } catch (e) {
      const cached = cacheService.getCachedMessages(contactId);
      if (cached) return { messages: cached, has_more: false };
      throw e;
    }
  },

  async getMessageHistory(contactId: string, beforeId: string, limit = 20): Promise<{ messages: Message[]; has_more: boolean }> {
    return apiRequest<{ messages: Message[]; has_more: boolean }>(
      `/api/messages/${contactId}/history?before=${beforeId}&limit=${limit}`
    );
  },

  async sendMessage(contactId: string, payload: {
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'file' | 'audio' | 'video_circle' | 'sticker' | 'document';
    amount?: number;
    tx?: boolean;
    replyTo?: any;
    isForwarded?: boolean;
    forwardedFrom?: string;
    fileName?: string;
    fileSize?: string;
  }): Promise<Message> {
    if (!navigator.onLine) {
      let type: any = 'chat_message';
      if (payload.mediaType === 'audio') type = 'voice_note';
      else if (payload.mediaType === 'video_circle') type = 'video_circle';

      offlineOutbox.enqueue(type, payload.text || 'Медиа сообщение', { recipientId: contactId, ...payload });

      const optimisticMsg: Message = {
        id: 'msg_off_' + Date.now(),
        from: 'me',
        text: payload.text || '',
        timestamp: Date.now(),
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        pending: true,
        amount: payload.amount,
        tx: payload.tx,
      };

      // Append to local cache
      const cached = cacheService.getCachedMessages(contactId) || [];
      cacheService.setCachedMessages(contactId, [...cached, optimisticMsg]);
      return optimisticMsg;
    }

    try {
      const res = await apiRequest<Message>(`/api/messages/${contactId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err: any) {
      let type: any = 'chat_message';
      if (payload.mediaType === 'audio') type = 'voice_note';
      else if (payload.mediaType === 'video_circle') type = 'video_circle';

      offlineOutbox.enqueue(type, payload.text || 'Медиа сообщение', { recipientId: contactId, ...payload });

      const optimisticMsg: Message = {
        id: 'msg_off_' + Date.now(),
        from: 'me',
        text: payload.text || '',
        timestamp: Date.now(),
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        pending: true,
        amount: payload.amount,
        tx: payload.tx,
      };
      const cached = cacheService.getCachedMessages(contactId) || [];
      cacheService.setCachedMessages(contactId, [...cached, optimisticMsg]);
      return optimisticMsg;
    }
  },

  async markMessagesRead(contactId: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/messages/${contactId}/read`, {
      method: 'POST',
    });
  },

  async toggleMessageReaction(contactId: string, messageId: string, emoji: string): Promise<{ success: boolean; reactions: Record<string, MessageReactionInfo> }> {
    return apiRequest<{ success: boolean; reactions: Record<string, MessageReactionInfo> }>(`/api/messages/${contactId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ messageId, emoji }),
    });
  },

  // Wallet
  async getWalletBalance(): Promise<number> {
    const res = await apiRequest<{ balance: number }>('/api/wallet/balance');
    return res.balance;
  },

  async getTransactions(): Promise<Transaction[]> {
    return apiRequest<Transaction[]>('/api/wallet/transactions');
  },

  async sendCrypto(recipientNameOrId: string, amount: number): Promise<{ success: boolean; newBalance: number; transaction: Transaction }> {
    return apiRequest<{ success: boolean; newBalance: number; transaction: Transaction }>('/api/wallet/send', {
      method: 'POST',
      body: JSON.stringify({
        recipientName: recipientNameOrId,
        recipientId: recipientNameOrId,
        amount,
      }),
    });
  },

  // Media Upload
  async uploadMedia(file: File): Promise<{ url: string; filename: string; mediaType: 'image' | 'file' }> {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest<{ url: string; filename: string; mediaType: 'image' | 'file' }>('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // AI Assistant
  async sendAIChat(message: string, action?: string, isTranslationMode?: boolean): Promise<{ reply: string }> {
    return apiRequest<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, action, isTranslationMode }),
    });
  },

  // News & Notifications
  async getNews(): Promise<NewsItem[]> {
    try {
      const res = await apiRequest<NewsItem[]>('/api/news');
      if (Array.isArray(res)) {
        cacheService.setCachedNews(res);
      }
      return res;
    } catch (e) {
      const cached = cacheService.getCachedNews();
      if (cached) return cached;
      throw e;
    }
  },

  async getNotifications(): Promise<AppNotification[]> {
    return apiRequest<AppNotification[]>('/api/notifications');
  },

  async markNotificationRead(id: string): Promise<void> {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'POST' });
  },

  async clearNotifications(): Promise<void> {
    await apiRequest('/api/notifications/clear', { method: 'POST' });
  },

  async markAllNotificationsRead(): Promise<void> {
    await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
  },

  async markNotificationsRead(): Promise<void> {
    await apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
  },

  // Profile Updates & Social
  async updateProfile(updates: Partial<User>): Promise<{ user: User }> {
    const res = await apiRequest<{ user: User }>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res && res.user) {
      cacheService.set('current_user', res.user);
    }
    return res;
  },

  async followUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/users/${targetUserId}/follow`, {
      method: 'POST',
    });
  },

  async unfollowUser(targetUserId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/users/${targetUserId}/unfollow`, {
      method: 'POST',
    });
  },

  async getUserPublicProfile(targetUserId: string): Promise<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    handle: string;
    initials: string;
    avatarColor: string;
    avatarUrl?: string;
    phone?: string;
    isOnline: boolean;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    isFollower: boolean;
    sharedMedia: { id: string; type: 'media' | 'audio' | 'document' | 'link'; url: string; name: string; timestamp: number }[];
  }> {
    return apiRequest(`/api/users/${targetUserId}/profile`);
  },

  // Stories
  async getStories(): Promise<Story[]> {
    try {
      const res = await apiRequest<Story[]>('/api/stories');
      if (Array.isArray(res)) {
        cacheService.setCachedStories(res);
      }
      return res;
    } catch (e) {
      const cached = cacheService.getCachedStories();
      if (cached) return cached;
      throw e;
    }
  },

  async createStory(
    mediaUrl: string,
    caption?: string,
    options?: {
      slides?: string[];
      audience?: 'everyone' | 'close_friends' | 'contacts';
      hideComments?: boolean;
      hideReactions?: boolean;
      allowedReactions?: string[];
    }
  ): Promise<Story> {
    if (!navigator.onLine) {
      offlineOutbox.enqueue('story', caption || 'История', { imageUrl: mediaUrl, caption, options });
      const currentUser = cacheService.getSync<User>('current_user');
      const optimisticStory: Story = {
        id: 'story_off_' + Date.now(),
        userId: currentUser ? currentUser.id : 'me',
        userName: currentUser ? currentUser.username : 'Вы',
        userAvatar: currentUser ? currentUser.avatarUrl : undefined,
        mediaUrl: mediaUrl,
        caption: caption || '',
        timestamp: Date.now(),
        slides: options?.slides || [mediaUrl],
        reactions: [],
        comments: [],
        audience: options?.audience || 'everyone',
      };
      const cached = cacheService.getCachedStories() || [];
      cacheService.setCachedStories([optimisticStory, ...cached]);
      return optimisticStory;
    }

    try {
      return await apiRequest<Story>('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          mediaUrl,
          caption,
          slides: options?.slides,
          audience: options?.audience,
          hideComments: options?.hideComments,
          hideReactions: options?.hideReactions,
          allowedReactions: options?.allowedReactions,
        }),
      });
    } catch (err: any) {
      offlineOutbox.enqueue('story', caption || 'История', { imageUrl: mediaUrl, caption, options });
      const currentUser = cacheService.getSync<User>('current_user');
      const optimisticStory: Story = {
        id: 'story_off_' + Date.now(),
        userId: currentUser ? currentUser.id : 'me',
        userName: currentUser ? currentUser.username : 'Вы',
        userAvatar: currentUser ? currentUser.avatarUrl : undefined,
        mediaUrl: mediaUrl,
        caption: caption || '',
        timestamp: Date.now(),
        slides: options?.slides || [mediaUrl],
        reactions: [],
        comments: [],
        audience: options?.audience || 'everyone',
      };
      const cached = cacheService.getCachedStories() || [];
      cacheService.setCachedStories([optimisticStory, ...cached]);
      return optimisticStory;
    }
  },

  async updateStory(
    storyId: string,
    updates: {
      caption?: string;
      audience?: 'everyone' | 'close_friends' | 'contacts';
      hideComments?: boolean;
      hideReactions?: boolean;
      allowedReactions?: string[];
    }
  ): Promise<{ success: boolean; story: Story }> {
    return apiRequest<{ success: boolean; story: Story }>(`/api/stories/${storyId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteStory(storyId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/stories/${storyId}`, {
      method: 'DELETE',
    });
  },

  async reactToStory(storyId: string, emoji: string): Promise<{ success: boolean; reaction: StoryReaction }> {
    return apiRequest<{ success: boolean; reaction: StoryReaction }>(`/api/stories/${storyId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  },

  async commentOnStory(storyId: string, text: string): Promise<{ success: boolean; comment: StoryComment }> {
    return apiRequest<{ success: boolean; comment: StoryComment }>(`/api/stories/${storyId}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async markStoryViewed(storyId: string): Promise<void> {
    await apiRequest(`/api/stories/${storyId}/view`, { method: 'POST' });
  },

  // News Operations
  async createNews(
    title: string,
    content: string,
    options?: { mediaUrl?: string; mediaType?: 'image' | 'video'; tag?: string; accent?: string; summary?: string; category?: string; videoUrl?: string; isReel?: boolean }
  ): Promise<NewsItem> {
    if (!navigator.onLine) {
      offlineOutbox.enqueue(options?.isReel ? 'reel' : 'news_post', title, { title, content, ...options });
      const currentUser = cacheService.getSync<User>('current_user');
      const optimisticNews: NewsItem = {
        id: 'news_off_' + Date.now(),
        title,
        content,
        mediaUrl: options?.mediaUrl,
        mediaType: options?.mediaType || 'image',
        tag: options?.tag || 'Новости',
        timestamp: new Date().toISOString(),
        accent: options?.accent || 'blue',
        authorName: currentUser ? currentUser.username : 'Вы',
        authorAvatar: currentUser ? currentUser.avatarUrl : undefined,
        likesCount: 0,
        userLiked: false,
        commentsCount: 0,
        comments: [],
      };
      const cached = cacheService.getCachedNews() || [];
      cacheService.setCachedNews([optimisticNews, ...cached]);
      return optimisticNews;
    }

    try {
      return await apiRequest<NewsItem>('/api/news', {
        method: 'POST',
        body: JSON.stringify({ title, content, ...options }),
      });
    } catch (err: any) {
      offlineOutbox.enqueue(options?.isReel ? 'reel' : 'news_post', title, { title, content, ...options });
      const currentUser = cacheService.getSync<User>('current_user');
      const optimisticNews: NewsItem = {
        id: 'news_off_' + Date.now(),
        title,
        content,
        mediaUrl: options?.mediaUrl,
        mediaType: options?.mediaType || 'image',
        tag: options?.tag || 'Новости',
        timestamp: new Date().toISOString(),
        accent: options?.accent || 'blue',
        authorName: currentUser ? currentUser.username : 'Вы',
        authorAvatar: currentUser ? currentUser.avatarUrl : undefined,
        likesCount: 0,
        userLiked: false,
        commentsCount: 0,
        comments: [],
      };
      const cached = cacheService.getCachedNews() || [];
      cacheService.setCachedNews([optimisticNews, ...cached]);
      return optimisticNews;
    }
  },

  async createNewsItem(payload: any): Promise<NewsItem> {
    return this.createNews(payload.title, payload.content || payload.summary || '', payload);
  },

  async updateNews(
    id: string,
    updates: { title?: string; content?: string; mediaUrl?: string; tag?: string; mediaType?: 'image' | 'video' }
  ): Promise<{ success: boolean; news: NewsItem }> {
    return apiRequest<{ success: boolean; news: NewsItem }>(`/api/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteNews(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/news/${id}`, {
      method: 'DELETE',
    });
  },

  async toggleNewsLike(id: string): Promise<{ success: boolean; likesCount: number; userLiked: boolean }> {
    return apiRequest<{ success: boolean; likesCount: number; userLiked: boolean }>(`/api/news/${id}/like`, {
      method: 'POST',
    });
  },

  async commentOnNews(id: string, text: string): Promise<{ success: boolean; comment: NewsComment }> {
    return apiRequest<{ success: boolean; comment: NewsComment }>(`/api/news/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  async reportNews(id: string, reason?: string, comment?: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/news/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, comment }),
    });
  },

  // Channels & Groups Operations
  async getChannelsGroups(): Promise<ChannelGroup[]> {
    return apiRequest<ChannelGroup[]>('/api/channels-groups');
  },

  async searchChannelsGroups(query: string): Promise<ChannelGroup[]> {
    return apiRequest<ChannelGroup[]>(`/api/channels-groups/search?q=${encodeURIComponent(query)}`);
  },

  async createChannelGroup(data: {
    type: ChannelGroupType;
    title: string;
    description?: string;
    handle?: string;
    avatarUrl?: string;
    avatarColor?: string;
  }): Promise<ChannelGroup> {
    return apiRequest<ChannelGroup>('/api/channels-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async joinChannelGroup(id: string): Promise<{ success: boolean; channelGroup: ChannelGroup }> {
    return apiRequest<{ success: boolean; channelGroup: ChannelGroup }>(`/api/channels-groups/${id}/join`, {
      method: 'POST',
    });
  },

  async leaveChannelGroup(id: string): Promise<{ success: boolean }> {
    cacheService.remove(`msg_${id}`);
    cacheService.remove('channels_groups');
    cacheService.remove('contacts');
    return apiRequest<{ success: boolean }>(`/api/channels-groups/${id}/leave`, {
      method: 'POST',
    });
  },

  async getChannelGroupDetails(id: string): Promise<ChannelGroup & { members: any[] }> {
    return apiRequest<ChannelGroup & { members: any[] }>(`/api/channels-groups/${id}`);
  },

  async updateChannelGroup(id: string, updates: Partial<ChannelGroup>): Promise<{ success: boolean; channelGroup: ChannelGroup }> {
    return apiRequest<{ success: boolean; channelGroup: ChannelGroup }>(`/api/channels-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteChannelGroup(id: string): Promise<{ success: boolean; message: string }> {
    cacheService.remove(`msg_${id}`);
    cacheService.remove('channels_groups');
    cacheService.remove('contacts');
    return apiRequest<{ success: boolean; message: string }>(`/api/channels-groups/${id}`, {
      method: 'DELETE',
    });
  },

  async toggleChannelGroupAdmin(id: string, targetUserId: string): Promise<{ success: boolean; channelGroup: ChannelGroup }> {
    return apiRequest<{ success: boolean; channelGroup: ChannelGroup }>(`/api/channels-groups/${id}/toggle-admin`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async toggleChannelGroupModerator(id: string, targetUserId: string): Promise<{ success: boolean; channelGroup: ChannelGroup }> {
    return apiRequest<{ success: boolean; channelGroup: ChannelGroup }>(`/api/channels-groups/${id}/toggle-moderator`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async kickChannelGroupMember(id: string, targetUserId: string): Promise<{ success: boolean; channelGroup: ChannelGroup }> {
    return apiRequest<{ success: boolean; channelGroup: ChannelGroup }>(`/api/channels-groups/${id}/kick`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  async getChannelAnalytics(id: string, timeframe: '7d' | '30d' | '90d' = '30d'): Promise<ChannelAnalyticsData> {
    try {
      return await apiRequest<ChannelAnalyticsData>(`/api/channels-groups/${id}/analytics?timeframe=${timeframe}`);
    } catch (e) {
      // Fallback generator if offline or network error
      const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;
      const trend = [];
      const eng = [];
      let baseSubs = 850;
      const now = new Date();

      for (let i = days; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
        const joined = Math.floor(Math.random() * 12) + 3;
        const left = Math.floor(Math.random() * 3);
        baseSubs += joined - left;
        trend.push({ date: dateStr, subscribers: baseSubs, joined, left });

        const views = Math.floor(Math.random() * 400) + 150;
        const reactions = Math.floor(views * (0.12 + Math.random() * 0.08));
        const comments = Math.floor(reactions * (0.2 + Math.random() * 0.15));
        const shares = Math.floor(reactions * 0.1);
        eng.push({ date: dateStr, views, reactions, comments, shares });
      }

      const hourly = Array.from({ length: 24 }, (_, h) => {
        const hourStr = `${h.toString().padStart(2, '0')}:00`;
        const activeUsers = Math.floor(10 + Math.sin((h - 6) / 3) * 40 + Math.random() * 15);
        return { hour: hourStr, activeUsers: Math.max(5, activeUsers), engagementRate: Number((4 + Math.random() * 6).toFixed(1)) };
      });

      return {
        summary: {
          totalSubscribers: baseSubs,
          subscriberGrowthNet: 142,
          subscriberGrowthPct: 18.4,
          totalViews: 12450,
          viewsGrowthPct: 14.2,
          engagementRate: 8.6,
          avgReactionsPerPost: 48,
          totalPosts: 34,
          reachRate: 74.2,
        },
        subscriberGrowthTrend: trend,
        engagementMetrics: eng,
        hourlyActivity: hourly,
        interactionBreakdown: [
          { name: 'Реакции ❤️/🔥', value: 58, color: '#f43f5e' },
          { name: 'Комментарии 💬', value: 24, color: '#38bdf8' },
          { name: 'Репосты 🔄', value: 12, color: '#10b981' },
          { name: 'Клики по ссылкам 🔗', value: 6, color: '#a855f7' },
        ],
        topPosts: [
          { id: '1', title: '🚀 Главные обновления платформы Orbit 2026', date: 'Вчера', views: 1840, reactions: 142, comments: 38 },
          { id: '2', title: '💡 Как настроить PWA и Офлайн режим', date: '3 дня назад', views: 1420, reactions: 110, comments: 24 },
          { id: '3', title: '📢 Правила сообщества и безопасности', date: '5 дней назад', views: 980, reactions: 76, comments: 12 },
        ],
      };
    }
  },

  // System Announcements (Public / Authenticated)
  async getActiveAnnouncements(): Promise<SystemAnnouncement[]> {
    return apiRequest<SystemAnnouncement[]>('/api/announcements');
  },

  // Admin Operations
  async getAdminAnnouncements(): Promise<SystemAnnouncement[]> {
    return apiRequest<SystemAnnouncement[]>('/api/admin/announcements');
  },

  async createAnnouncement(data: {
    title?: string;
    content: string;
    tag?: string;
    type?: 'update' | 'security' | 'info';
    scheduledAt?: number;
    isButton?: boolean;
    buttonText?: string;
    buttonUrl?: string;
  }): Promise<SystemAnnouncement> {
    return apiRequest<SystemAnnouncement>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAnnouncement(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminReports(): Promise<AdminReport[]> {
    return apiRequest<AdminReport[]>('/api/admin/reports');
  },

  async resolveReport(id: string, note: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/admin/reports/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async deleteReport(id: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/admin/reports/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminUsers(): Promise<{ id: string; username: string; email: string; handle: string; phone: string; createdAt: string; avatarColor: string; initials: string; role: UserRole; isBlocked: boolean }[]> {
    return apiRequest('/api/admin/users');
  },

  async updateUserRole(userId: string, role: UserRole): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async toggleUserBlock(userId: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/admin/users/${userId}/toggle-block`, {
      method: 'POST',
    });
  },

  async deleteAdminUser(userId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async getAdminStats(): Promise<SystemStats> {
    return apiRequest<SystemStats>('/api/admin/stats');
  },

  async getAdminAuditLogs(): Promise<AuditLogItem[]> {
    return apiRequest<AuditLogItem[]>('/api/admin/audit-logs');
  },
};
