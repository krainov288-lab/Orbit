import React, { useState, useRef, useEffect } from 'react';
import { User, Contact, ChatFolder, NewsItem } from '../../types';
import { api } from '../../services/api';
import { cacheService } from '../../services/cacheService';
import { compressImage } from '../../services/media';
import { AdminPanelModal } from './AdminPanelModal';
import { FollowerGroupsModal } from '../Feed/FollowerGroupsModal';
import { useLanguage, SupportedLanguage } from '../../context/LanguageContext';
import { validateNickname } from '../../utils/validation';
import { triggerHaptic } from '../../utils/haptics';
import { ProfileScreenSkeleton } from '../Common/Skeleton';
import {
  ShieldCheck,
  Shield,
  Moon,
  Sun,
  LogOut,
  ScanFace,
  KeyRound,
  Lock,
  Bell,
  Volume2,
  Download,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  X,
  Send,
  ChevronRight,
  HardDrive,
  Zap,
  Camera,
  Pencil,
  Check,
  Phone,
  Mail,
  CheckCheck,
  EyeOff,
  Globe,
  MapPin,
  Users,
  UserCheck,
  Search,
  History,
  Trash2,
  SearchX,
  FolderKanban,
  BarChart3,
  Folder,
  FolderMinus,
  Sparkles,
  ArrowUpDown,
  Filter,
  Newspaper,
  Sliders,
  Tag,
  Bookmark,
  MessageSquare,
  MessagesSquare,
  Ban,
  UserX,
  VolumeX,
  Share2,
  FileText,
  Clock,
  Layers,
  LockKeyhole,
} from 'lucide-react';
import {
  FeedSettings,
  SearchHistoryItem,
  SAFE_MODE_CATEGORY_DICTIONARY,
  getStoredFeedSettings,
  saveFeedSettings,
  addSearchQueryToHistory,
} from '../../utils/feedAlgorithm';
import {
  getSavedNewsItems,
  removeSavedNewsItem,
  clearAllSavedNewsItems,
} from '../../utils/savedNewsService';
import { FeedStatsChart } from './FeedStatsChart';

interface ProfileScreenProps {
  user: User | null;
  contacts: Contact[];
  isDark: boolean;
  isLoading?: boolean;
  isPinSet?: boolean;
  onOpenPinSetup?: () => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  onTriggerTestNotification?: (title: string, body: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  contacts,
  isDark,
  isLoading,
  isPinSet,
  onOpenPinSetup,
  onToggleDarkMode,
  onLogout,
  onOpenAuth,
  onUpdateUser,
  onTriggerTestNotification,
}) => {
  const { language, setLanguage, t } = useLanguage();

  if (isLoading && !user) {
    return <ProfileScreenSkeleton />;
  }

  // Inline editing state for Username and Handle
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editingUsername, setEditingUsername] = useState(user?.username || '');

  const [isEditingHandle, setIsEditingHandle] = useState(false);
  const [editingHandle, setEditingHandle] = useState(user?.handle || '');

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Email verification state
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(() => {
    if (!user) return false;
    return (user as any).isEmailVerified || localStorage.getItem(`orbit_email_verified_${user.id}`) === 'true';
  });
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [sentEmailCode, setSentEmailCode] = useState<string | null>(null);
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);

  // 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => {
    if (!user) return false;
    return user.isTwoFactorEnabled || localStorage.getItem(`orbit_2fa_${user.email}`) === 'true';
  });
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Biometrics State
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbit_biometrics_enabled') === 'true';
  });

  // Chat List Sorting State
  const [chatSortMode, setChatSortMode] = useState<'recent' | 'name' | 'online'>(() => {
    return (localStorage.getItem(`orbit_chat_sort_mode_${user?.id || 'me'}`) as any) || 'recent';
  });

  // Feed Settings State
  const [feedSettings, setFeedSettings] = useState<FeedSettings>(() => getStoredFeedSettings(user?.id));
  const [newInterestKeywordInput, setNewInterestKeywordInput] = useState('');
  const [newBlockedKeywordInput, setNewBlockedKeywordInput] = useState('');

  const handleAddInterestKeyword = (keywordToAdd?: string) => {
    const kw = (typeof keywordToAdd === 'string' ? keywordToAdd : newInterestKeywordInput).trim();
    if (!kw) return;
    if (feedSettings.interestKeywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setNewInterestKeywordInput('');
      return;
    }
    const updated = {
      ...feedSettings,
      interestKeywords: [...feedSettings.interestKeywords, kw],
    };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    setNewInterestKeywordInput('');
    triggerHaptic('light');
  };

  const handleRemoveInterestKeyword = (kwToRemove: string) => {
    const updated = {
      ...feedSettings,
      interestKeywords: feedSettings.interestKeywords.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase()),
    };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    triggerHaptic('light');
  };

  const handleAddBlockedKeyword = () => {
    const kw = newBlockedKeywordInput.trim();
    if (!kw) return;
    if (feedSettings.customBlockedKeywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      setNewBlockedKeywordInput('');
      return;
    }
    const updated = {
      ...feedSettings,
      customBlockedKeywords: [...feedSettings.customBlockedKeywords, kw],
    };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    setNewBlockedKeywordInput('');
    triggerHaptic('light');
  };

  const handleRemoveBlockedKeyword = (kwToRemove: string) => {
    const updated = {
      ...feedSettings,
      customBlockedKeywords: feedSettings.customBlockedKeywords.filter((k) => k.toLowerCase() !== kwToRemove.toLowerCase()),
    };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    triggerHaptic('light');
  };

  // Search History Management
  const [newSearchHistoryQueryInput, setNewSearchHistoryQueryInput] = useState('');

  const handleToggleSearchHistoryItem = (id: string) => {
    const history = feedSettings.searchHistory || [];
    const updatedHistory = history.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    const updated = { ...feedSettings, searchHistory: updatedHistory };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    triggerHaptic('light');
  };

  const handleRemoveSearchHistoryItem = (id: string) => {
    const history = feedSettings.searchHistory || [];
    const updatedHistory = history.filter((item) => item.id !== id);
    const updated = { ...feedSettings, searchHistory: updatedHistory };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    triggerHaptic('light');
  };

  const handleClearAllSearchHistory = () => {
    const updated = { ...feedSettings, searchHistory: [] };
    setFeedSettings(updated);
    saveFeedSettings(updated, user?.id);
    triggerHaptic('medium');
  };

  const handleAddSearchHistoryItemManually = () => {
    const query = newSearchHistoryQueryInput.trim();
    if (!query) return;
    addSearchQueryToHistory(query, user?.id);
    setFeedSettings(getStoredFeedSettings(user?.id));
    setNewSearchHistoryQueryInput('');
    triggerHaptic('light');
  };

  // News Settings Sub-Tab ('algorithm' | 'history' | 'saved')
  const [newsSettingsSubTab, setNewsSettingsSubTab] = useState<'algorithm' | 'history' | 'saved'>('algorithm');
  
  // Saved News Items State
  const [savedNewsList, setSavedNewsList] = useState<NewsItem[]>(() => getSavedNewsItems());

  useEffect(() => {
    const syncSavedNews = () => {
      setSavedNewsList(getSavedNewsItems());
    };
    window.addEventListener('orbit_saved_news_updated', syncSavedNews);
    return () => {
      window.removeEventListener('orbit_saved_news_updated', syncSavedNews);
    };
  }, []);

  const handleRemoveSavedItem = (id: string) => {
    removeSavedNewsItem(id);
    setSavedNewsList(getSavedNewsItems());
    triggerHaptic('light');
  };

  const handleClearAllSaved = () => {
    clearAllSavedNewsItems();
    setSavedNewsList([]);
    triggerHaptic('medium');
  };

  // Dialog Settings & Real Analytics State
  const [dialogSettingsTab, setDialogSettingsTab] = useState<'analytics' | 'privacy' | 'blocked_users' | 'blocked_dialogs'>('analytics');
  const [dialogAnalyticsTimeframe, setDialogAnalyticsTimeframe] = useState<'week' | 'month' | 'year' | 'all'>('week');

  // Dialog Privacy & Behavior Preferences
  const [hideReadReceipts, setHideReadReceipts] = useState<boolean>(() => localStorage.getItem('orbit_hide_read_receipts') === 'true');
  const [hideTypingIndicator, setHideTypingIndicator] = useState<boolean>(() => localStorage.getItem('orbit_hide_typing') === 'true');
  const [hideOnlineStatus, setHideOnlineStatus] = useState<boolean>(() => localStorage.getItem('orbit_hide_online') === 'true');
  const [doNotDisturbMessages, setDoNotDisturbMessages] = useState<boolean>(() => localStorage.getItem('orbit_dnd_messages') === 'true');
  const [doubleTapQuickReply, setDoubleTapQuickReply] = useState<boolean>(() => localStorage.getItem('orbit_double_tap_reply') !== 'false');
  const [autoArchiveInactive, setAutoArchiveInactive] = useState<boolean>(() => localStorage.getItem('orbit_auto_archive') === 'true');
  const [pinnedChatsLimit, setPinnedChatsLimit] = useState<string>(() => localStorage.getItem('orbit_pinned_chats_limit') || '10');

  // Blocked Users & Blocked Dialogs Lists
  const [blockedUsersList, setBlockedUsersList] = useState<Array<{ id: string; name: string; username: string; date: string }>>(() => {
    try {
      const saved = localStorage.getItem(`orbit_blocked_users_${user?.id || 'me'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [blockedDialogsList, setBlockedDialogsList] = useState<Array<{ id: string; name: string; type: 'group' | 'channel' | 'user'; date: string }>>(() => {
    try {
      const saved = localStorage.getItem(`orbit_blocked_dialogs_${user?.id || 'me'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const handleUnblockUser = (id: string, name: string) => {
    setBlockedUsersList((prev) => prev.filter((u) => u.id !== id));
    setToastMessage(`Пользователь "${name}" разблокирован`);
    setTimeout(() => setToastMessage(null), 2500);
    triggerHaptic('light');
  };

  const handleUnblockDialog = (id: string, name: string) => {
    setBlockedDialogsList((prev) => prev.filter((d) => d.id !== id));
    setToastMessage(`Диалог "${name}" разблокирован`);
    setTimeout(() => setToastMessage(null), 2500);
    triggerHaptic('light');
  };

  // Media & Data Saver Preferences
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(() => localStorage.getItem('orbit_data_saver_mode') === 'true');
  const [hideMediaInFeed, setHideMediaInFeed] = useState<boolean>(() => localStorage.getItem('orbit_hide_media_feed') === 'true');
  const [autoDownloadOption, setAutoDownloadOption] = useState<string>(() => localStorage.getItem('orbit_auto_download_option') || 'wifi');
  const [videoQualityOption, setVideoQualityOption] = useState<string>(() => localStorage.getItem('orbit_video_quality') || '720p');
  const [photoQualityOption, setPhotoQualityOption] = useState<string>(() => localStorage.getItem('orbit_photo_quality') || 'optimal');
  const [autoplayMedia, setAutoplayMedia] = useState<boolean>(() => localStorage.getItem('orbit_autoplay_media') !== 'false');
  const [cacheAudioMessages, setCacheAudioMessages] = useState<boolean>(() => localStorage.getItem('orbit_cache_audio') !== 'false');
  const [appCacheSize, setAppCacheSize] = useState<string>('14.8 МБ');

  const handleToggleHideReadReceipts = () => {
    const next = !hideReadReceipts;
    setHideReadReceipts(next);
    localStorage.setItem('orbit_hide_read_receipts', next ? 'true' : 'false');
    triggerHaptic('light');
    setToastMessage(next ? 'Статус "прочитал" скрыт' : 'Статус "прочитал" виден');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Notification Preferences
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => localStorage.getItem('orbit_notif_push') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => localStorage.getItem('orbit_notif_sound') !== 'false');

  // Language & Country Preferences
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => localStorage.getItem('orbit_app_lang') || 'Русский');
  const [selectedCountry, setSelectedCountry] = useState<string>(() => localStorage.getItem('orbit_app_country') || 'Россия');

  // Followers / Following Modals & Subscriber Sorting State
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowerGroupsModal, setShowFollowerGroupsModal] = useState(false);
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [subscriberSortMode, setSubscriberSortMode] = useState<'recent' | 'name' | 'online'>('recent');
  const [subscriberFilterTab, setSubscriberFilterTab] = useState<'all' | 'online' | 'groups'>('all');

  // Following & Followers persistent state
  const [followingList, setFollowingList] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(`orbit_following_${user?.id || 'me'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return contacts.length > 0 ? contacts : [];
  });

  const [followersList, setFollowersList] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem(`orbit_followers_${user?.id || 'me'}`);
      if (saved && JSON.parse(saved).length > 0) return JSON.parse(saved);
    } catch {}
    if (contacts.length > 0) {
      return contacts.map((c, idx) => ({
        ...c,
        isOnline: idx % 2 === 0,
      }));
    }
    return [];
  });

  // Folders state & statistics
  const [folders] = useState<ChatFolder[]>(() => {
    const storageKey = user ? `orbit_chat_folders_${user.email}` : 'orbit_chat_folders_guest';
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const personalIds = contacts.filter((c) => !c.isChannelGroup).slice(0, 3).map((c) => c.id);
    const workIds = contacts.filter((c) => c.isChannelGroup || c.name.toLowerCase().includes('рабоч') || c.name.toLowerCase().includes('work')).map((c) => c.id);
    const financeIds = contacts.filter((c) => c.name.toLowerCase().includes('кошелек') || c.name.toLowerCase().includes('wallet') || c.name.toLowerCase().includes('банк') || c.name.toLowerCase().includes('фин')).map((c) => c.id);

    return [
      { id: 'f_personal', name: 'Личные', contactIds: personalIds },
      { id: 'f_work', name: 'Рабочие', contactIds: workIds },
      { id: 'f_finance', name: 'Финансы', contactIds: financeIds },
    ];
  });

  const [showFolderStatsModal, setShowFolderStatsModal] = useState(false);
  const [selectedFolderIdForDetails, setSelectedFolderIdForDetails] = useState<string | null>(null);

  // Folder Statistics Calculations
  const totalContacts = contacts.length;
  const allFolderContactIds = new Set(folders.flatMap((f) => f.contactIds));
  const uncategorizedContacts = contacts.filter((c) => !allFolderContactIds.has(c.id));
  const categorizedCount = totalContacts - uncategorizedContacts.length;
  const organizationPercentage = totalContacts > 0 ? Math.round((categorizedCount / totalContacts) * 100) : 100;

  const folderThemeMap: Record<string, { bg: string; text: string; bar: string; border: string }> = {
    Личные: { bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400', bar: 'bg-sky-500', border: 'border-sky-500/30' },
    Рабочие: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', bar: 'bg-indigo-500', border: 'border-indigo-500/30' },
    Финансы: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', border: 'border-emerald-500/30' },
  };

  const defaultPalette = [
    { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500', border: 'border-purple-500/30' },
    { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400', bar: 'bg-rose-500', border: 'border-rose-500/30' },
    { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', border: 'border-amber-500/30' },
    { bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400', bar: 'bg-teal-500', border: 'border-teal-500/30' },
  ];

  const getFolderTheme = (name: string, index: number) => {
    if (folderThemeMap[name]) return folderThemeMap[name];
    return defaultPalette[index % defaultPalette.length];
  };

  const folderStatsList = folders.map((f, idx) => {
    const fContacts = contacts.filter((c) => f.contactIds.includes(c.id));
    const chatCount = fContacts.length;
    const unreadCount = fContacts.reduce((sum, c) => sum + (c.unread || 0), 0);
    
    const messageCount = fContacts.reduce((sum, c) => {
      const cached = cacheService.getCachedMessages(c.id);
      const count = cached && cached.length > 0 ? cached.length : (c.last ? 1 : 0) + (c.unread || 0);
      return sum + Math.max(count, 1);
    }, 0);

    const channelsCount = fContacts.filter((c) => c.isChannelGroup && c.channelGroupType?.includes('channel')).length;
    const groupsCount = fContacts.filter((c) => c.isChannelGroup && c.channelGroupType?.includes('group')).length;
    const dmsCount = fContacts.filter((c) => !c.isChannelGroup).length;

    return {
      folder: f,
      contacts: fContacts,
      chatCount,
      unreadCount,
      messageCount,
      channelsCount,
      groupsCount,
      dmsCount,
      theme: getFolderTheme(f.name, idx),
    };
  });

  const uncategorizedUnread = uncategorizedContacts.reduce((sum, c) => sum + (c.unread || 0), 0);
  const uncategorizedMessageCount = uncategorizedContacts.reduce((sum, c) => {
    const cached = cacheService.getCachedMessages(c.id);
    const count = cached && cached.length > 0 ? cached.length : (c.last ? 1 : 0) + (c.unread || 0);
    return sum + Math.max(count, 1);
  }, 0);

  const totalMessagesInApp = folderStatsList.reduce((sum, item) => sum + item.messageCount, 0) + uncategorizedMessageCount;

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showAdminModal, setShowAdminModal] = useState(false);

  const userRole = user?.role || (user?.username?.toLowerCase() === 'admin' ? 'sysadmin' : 'user');
  const hasAdminAccess = ['support', 'admin', 'sysadmin'].includes(userRole) || user?.username?.toLowerCase() === 'admin';

  const secretKey = 'ORBIT-2FA-8890-4102-SECURE';

  const handleSaveUsername = async () => {
    if (!editingUsername.trim()) return;
    try {
      const res = await api.updateProfile({ username: editingUsername.trim() });
      if (res && res.user && onUpdateUser) {
        onUpdateUser(res.user);
      } else if (user) {
        user.username = editingUsername.trim();
      }
      setIsEditingUsername(false);
      setToastMessage('Имя профиля обновлено');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Ошибка обновления имени');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleSaveHandle = async () => {
    const val = validateNickname(editingHandle);
    if (!val.isValid) {
      setToastMessage(val.error || 'Неверный формат никнейма');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    const formatted = val.formattedHandle!;
    try {
      const res = await api.updateProfile({ handle: formatted });
      if (res && res.user && onUpdateUser) {
        onUpdateUser(res.user);
      } else if (user) {
        user.handle = formatted;
      }
      setIsEditingHandle(false);
      setToastMessage('Никнейм успешно обновлён');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      setToastMessage(err?.message || 'Ошибка обновления никнейма');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setToastMessage('Загрузка аватара...');
      let fileToUpload = file;
      try {
        fileToUpload = await compressImage(file, 800, 800, 0.85);
      } catch {}

      let newAvatarUrl = '';
      try {
        const uploadRes = await api.uploadMedia(fileToUpload);
        if (uploadRes?.url) {
          newAvatarUrl = uploadRes.url;
        }
      } catch (e) {
        console.warn('Media upload failed, converting to compressed data URL fallback:', e);
      }

      if (!newAvatarUrl) {
        const reader = new FileReader();
        newAvatarUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(fileToUpload);
        });
      }

      const res = await api.updateProfile({ avatarUrl: newAvatarUrl });
      if (res && res.user && onUpdateUser) {
        onUpdateUser(res.user);
      } else if (user) {
        user.avatarUrl = newAvatarUrl;
      }
      setToastMessage('Аватар профиля успешно обновлён');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('Ошибка сохранения аватара');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleStartEmailVerify = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentEmailCode(code);
    setShowEmailVerifyModal(true);
    setToastMessage(`Код подтверждения email (${user?.email}): ${code}`);
    setTimeout(() => setToastMessage(null), 10000);
  };

  const handleToggleEmailVerify = async () => {
    if (isEmailVerified) {
      setIsEmailVerified(false);
      if (user) {
        localStorage.setItem(`orbit_email_verified_${user.id}`, 'false');
        try {
          const res = await api.updateProfile({ isEmailVerified: false });
          if (res?.user && onUpdateUser) onUpdateUser(res.user);
        } catch {}
      }
      setToastMessage('Подтверждение электронной почты отключено');
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      handleStartEmailVerify();
    }
  };

  const handleTogglePin = () => {
    if (onOpenPinSetup) {
      onOpenPinSetup();
    }
  };

  const handleConfirmEmailCode = async () => {
    if (!emailCode || emailCode.trim() !== sentEmailCode) {
      setEmailVerifyError('Неверный код подтверждения');
      return;
    }
    setIsEmailVerified(true);
    if (user) {
      localStorage.setItem(`orbit_email_verified_${user.id}`, 'true');
      try {
        const res = await api.updateProfile({ isEmailVerified: true });
        if (res?.user && onUpdateUser) onUpdateUser(res.user);
      } catch {}
    }
    setShowEmailVerifyModal(false);
    setEmailCode('');
    setEmailVerifyError(null);
    setToastMessage('Электронная почта успешно подтверждена!');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggle2FA = () => {
    if (is2FAEnabled) {
      setIs2FAEnabled(false);
      if (user) localStorage.setItem(`orbit_2fa_${user.email}`, 'false');
    } else {
      setShow2FAModal(true);
    }
  };

  const handleVerifyAndEnable2FA = () => {
    if (totpCode.trim().length < 6) {
      setTotpError('Введите 6-значный код');
      return;
    }
    setIs2FAEnabled(true);
    if (user) localStorage.setItem(`orbit_2fa_${user.email}`, 'true');
    setShow2FAModal(false);
    setTotpCode('');
    setTotpError('');
  };

  const handleToggleBiometrics = () => {
    const nextVal = !isBiometricsEnabled;
    setIsBiometricsEnabled(nextVal);
    localStorage.setItem('orbit_biometrics_enabled', nextVal ? 'true' : 'false');
  };

  if (!user) {
    return (
      <div className="px-5 pt-12 pb-4 text-center">
        <div className="glass-card max-w-xs mx-auto rounded-3xl p-6 text-primary border border-white/60 dark:border-slate-800 shadow-sm">
          <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-500/20">
            OR
          </div>
          <h3 className="text-base font-semibold mb-1">Гостевой режим</h3>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Войдите в аккаунт для доступа к отправке сообщений, кошельку, общению с ИИ и настройкам.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            Войти / Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-24 space-y-4">
      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarFileSelect}
        className="hidden"
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-xl text-center whitespace-nowrap animate-fade-in max-w-xs pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="glass-card rounded-3xl p-3 pt-2 mt-0 flex flex-col items-center text-center border border-white/60 dark:border-slate-800 relative">
        {/* Top-Right Crypto Balance Inside Block */}
        <div className="absolute top-3 right-3 bg-gradient-to-br from-sky-500/15 to-indigo-500/15 backdrop-blur-md px-3 py-1 rounded-2xl border border-sky-400/30 dark:border-sky-500/30 text-right shadow-2xs">
          <div className="text-[10px] text-sky-600 dark:text-sky-300 font-semibold">{t.orbBalance}</div>
          <div className="text-xs font-extrabold text-sky-600 dark:text-sky-300 tracking-tight">{user.balance.toFixed(2)}</div>
        </div>

        {/* Avatar Circle with Upload Trigger */}
        <div className="relative group cursor-pointer mt-1" onClick={() => fileInputRef.current?.click()}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="h-24 w-24 rounded-full object-cover shadow-lg border-2 border-blue-500/30"
            />
          ) : (
            <div
              className={`h-24 w-24 rounded-full bg-gradient-to-br ${user.avatarColor} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}
            >
              {user.initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={22} className="text-white" />
          </div>
          <button
            type="button"
            className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900"
            title="Загрузить аватар"
          >
            <Camera size={13} />
          </button>
        </div>

        {/* Compact User Data (Name, Nickname, Phone - Minimal Line Gaps) */}
        <div className="mt-1.5 flex flex-col items-center gap-0.5 w-full">
          {/* Name - Editable */}
          {isEditingUsername ? (
            <div className="flex items-center gap-1.5 justify-center w-full max-w-[220px]">
              <input
                type="text"
                autoFocus
                value={editingUsername}
                onChange={(e) => setEditingUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                className="w-full text-center text-sm font-bold px-2.5 py-0.5 rounded-xl border border-sky-400 bg-white dark:bg-slate-900 text-primary outline-none shadow-xs"
              />
              <button
                onClick={handleSaveUsername}
                className="p-1 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition shrink-0 shadow-xs"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                setEditingUsername(user.username);
                setIsEditingUsername(true);
              }}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition group"
              title="Нажмите для редактирования имени"
            >
              <span className="text-base font-extrabold text-primary leading-tight">{user.username}</span>
              <Pencil size={12} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
            </div>
          )}

          {/* Nickname - Editable */}
          {isEditingHandle ? (
            <div className="flex items-center gap-1.5 justify-center w-full max-w-[190px]">
              <input
                type="text"
                autoFocus
                value={editingHandle}
                onChange={(e) => setEditingHandle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveHandle()}
                className="w-full text-center text-xs font-semibold px-2 py-0.5 rounded-lg border border-sky-400 bg-white dark:bg-slate-900 text-primary outline-none shadow-xs"
              />
              <button
                onClick={handleSaveHandle}
                className="p-1 rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition shrink-0 shadow-xs"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                setEditingHandle(user.handle);
                setIsEditingHandle(true);
              }}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition group"
              title="Нажмите для редактирования никнейма"
            >
              <span className="text-[11px] text-muted font-medium leading-none">{user.handle}</span>
              <Pencil size={10} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
            </div>
          )}

          {/* Phone (Unchangeable plain text) */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none mt-0.5">
            {user.phone || '+7 (999) 000-00-00'}
          </div>
        </div>

        {/* Subscriptions (Подписки) & Followers (Подписчики) Bar */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 w-full justify-center">
          <button
            onClick={() => setShowFollowingModal(true)}
            className="text-center group hover:opacity-80 transition"
          >
            <div className="text-sm font-bold text-primary group-hover:text-sky-500">{followingList.length}</div>
            <div className="text-[11px] text-muted font-medium">{t.subscriptions}</div>
          </button>
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
          <button
            onClick={() => setShowFollowersModal(true)}
            className="text-center group hover:opacity-80 transition"
          >
            <div className="text-sm font-bold text-primary group-hover:text-sky-500">{followersList.length}</div>
            <div className="text-[11px] text-muted font-medium">{t.followers}</div>
          </button>
        </div>
      </div>




      {/* Admin Panel Entry Card */}
      {hasAdminAccess && (
        <div className="glass-card rounded-3xl p-4 border border-slate-200/60 dark:border-slate-800/60 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
                <Shield size={18} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  Панель Поддержки и Управления
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50">
                    {userRole === 'sysadmin' ? 'SYSADMIN' : userRole === 'admin' ? 'ADMIN' : 'SUPPORT'}
                  </span>
                </h3>
                <p className="text-[11px] text-muted leading-tight mt-0.5">
                  Управление новостями, пользователями, ролями и обращениями
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-200 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-md active:scale-95 transition shrink-0"
            >
              Открыть
            </button>
          </div>
        </div>
      )}

      {/* Security & Email Registration Confirmation Section */}
      <div className="glass-card rounded-3xl p-3 border border-white/60 dark:border-slate-800 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Безопасность & Регистрация
        </div>

        {/* Email Confirmation Row (Completes Registration Stage) */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>Подтверждение почты ({user.email})</span>
              </div>
              <div className="text-[11px] text-muted">
                {isEmailVerified
                  ? 'Почта подтверждена. Регистрация полностью завершена'
                  : 'Завершите регистрацию'}
              </div>
            </div>
          </div>
          <button
            onClick={handleToggleEmailVerify}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              isEmailVerified ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isEmailVerified ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* PIN Code Row */}
        {onOpenPinSetup && (
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-primary">ПИН-код защиты профиля</div>
                <div className="text-[11px] text-muted">
                  {isPinSet ? 'ПИН-код установлен и активен' : 'Защитите аккаунт индивидуальным ПИН-кодом'}
                </div>
              </div>
            </div>
            <button
              onClick={handleTogglePin}
              className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                isPinSet ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  isPinSet ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* 2FA Toggle Row */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <KeyRound size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Двухфакторная аутентификация (2FA)</div>
              <div className="text-[11px] text-muted">Запрос 6-значного кода при входе</div>
            </div>
          </div>
          <button
            onClick={handleToggle2FA}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              is2FAEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                is2FAEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Touch / Face ID Toggle Row */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <ScanFace size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Вход по Touch ID / Face ID</div>
              <div className="text-[11px] text-muted">Биометрическая разблокировка</div>
            </div>
          </div>
          <button
            onClick={handleToggleBiometrics}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              isBiometricsEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isBiometricsEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Notification Preferences Section */}
      <div className="glass-card rounded-3xl p-3 border border-white/60 dark:border-slate-800 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>Настройки уведомлений</span>
          <Bell size={13} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Push-уведомления</div>
              <div className="text-[11px] text-muted">Уведомления о сообщениях и звонках</div>
            </div>
          </div>
          <button
            onClick={() => {
              const val = !pushEnabled;
              setPushEnabled(val);
              localStorage.setItem('orbit_notif_push', val ? 'true' : 'false');
            }}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              pushEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                pushEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <Volume2 size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Звуковые сигналы</div>
              <div className="text-[11px] text-muted">Звуки сообщений и системных событий</div>
            </div>
          </div>
          <button
            onClick={() => {
              const val = !soundEnabled;
              setSoundEnabled(val);
              localStorage.setItem('orbit_notif_sound', val ? 'true' : 'false');
            }}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              soundEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                soundEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          onClick={() => {
            if (onTriggerTestNotification) {
              onTriggerTestNotification('Тестовое уведомление ORBIT', 'Система уведомлений работает корректно.');
            }
          }}
          className="w-full mt-2 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition shadow-2xs"
        >
          <Send size={14} />
          <span>Отправить тестовое уведомление</span>
        </button>
      </div>

      {/* D3.js Feed Stats Visualization Card */}
      <FeedStatsChart />

      {/* Feed & Content Algorithm Settings Card */}
      <div className="glass-card rounded-3xl p-3.5 border border-white/60 dark:border-slate-800 space-y-3">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>Настройки ленты новостей</span>
          <Newspaper size={14} className="text-sky-500" />
        </div>

        {/* Sub-Tabs for News Settings */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => {
              setNewsSettingsSubTab('algorithm');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              newsSettingsSubTab === 'algorithm'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sliders size={13} />
            <span>Алгоритмы</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewsSettingsSubTab('history');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              newsSettingsSubTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History size={13} />
            <span>История</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewsSettingsSubTab('saved');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              newsSettingsSubTab === 'saved'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Bookmark size={13} />
            <span>Избранное ({savedNewsList.length})</span>
          </button>
        </div>

        {/* 1. Sub-Tab: Algorithm & Content Filters */}
        {newsSettingsSubTab === 'algorithm' && (
          <div className="space-y-3 animate-fade-in">
            {/* Algorithm Header Summary */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-500/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Персонализация & Алгоритм</span>
                    {feedSettings.safeMode && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-500/30">
                        Safe Shield
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {feedSettings.feedMode === 'recommendations'
                      ? 'Умные рекомендации'
                      : feedSettings.feedMode === 'interests_only'
                      ? 'Только по интересам'
                      : 'Все новости без фильтра'}
                    {' • '}
                    {feedSettings.interestKeywords.length} тем(-ы)
                  </div>
                </div>
              </div>
            </div>

            {/* Safe Mode Controls */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center transition ${
                      feedSettings.safeMode
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Безопасный режим</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Фильтрация опасного и нежелательного контента
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...feedSettings, safeMode: !feedSettings.safeMode };
                    setFeedSettings(updated);
                    saveFeedSettings(updated, user?.id);
                    triggerHaptic('light');
                  }}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    feedSettings.safeMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      feedSettings.safeMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {feedSettings.safeMode && (
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2.5 animate-fade-in">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Категории контента для скрытия:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(SAFE_MODE_CATEGORY_DICTIONARY).map(([catKey, catVal]) => {
                      const isChecked = feedSettings.blockedCategories.includes(catKey);
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => {
                            const newCats = isChecked
                              ? feedSettings.blockedCategories.filter((c) => c !== catKey)
                              : [...feedSettings.blockedCategories, catKey];
                            const updated = { ...feedSettings, blockedCategories: newCats };
                            setFeedSettings(updated);
                            saveFeedSettings(updated, user?.id);
                            triggerHaptic('light');
                          }}
                          className={`p-2 rounded-xl text-[10px] font-semibold text-left transition flex items-center justify-between border cursor-pointer ${
                            isChecked
                              ? 'bg-rose-500/10 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-500/30 shadow-2xs'
                              : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 border-slate-200/60 dark:border-slate-700/60'
                          }`}
                        >
                          <span className="truncate pr-1">{catVal.label}</span>
                          {isChecked && <Check size={12} className="shrink-0 text-rose-500 stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Prohibited Keywords */}
                  <div className="pt-1 space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Ваши стоп-слова и запрещенные теги:
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newBlockedKeywordInput}
                        onChange={(e) => setNewBlockedKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddBlockedKeyword();
                        }}
                        placeholder="Добавить слово..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-white outline-none focus:border-rose-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleAddBlockedKeyword}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer"
                      >
                        + Слово
                      </button>
                    </div>
                    {feedSettings.customBlockedKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {feedSettings.customBlockedKeywords.map((word) => (
                          <span
                            key={word}
                            className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center gap-1 border border-rose-500/20"
                          >
                            <span>{word}</span>
                            <X
                              size={10}
                              className="cursor-pointer hover:opacity-80"
                              onClick={() => handleRemoveBlockedKeyword(word)}
                            />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Feed Mode & Sort Mode */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span>Режим алгоритма ленты</span>
                <Sliders size={14} className="text-sky-500" />
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...feedSettings, feedMode: 'recommendations' as const };
                    setFeedSettings(updated);
                    saveFeedSettings(updated, user?.id);
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${
                    feedSettings.feedMode === 'recommendations'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Умный
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...feedSettings, feedMode: 'all' as const };
                    setFeedSettings(updated);
                    saveFeedSettings(updated, user?.id);
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${
                    feedSettings.feedMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Все новости
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...feedSettings, feedMode: 'interests_only' as const };
                    setFeedSettings(updated);
                    saveFeedSettings(updated, user?.id);
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${
                    feedSettings.feedMode === 'interests_only'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-sky-500/20'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  По темам
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Сортировка постов:</span>
                <select
                  value={feedSettings.sortMode}
                  onChange={(e) => {
                    const updated = { ...feedSettings, sortMode: e.target.value as any };
                    setFeedSettings(updated);
                    saveFeedSettings(updated, user?.id);
                    triggerHaptic('light');
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl px-2.5 py-1 text-[11px] font-bold outline-none cursor-pointer"
                >
                  <option value="newest">Сначала новые</option>
                  <option value="popular">По популярности</option>
                  <option value="relevance">По совпадению интересов</option>
                </select>
              </div>
            </div>

            {/* Interest Keywords & Topics */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Ваши интересы и ключевые слова</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">{feedSettings.interestKeywords.length} тем</span>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newInterestKeywordInput}
                  onChange={(e) => setNewInterestKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddInterestKeyword();
                  }}
                  placeholder="Добавить тему (например, Технологии, ИИ)..."
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-white outline-none focus:border-sky-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleAddInterestKeyword()}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer"
                >
                  + Тема
                </button>
              </div>

              <div className="flex flex-wrap gap-1">
                {['Технологии', 'ИИ', 'Дизайн', 'Программирование', 'Новости ORBIT', 'Игры', 'Музыка', 'Финансы', 'Спорт'].map(
                  (preset) => {
                    const isAdded = feedSettings.interestKeywords.some((k) => k.toLowerCase() === preset.toLowerCase());
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (isAdded) {
                            handleRemoveInterestKeyword(preset);
                          } else {
                            handleAddInterestKeyword(preset);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition border cursor-pointer ${
                          isAdded
                            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 font-bold'
                            : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 border-slate-200/60 dark:border-slate-700/60 hover:text-slate-800'
                        }`}
                      >
                        {isAdded ? `✓ ${preset}` : `+ ${preset}`}
                      </button>
                    );
                  }
                )}
              </div>

              {feedSettings.interestKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  {feedSettings.interestKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[11px] font-bold flex items-center gap-1.5 border border-sky-500/20"
                    >
                      <span>#{kw}</span>
                      <X
                        size={12}
                        className="cursor-pointer hover:opacity-75"
                        onClick={() => handleRemoveInterestKeyword(kw)}
                      />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Sub-Tab: Dedicated Search History */}
        {newsSettingsSubTab === 'history' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <History size={14} className="text-sky-500" />
                <span>История поиска новостей</span>
              </div>
              {(feedSettings.searchHistory || []).length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSearchHistory}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} />
                  <span>Очистить историю</span>
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Здесь отображаются ваши недавние поисковые запросы по новостям. Включайте их для автоматической приоритетной фильтрации новостной ленты.
            </p>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newSearchHistoryQueryInput}
                onChange={(e) => setNewSearchHistoryQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSearchHistoryItemManually();
                }}
                placeholder="Добавить поисковый запрос..."
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-white outline-none focus:border-sky-500 font-medium"
              />
              <button
                type="button"
                onClick={handleAddSearchHistoryItemManually}
                className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-xl text-[11px] font-bold transition shadow-xs cursor-pointer"
              >
                + Запрос
              </button>
            </div>

            {(feedSettings.searchHistory || []).length === 0 ? (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 text-center text-[11px] text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1 border border-dashed border-slate-200 dark:border-slate-700/60">
                <SearchX size={18} className="text-slate-300" />
                <span>История поиска пока пуста</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {(feedSettings.searchHistory || []).map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition border text-[11px] ${
                      item.enabled
                        ? 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500/30 text-sky-900 dark:text-sky-200'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Search size={13} className={item.enabled ? 'text-sky-500' : 'text-slate-400'} />
                      <span className="font-bold truncate">{item.query}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSearchHistoryItem(item.id)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                          item.enabled
                            ? 'bg-sky-500 text-white shadow-2xs'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {item.enabled ? 'ВКЛ' : 'ВЫКЛ'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSearchHistoryItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition cursor-pointer"
                        title="Удалить запрос"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Sub-Tab: Saved / Favorited News */}
        {newsSettingsSubTab === 'saved' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Bookmark size={14} className="text-amber-500 fill-amber-500" />
                <span>Сохранённые новости ({savedNewsList.length})</span>
              </div>
              {savedNewsList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSaved}
                  className="text-[10px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={11} />
                  <span>Очистить всё</span>
                </button>
              )}
            </div>

            {savedNewsList.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/60 dark:bg-slate-800/40 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2 border border-dashed border-slate-200 dark:border-slate-700/60">
                <Bookmark size={24} className="text-amber-400/60" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">У вас нет сохранённых новостей</div>
                <div className="text-[11px] text-slate-400 max-w-xs">
                  Нажмите на значок закладки под любой публикацией в ленте новостей, чтобы сохранить её сюда.
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {savedNewsList.map((newsItem) => (
                  <div
                    key={newsItem.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          {newsItem.category || 'Новость'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                          {newsItem.title}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSavedItem(newsItem.id)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition shrink-0 cursor-pointer"
                        title="Удалить из сохранённых"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {newsItem.mediaUrl && (
                      <div className="relative rounded-xl overflow-hidden max-h-28 bg-slate-100 dark:bg-slate-900">
                        <img
                          src={newsItem.mediaUrl}
                          alt={newsItem.title}
                          className="w-full h-28 object-cover"
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {newsItem.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        <span>{newsItem.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: newsItem.title, text: newsItem.content }).catch(() => {});
                            } else {
                              setToastMessage('Ссылка на новость скопирована!');
                              setTimeout(() => setToastMessage(null), 2000);
                            }
                          }}
                          className="text-slate-400 hover:text-sky-500 flex items-center gap-1 cursor-pointer"
                        >
                          <Share2 size={12} />
                          <span>Поделиться</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Refactored Section: "Настройка диалогов" (Dialog Settings & Analytics) */}
      <div className="glass-card rounded-3xl p-3.5 border border-white/60 dark:border-slate-800 space-y-3">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>Настройка диалогов</span>
          <MessagesSquare size={15} className="text-indigo-500" />
        </div>

        {/* Sub-Tabs for Dialog Settings */}
        <div className="grid grid-cols-4 gap-1 bg-slate-200/80 dark:bg-slate-800/80 p-1 rounded-2xl text-[10px] font-bold">
          <button
            type="button"
            onClick={() => {
              setDialogSettingsTab('analytics');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              dialogSettingsTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 size={12} />
            <span className="truncate">Аналитика</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDialogSettingsTab('privacy');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              dialogSettingsTab === 'privacy'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LockKeyhole size={12} />
            <span className="truncate">Приватность</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDialogSettingsTab('blocked_users');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              dialogSettingsTab === 'blocked_users'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserX size={12} />
            <span className="truncate">Юзеры ({blockedUsersList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDialogSettingsTab('blocked_dialogs');
              triggerHaptic('light');
            }}
            className={`py-1.5 px-1 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              dialogSettingsTab === 'blocked_dialogs'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-500/20 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Ban size={12} />
            <span className="truncate">Чаты ({blockedDialogsList.length})</span>
          </button>
        </div>

        {/* 1. Dialog Analytics Tab */}
        {dialogSettingsTab === 'analytics' && (
          <div className="space-y-3 animate-fade-in">
            {/* Folder Analytics Banner Row */}
            <div
              onClick={() => {
                setShowFolderStatsModal(true);
                triggerHaptic('light');
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <FolderKanban size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Аналитика и статистика папок</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Анализ распределения чатов и сообщений по папкам</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-indigo-500" />
                  <span>Аналитика общения</span>
                </div>
                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[10px] font-bold">
                  {(['week', 'month', 'year', 'all'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        setDialogAnalyticsTimeframe(tf);
                        triggerHaptic('light');
                      }}
                      className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                        dialogAnalyticsTimeframe === tf
                          ? 'bg-indigo-600 text-white font-extrabold'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {tf === 'week' ? 'Неделя' : tf === 'month' ? 'Месяц' : tf === 'year' ? 'Год' : 'Всё время'}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Статистика ваших диалогов, с кем вы общаетесь активнее всего за выбранный период.
              </p>
            </div>

            {/* Top Interlocutors List */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Топ контактов по количеству сообщений:
              </div>

              {contacts.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 text-center text-[11px] text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1 border border-dashed border-slate-200 dark:border-slate-700/60">
                  <Users size={18} className="text-slate-300 dark:text-slate-600" />
                  <span>История сообщений и диалогов пока пуста</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.slice(0, 5).map((contact) => {
                    const cachedMsgs = cacheService.getCachedMessages(contact.id);
                    const realMsgCount = cachedMsgs && cachedMsgs.length > 0 ? cachedMsgs.length : (contact.unread || (contact.last ? 1 : 0));
                    const maxCount = Math.max(
                      ...contacts.map((c) => {
                        const m = cacheService.getCachedMessages(c.id);
                        return m && m.length > 0 ? m.length : (c.unread || (c.last ? 1 : 0));
                      }),
                      1
                    );
                    const percent = Math.min(100, Math.round((realMsgCount / maxCount) * 100));

                    return (
                      <div
                        key={contact.id}
                        className="p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-7 w-7 rounded-full bg-gradient-to-tr ${contact.color || 'from-sky-500 to-indigo-600'} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                              {contact.initials || (contact.name || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {contact.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {contact.username || `@user_${contact.id}`}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                              {realMsgCount} сообщ.
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700/80 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Dialog Privacy & Flexible Behavior Tab */}
        {dialogSettingsTab === 'privacy' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <LockKeyhole size={14} className="text-indigo-500" />
              <span>Гибкая настройка диалогов и приватность</span>
            </div>

            {/* Chat List Sorting Setting */}
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                  <ArrowUpDown size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Сортировка диалогов</div>
                  <div className="text-[10px] text-slate-400">Порядок отображения контактов и чатов в списке</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setChatSortMode('recent');
                    localStorage.setItem(`orbit_chat_sort_mode_${user?.id || 'me'}`, 'recent');
                    window.dispatchEvent(new Event('orbit_sort_mode_changed'));
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 rounded-lg transition cursor-pointer ${
                    chatSortMode === 'recent'
                      ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  По времени
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatSortMode('name');
                    localStorage.setItem(`orbit_chat_sort_mode_${user?.id || 'me'}`, 'name');
                    window.dispatchEvent(new Event('orbit_sort_mode_changed'));
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 rounded-lg transition cursor-pointer ${
                    chatSortMode === 'name'
                      ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  По имени
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatSortMode('online');
                    localStorage.setItem(`orbit_chat_sort_mode_${user?.id || 'me'}`, 'online');
                    window.dispatchEvent(new Event('orbit_sort_mode_changed'));
                    triggerHaptic('light');
                  }}
                  className={`py-1.5 px-2 rounded-lg transition cursor-pointer ${
                    chatSortMode === 'online'
                      ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  В сети
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <label className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Скрывать статус «Прочитано»</div>
                  <div className="text-[10px] text-slate-400">Собеседники не увидят, когда вы прочитали их сообщения</div>
                </div>
                <input
                  type="checkbox"
                  checked={hideReadReceipts}
                  onChange={handleToggleHideReadReceipts}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Скрывать статус «Печатает...»</div>
                  <div className="text-[10px] text-slate-400">Не показывать индикатор набора текста в диалогах</div>
                </div>
                <input
                  type="checkbox"
                  checked={hideTypingIndicator}
                  onChange={(e) => {
                    setHideTypingIndicator(e.target.checked);
                    localStorage.setItem('orbit_hide_typing', e.target.checked ? 'true' : 'false');
                    triggerHaptic('light');
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Скрывать сетевой статус (Онлайн)</div>
                  <div className="text-[10px] text-slate-400">Скрыть точное время последнего захода</div>
                </div>
                <input
                  type="checkbox"
                  checked={hideOnlineStatus}
                  onChange={(e) => {
                    setHideOnlineStatus(e.target.checked);
                    localStorage.setItem('orbit_hide_online', e.target.checked ? 'true' : 'false');
                    triggerHaptic('light');
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Быстрый ответ по двойному тапу</div>
                  <div className="text-[10px] text-slate-400">Двойное нажатие на облако сообщения открывает цитирование</div>
                </div>
                <input
                  type="checkbox"
                  checked={doubleTapQuickReply}
                  onChange={(e) => {
                    setDoubleTapQuickReply(e.target.checked);
                    localStorage.setItem('orbit_double_tap_reply', e.target.checked ? 'true' : 'false');
                    triggerHaptic('light');
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Автоархивация неактивных чатов</div>
                  <div className="text-[10px] text-slate-400">Архивировать чаты без активности более 30 дней</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoArchiveInactive}
                  onChange={(e) => {
                    setAutoArchiveInactive(e.target.checked);
                    localStorage.setItem('orbit_auto_archive', e.target.checked ? 'true' : 'false');
                    triggerHaptic('light');
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
              </label>

              <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Лимит закрепленных диалогов</div>
                  <div className="text-[10px] text-slate-400">Максимальное кол-во чатов поверх списка</div>
                </div>
                <select
                  value={pinnedChatsLimit}
                  onChange={(e) => {
                    setPinnedChatsLimit(e.target.value);
                    localStorage.setItem('orbit_pinned_chats_limit', e.target.value);
                    triggerHaptic('light');
                  }}
                  className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-2 py-1 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="5">5 чатов</option>
                  <option value="10">10 чатов</option>
                  <option value="20">20 чатов</option>
                  <option value="unlimited">Без лимита</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. Blocked Users Tab */}
        {dialogSettingsTab === 'blocked_users' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <UserX size={14} className="text-rose-500" />
                <span>Заблокированные пользователи ({blockedUsersList.length})</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Заблокированные аккаунты не могут писать вам личные сообщения или видеть ваш статус.
            </p>

            {blockedUsersList.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 text-center text-[11px] text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1 border border-dashed border-slate-200 dark:border-slate-700/60">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span>Список заблокированных пользователей пуст</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {blockedUsersList.map((bu) => (
                  <div
                    key={bu.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-rose-500/10 text-rose-500 font-bold flex items-center justify-center shrink-0">
                        <UserX size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{bu.name}</div>
                        <div className="text-[10px] text-slate-400">{bu.username} • {bu.date}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnblockUser(bu.id, bu.name)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold transition cursor-pointer shrink-0"
                    >
                      Разблокировать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Blocked Dialogs Tab */}
        {dialogSettingsTab === 'blocked_dialogs' && (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Ban size={14} className="text-rose-500" />
                <span>Заблокированные диалоги и каналы ({blockedDialogsList.length})</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Заблокированные или заглушенные групповые чаты и каналы.
            </p>

            {blockedDialogsList.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 text-center text-[11px] text-slate-400 dark:text-slate-500 flex flex-col items-center gap-1 border border-dashed border-slate-200 dark:border-slate-700/60">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <span>Заблокированных диалогов и каналов нет</span>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {blockedDialogsList.map((bd) => (
                  <div
                    key={bd.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-500 font-bold flex items-center justify-center shrink-0">
                        <VolumeX size={15} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <span>{bd.name}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-extrabold uppercase">
                            {bd.type === 'channel' ? 'Канал' : 'Группа'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">Заблокирован: {bd.date}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnblockDialog(bd.id, bd.name)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold transition cursor-pointer shrink-0"
                    >
                      Разблокировать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Card: "Данные, медиа & экономия трафика" */}
      <div className="glass-card rounded-3xl p-3.5 border border-white/60 dark:border-slate-800 space-y-3">
        <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>Данные, медиа & экономия трафика</span>
          <HardDrive size={15} className="text-emerald-500" />
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
          {/* Follower Groups Row */}
          <div
            onClick={() => {
              setShowFollowerGroupsModal(true);
              triggerHaptic('light');
            }}
            className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <UserCheck size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Группы подписчиков</span>
                </div>
                <div className="text-[10px] text-slate-400">Сортировка людей для приватностей сториз и новостей</div>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          {/* Traffic Saver Toggle */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Zap size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Режим экономии трафика</div>
                <div className="text-[10px] text-slate-400">Снижает расход мобильных данных</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const val = !dataSaverMode;
                setDataSaverMode(val);
                localStorage.setItem('orbit_data_saver_mode', val ? 'true' : 'false');
                triggerHaptic('light');
              }}
              className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                dataSaverMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  dataSaverMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Hide Media in Feed Toggle */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                <EyeOff size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Скрывать медиафайлы в ленте</div>
                <div className="text-[10px] text-slate-400">Показывать только текстовые превью новостей</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const val = !hideMediaInFeed;
                setHideMediaInFeed(val);
                localStorage.setItem('orbit_hide_media_feed', val ? 'true' : 'false');
                triggerHaptic('light');
              }}
              className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                hideMediaInFeed ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  hideMediaInFeed ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto Download Select */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Download size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Автозагрузка медиафайлов</div>
                <div className="text-[11px] text-slate-400">Сеть для загрузки фото и видео</div>
              </div>
            </div>
            <select
              value={autoDownloadOption}
              onChange={(e) => {
                setAutoDownloadOption(e.target.value);
                localStorage.setItem('orbit_auto_download_option', e.target.value);
                triggerHaptic('light');
              }}
              className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-2 py-1 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="all">Все сети</option>
              <option value="wifi">Только Wi-Fi</option>
              <option value="never">Никогда</option>
            </select>
          </div>

          {/* Video Quality Select */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Качество автовоспроизведения видео</div>
              <div className="text-[10px] text-slate-400">Разрешение видеороликов в сети</div>
            </div>
            <select
              value={videoQualityOption}
              onChange={(e) => {
                setVideoQualityOption(e.target.value);
                localStorage.setItem('orbit_video_quality', e.target.value);
                triggerHaptic('light');
              }}
              className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-2 py-1 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="1080p">1080p Full HD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p Эко</option>
            </select>
          </div>

          {/* Photo Quality Select */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Качество отправляемых фото</div>
              <div className="text-[10px] text-slate-400">Степень сжатия изображений при отправке</div>
            </div>
            <select
              value={photoQualityOption}
              onChange={(e) => {
                setPhotoQualityOption(e.target.value);
                localStorage.setItem('orbit_photo_quality', e.target.value);
                triggerHaptic('light');
              }}
              className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-2 py-1 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="high">Высокое (оригинал)</option>
              <option value="optimal">Оптимальное</option>
              <option value="max_compression">Макс. сжатие</option>
            </select>
          </div>

          {/* Clear Cache Button */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 pt-2">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Кэш приложения</div>
              <div className="text-[10px] text-slate-400">Занимаемое место: {appCacheSize}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAppCacheSize('0 КБ');
                setToastMessage('Кэш приложения успешно очищен');
                setTimeout(() => setToastMessage(null), 2500);
                triggerHaptic('medium');
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Очистить кэш
            </button>
          </div>
        </div>
      </div>

      {/* Language & Country Settings Card */}
      <div className="glass-card rounded-3xl p-3 border border-white/60 dark:border-slate-800 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>{t.languageAndRegion}</span>
          <Globe size={13} />
        </div>

        {/* Platform Language Selector */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <Globe size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">{t.platformLanguage}</div>
              <div className="text-[11px] text-muted">Язык интерфейса приложения</div>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => {
              const val = e.target.value as SupportedLanguage;
              setSelectedLanguage(val);
              setLanguage(val);
              api.updateProfile({ language: val }).catch(() => {});
              setToastMessage(`Язык приложения изменён на: ${val}`);
              setTimeout(() => setToastMessage(null), 2500);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs font-semibold text-primary outline-none cursor-pointer"
          >
            <option value="Русский">Русский 🇷🇺</option>
            <option value="English">English 🇺🇸</option>
            <option value="Ўзбекча">Ўзбекча 🇺🇿</option>
            <option value="Қазақша">Қазақша 🇰🇿</option>
            <option value="Türkçe">Türkçe 🇹🇷</option>
            <option value="Deutsch">Deutsch 🇩🇪</option>
          </select>
        </div>

        {/* Country of Residence Selector */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Страна проживания</div>
              <div className="text-[11px] text-muted">Ваш текущий регион</div>
            </div>
          </div>
          <select
            value={selectedCountry}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCountry(val);
              localStorage.setItem('orbit_app_country', val);
              setToastMessage(`Страна проживания изменена на: ${val}`);
              setTimeout(() => setToastMessage(null), 2500);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs font-semibold text-primary outline-none cursor-pointer"
          >
            <option value="Россия">Россия</option>
            <option value="Узбекистан">Узбекистан</option>
            <option value="Казахстан">Казахстан</option>
            <option value="Турция">Турция</option>
            <option value="Германия">Германия</option>
            <option value="ОАЭ">ОАЭ</option>
            <option value="США">США</option>
          </select>
        </div>
      </div>

      {/* App Appearance & Logout Section */}
      <div className="glass-card rounded-3xl p-3 border border-white/60 dark:border-slate-800 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Оформление и аккаунт
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl transition opacity-60">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <Sun size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>Тёмное оформление</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-semibold">Недоступно</span>
              </div>
              <div className="text-[11px] text-muted">
                Переход на тёмную тему временно недоступен
              </div>
            </div>
          </div>
          <button
            disabled
            onClick={() => {
              setToastMessage('Переход на тёмную тему пока недоступен');
              setTimeout(() => setToastMessage(null), 3000);
            }}
            className="w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 bg-slate-300 cursor-not-allowed opacity-60"
            title="Тёмное оформление временно недоступно"
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-transform translate-x-0" />
          </button>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-2xs flex items-center justify-center shrink-0">
              <LogOut size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-red-500 dark:text-red-400">Выйти из аккаунта</div>
              <div className="text-[11px] text-muted">Завершить текущий сеанс в ORBIT</div>
            </div>
          </div>
          <ChevronRight size={15} className="text-red-400/60 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Email Verification Modal */}
      {showEmailVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-6 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-xl space-y-4">
            <button
              onClick={() => setShowEmailVerifyModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">Завершение регистрации</h3>
                <p className="text-xs text-muted">Подтверждение электронной почты</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Код подтверждения отправлен на почту <strong className="text-primary">{user.email}</strong>.
            </p>

            {/* Display Demo Verification Code clearly inside the Modal */}
            {sentEmailCode && (
              <div className="p-3 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 text-center space-y-1">
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Ваш демо-код подтверждения:
                </div>
                <div className="flex items-center justify-center gap-2 pt-0.5">
                  <span className="text-xl font-bold font-mono tracking-widest text-blue-700 dark:text-blue-300">
                    {sentEmailCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailCode(sentEmailCode)}
                    className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold shadow-2xs active:scale-95 transition"
                  >
                    Вставить
                  </button>
                </div>
              </div>
            )}

            <div>
              <input
                type="text"
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                placeholder="6 цифр"
                className="w-full text-center text-xl tracking-[0.4em] font-mono py-2.5 rounded-2xl border border-custom bg-white/50 dark:bg-slate-900/50 outline-none"
              />
            </div>

            {emailVerifyError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={14} />
                <span>{emailVerifyError}</span>
              </div>
            )}

            <button
              onClick={handleConfirmEmailCode}
              className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm active:scale-95 transition"
            >
              Подтвердить Email
            </button>
          </div>
        </div>
      )}

      {/* 2FA Configuration Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-6 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-xl space-y-4">
            <button
              onClick={() => setShow2FAModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-primary">Подключение 2FA</h3>
                <p className="text-xs text-muted">Authenticator (Google / Authy)</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-custom flex flex-col items-center gap-2">
              <div className="h-32 w-32 bg-white p-2 rounded-xl flex items-center justify-center shadow-inner">
                <QrCode size={100} className="text-slate-900" />
              </div>
              <p className="text-[11px] text-muted text-center mt-1">Отсканируйте QR-код приложением аутентификации</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">Секретный ключ (ручной ввод)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secretKey}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-2xl border border-custom bg-white/50 dark:bg-slate-900/50 text-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(secretKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-2 rounded-2xl glass-button text-blue-500"
                >
                  {copiedKey ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Введите код из приложения</label>
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6 цифр"
                className="w-full text-center tracking-widest text-base py-2 rounded-2xl border border-custom bg-white/50 dark:bg-slate-900/50 outline-none"
              />
            </div>

            {totpError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={14} />
                <span>{totpError}</span>
              </div>
            )}

            <button
              onClick={handleVerifyAndEnable2FA}
              className="w-full py-2.5 rounded-2xl bg-blue-600 text-white font-semibold text-xs shadow-sm active:scale-95 transition"
            >
              Активировать 2FA
            </button>
          </div>
        </div>
      )}

      {/* Following Modal (Подписки) */}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-5 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-xl space-y-3">
            <button
              onClick={() => {
                setShowFollowingModal(false);
                setSocialSearchQuery('');
              }}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <UserCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">Подписки</h3>
                <p className="text-[11px] text-muted">Вы подписаны ({followingList.length})</p>
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={socialSearchQuery}
                onChange={(e) => setSocialSearchQuery(e.target.value)}
                placeholder="Поиск по подпискам..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-custom outline-none"
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar pt-1">
              {followingList
                .filter(
                  (item) =>
                    item.name.toLowerCase().includes(socialSearchQuery.toLowerCase()) ||
                    item.username.toLowerCase().includes(socialSearchQuery.toLowerCase())
                )
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-custom"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                        {f.name ? f.name.slice(0, 2).toUpperCase() : 'OR'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary">{f.name}</div>
                        <div className="text-[10px] text-muted">{f.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFollowingList((prev) => prev.filter((i) => i.id !== f.id));
                        setToastMessage(`Вы отписались от ${f.name}`);
                        setTimeout(() => setToastMessage(null), 2500);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-primary text-[10px] font-bold transition"
                    >
                      Отписаться
                    </button>
                  </div>
                ))}
              {followingList.length === 0 && (
                <div className="text-center text-xs text-muted py-6">Список подписок пуст</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Followers Modal (Подписчики) */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-5 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-xl space-y-3.5">
            <button
              onClick={() => {
                setShowFollowersModal(false);
                setSocialSearchQuery('');
              }}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">Подписчики</h3>
                <p className="text-[11px] text-muted">Всего подписчиков ({followersList.length})</p>
              </div>
            </div>

            {/* Filter Tabs for Subscribers */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-custom">
              <button
                onClick={() => setSubscriberFilterTab('all')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition ${
                  subscriberFilterTab === 'all'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Все ({followersList.length})
              </button>
              <button
                onClick={() => setSubscriberFilterTab('online')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  subscriberFilterTab === 'online'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                В сети ({followersList.filter((f) => f.isOnline).length})
              </button>
              <button
                onClick={() => {
                  setShowFollowersModal(false);
                  setShowFollowerGroupsModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition"
                title="Управление списками и группами"
              >
                Списки
              </button>
            </div>

            {/* Search filter & Sorting controls bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={socialSearchQuery}
                  onChange={(e) => setSocialSearchQuery(e.target.value)}
                  placeholder="Поиск по подписчикам..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-custom outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="relative shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-custom text-xs">
                <ArrowUpDown size={13} className="text-sky-500" />
                <select
                  value={subscriberSortMode}
                  onChange={(e) => setSubscriberSortMode(e.target.value as any)}
                  className="bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer pr-1"
                >
                  <option value="recent">Сначала новые</option>
                  <option value="name">По имени (А–Я)</option>
                  <option value="online">Сначала В сети</option>
                </select>
              </div>
            </div>

            {/* Subscribers List */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 no-scrollbar pt-1">
              {followersList
                .filter((item) => {
                  if (subscriberFilterTab === 'online' && !item.isOnline) return false;
                  return (
                    item.name.toLowerCase().includes(socialSearchQuery.toLowerCase()) ||
                    item.username.toLowerCase().includes(socialSearchQuery.toLowerCase())
                  );
                })
                .sort((a, b) => {
                  if (subscriberSortMode === 'name') {
                    return a.name.localeCompare(b.name, 'ru');
                  }
                  if (subscriberSortMode === 'online') {
                    if (a.isOnline === b.isOnline) return a.name.localeCompare(b.name, 'ru');
                    return b.isOnline ? 1 : -1;
                  }
                  return 0; // recent (default)
                })
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-custom hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`h-9 w-9 rounded-full bg-gradient-to-br ${
                            f.color || 'from-indigo-400 to-purple-500'
                          } flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                        >
                          {f.avatarUrl ? (
                            <img src={f.avatarUrl} alt={f.name} className="h-full w-full rounded-full object-cover" />
                          ) : f.name ? (
                            f.name.slice(0, 2).toUpperCase()
                          ) : (
                            'OR'
                          )}
                        </div>
                        {f.isOnline && (
                          <span
                            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                            title="В сети"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-primary truncate flex items-center gap-1">
                          <span className="truncate">{f.name}</span>
                        </div>
                        <div className="text-[10px] text-muted truncate">{f.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          setFollowersList((prev) => prev.filter((i) => i.id !== f.id));
                          setToastMessage(`Пользователь ${f.name} удален из подписчиков`);
                          setTimeout(() => setToastMessage(null), 2500);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-primary text-[10px] font-bold transition"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}

              {followersList.length === 0 && (
                <div className="text-center text-xs text-muted py-8">У вас пока нет подписчиков</div>
              )}

              {followersList.length > 0 &&
                followersList.filter((item) => {
                  if (subscriberFilterTab === 'online' && !item.isOnline) return false;
                  return (
                    item.name.toLowerCase().includes(socialSearchQuery.toLowerCase()) ||
                    item.username.toLowerCase().includes(socialSearchQuery.toLowerCase())
                  );
                }).length === 0 && (
                  <div className="text-center text-xs text-muted py-8">Подписчики по заданным фильтрам не найдены</div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Folder Statistics Analytics Modal */}
      {showFolderStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar rounded-3xl p-5 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-2xl space-y-4">
            <button
              onClick={() => {
                setShowFolderStatsModal(false);
                setSelectedFolderIdForDetails(null);
              }}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 text-sky-500 flex items-center justify-center shadow-2xs">
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-primary">Аналитика и статистика папок</h3>
                <p className="text-xs text-muted">Привычки организации переписок</p>
              </div>
            </div>

            {/* Organizational Habit Recommendation Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-400/30 text-xs space-y-1">
              <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Индекс структурирования: {organizationPercentage}%</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {organizationPercentage >= 80
                  ? 'Превосходная организация! Ваши чаты чётко распределены, что ускоряет поиск нужной информации и снижает когнитивную нагрузку.'
                  : organizationPercentage >= 50
                  ? 'Хороший уровень структурированности. Рекомендуется распределить оставшиеся чаты по тематическим папкам.'
                  : 'Большинство диалогов находятся вне папок. Настройте категории для комфортной навигации.'}
              </p>
            </div>

            {/* Filter Tabs by Folder */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                onClick={() => setSelectedFolderIdForDetails(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                  selectedFolderIdForDetails === null
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Все категории
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolderIdForDetails(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                    selectedFolderIdForDetails === f.id
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.name}
                </button>
              ))}
              {uncategorizedContacts.length > 0 && (
                <button
                  onClick={() => setSelectedFolderIdForDetails('uncategorized')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                    selectedFolderIdForDetails === 'uncategorized'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Без папки
                </button>
              )}
            </div>

            {/* Detail Breakdown View */}
            <div className="space-y-3">
              {(selectedFolderIdForDetails === null
                ? folderStatsList
                : folderStatsList.filter((item) => item.folder.id === selectedFolderIdForDetails)
              ).map((item) => (
                <div
                  key={item.folder.id}
                  className="p-3.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-7 w-7 rounded-lg ${item.theme.bg} ${item.theme.text} flex items-center justify-center font-bold border ${item.theme.border}`}>
                        <Folder size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-primary">{item.folder.name}</h4>
                        <div className="text-[10px] text-muted">{item.chatCount} диалогов в категории</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                        {totalMessagesInApp > 0 ? Math.round((item.messageCount / totalMessagesInApp) * 100) : 0}% сообщ.
                      </span>
                    </div>
                  </div>

                  {/* Sub-metrics breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/70">
                      <div className="font-bold text-primary">{item.dmsCount}</div>
                      <div className="text-muted">Личные</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/70">
                      <div className="font-bold text-primary">{item.groupsCount}</div>
                      <div className="text-muted">Группы</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/70">
                      <div className="font-bold text-primary">{item.channelsCount}</div>
                      <div className="text-muted">Каналы</div>
                    </div>
                  </div>

                  {/* List of contacts in this folder */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Чаты в этой папке:</div>
                    {item.contacts.length === 0 ? (
                      <div className="text-[11px] text-muted italic py-1">Папка пока пуста</div>
                    ) : (
                      item.contacts.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className={`h-6 w-6 rounded-full bg-gradient-to-br ${c.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                              {c.initials}
                            </div>
                            <span className="font-semibold text-primary truncate">{c.name}</span>
                          </div>
                          {c.unread > 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500 text-white shrink-0">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}

              {/* Uncategorized Details if selected */}
              {(selectedFolderIdForDetails === null || selectedFolderIdForDetails === 'uncategorized') && uncategorizedContacts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <FolderMinus size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-primary">Чаты без папки</h4>
                        <div className="text-[10px] text-muted">{uncategorizedContacts.length} чатов вне категорий</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {uncategorizedContacts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-amber-500/20 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`h-6 w-6 rounded-full bg-gradient-to-br ${c.color} text-white flex items-center justify-center text-[10px] font-bold shrink-0`}>
                            {c.initials}
                          </div>
                          <span className="font-semibold text-primary truncate">{c.name}</span>
                        </div>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Без категории</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        currentUser={user || undefined}
      />

      {/* Follower Groups Modal */}
      <FollowerGroupsModal
        isOpen={showFollowerGroupsModal}
        onClose={() => setShowFollowerGroupsModal(false)}
        followersList={followersList}
      />

    </div>
  );
};
