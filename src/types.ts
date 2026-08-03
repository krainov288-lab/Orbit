export type UserRole = 'user' | 'support' | 'admin' | 'sysadmin';

export interface StoryComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: number;
}

export interface StoryReaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userColor?: string;
  userInitials?: string;
  mediaUrl: string;
  slides?: string[];
  caption?: string;
  timestamp: number;
  viewed?: boolean;
  audience?: 'everyone' | 'close_friends' | 'contacts';
  hideComments?: boolean;
  hideReactions?: boolean;
  allowedReactions?: string[];
  reactions?: StoryReaction[];
  comments?: StoryComment[];
}

export interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  countryCode?: string;
  country?: string;
  language?: string;
  avatarColor: string;
  avatarUrl?: string;
  initials: string;
  handle: string;
  balance: number;
  createdAt: string;
  role?: UserRole;
  isBlocked?: boolean;
  isTwoFactorEnabled?: boolean;
  isBiometricsEnabled?: boolean;
  isEmailVerified?: boolean;
  following?: string[]; // array of userIds
  followers?: string[]; // array of userIds
}

export interface SharedMediaItem {
  id: string;
  type: 'media' | 'audio' | 'document' | 'link';
  url: string;
  name?: string;
  size?: string;
  timestamp: number;
}

export interface Contact {
  id: string;
  name: string;
  initials: string;
  color: string;
  avatarUrl?: string;
  handle: string;
  last: string;
  time: string;
  unread: number;
  isOnline?: boolean;
  isChannelGroup?: boolean;
  channelGroupType?: ChannelGroupType;
  subscribersCount?: number;
  membersCount?: number;
  inviteLink?: string;
  isAdmin?: boolean;
  description?: string;
  allowCalls?: boolean;
  mutedFeedNotifications?: boolean;
  creatorId?: string;
  adminIds?: string[];
  moderatorIds?: string[];
  slowMode?: number;
  allowedReactions?: string[];
  disableReactions?: boolean;
  disableComments?: boolean;
  disableForwarding?: boolean;
  isMember?: boolean;
}
export interface MessageReactionInfo {
  count: number;
  userReacted?: boolean;
  users?: string[];
}

export interface MessageReplyInfo {
  id: string;
  text: string;
  senderName: string;
  mediaType?: string;
  mediaUrl?: string;
}

export interface Message {
  id: string;
  from: 'me' | 'contact';
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'file' | 'audio' | 'video_circle' | 'sticker' | 'document';
  duration?: number;
  fileName?: string;
  fileSize?: string;
  amount?: number;
  tx?: boolean;
  timestamp: number;
  pending?: boolean;
  failed?: boolean;
  isEncrypted?: boolean;
  isRead?: boolean;
  reactions?: Record<string, MessageReactionInfo>;
  replyTo?: MessageReplyInfo;
  isForwarded?: boolean;
  forwardedFrom?: string;
  authorName?: string;
  viewsCount?: number;
}

export interface Transaction {
  id: string;
  senderId: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  type: 'in' | 'out';
  timestamp: string;
}

export interface NewsComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  timestamp: number;
}

export interface NewsItem {
  id: string;
  userId?: string;
  channelId?: string;
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
  likesCount?: number;
  userLiked?: boolean;
  commentsCount?: number;
  comments?: NewsComment[];
  sharesCount?: number;
}

export type CallType = 'voice' | 'video' | 'group_conference' | 'channel_stream';

export type ChannelGroupType = 'public_channel' | 'private_channel' | 'public_group' | 'private_group' | 'closed_group';

export interface ChannelGroup {
  id: string;
  type: ChannelGroupType;
  title: string;
  handle: string;
  description?: string;
  avatarUrl?: string;
  avatarColor: string;
  creatorId: string;
  adminIds: string[];
  moderatorIds?: string[];
  memberIds: string[];
  createdAt: number;
  inviteLink?: string;
  allowCalls?: boolean;
  slowMode?: number;
  signPosts?: boolean;
  allowedReactions?: string[];
  disableReactions?: boolean;
  disableComments?: boolean;
  disableForwarding?: boolean;
  isMember?: boolean;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  timestamp: number;
  isRead: boolean;
}

export interface SystemAnnouncement {
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

export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetUserId: string;
  targetName?: string;
  reason: string;
  comment?: string;
  timestamp: number;
  status?: 'new' | 'resolved';
  resolutionNote?: string;
  resolvedBy?: string;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface SystemStats {
  totalUsers: number;
  totalMessages: number;
  activeAnnouncements: number;
  openReports: number;
  supportCount: number;
  adminCount: number;
  sysadminCount: number;
  uptimeMs: number;
}

export type TabType = 'home' | 'ai' | 'wallet' | 'feed' | 'profile';

export interface ChatFolder {
  id: string;
  name: string;
  contactIds: string[];
}

export interface ChannelAnalyticsData {
  summary: {
    totalSubscribers: number;
    subscriberGrowthNet: number;
    subscriberGrowthPct: number;
    totalViews: number;
    viewsGrowthPct: number;
    engagementRate: number;
    avgReactionsPerPost: number;
    totalPosts: number;
    reachRate: number;
  };
  subscriberGrowthTrend: {
    date: string;
    subscribers: number;
    joined: number;
    left: number;
  }[];
  engagementMetrics: {
    date: string;
    views: number;
    reactions: number;
    comments: number;
    shares: number;
  }[];
  hourlyActivity: {
    hour: string;
    activeUsers: number;
    engagementRate: number;
  }[];
  interactionBreakdown: {
    name: string;
    value: number;
    color: string;
  }[];
  topPosts: {
    id: string;
    title: string;
    date: string;
    views: number;
    reactions: number;
    comments: number;
  }[];
}

