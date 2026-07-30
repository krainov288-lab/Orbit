import { User, Contact, Message, MessageReactionInfo, Transaction, NewsItem, NewsComment, ChannelGroup, ChannelGroupType, AppNotification, SystemAnnouncement, AdminReport, AuditLogItem, SystemStats, UserRole, Story, StoryReaction, StoryComment } from '../types';

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
    return apiRequest<Contact[]>('/api/contacts');
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
    return apiRequest<{ messages: Message[]; has_more: boolean }>(`/api/messages/${contactId}?limit=${limit}`);
  },

  async getMessageHistory(contactId: string, beforeId: string, limit = 20): Promise<{ messages: Message[]; has_more: boolean }> {
    return apiRequest<{ messages: Message[]; has_more: boolean }>(
      `/api/messages/${contactId}/history?before=${beforeId}&limit=${limit}`
    );
  },

  async sendMessage(contactId: string, payload: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'file' | 'audio' | 'video_circle' | 'sticker' | 'document'; amount?: number; tx?: boolean }): Promise<Message> {
    return apiRequest<Message>(`/api/messages/${contactId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
  async sendAIChat(message: string, action?: string): Promise<{ reply: string }> {
    return apiRequest<{ reply: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, action }),
    });
  },

  // News & Notifications
  async getNews(): Promise<NewsItem[]> {
    return apiRequest<NewsItem[]>('/api/news');
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
    return apiRequest<{ user: User }>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
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
    return apiRequest<Story[]>('/api/stories');
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
    return apiRequest<Story>('/api/stories', {
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
    options?: { mediaUrl?: string; mediaType?: 'image' | 'video'; tag?: string; accent?: string }
  ): Promise<NewsItem> {
    return apiRequest<NewsItem>('/api/news', {
      method: 'POST',
      body: JSON.stringify({ title, content, ...options }),
    });
  },

  async updateNews(
    id: string,
    updates: { title?: string; content?: string; mediaUrl?: string }
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

  // Channels & Groups Operations
  async getChannelsGroups(): Promise<ChannelGroup[]> {
    return apiRequest<ChannelGroup[]>('/api/channels-groups');
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
    return apiRequest<{ success: boolean }>(`/api/channels-groups/${id}/leave`, {
      method: 'POST',
    });
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
