import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'support' | 'admin' | 'sysadmin';

export interface DBUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  passwordHash: string;
  avatarColor: string;
  avatarUrl?: string;
  initials: string;
  handle: string;
  balance: number;
  createdAt: string;
  phone?: string;
  countryCode?: string;
  country?: string;
  language?: string;
  role?: UserRole;
  isBlocked?: boolean;
  isEmailVerified?: boolean;
  following?: string[];
  followers?: string[];
}

export interface DBStoryComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: number;
}

export interface DBStoryReaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: number;
}

export interface DBStory {
  id: string;
  userId: string;
  mediaUrl: string;
  slides?: string[];
  caption?: string;
  timestamp: number;
  viewedBy?: string[];
  audience?: 'everyone' | 'close_friends' | 'contacts';
  hideComments?: boolean;
  hideReactions?: boolean;
  allowedReactions?: string[];
  reactions?: DBStoryReaction[];
  comments?: DBStoryComment[];
}

export interface DBMessage {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file' | 'audio' | 'video_circle';
  amount?: number;
  isTx?: boolean;
  timestamp: number;
  isRead: boolean;
  reactions?: Record<string, string[]>;
}

export interface DBTransaction {
  id: string;
  senderId: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  type: 'in' | 'out';
  timestamp: string;
}

export interface DBNewsComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: number;
}

export interface DBNews {
  id: string;
  userId?: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  tag: string;
  title: string;
  timestamp: string;
  accent: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likes?: string[];
  comments?: DBNewsComment[];
  sharesCount?: number;
}

export type ChannelGroupType = 'public_channel' | 'private_channel' | 'public_group' | 'private_group' | 'closed_group';

export interface DBChannelGroup {
  id: string;
  type: ChannelGroupType;
  title: string;
  handle: string;
  description?: string;
  avatarUrl?: string;
  avatarColor: string;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  createdAt: number;
  inviteLink?: string;
}

export interface DBNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  timestamp: number;
  isRead: boolean;
}

export interface DBContactRelation {
  userId: string;
  contactUserId: string;
  addedAt: number;
}

export interface DBBlockedUser {
  userId: string;
  blockedUserId: string;
  timestamp: number;
}

export interface DBReport {
  id: string;
  reporterId: string;
  targetUserId: string;
  reason: string;
  comment?: string;
  timestamp: number;
  status?: 'new' | 'resolved';
  resolutionNote?: string;
  resolvedBy?: string;
}

export interface DBAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface DBAnnouncement {
  id: string;
  title?: string;
  content: string;
  tag: string;
  type: 'update' | 'security' | 'info';
  scheduledAt?: number;
  createdAt: number;
  createdBy: string;
  isButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
}

export interface DBData {
  users: DBUser[];
  messages: DBMessage[];
  transactions: DBTransaction[];
  news: DBNews[];
  notifications: DBNotification[];
  contactRelations?: DBContactRelation[];
  blockedUsers?: DBBlockedUser[];
  reports?: DBReport[];
  announcements?: DBAnnouncement[];
  auditLogs?: DBAuditLog[];
  stories?: DBStory[];
  channelsGroups?: DBChannelGroup[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initial seed data - clean, empty defaults
function getInitialData(): DBData {
  return {
    users: [],
    messages: [],
    transactions: [],
    news: [],
    notifications: [],
    contactRelations: [],
    blockedUsers: [],
    reports: [],
    announcements: [],
  };
}

class Database {
  private data: DBData;

  constructor() {
    this.data = this.load();
  }

  private load(): DBData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent) as DBData;
        // Purge old demo users or initial demo news if present
        if (parsed.users) {
          parsed.users = parsed.users.filter(u => !u.id.startsWith('demo_user_'));
          // Ensure valid balances
          parsed.users.forEach(u => {
            const role = this.getUserRole(u);
            const isAdmin = role === 'admin' || role === 'sysadmin' || u.username.toLowerCase() === 'admin' || u.handle.toLowerCase() === '@admin';
            if (isAdmin) {
              u.balance = 100000;
            } else if (u.balance === undefined || u.balance === null) {
              u.balance = 1000;
            }
          });
        }
        if (parsed.news) {
          parsed.news = parsed.news.filter(n => !n.id.startsWith('news_1') && !n.id.startsWith('news_2'));
        }
        if (parsed.messages) {
          parsed.messages = parsed.messages.filter(m => !m.senderId.startsWith('demo_user_') && !m.recipientId.startsWith('demo_user_'));
        }
        if (parsed.stories) {
          // Clean up oversized base64 data strings that bloat DB
          parsed.stories.forEach((s) => {
            if (s.mediaUrl && s.mediaUrl.startsWith('data:') && s.mediaUrl.length > 3000) {
              s.mediaUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
            }
            if (s.slides) {
              s.slides = s.slides.map((slide) =>
                slide && slide.startsWith('data:') && slide.length > 3000
                  ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
                  : slide
              );
            }
          });
        }
        this.saveData(parsed);
        return parsed;
      }
    } catch (err) {
      console.error('Error reading DB file, reinitializing:', err);
    }
    const initial = getInitialData();
    this.saveData(initial);
    return initial;
  }

  private saveData(data: DBData): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving DB file:', err);
    }
  }

  public save(): void {
    this.saveData(this.data);
  }

  // User Operations
  public getUsers(): DBUser[] {
    return this.data.users;
  }

  public getUserById(id: string): DBUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): DBUser | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getUserByHandle(handle: string): DBUser | undefined {
    return this.data.users.find((u) => u.handle.toLowerCase() === handle.toLowerCase());
  }

  public getUserByPhone(phone: string): DBUser | undefined {
    if (!phone) return undefined;
    const clean = phone.replace(/[^\d+]/g, '');
    return this.data.users.find((u) => u.phone && u.phone.replace(/[^\d+]/g, '') === clean);
  }

  public createUser(user: DBUser): DBUser {
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUserBalance(userId: string, newBalance: number): void {
    const user = this.getUserById(userId);
    if (user) {
      user.balance = newBalance;
      this.save();
    }
  }

  public updateUserProfile(userId: string, updates: Partial<DBUser>): DBUser | undefined {
    const user = this.getUserById(userId);
    if (!user) return undefined;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  public followUser(followerId: string, targetId: string): void {
    const follower = this.getUserById(followerId);
    const target = this.getUserById(targetId);
    if (!follower || !target) return;

    if (!follower.following) follower.following = [];
    if (!target.followers) target.followers = [];

    if (!follower.following.includes(targetId)) follower.following.push(targetId);
    if (!target.followers.includes(followerId)) target.followers.push(followerId);
    this.save();
  }

  public unfollowUser(followerId: string, targetId: string): void {
    const follower = this.getUserById(followerId);
    const target = this.getUserById(targetId);
    if (follower && follower.following) {
      follower.following = follower.following.filter((id) => id !== targetId);
    }
    if (target && target.followers) {
      target.followers = target.followers.filter((id) => id !== followerId);
    }
    this.save();
  }

  // Stories Operations
  public getStories(): DBStory[] {
    if (!this.data.stories) return [];
    // Only return stories from last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return this.data.stories.filter((s) => s.timestamp >= dayAgo);
  }

  public getStoryById(id: string): DBStory | undefined {
    if (!this.data.stories) return undefined;
    return this.data.stories.find((s) => s.id === id);
  }

  public addStory(story: DBStory): DBStory {
    if (!this.data.stories) this.data.stories = [];
    this.data.stories.unshift(story);
    this.save();
    return story;
  }

  public updateStory(storyId: string, userId: string, updates: Partial<DBStory>): DBStory | undefined {
    if (!this.data.stories) return undefined;
    const story = this.data.stories.find((s) => s.id === storyId);
    if (!story) return undefined;
    if (story.userId !== userId) {
      const user = this.getUserById(userId);
      const role = user ? this.getUserRole(user) : 'user';
      if (!['admin', 'sysadmin'].includes(role)) return undefined;
    }
    Object.assign(story, updates);
    this.save();
    return story;
  }

  public deleteStory(storyId: string, userId: string): boolean {
    if (!this.data.stories) return false;
    const story = this.data.stories.find((s) => s.id === storyId);
    if (!story) return false;
    if (story.userId !== userId) {
      const user = this.getUserById(userId);
      const role = user ? this.getUserRole(user) : 'user';
      if (!['admin', 'sysadmin'].includes(role)) return false;
    }
    this.data.stories = this.data.stories.filter((s) => s.id !== storyId);
    this.save();
    return true;
  }

  public addStoryReaction(storyId: string, reaction: DBStoryReaction): DBStoryReaction | undefined {
    if (!this.data.stories) return undefined;
    const story = this.data.stories.find((s) => s.id === storyId);
    if (!story) return undefined;
    if (!story.reactions) story.reactions = [];
    story.reactions.push(reaction);
    this.save();
    return reaction;
  }

  public addStoryComment(storyId: string, comment: DBStoryComment): DBStoryComment | undefined {
    if (!this.data.stories) return undefined;
    const story = this.data.stories.find((s) => s.id === storyId);
    if (!story) return undefined;
    if (!story.comments) story.comments = [];
    story.comments.push(comment);
    this.save();
    return comment;
  }

  public markStoryViewed(storyId: string, userId: string): void {
    if (!this.data.stories) return;
    const story = this.data.stories.find((s) => s.id === storyId);
    if (story) {
      if (!story.viewedBy) story.viewedBy = [];
      if (!story.viewedBy.includes(userId)) {
        story.viewedBy.push(userId);
        this.save();
      }
    }
  }

  // Contact Relations Operations
  public getContactUserIds(userId: string): string[] {
    if (!this.data.contactRelations) return [];
    return this.data.contactRelations
      .filter((r) => r.userId === userId)
      .map((r) => r.contactUserId);
  }

  public addContactRelation(userId: string, contactUserId: string): void {
    if (!this.data.contactRelations) this.data.contactRelations = [];
    if (!this.data.contactRelations.some((r) => r.userId === userId && r.contactUserId === contactUserId)) {
      this.data.contactRelations.push({ userId, contactUserId, addedAt: Date.now() });
      this.save();
    }
  }

  public removeContactRelation(userId: string, contactUserId: string): void {
    if (!this.data.contactRelations) return;
    this.data.contactRelations = this.data.contactRelations.filter(
      (r) => !(r.userId === userId && r.contactUserId === contactUserId)
    );
    this.save();
  }

  // Blocked Users Operations
  public getBlockedUsers(userId: string): DBBlockedUser[] {
    if (!this.data.blockedUsers) return [];
    return this.data.blockedUsers.filter((b) => b.userId === userId);
  }

  public isUserBlocked(userId1: string, userId2: string): boolean {
    if (!this.data.blockedUsers) return false;
    return this.data.blockedUsers.some(
      (b) => (b.userId === userId1 && b.blockedUserId === userId2) ||
             (b.userId === userId2 && b.blockedUserId === userId1)
    );
  }

  public blockUser(userId: string, blockedUserId: string): void {
    if (!this.data.blockedUsers) this.data.blockedUsers = [];
    if (!this.data.blockedUsers.some((b) => b.userId === userId && b.blockedUserId === blockedUserId)) {
      this.data.blockedUsers.push({ userId, blockedUserId, timestamp: Date.now() });
      // Remove from contacts if blocked
      this.removeContactRelation(userId, blockedUserId);
      this.save();
    }
  }

  public unblockUser(userId: string, blockedUserId: string): void {
    if (!this.data.blockedUsers) return;
    this.data.blockedUsers = this.data.blockedUsers.filter(
      (b) => !(b.userId === userId && b.blockedUserId === blockedUserId)
    );
    this.save();
  }

  // Reports Operations
  public addReport(report: DBReport): DBReport {
    if (!this.data.reports) this.data.reports = [];
    report.status = 'new';
    this.data.reports.push(report);
    this.save();
    return report;
  }

  public getReports(): DBReport[] {
    if (!this.data.reports) return [];
    return this.data.reports;
  }

  public resolveReport(id: string, note: string, resolverName: string): boolean {
    if (!this.data.reports) return false;
    const report = this.data.reports.find((r) => r.id === id);
    if (!report) return false;
    report.status = 'resolved';
    report.resolutionNote = note;
    report.resolvedBy = resolverName;
    this.save();
    return true;
  }

  public deleteReport(id: string): void {
    if (!this.data.reports) return;
    this.data.reports = this.data.reports.filter((r) => r.id !== id);
    this.save();
  }

  // User Role & Account Security Operations
  public getUserRole(user: DBUser): UserRole {
    if (!user) return 'user';
    const name = (user.username || '').toLowerCase();
    const handle = (user.handle || '').toLowerCase().replace('@', '');
    if (name === 'admin' || handle === 'admin') {
      return 'sysadmin';
    }
    return user.role || 'user';
  }

  public updateUserRole(targetUserId: string, newRole: UserRole, actorId: string, actorName: string): boolean {
    const user = this.getUserById(targetUserId);
    if (!user) return false;

    // Protect root admin
    const isRootAdmin = user.username.toLowerCase() === 'admin' || user.handle.toLowerCase().replace('@', '') === 'admin';
    if (isRootAdmin) {
      return false;
    }

    user.role = newRole;
    this.save();
    this.addAuditLog(
      actorId,
      actorName,
      'ИЗМЕНЕНИЕ_РОЛИ',
      `Изменена роль пользователя ${user.username} (${user.handle}) на "${newRole}"`
    );
    return true;
  }

  public toggleUserBlock(targetUserId: string, actorId: string, actorName: string): boolean {
    const user = this.getUserById(targetUserId);
    if (!user) return false;

    const isRootAdmin = user.username.toLowerCase() === 'admin' || user.handle.toLowerCase().replace('@', '') === 'admin';
    if (isRootAdmin) return false;

    user.isBlocked = !user.isBlocked;
    this.save();
    const statusText = user.isBlocked ? 'ЗАБЛОКИРОВАН' : 'РАЗБЛОКИРОВАН';
    this.addAuditLog(
      actorId,
      actorName,
      'БЛОКИРОВКА_ПОЛЬЗОВАТЕЛЯ',
      `Пользователь ${user.username} (${user.handle}) ${statusText}`
    );
    return true;
  }

  // Delete user by Admin
  public deleteUser(userId: string): void {
    const targetUser = this.getUserById(userId);
    if (targetUser) {
      const isRootAdmin = targetUser.username.toLowerCase() === 'admin' || targetUser.handle.toLowerCase().replace('@', '') === 'admin';
      if (isRootAdmin) return;
    }

    this.data.users = this.data.users.filter((u) => u.id !== userId);
    this.data.messages = this.data.messages.filter((m) => m.senderId !== userId && m.recipientId !== userId);
    this.data.transactions = this.data.transactions.filter((t) => t.senderId !== userId && t.recipientId !== userId);
    if (this.data.contactRelations) {
      this.data.contactRelations = this.data.contactRelations.filter((r) => r.userId !== userId && r.contactUserId !== userId);
    }
    if (this.data.blockedUsers) {
      this.data.blockedUsers = this.data.blockedUsers.filter((b) => b.userId !== userId && b.blockedUserId !== userId);
    }
    if (this.data.reports) {
      this.data.reports = this.data.reports.filter((r) => r.reporterId !== userId && r.targetUserId !== userId);
    }
    if (this.data.stories) {
      this.data.stories = this.data.stories.filter((s) => s.userId !== userId);
    }
    this.save();
  }

  // Audit Logs
  public addAuditLog(actorId: string, actorName: string, action: string, details: string): DBAuditLog {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    const log: DBAuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actorId,
      actorName,
      action,
      details,
      timestamp: Date.now(),
    };
    this.data.auditLogs.unshift(log);
    if (this.data.auditLogs.length > 200) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 200);
    }
    this.save();
    return log;
  }

  public getAuditLogs(): DBAuditLog[] {
    if (!this.data.auditLogs) return [];
    return this.data.auditLogs;
  }

  public getSystemStats() {
    const users = this.data.users;
    let supportCount = 0;
    let adminCount = 0;
    let sysadminCount = 0;

    users.forEach((u) => {
      const role = this.getUserRole(u);
      if (role === 'support') supportCount++;
      else if (role === 'admin') adminCount++;
      else if (role === 'sysadmin') sysadminCount++;
    });

    const openReports = (this.data.reports || []).filter((r) => r.status !== 'resolved').length;
    const activeAnnouncements = this.getActiveAnnouncements().length;

    return {
      totalUsers: users.length,
      totalMessages: this.data.messages.length,
      activeAnnouncements,
      openReports,
      supportCount,
      adminCount,
      sysadminCount,
      uptimeMs: Math.round(process.uptime() * 1000),
    };
  }

  // Admin System Announcements Operations
  public getAnnouncements(): DBAnnouncement[] {
    if (!this.data.announcements) return [];
    return this.data.announcements;
  }

  public getActiveAnnouncements(): DBAnnouncement[] {
    if (!this.data.announcements) return [];
    const now = Date.now();
    return this.data.announcements.filter(
      (a) => !a.scheduledAt || a.scheduledAt <= now
    );
  }

  public createAnnouncement(announcement: DBAnnouncement): DBAnnouncement {
    if (!this.data.announcements) this.data.announcements = [];
    this.data.announcements.unshift(announcement);
    this.save();
    return announcement;
  }

  public deleteAnnouncement(id: string): void {
    if (!this.data.announcements) return;
    this.data.announcements = this.data.announcements.filter((a) => a.id !== id);
    this.save();
  }

  // Message Operations
  public getMessagesBetween(userId1: string, userId2: string, limit: number = 50, beforeId?: string): DBMessage[] {
    let conversation = this.data.messages.filter(
      (m) =>
        (m.senderId === userId1 && m.recipientId === userId2) ||
        (m.senderId === userId2 && m.recipientId === userId1)
    );

    conversation.sort((a, b) => a.timestamp - b.timestamp);

    if (beforeId) {
      const idx = conversation.findIndex((m) => m.id === beforeId);
      if (idx > 0) {
        conversation = conversation.slice(0, idx);
      }
    }

    if (conversation.length > limit) {
      conversation = conversation.slice(conversation.length - limit);
    }

    return conversation;
  }

  public addMessage(msg: DBMessage): DBMessage {
    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  public markMessagesAsRead(senderId: string, recipientId: string): void {
    let updated = false;
    for (const m of this.data.messages) {
      if (m.senderId === senderId && m.recipientId === recipientId && !m.isRead) {
        m.isRead = true;
        updated = true;
      }
    }
    if (updated) this.save();
  }

  public toggleMessageReaction(messageId: string, userId: string, emoji: string): Record<string, string[]> | null {
    const msg = this.data.messages.find((m) => m.id === messageId);
    if (!msg) return null;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];

    const userIdx = msg.reactions[emoji].indexOf(userId);
    if (userIdx !== -1) {
      msg.reactions[emoji].splice(userIdx, 1);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji].push(userId);
    }
    this.save();
    return msg.reactions;
  }

  public getUnreadCount(userId: string, senderId?: string): number {
    return this.data.messages.filter((m) => {
      if (m.recipientId !== userId || m.isRead) return false;
      if (senderId) return m.senderId === senderId;
      return true;
    }).length;
  }

  // Transactions Operations
  public addTransaction(tx: DBTransaction): DBTransaction {
    this.data.transactions.unshift(tx);
    this.save();
    return tx;
  }

  public getTransactionsForUser(userId: string): DBTransaction[] {
    return this.data.transactions.filter((t) => t.senderId === userId || t.recipientId === userId);
  }

  // News Operations
  public getNews(): DBNews[] {
    return this.data.news || [];
  }

  public getNewsById(id: string): DBNews | undefined {
    return (this.data.news || []).find((n) => n.id === id);
  }

  public addNews(newsItem: DBNews): DBNews {
    if (!this.data.news) this.data.news = [];
    this.data.news.unshift(newsItem);
    this.save();
    return newsItem;
  }

  public updateNews(id: string, userId: string, updates: Partial<DBNews>): DBNews | undefined {
    const item = this.getNewsById(id);
    if (!item) return undefined;
    if (item.userId && item.userId !== userId) {
      const user = this.getUserById(userId);
      const role = user ? this.getUserRole(user) : 'user';
      if (!['admin', 'sysadmin'].includes(role)) return undefined;
    }
    Object.assign(item, updates);
    this.save();
    return item;
  }

  public deleteNews(id: string, userId: string): boolean {
    if (!this.data.news) return false;
    const idx = this.data.news.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    const item = this.data.news[idx];
    if (item.userId && item.userId !== userId) {
      const user = this.getUserById(userId);
      const role = user ? this.getUserRole(user) : 'user';
      if (!['admin', 'sysadmin'].includes(role)) return false;
    }
    this.data.news.splice(idx, 1);
    this.save();
    return true;
  }

  public toggleNewsLike(newsId: string, userId: string): { likesCount: number; userLiked: boolean } | null {
    const item = this.getNewsById(newsId);
    if (!item) return null;
    if (!item.likes) item.likes = [];
    const idx = item.likes.indexOf(userId);
    let userLiked = false;
    if (idx !== -1) {
      item.likes.splice(idx, 1);
    } else {
      item.likes.push(userId);
      userLiked = true;
    }
    this.save();
    return { likesCount: item.likes.length, userLiked };
  }

  public addNewsComment(newsId: string, comment: DBNewsComment): DBNewsComment | null {
    const item = this.getNewsById(newsId);
    if (!item) return null;
    if (!item.comments) item.comments = [];
    item.comments.push(comment);
    this.save();
    return comment;
  }

  // Channels & Groups Operations
  public getChannelsGroups(): DBChannelGroup[] {
    return this.data.channelsGroups || [];
  }

  public getChannelGroupById(id: string): DBChannelGroup | undefined {
    return (this.data.channelsGroups || []).find((cg) => cg.id === id);
  }

  public getChannelGroupsForUser(userId: string): DBChannelGroup[] {
    return (this.data.channelsGroups || []).filter(
      (cg) =>
        cg.memberIds.includes(userId) ||
        cg.adminIds.includes(userId) ||
        cg.type === 'public_channel' ||
        cg.type === 'public_group'
    );
  }

  public addChannelGroup(cg: DBChannelGroup): DBChannelGroup {
    if (!this.data.channelsGroups) this.data.channelsGroups = [];
    this.data.channelsGroups.unshift(cg);
    this.save();
    return cg;
  }

  public joinChannelGroup(cgId: string, userId: string): DBChannelGroup | undefined {
    const cg = this.getChannelGroupById(cgId);
    if (!cg) return undefined;
    if (!cg.memberIds.includes(userId)) {
      cg.memberIds.push(userId);
      this.save();
    }
    return cg;
  }

  public leaveChannelGroup(cgId: string, userId: string): boolean {
    const cg = this.getChannelGroupById(cgId);
    if (!cg) return false;
    const idx = cg.memberIds.indexOf(userId);
    if (idx !== -1) {
      cg.memberIds.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Notifications
  public addNotification(notif: DBNotification): DBNotification {
    this.data.notifications.unshift(notif);
    this.save();
    return notif;
  }

  public getNotifications(userId: string): DBNotification[] {
    return this.data.notifications.filter((n) => n.userId === userId);
  }

  public markNotificationAsRead(userId: string, notifId: string): void {
    const n = this.data.notifications.find((item) => item.id === notifId && item.userId === userId);
    if (n) {
      n.isRead = true;
      this.save();
    }
  }
}

export const db = new Database();
