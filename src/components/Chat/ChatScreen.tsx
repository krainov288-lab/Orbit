import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  ArrowUpRight,
  FileText,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MoreVertical,
  Trash2,
  ShieldAlert,
  Ban,
  X,
  Phone,
  Video,
  Mic,
  Smile,
  Lock,
  Play,
  Pause,
  Download,
  Zap,
  Users,
  UserPlus,
  Radio,
  Search,
  ChevronUp,
  ChevronDown,
  Globe,
  Languages,
  CornerUpLeft,
  CornerUpRight,
  Eye,
  Maximize2,
  ExternalLink,
  Share2,
  Palette,
} from 'lucide-react';
import { Contact, Message, MessageReactionInfo, User } from '../../types';
import { api } from '../../services/api';
import { compressImage } from '../../services/media';
import { socketService } from '../../services/socket';
import { cacheService } from '../../services/cacheService';
import { E2EESecurityModal } from './E2EESecurityModal';
import { CallOverlayModal, CallType } from './CallOverlayModal';
import { VoiceRecorder } from './VoiceRecorder';
import {
  WallpaperModal,
  WallpaperBackgroundLayer,
  WallpaperSettings,
  DEFAULT_WALLPAPER_SETTINGS,
} from './WallpaperModal';
import { VideoCircleRecorder } from './VideoCircleRecorder';
import { StickerEmojiPicker } from './StickerEmojiPicker';
import { VideoCirclePlayer } from './VideoCirclePlayer';
import { StickyMediaHeaderPlayer } from './StickyMediaHeaderPlayer';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { ScheduledMessagesListModal } from './ScheduledMessagesListModal';
import {
  getScheduledMessages,
  addScheduledMessage,
  removeScheduledMessage,
} from '../../utils/scheduledMessages';
import { ScheduledMessage } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { Skeleton, SkeletonAvatar } from '../Common/Skeleton';

const MessageStatusIndicator: React.FC<{ message: Message; chatId?: string }> = ({ message, chatId }) => {
  const isHideRead = typeof window !== 'undefined' && (
    (chatId && localStorage.getItem(`orbit_hide_read_receipts_${chatId}`) === 'true') ||
    localStorage.getItem('orbit_hide_read_receipts') === 'true'
  );

  if (message.pending) {
    return <Clock size={11} className="text-slate-400 dark:text-slate-500 animate-pulse" title="Отправляется..." />;
  }
  if (message.isRead || message.status === 'read') {
    if (isHideRead) {
      return <Check size={12} className="text-slate-400 dark:text-slate-500" title="Отправлено (статус скрыт)" />;
    }
    return <CheckCheck size={12} className="text-sky-500 font-bold" title="Прочитано" />;
  }
  if (message.status === 'delivered') {
    return <CheckCheck size={12} className="text-slate-400 dark:text-slate-500" title="Доставлено" />;
  }
  return <Check size={12} className="text-slate-400 dark:text-slate-500" title="Отправлено" />;
};

interface ChatScreenProps {
  contact: Contact;
  onBack: () => void;
  balance: number;
  onSendCrypto: () => void;
  isDark?: boolean;
  isGuest?: boolean;
  user?: User | null;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onRefreshContacts?: () => void;
  onUpdateContact?: (contact: Contact) => void;
  onInitiateCall?: (contact: Contact, type: CallType) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  contact,
  onBack,
  balance,
  onSendCrypto,
  isDark,
  isGuest,
  user,
  onOpenAuth,
  onOpenUserProfile,
  onRefreshContacts,
  onUpdateContact,
  onInitiateCall,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`orbit_draft_${contact.id}`) || '';
    }
    return '';
  });
  const loadedDraftContactIdRef = useRef<string>(contact.id);

  // Auto-restore draft when contact changes
  useEffect(() => {
    loadedDraftContactIdRef.current = contact.id;
    if (typeof window !== 'undefined') {
      const savedDraft = localStorage.getItem(`orbit_draft_${contact.id}`);
      setInput(savedDraft || '');
    }
  }, [contact.id]);

  // Auto-save draft when input changes
  useEffect(() => {
    if (typeof window !== 'undefined' && loadedDraftContactIdRef.current === contact.id) {
      if (input) {
        localStorage.setItem(`orbit_draft_${contact.id}`, input);
      } else {
        localStorage.removeItem(`orbit_draft_${contact.id}`);
      }
    }
  }, [input, contact.id]);

  // Scheduled Messages State
  const [scheduledList, setScheduledList] = useState<ScheduledMessage[]>(() => getScheduledMessages());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScheduledListModal, setShowScheduledListModal] = useState(false);

  // Sync scheduled messages & dispatch due messages
  useEffect(() => {
    const checkScheduled = async () => {
      const all = getScheduledMessages();
      const now = Date.now();
      const due = all.filter((m) => m.scheduledAt <= now);

      if (due.length > 0) {
        for (const msg of due) {
          removeScheduledMessage(msg.id);
          try {
            const actualMsg = await api.sendMessage(msg.contactId, {
              text: msg.text,
              mediaUrl: msg.pendingMedia?.url,
              mediaType: msg.pendingMedia?.mediaType,
              duration: msg.pendingMedia?.duration,
              waveform: msg.pendingMedia?.waveform,
              replyTo: msg.replyTo,
            });

            if (msg.contactId === contact.id) {
              setMessages((prev) => [...prev, actualMsg]);
              requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              });
            }
            showToast('⏱ Отложенное сообщение отправлено!');
          } catch (err) {
            console.error('Failed to send scheduled message:', err);
            showToast('Ошибка отправки отложенного сообщения');
          }
        }
        setScheduledList(getScheduledMessages());
      }
    };

    checkScheduled();
    const interval = setInterval(checkScheduled, 3000);
    return () => clearInterval(interval);
  }, [contact.id, user]);

  const contactScheduledMessages = scheduledList.filter((m) => m.contactId === contact.id);

  const handleScheduleMessageConfirm = (scheduledAtMs: number) => {
    const textToSend = input.trim();
    if (!textToSend && !pendingMedia) return;

    addScheduledMessage({
      contactId: contact.id,
      text: textToSend,
      scheduledAt: scheduledAtMs,
      pendingMedia: pendingMedia ? {
        url: pendingMedia.url,
        mediaType: pendingMedia.mediaType,
        fileName: pendingMedia.fileName,
        fileSize: pendingMedia.fileSize,
      } : null,
      replyTo: replyingToMessage ? {
        id: replyingToMessage.id,
        text: replyingToMessage.text || 'Медиафайл',
        senderName: replyingToMessage.from === 'me' ? (user?.username || 'Вы') : contact.name,
      } : undefined,
    });

    setInput('');
    setPendingMedia(null);
    setReplyingToMessage(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`orbit_draft_${contact.id}`);
    }
    setScheduledList(getScheduledMessages());

    const dateFormatted = new Date(scheduledAtMs).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    showToast(`⏱ Сообщение запланировано на ${dateFormatted}`);
  };

  const handleSendScheduledNow = async (msg: ScheduledMessage) => {
    removeScheduledMessage(msg.id);
    setScheduledList(getScheduledMessages());
    try {
      const actualMsg = await api.sendMessage(msg.contactId, {
        text: msg.text,
        mediaUrl: msg.pendingMedia?.url,
        mediaType: msg.pendingMedia?.mediaType,
        duration: msg.pendingMedia?.duration,
        waveform: msg.pendingMedia?.waveform,
        replyTo: msg.replyTo,
      });

      if (msg.contactId === contact.id) {
        setMessages((prev) => [...prev, actualMsg]);
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
      showToast('Сообщение отправлено!');
    } catch (err) {
      console.error('Failed to send scheduled message:', err);
      showToast('Ошибка при отправке сообщения');
    }
  };

  const handleDeleteScheduled = (id: string) => {
    removeScheduledMessage(id);
    setScheduledList(getScheduledMessages());
    showToast('Запланированное сообщение удалено');
  };

  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSendCryptoModal, setShowSendCryptoModal] = useState(false);
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [sendingCrypto, setSendingCrypto] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Pending Photo/Media Attachment State (Photo with Caption)
  const [pendingMedia, setPendingMedia] = useState<{
    url: string;
    mediaType: 'image' | 'file' | 'audio' | 'video_circle' | 'sticker' | 'document';
    fileName?: string;
    fileSize?: string;
  } | null>(null);

  // Reply Mechanics State (WhatsApp style)
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  // Forward Mechanics State (WhatsApp style)
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardContacts, setForwardContacts] = useState<Contact[]>([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const [sendingForward, setSendingForward] = useState(false);

  // Full Screen Image Lightbox Modal State
  const [fullScreenImage, setFullScreenImage] = useState<{ url: string; title?: string } | null>(null);

  // Chat Wallpaper Background Customization State
  const [wallpaperSettings, setWallpaperSettings] = useState<WallpaperSettings>(DEFAULT_WALLPAPER_SETTINGS);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  // Sync wallpaper settings on contact change or channel group setting update
  useEffect(() => {
    if (contact.isChannelGroup) {
      setWallpaperSettings({
        preset: contact.bgPattern || 'default',
        opacity: contact.bgOpacity ?? 35,
        adaptTheme: contact.bgAdaptTheme ?? true,
        imageUrl: contact.bgImageUrl || '',
      });
    } else {
      try {
        const chatKey = `orbit_chat_wallpaper_${contact.id}_${user?.id || 'me'}`;
        const saved = localStorage.getItem(chatKey);
        if (saved) {
          setWallpaperSettings(JSON.parse(saved));
          return;
        }
        const globalSaved = localStorage.getItem('chat_wallpaper_settings');
        if (globalSaved) {
          setWallpaperSettings(JSON.parse(globalSaved));
          return;
        }
      } catch (e) {
        console.error('Failed to load wallpaper settings:', e);
      }
      setWallpaperSettings(DEFAULT_WALLPAPER_SETTINGS);
    }
  }, [
    contact.id,
    contact.isChannelGroup,
    contact.bgPattern,
    contact.bgOpacity,
    contact.bgAdaptTheme,
    contact.bgImageUrl,
    user?.id,
  ]);

  const handleSaveWallpaper = async (newSettings: WallpaperSettings) => {
    setWallpaperSettings(newSettings);

    if (contact.isChannelGroup) {
      if (!isUserAdminOrAuthor) {
        showToast('Задний фон канала/группы может менять только автор');
        return;
      }
      try {
        const res = await api.updateChannelGroup(contact.id, {
          bgPattern: newSettings.preset,
          bgOpacity: newSettings.opacity,
          bgAdaptTheme: newSettings.adaptTheme,
          bgImageUrl: newSettings.imageUrl,
        });
        if (res.success) {
          showToast('Фон канала/группы обновлен для всех участников!');
          if (onUpdateContact) {
            onUpdateContact({
              ...contact,
              bgPattern: newSettings.preset,
              bgOpacity: newSettings.opacity,
              bgAdaptTheme: newSettings.adaptTheme,
              bgImageUrl: newSettings.imageUrl,
            });
          }
        }
      } catch (err: any) {
        showToast(err.message || 'Ошибка сохранения фона на сервере');
      }
    } else {
      try {
        const chatKey = `orbit_chat_wallpaper_${contact.id}_${user?.id || 'me'}`;
        localStorage.setItem(chatKey, JSON.stringify(newSettings));
        localStorage.setItem('chat_wallpaper_settings', JSON.stringify(newSettings));
      } catch (e) {
        console.error('Failed to save wallpaper settings:', e);
      }
      showToast('Индивидуальный фон чата сохранен!');
    }
  };

  // Selection & Reaction State
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '🎉'];
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reactionPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Slow Mode state & countdown timer
  const [slowModeCooldown, setSlowModeCooldown] = useState<number>(0);
  const lastSentTimeRef = useRef<number>(0);

  // Channel & Group Permissions & Settings
  const isChannelGroup = contact.isChannelGroup;
  const isChannel = isChannelGroup && contact.channelGroupType?.includes('channel');
  const isGroup = isChannelGroup && contact.channelGroupType?.includes('group');

  const isUserAdminOrAuthor =
    contact.isAdmin ||
    (user &&
      (contact.creatorId === user.id ||
        (contact.adminIds && contact.adminIds.includes(user.id)) ||
        (contact.moderatorIds && contact.moderatorIds.includes(user.id))));

  const isJoined =
    !isChannelGroup ||
    isUserAdminOrAuthor ||
    (contact.memberIds && user ? contact.memberIds.includes(user.id) : true);

  const [joinedChannelState, setJoinedChannelState] = useState<boolean | null>(null);
  const isActuallyJoined = joinedChannelState !== null ? joinedChannelState : isJoined;

  const canPostInChannel = !isChannel || isUserAdminOrAuthor;
  const reactionsDisabled = !!contact.disableReactions;
  const commentsDisabled = !!contact.disableComments && isChannelGroup && !isUserAdminOrAuthor;
  const availableReactions =
    contact.allowedReactions && contact.allowedReactions.length > 0
      ? contact.allowedReactions
      : QUICK_EMOJIS;

  // Slow Mode countdown effect
  const slowModeSec = contact.slowMode || 0;
  useEffect(() => {
    if (!slowModeSec || isUserAdminOrAuthor) {
      setSlowModeCooldown(0);
      return;
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastSentTimeRef.current) / 1000);
      const remaining = slowModeSec - elapsed;
      setSlowModeCooldown(remaining > 0 ? remaining : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [slowModeSec, isUserAdminOrAuthor]);

  // Touch & Long Press Handlers for Messages
  const handleTouchStartMessage = (m: Message) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      triggerHaptic('impactMedium');
      setSelectedMessage(m);
    }, 450);
  };

  const handleTouchEndOrCancelMessage = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageClick = (m: Message, e: React.MouseEvent) => {
    const now = Date.now();
    if (lastTapRef.current.id === m.id && now - lastTapRef.current.time < 300) {
      // Double Tap Reaction!
      e.stopPropagation();
      if (!reactionsDisabled) {
        const defaultEmoji = availableReactions[0] || '❤️';
        handleToggleReaction(m.id, defaultEmoji);
      }
      lastTapRef.current = { id: '', time: 0 };
    } else {
      lastTapRef.current = { id: m.id, time: now };
    }
  };

  // Touch & Long Press Handlers for Reactions (Hold reaction badge -> opens reaction picker bubble)
  const handleReactionBadgeTouchStart = (messageId: string, e: React.SyntheticEvent) => {
    if (reactionsDisabled) return;
    if (reactionPressTimerRef.current) clearTimeout(reactionPressTimerRef.current);
    reactionPressTimerRef.current = setTimeout(() => {
      triggerHaptic('impactMedium');
      setActiveReactionPickerId(messageId);
    }, 400);
  };

  const handleReactionBadgeTouchEnd = () => {
    if (reactionPressTimerRef.current) {
      clearTimeout(reactionPressTimerRef.current);
      reactionPressTimerRef.current = null;
    }
  };

  const [isFeedMuted, setIsFeedMuted] = useState(() => {
    try {
      const muted: string[] = JSON.parse(localStorage.getItem('orbit_muted_channels') || '[]');
      return muted.includes(contact.id);
    } catch {
      return false;
    }
  });

  const handleToggleFeedMute = () => {
    try {
      const muted: string[] = JSON.parse(localStorage.getItem('orbit_muted_channels') || '[]');
      let next: string[];
      if (muted.includes(contact.id)) {
        next = muted.filter((id) => id !== contact.id);
        showToast('Новости канала включены в вашей ленте');
        setIsFeedMuted(false);
      } else {
        next = [...muted, contact.id];
        showToast('Новости с этого канала не будут попадать в ленту');
        setIsFeedMuted(true);
      }
      localStorage.setItem('orbit_muted_channels', JSON.stringify(next));
      cacheService.set('muted_channel_ids', next);
    } catch {}
  };

  const handleInitiateCall = (type: CallType) => {
    if (isChannel) {
      if (type === 'channel_stream') {
        if (!isUserAdminOrAuthor) {
          showToast('Только автор или администратор канала может запустить прямой эфир');
          return;
        }
        if (onInitiateCall) {
          onInitiateCall(contact, 'channel_stream');
        } else {
          socketService.emit('start_live_stream', {
            channelId: contact.id,
            channelTitle: contact.name,
            authorName: user?.username || 'Администратор',
          });
          setCallType('channel_stream');
        }
      } else {
        showToast('В каналах обычные звонки недоступны');
      }
      return;
    }

    if (isGroup && contact.allowCalls === false && !isUserAdminOrAuthor) {
      showToast('Звонки отключены администратором группы');
      return;
    }

    if (onInitiateCall) {
      onInitiateCall(contact, type);
    } else {
      socketService.emit('call_user', {
        targetUserId: contact.id,
        callType: type,
        caller: user,
        channelId: contact.isChannelGroup ? contact.id : undefined,
      });
      setCallType(type);
    }
  };

  // Modals & Modes
  const [showE2EEModal, setShowE2EEModal] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingCircle, setIsRecordingCircle] = useState(false);
  const [inputMode, setInputMode] = useState<'mic' | 'video_circle'>('mic');
  const [showStickerEmojiPicker, setShowStickerEmojiPicker] = useState(false);

  // Real-time Typing Indicator State
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [typingUserName, setTypingUserName] = useState<string | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const localTypingTimerRef = useRef<any>(null);
  const lastLocalTypingEmittedRef = useRef<number>(0);

  // Global Media Playback Engine State
  const [activeMedia, setActiveMedia] = useState<{
    id: string;
    type: 'audio' | 'video_circle';
    mediaUrl: string;
    title: string;
    duration: number;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);

  // In-Chat Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // AI Translation & Voice Transcription States
  const [translations, setTranslations] = useState<Record<string, { text: string; loading: boolean }>>({});
  const [transcriptions, setTranscriptions] = useState<Record<string, { text: string; loading: boolean }>>({});

  const handleTranslateMessage = async (msgId: string, text: string) => {
    setTranslations((prev) => ({ ...prev, [msgId]: { text: prev[msgId]?.text || '', loading: true } }));
    try {
      const res = await api.sendAIChat(text, 'translate_message');
      setTranslations((prev) => ({ ...prev, [msgId]: { text: res.reply, loading: false } }));
    } catch {
      setTranslations((prev) => ({ ...prev, [msgId]: { text: 'Ошибка ИИ перевода', loading: false } }));
    }
  };

  const handleTranscribeAudio = async (msgId: string, duration?: number) => {
    setTranscriptions((prev) => ({ ...prev, [msgId]: { text: prev[msgId]?.text || '', loading: true } }));
    try {
      const res = await api.sendAIChat(`Расшифруй голосовое сообщение ${duration || 5}с`, 'transcribe_audio');
      setTranscriptions((prev) => ({ ...prev, [msgId]: { text: res.reply, loading: false } }));
    } catch {
      setTranscriptions((prev) => ({ ...prev, [msgId]: { text: 'Ошибка расшифровки ГС', loading: false } }));
    }
  };

  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [pushStartPos, setPushStartPos] = useState<{ x: number; y: number } | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const recordPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongRecordPressRef = useRef(false);

  const handleRecordPointerDown = (e: React.PointerEvent) => {
    isLongRecordPressRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;

    if (recordPressTimerRef.current) {
      clearTimeout(recordPressTimerRef.current);
    }

    recordPressTimerRef.current = setTimeout(() => {
      isLongRecordPressRef.current = true;
      if (inputMode === 'mic') {
        setIsPushToTalk(true);
        setPushStartPos({ x: startX, y: startY });
        setIsRecordingVoice(true);
      } else {
        setIsRecordingCircle(true);
      }
    }, 220);
  };

  const handleRecordPointerUp = () => {
    if (recordPressTimerRef.current) {
      clearTimeout(recordPressTimerRef.current);
    }
  };

  const handleRecordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLongRecordPressRef.current) {
      isLongRecordPressRef.current = false;
      return;
    }
    // Single tap/click -> Toggle between voice recording (mic) and video circle (video_circle)
    setInputMode((prev) => (prev === 'mic' ? 'video_circle' : 'mic'));
  };

  // Data saver & HD previews
  const [dataSaverMode] = useState<boolean>(() => localStorage.getItem('orbit_data_saver_mode') === 'true');
  const [unlockedHdMedia, setUnlockedHdMedia] = useState<Record<string, boolean>>({});

  // Contact options menu & report modal state
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Спам или реклама');
  const [reportComment, setReportComment] = useState('');
  const [blockAfterReport, setBlockAfterReport] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Per-chat read receipt setting
  const [isHideReadReceipts, setIsHideReadReceipts] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`orbit_hide_read_receipts_${contact.id}`) === 'true';
  });

  const handleToggleReadReceipts = () => {
    const next = !isHideReadReceipts;
    setIsHideReadReceipts(next);
    localStorage.setItem(`orbit_hide_read_receipts_${contact.id}`, next ? 'true' : 'false');
    triggerHaptic('light');
    showToast(next ? 'Статус «прочитал» отключен для этого чата' : 'Статус «прочитал» включен для этого чата');
  };

  // Check if user was invited to this group/channel and track whether they saw the invite banner
  const invitationInfo = (contact as any).invitations?.[user?.id || ''];
  const inviteSeenKey = `orbit_invite_seen_${contact.id}_${user?.id || ''}`;
  const [hasSeenInvite] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(inviteSeenKey) === 'true';
  });

  useEffect(() => {
    return () => {
      if (invitationInfo && typeof window !== 'undefined') {
        localStorage.setItem(inviteSeenKey, 'true');
      }
    };
  }, [contact.id, invitationInfo, inviteSeenKey]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInitialMessages = async () => {
    setLoading(true);
    try {
      const res = await api.getMessages(contact.id, 20);
      setMessages(res.messages || []);
      setHasMore(res.has_more || false);
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialMessages();
    if (!contact.isChannelGroup && contact.id) {
      api.addContact(contact.id).then(() => {
        if (onRefreshContacts) onRefreshContacts();
      }).catch(() => {});
    }

    const unsubRead = socketService.subscribe('messages_read', (data) => {
      if (data.byUserId === contact.id) {
        setMessages((prev) => prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)));
      }
    });

    const unsubMsg = socketService.subscribe('new_message', (data) => {
      const isForCurrentChat =
        String(data.senderId) === String(contact.id) ||
        (data.message && String(data.message.senderId) === String(contact.id));

      if (isForCurrentChat && data.message) {
        setIsOtherTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        if (typeof window !== 'undefined' && localStorage.getItem('orbit_hide_read_receipts') !== 'true') {
          api.markMessagesRead(contact.id).catch(() => {});
        }
      }
    });

    const unsubTyping = socketService.subscribe('user_typing', (data) => {
      const isSelf = user && String(data.senderId) === String(user.id);
      if (isSelf) return;

      const isForThisChat =
        (contact.isChannelGroup && String(data.channelGroupId) === String(contact.id)) ||
        (!contact.isChannelGroup && String(data.senderId) === String(contact.id));

      if (isForThisChat) {
        if (data.isTyping) {
          setIsOtherTyping(true);
          if (data.senderName) {
            setTypingUserName(data.senderName);
          }
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 3500);
        } else {
          setIsOtherTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      }
    });

    const unsubReaction = socketService.subscribe('message_reaction', (data) => {
      if (data.messageId && data.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    });

    const unsubSingleRead = socketService.subscribe('message_read_single', (data) => {
      if (data.messageId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, isRead: true, status: 'read' } : m))
        );
      }
    });

    return () => {
      unsubRead();
      unsubMsg();
      unsubReaction();
      unsubSingleRead();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
    };
  }, [contact.id]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    triggerHaptic('light');
    // Optimistic UI update - strictly enforce single reaction per user
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions: Record<string, MessageReactionInfo> = {};

        if (m.reactions) {
          Object.entries(m.reactions).forEach(([eKey, val]) => {
            currentReactions[eKey] = { ...(val as MessageReactionInfo) };
          });
        }

        const targetReaction = currentReactions[emoji] || { count: 0, userReacted: false, users: [] };
        const wasReactedByMe = targetReaction.userReacted;

        // First remove user's reaction from ALL emojis
        Object.keys(currentReactions).forEach((eKey) => {
          if (currentReactions[eKey]?.userReacted) {
            const updatedCount = Math.max(0, currentReactions[eKey].count - 1);
            if (updatedCount === 0) {
              delete currentReactions[eKey];
            } else {
              currentReactions[eKey] = {
                ...currentReactions[eKey],
                count: updatedCount,
                userReacted: false,
              };
            }
          }
        });

        // If user was not reacted to target emoji before, add reaction
        if (!wasReactedByMe) {
          const prevTarget = currentReactions[emoji] || { count: 0, userReacted: false, users: [] };
          currentReactions[emoji] = {
            ...prevTarget,
            count: prevTarget.count + 1,
            userReacted: true,
          };
        }

        return { ...m, reactions: currentReactions };
      })
    );

    try {
      const res = await api.toggleMessageReaction(contact.id, messageId, emoji);
      if (res.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Synchronize audio HTML5 element with activeMedia (for voice notes)
  useEffect(() => {
    if (!activeMedia || !activeMedia.mediaUrl) {
      if (audioElRef.current) audioElRef.current.pause();
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    if (activeMedia.type === 'audio' && audioElRef.current) {
      if (!audioElRef.current.src || !audioElRef.current.src.endsWith(activeMedia.mediaUrl)) {
        audioElRef.current.src = activeMedia.mediaUrl;
        try {
          audioElRef.current.load();
        } catch {}
      }
      audioElRef.current.playbackRate = playbackRate;
      const playPromise = audioElRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Audio playback interrupted:', err);
            setIsPlaying(false);
          });
      }
    } else if (activeMedia.type === 'video_circle') {
      setIsPlaying(true);
    }
  }, [activeMedia]);

  // Update playback rate dynamically
  useEffect(() => {
    if (audioElRef.current && activeMedia?.type === 'audio') {
      audioElRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, activeMedia]);

  const toggleMediaPlayback = (
    id: string,
    type: 'audio' | 'video_circle',
    mediaUrl: string,
    title: string,
    duration: number
  ) => {
    if (activeMedia?.id === id) {
      if (type === 'audio') {
        if (audioElRef.current) {
          if (isPlaying) {
            audioElRef.current.pause();
            setIsPlaying(false);
          } else {
            audioElRef.current.play();
            setIsPlaying(true);
          }
        }
      } else {
        setIsPlaying((prev) => !prev);
      }
    } else {
      setActiveMedia({ id, type, mediaUrl, title, duration });
      setIsPlaying(true);
      setCurrentTime(0);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!activeMedia) return;
    const activeEl = activeMedia.type === 'audio' ? audioElRef.current : videoElRef.current;
    if (activeEl) {
      activeEl.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    const container = chatListRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;
    const oldScrollTop = container ? container.scrollTop : 0;

    const oldestId = messages[0].id;
    setLoadingMore(true);
    try {
      const res = await api.getMessageHistory(contact.id, oldestId, 20);
      setMessages((prev) => [...(res.messages || []), ...prev]);
      setHasMore(res.has_more || false);

      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
        }
      });
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    if (newValue.trim()) {
      const now = Date.now();
      if (now - lastLocalTypingEmittedRef.current > 1800) {
        lastLocalTypingEmittedRef.current = now;
        socketService.emit('typing', {
          targetUserId: contact.isChannelGroup ? undefined : contact.id,
          channelGroupId: contact.isChannelGroup ? contact.id : undefined,
          isTyping: true,
        });
      }

      if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
      localTypingTimerRef.current = setTimeout(() => {
        socketService.emit('typing', {
          targetUserId: contact.isChannelGroup ? undefined : contact.id,
          channelGroupId: contact.isChannelGroup ? contact.id : undefined,
          isTyping: false,
        });
        lastLocalTypingEmittedRef.current = 0;
      }, 2500);
    } else {
      if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
      socketService.emit('typing', {
        targetUserId: contact.isChannelGroup ? undefined : contact.id,
        channelGroupId: contact.isChannelGroup ? contact.id : undefined,
        isTyping: false,
      });
      lastLocalTypingEmittedRef.current = 0;
    }
  };

  const handleSendText = async (textOverride?: string, extraMediaProps?: Partial<Message>) => {
    if (commentsDisabled) {
      showToast('Комментарии отключены администратором');
      return;
    }

    if (slowModeCooldown > 0 && !isUserAdminOrAuthor) {
      showToast(`Медленный режим включен. Подождите еще ${slowModeCooldown} сек.`);
      return;
    }

    // Stop local typing indicator when sending
    if (localTypingTimerRef.current) clearTimeout(localTypingTimerRef.current);
    socketService.emit('typing', {
      targetUserId: contact.isChannelGroup ? undefined : contact.id,
      channelGroupId: contact.isChannelGroup ? contact.id : undefined,
      isTyping: false,
    });
    lastLocalTypingEmittedRef.current = 0;

    const textToSend = (textOverride ?? input).trim();
    if (!textToSend && !extraMediaProps && !pendingMedia) return;
    triggerHaptic('success');
    if (!textOverride) {
      setInput('');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`orbit_draft_${contact.id}`);
      }
    }

    if (!isUserAdminOrAuthor && slowModeSec > 0) {
      lastSentTimeRef.current = Date.now();
      setSlowModeCooldown(slowModeSec);
    }

    const mediaProps: Partial<Message> = extraMediaProps || (pendingMedia ? {
      mediaUrl: pendingMedia.url,
      mediaType: pendingMedia.mediaType,
      fileName: pendingMedia.fileName,
      fileSize: pendingMedia.fileSize,
    } : {});

    const replyProps = replyingToMessage ? {
      replyTo: {
        id: replyingToMessage.id,
        text: replyingToMessage.text || (replyingToMessage.mediaType === 'image' ? 'Фотография' : 'Медиафайл'),
        senderName: replyingToMessage.from === 'me' ? (user?.username || 'Вы') : contact.name,
        mediaType: replyingToMessage.mediaType,
        mediaUrl: replyingToMessage.mediaUrl,
      }
    } : {};

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg: Message = {
      id: tempId,
      from: 'me',
      text: textToSend,
      timestamp: Date.now(),
      isEncrypted: true,
      authorName: user?.username || 'Вы',
      viewsCount: 1,
      ...mediaProps,
      ...replyProps,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setPendingMedia(null);
    setReplyingToMessage(null);

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    try {
      const actualMsg = await api.sendMessage(contact.id, {
        text: textToSend,
        mediaUrl: mediaProps.mediaUrl,
        mediaType: mediaProps.mediaType,
        duration: mediaProps.duration,
        waveform: mediaProps.waveform,
        replyTo: replyProps.replyTo,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...actualMsg, ...mediaProps, ...replyProps, isEncrypted: true } : m))
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendVoiceNote = async (durationSec: number, localMediaUrl?: string, blob?: Blob, waveformLevels?: number[]) => {
    setIsRecordingVoice(false);
    setIsPushToTalk(false);
    let serverUrl = '';

    if (blob && blob.size > 0) {
      try {
        const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        const uploadRes = await api.uploadMedia(file);
        if (uploadRes?.url) {
          serverUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Voice note upload fallback to local URL:', err);
      }
    }

    const playUrl = serverUrl || localMediaUrl || 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg';

    await handleSendText(`Голосовое сообщение (${durationSec} сек)`, {
      mediaType: 'audio',
      duration: durationSec,
      waveform: waveformLevels,
      mediaUrl: playUrl,
    });
  };

  const handleSendVideoCircle = async (durationSec: number, localMediaUrl?: string, blob?: Blob) => {
    setIsRecordingCircle(false);
    let serverUrl = '';

    if (blob && blob.size > 0) {
      try {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `circle_${Date.now()}.${ext}`, { type: blob.type || 'video/webm' });
        const uploadRes = await api.uploadMedia(file);
        if (uploadRes?.url) {
          serverUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Video circle upload fallback to local URL:', err);
      }
    }

    const playUrl = serverUrl || localMediaUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    await handleSendText(`Видеосообщение (${durationSec} сек)`, {
      mediaType: 'video_circle',
      duration: durationSec,
      mediaUrl: playUrl,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setUploadingMedia(true);
    try {
      const fileToUpload = rawFile.type.startsWith('image/')
        ? await compressImage(rawFile, 1600, 1600, 0.85)
        : rawFile;

      const uploadRes = await api.uploadMedia(fileToUpload);
      const isDoc = !rawFile.type.startsWith('image/') && !rawFile.type.startsWith('video/');

      setPendingMedia({
        url: uploadRes.url,
        mediaType: isDoc ? 'document' : ((uploadRes.mediaType as any) || 'image'),
        fileName: fileToUpload.name,
        fileSize: `${(fileToUpload.size / (1024 * 1024)).toFixed(1)} MB`,
      });
      showToast('Медиафайл прикреплён (изображение оптимизировано).');
    } catch (err) {
      console.error('Media upload failed:', err);
      showToast('Ошибка загрузки медиафайла');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmForward = async (targetContact: Contact) => {
    if (!forwardingMessage) return;
    setSendingForward(true);
    try {
      await api.sendMessage(targetContact.id, {
        text: forwardingMessage.text || '',
        mediaUrl: forwardingMessage.mediaUrl,
        mediaType: forwardingMessage.mediaType,
        fileName: forwardingMessage.fileName,
        fileSize: forwardingMessage.fileSize,
        isForwarded: true,
        forwardedFrom: forwardingMessage.from === 'me' ? (user?.username || 'Вы') : contact.name,
      });
      showToast(`Сообщение переслано в "${targetContact.name}"`);
      setShowForwardModal(false);
      setForwardingMessage(null);
    } catch (err: any) {
      showToast(err.message || 'Ошибка при пересылке');
    } finally {
      setSendingForward(false);
    }
  };

  const handleSendCryptoInChat = async () => {
    const amount = parseFloat(cryptoAmount);
    if (isNaN(amount) || amount <= 0 || amount > balance) {
      alert('Неверная сумма или недостаточно средств');
      return;
    }

    setSendingCrypto(true);
    try {
      await api.sendCrypto(contact.name, amount);
      await handleSendText(`Перевод ${amount} ORB для ${contact.name}`, {
        amount,
        tx: true,
      });
      onSendCrypto();
      setShowSendCryptoModal(false);
      setCryptoAmount('');
    } catch (err: any) {
      alert(err.message || 'Ошибка перевода криптовалюты');
    } finally {
      setSendingCrypto(false);
    }
  };

  const handleRemoveContact = async () => {
    try {
      if (contact.id.startsWith('cg_')) {
        try {
          await api.deleteChannelGroup(contact.id);
        } catch {
          await api.leaveChannelGroup(contact.id);
        }
      } else {
        await api.removeContact(contact.id);
      }
      showToast('Чат удалён');
      setTimeout(() => onBack(), 800);
    } catch (err: any) {
      showToast(err.message || 'Ошибка удаления чата');
    }
  };

  const handleBlockUser = async () => {
    try {
      await api.blockUser(contact.id);
      showToast('Пользователь заблокирован');
      setTimeout(() => onBack(), 1200);
    } catch (err: any) {
      showToast(err.message || 'Ошибка блокировки');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);
    try {
      await api.reportUser({
        targetUserId: contact.id,
        reason: reportReason,
        comment: reportComment,
        blockAfterReport,
      });
      showToast('Жалоба отправлена модераторам');
      setShowReportModal(false);
      if (blockAfterReport) {
        setTimeout(() => onBack(), 1200);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка отправки жалобы');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 relative overflow-hidden">
      {/* Dynamic Wallpaper Background Layer */}
      <WallpaperBackgroundLayer
        preset={wallpaperSettings.preset}
        adaptTheme={wallpaperSettings.adaptTheme}
        opacity={wallpaperSettings.opacity}
        imageUrl={wallpaperSettings.imageUrl}
      />
      {/* Hidden Global Audio & Video Players */}
      <audio
        ref={audioElRef}
        onLoadStart={() => setIsAudioLoading(true)}
        onWaiting={() => setIsAudioLoading(true)}
        onCanPlay={() => setIsAudioLoading(false)}
        onPlaying={() => setIsAudioLoading(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setIsAudioLoading(false);
          setCurrentTime(0);
          setExpandedCircleId(null);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsPlaying(false);
          setIsAudioLoading(false);
        }}
        className="hidden"
      />
      <video
        ref={videoElRef}
        playsInline
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setMediaDuration(e.currentTarget.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          setExpandedCircleId(null);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsPlaying(false);
        }}
        className="hidden"
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 shadow-xl text-slate-600 dark:text-slate-300 text-xs font-medium tracking-tight animate-fade-in text-center whitespace-nowrap pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Backdrop for 3-dots menu outside click auto-close */}
      {showMenu && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Backdrop for message reaction picker outside click auto-close */}
      {activeReactionPickerId && (
        <div
          className="fixed inset-0 z-20 bg-transparent"
          onClick={() => setActiveReactionPickerId(null)}
        />
      )}

      {/* Top Header Floating Bar */}
      <div className="px-3 pt-3 pb-1.5 flex items-center gap-2 shrink-0 relative z-30">
        {/* Standalone Circular Back Button */}
        <button
          onClick={onBack}
          className="h-10 w-10 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition active:scale-95 shrink-0"
          title="Назад"
        >
          <ArrowLeft size={19} />
        </button>

        {/* Main Header Bubble: Normal Mode vs Selected Message Action Mode */}
        {selectedMessage ? (
          <div className="flex-1 flex items-center justify-between px-3.5 py-1.5 rounded-full bg-sky-500 text-white shadow-md animate-fade-in relative z-30">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSelectedMessage(null)}
                className="p-1 rounded-full hover:bg-white/20 transition shrink-0"
                title="Отменить выбор"
              >
                <X size={17} />
              </button>
              <div className="truncate text-xs font-semibold flex items-center gap-1">
                <span className="shrink-0">Выбрано:</span>
                <span className="opacity-90 font-normal truncate">
                  {selectedMessage.text || (selectedMessage.mediaType === 'image' ? 'Фотография' : 'Медиафайл')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!commentsDisabled && (
                <button
                  onClick={() => {
                    setReplyingToMessage(selectedMessage);
                    setSelectedMessage(null);
                    showToast('Ответ на сообщение');
                  }}
                  className="p-1.5 rounded-full hover:bg-white/20 transition flex items-center justify-center text-white"
                  title="Ответить"
                >
                  <CornerUpLeft size={18} />
                </button>
              )}

              <button
                onClick={() => {
                  setForwardingMessage(selectedMessage);
                  setShowForwardModal(true);
                  if (forwardContacts.length === 0) {
                    api.getContacts().then((res) => setForwardContacts(res)).catch(() => {});
                  }
                  setSelectedMessage(null);
                }}
                className="p-1.5 rounded-full hover:bg-white/20 transition flex items-center justify-center text-white"
                title="Переслать"
              >
                <CornerUpRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-sm relative">
          <div
            onClick={() => {
              if (onOpenUserProfile) onOpenUserProfile(contact.id);
            }}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
          >
            <div
              className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-xs font-semibold text-white shadow-inner relative overflow-hidden`}
            >
              {contact.avatarUrl ? (
                <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                contact.initials
              )}
              {contact.isOnline && (
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900 z-10" />
              )}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-800 dark:text-white flex items-center gap-1 group-hover:text-sky-500 transition">
                <span className="truncate">{contact.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowE2EEModal(true);
                  }}
                  className="text-emerald-500 hover:text-emerald-400 transition shrink-0"
                  title="Сквозное E2EE шифрование"
                >
                  <Lock size={11} />
                </button>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                {isOtherTyping ? (
                  <span className="text-sky-500 dark:text-sky-400 font-semibold flex items-center gap-1 animate-pulse">
                    печатает...
                  </span>
                ) : (
                  <span>{contact.isOnline ? 'В сети' : 'Не в сети'}</span>
                )}
                <span>· Профиль</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!isChannel && (
              <>
                <button
                  onClick={() => handleInitiateCall('voice')}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  title="Голосовой вызов"
                >
                  <Phone size={16} />
                </button>

                <button
                  onClick={() => handleInitiateCall('video')}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                  title="Видеовызов"
                >
                  <Video size={16} />
                </button>
              </>
            )}

            <button
              onClick={() => {
                if (isGuest && onOpenAuth) {
                  onOpenAuth();
                } else {
                  setShowSendCryptoModal(true);
                }
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 text-[11px] font-medium hover:bg-slate-500/20 transition"
            >
              <ArrowUpRight size={13} />
              <span>ORB</span>
            </button>

            {/* More Options Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-10 w-56 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-2xl p-1.5 z-50 text-xs animate-fade-in space-y-0.5">
                  {onOpenUserProfile && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenUserProfile(contact.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                    >
                      <Users size={14} className="text-sky-500" />
                      <span>{isChannelGroup ? 'О канале / группе' : 'Посмотреть профиль'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setIsSearchOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Search size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Поиск по сообщениям</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowWallpaperModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                  >
                    <Palette size={14} className="text-sky-500" />
                    <span>Оформить фон чата</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleToggleReadReceipts();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCheck size={14} className={isHideReadReceipts ? 'text-slate-400' : 'text-sky-500'} />
                      <span>Отчёт о прочтении</span>
                    </div>
                    <div className={`w-7 h-4 rounded-full transition-colors relative p-0.5 ${!isHideReadReceipts ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${!isHideReadReceipts ? 'translate-x-3' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  {isChannel ? (
                    <>
                      {isUserAdminOrAuthor && (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            handleInitiateCall('channel_stream');
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 transition font-semibold"
                        >
                          <Radio size={14} className="animate-pulse" />
                          <span>Начать прямой эфир</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleToggleFeedMute();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Radio size={14} className={isFeedMuted ? 'text-emerald-500' : 'text-amber-500'} />
                        <span>{isFeedMuted ? 'Включить новости в ленте' : 'Отключить новости в ленте'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleInitiateCall(isGroup ? 'group_conference' : 'video');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Users size={14} className="text-slate-500 dark:text-slate-400" />
                      <span>{isGroup ? 'Видеоконференция' : 'Групповой вызов'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleRemoveContact();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Trash2 size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Удалить чат</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <ShieldAlert size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Пожаловаться</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleBlockUser();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Ban size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Заблокировать</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Floating Top Bubbles Container (Search Bubble + Playback Bubble stacked vertically) */}
      <div className="px-3 pb-1 space-y-1 shrink-0 z-20">
        {/* In-Chat Search Bubble */}
        {isSearchOpen && (
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-md rounded-full px-3.5 py-1.5 text-xs flex items-center justify-between gap-2 animate-fade-in text-slate-800 dark:text-slate-100">
            <Search size={15} className="text-sky-500 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              placeholder="Поиск по сообщениям..."
              className="flex-1 bg-transparent border-none outline-none text-xs text-slate-800 dark:text-white placeholder:text-slate-400"
              autoFocus
            />
            {(() => {
              const matches = searchQuery.trim()
                ? messages.filter((m) => m.text?.toLowerCase().includes(searchQuery.toLowerCase().trim()))
                : [];
              return (
                <>
                  {matches.length > 0 && (
                    <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {currentMatchIndex + 1}/{matches.length}
                    </span>
                  )}
                  {matches.length > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
                          setCurrentMatchIndex(prevIdx);
                          const el = document.getElementById(`msg-${matches[prevIdx].id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                        title="Предыдущее совпадение"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => {
                          const nextIdx = (currentMatchIndex + 1) % matches.length;
                          setCurrentMatchIndex(nextIdx);
                          const el = document.getElementById(`msg-${matches[nextIdx].id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                        title="Следующее совпадение"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title="Закрыть поиск"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Sticky Header Playback Player */}
        {activeMedia && (
          <StickyMediaHeaderPlayer
            title={activeMedia.title}
            type={activeMedia.type}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={activeMedia.duration || mediaDuration || 10}
            playbackRate={playbackRate}
            onTogglePlay={() => {
              const activeEl = activeMedia.type === 'audio' ? audioElRef.current : videoElRef.current;
              if (activeEl) {
                if (isPlaying) {
                  activeEl.pause();
                } else {
                  activeEl.play();
                }
              }
            }}
            onSeek={handleSeek}
            onChangeSpeed={(newRate) => setPlaybackRate(newRate)}
            onClose={() => {
              setActiveMedia(null);
              setExpandedCircleId(null);
            }}
          />
        )}
      </div>

      {/* Scheduled Messages Banner Bar */}
      {contactScheduledMessages.length > 0 && (
        <div className="px-4 py-1.5 bg-sky-500/10 dark:bg-sky-500/20 border-b border-sky-500/20 flex items-center justify-between text-xs text-sky-600 dark:text-sky-400 font-medium shrink-0 z-20">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="animate-pulse text-sky-500" />
            Отложенных сообщений в очереди: {contactScheduledMessages.length}
          </span>
          <button
            onClick={() => setShowScheduledListModal(true)}
            className="underline hover:text-sky-700 dark:hover:text-sky-300 font-bold transition"
          >
            Посмотреть / Отправить сейчас
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={chatListRef}
        className={`flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar transition-all duration-300 ${
          expandedCircleId ? 'pb-44' : ''
        }`}
      >
        {hasMore && (
          <div className="text-center my-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 px-3.5 py-1 rounded-full border border-white/60 shadow-xs"
            >
              {loadingMore ? 'Загрузка сообщений...' : 'Загрузить предыдущие'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-6 px-2 animate-fade-in">
            <div className="flex justify-start">
              <div className="flex items-end gap-2 max-w-[70%]">
                <SkeletonAvatar size="sm" />
                <Skeleton className="h-12 w-48 rounded-2xl rounded-bl-xs" />
              </div>
            </div>

            <div className="flex justify-end">
              <Skeleton className="h-16 w-56 rounded-2xl rounded-br-xs" />
            </div>

            <div className="flex justify-start">
              <div className="flex items-end gap-2 max-w-[70%]">
                <SkeletonAvatar size="sm" />
                <Skeleton className="h-20 w-64 rounded-2xl rounded-bl-xs" />
              </div>
            </div>

            <div className="flex justify-end">
              <Skeleton className="h-10 w-36 rounded-2xl rounded-br-xs" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-12 space-y-2">
            <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Lock size={18} />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">Сообщений пока нет</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Диалог защищен сквозным E2EE шифрованием. Напишите первое сообщение!
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.from === 'me';
            const formattedTime = new Date(m.timestamp || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            // CHANNEL NEWS FEED POST RENDERING (For channels: full-width news item cards)
            if (isChannel) {
              const activeReactions = Object.entries(m.reactions || {}).filter(
                ([_, val]) => (val as MessageReactionInfo)?.count > 0
              ) as [string, MessageReactionInfo][];

              return (
                <div id={`msg-${m.id}`} key={m.id} className="w-full my-3.5 animate-fade-in relative">
                  {/* Floating Reaction Bubble for Channel Posts */}
                  {!reactionsDisabled && activeReactionPickerId === m.id && (
                    <div
                      className="absolute z-30 -top-11 left-4 flex items-center gap-0.5 p-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl animate-scale-in"
                    >
                      {availableReactions.map((emoji) => {
                        const isReacted = m.reactions?.[emoji]?.userReacted;
                        return (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReaction(m.id, emoji);
                              setActiveReactionPickerId(null);
                            }}
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-sm hover:scale-125 transition-transform active:scale-90 select-none ${
                              isReacted ? 'bg-sky-500/20 ring-1 ring-sky-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={`Реакция ${emoji}`}
                          >
                            {emoji}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    onClick={(e) => handleMessageClick(m, e)}
                    onTouchStart={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = setTimeout(() => {
                        triggerHaptic('impactMedium');
                        setActiveReactionPickerId(m.id);
                      }, 400);
                    }}
                    onTouchEnd={handleTouchEndOrCancelMessage}
                    onTouchMove={handleTouchEndOrCancelMessage}
                    onMouseDown={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = setTimeout(() => {
                        triggerHaptic('impactMedium');
                        setActiveReactionPickerId(m.id);
                      }, 400);
                    }}
                    onMouseUp={handleTouchEndOrCancelMessage}
                    onMouseLeave={handleTouchEndOrCancelMessage}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      triggerHaptic('impactMedium');
                      setActiveReactionPickerId(m.id);
                    }}
                    className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm hover:shadow-md transition space-y-3 cursor-pointer"
                  >
                    {/* Channel Author Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-xs font-bold text-white shadow-inner overflow-hidden shrink-0`}>
                          {contact.avatarUrl ? (
                            <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full object-cover" />
                          ) : (
                            contact.initials
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                            <span>{contact.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 font-semibold text-[10px]">
                              Автор канала
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{formattedTime}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-slate-400">
                        <div className="flex items-center gap-1">
                          <Eye size={13} />
                          <span className="text-[10px] font-mono font-medium">{m.viewsCount || 1}</span>
                        </div>
                        {!contact.disableForwarding && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setForwardingMessage(m);
                              setShowForwardModal(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 hover:text-sky-500 transition px-2 py-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Переслать сообщение"
                          >
                            <CornerUpRight size={13} />
                            <span>Переслать</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Forwarded Header if present */}
                    {m.isForwarded && (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-500 bg-sky-500/10 px-3 py-1 rounded-xl w-fit">
                        <CornerUpRight size={13} />
                        <span>Переслано от {m.forwardedFrom || 'автора'}</span>
                      </div>
                    )}

                    {/* Quoted Reply Block if present */}
                    {m.replyTo && (
                      <div
                        onClick={() => {
                          const el = document.getElementById(`msg-${m.replyTo?.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border-l-4 border-sky-500 text-xs cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition"
                      >
                        <div className="text-[11px] font-bold text-sky-500">{m.replyTo.senderName}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{m.replyTo.text}</div>
                      </div>
                    )}

                    {/* Attached Photo / Media with Full-Screen Lightbox view */}
                    {m.mediaUrl && (
                      <div
                        className="w-full max-h-80 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-950 cursor-pointer relative group"
                        onClick={() => setFullScreenImage({ url: m.mediaUrl!, title: contact.name })}
                      >
                        {m.mediaType === 'image' || !m.mediaType ? (
                          <img src={m.mediaUrl} alt="Channel Post Media" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        ) : m.mediaType === 'document' ? (
                          <div className="flex items-center gap-3 p-3 bg-slate-800 text-white">
                            <FileText size={20} className="text-sky-400" />
                            <span className="text-xs font-semibold">{m.fileName || 'Документ'}</span>
                          </div>
                        ) : (
                          <img src={m.mediaUrl} alt="" className="w-full h-full object-cover" />
                        )}
                        {m.mediaType === 'image' && (
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold flex items-center gap-1.5 border border-white/20">
                              <Maximize2 size={13} />
                              <span>Открыть фото</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text Message Content */}
                    {m.text && (
                      <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap font-sans">
                        {m.text}
                      </div>
                    )}

                    {/* Channel Post Footer Actions */}
                    {(!reactionsDisabled && activeReactions.length > 0) && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                        {/* Reactions */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeReactions.map(([emoji, val]) => {
                            const count = val.count || 0;
                            const userReacted = val.userReacted;
                            return (
                              <button
                                key={emoji}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReaction(m.id, emoji);
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs flex items-center gap-1 transition active:scale-95 ${
                                  userReacted
                                    ? 'bg-sky-500/20 text-sky-500 border border-sky-500/30 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // STANDARD 1:1 OR GROUP CHAT BUBBLE RENDERING
            return (
              <div id={`msg-${m.id}`} key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/row my-0.5`}>
                <div className={`relative flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Bubble Container - Soft Airy Tones */}
                  <div
                    onClick={(e) => handleMessageClick(m, e)}
                    onTouchStart={() => handleTouchStartMessage(m)}
                    onTouchEnd={handleTouchEndOrCancelMessage}
                    onTouchMove={handleTouchEndOrCancelMessage}
                    onMouseDown={() => handleTouchStartMessage(m)}
                    onMouseUp={handleTouchEndOrCancelMessage}
                    onMouseLeave={handleTouchEndOrCancelMessage}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      triggerHaptic('impactMedium');
                      setSelectedMessage(m);
                    }}
                    className={`relative group ${
                      m.mediaType === 'sticker' || m.mediaType === 'video_circle'
                        ? 'bg-transparent shadow-none border-0 p-0 text-xs sm:text-sm'
                        : `px-3.5 py-2 rounded-2xl text-xs sm:text-sm shadow-xs ${
                            isMe
                              ? 'bg-sky-500/15 dark:bg-sky-400/20 border border-sky-500/25 dark:border-sky-400/30 text-slate-800 dark:text-slate-100 rounded-br-xs backdrop-blur-md'
                              : 'bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-bl-xs backdrop-blur-md'
                          }`
                    }`}
                  >
                    {/* Forwarded Message Header Badge */}
                    {m.isForwarded && (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-500 mb-1">
                        <CornerUpRight size={11} />
                        <span>Переслано от {m.forwardedFrom || 'пользователя'}</span>
                      </div>
                    )}

                    {/* Quoted Reply Block */}
                    {m.replyTo && (
                      <div
                        onClick={() => {
                          const el = document.getElementById(`msg-${m.replyTo?.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-2 mb-1.5 rounded-xl bg-black/5 dark:bg-white/5 border-l-3 border-sky-500 text-xs cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition"
                      >
                        <div className="text-[10px] font-bold text-sky-500">{m.replyTo.senderName}</div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{m.replyTo.text}</div>
                      </div>
                    )}

                    {/* Quick Reaction Floating Picker Bar */}
                    {!reactionsDisabled && activeReactionPickerId === m.id && (
                      <div
                        className={`absolute z-30 -top-11 ${
                          isMe ? 'right-0' : 'left-0'
                        } flex items-center gap-0.5 p-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl animate-scale-in`}
                      >
                        {availableReactions.map((emoji) => {
                          const isReacted = m.reactions?.[emoji]?.userReacted;
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(m.id, emoji);
                                setActiveReactionPickerId(null);
                              }}
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-sm hover:scale-125 transition-transform active:scale-90 select-none ${
                                isReacted ? 'bg-sky-500/20 ring-1 ring-sky-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title={`Реакция ${emoji}`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Sticker Renderer */}
                    {m.mediaType === 'sticker' && m.mediaUrl && (
                      <div className="w-28 h-28 p-1">
                        <img src={m.mediaUrl} alt="Sticker" className="w-full h-full object-contain" />
                      </div>
                    )}

                    {/* Minimalist Slim Voice Note (ГС) Renderer */}
                    {m.mediaType === 'audio' && (
                      <div className="flex flex-col gap-1 py-0.5">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() =>
                              toggleMediaPlayback(
                                m.id,
                                'audio',
                                m.mediaUrl || '',
                                `Голосовое (${m.duration || 0}с)`,
                                m.duration || 10
                              )
                            }
                            className="relative h-7 w-7 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs active:scale-95 transition"
                          >
                            {activeMedia?.id === m.id && isAudioLoading && (
                              <span className="absolute -inset-1 border-2 border-sky-400 border-t-transparent rounded-full animate-spin pointer-events-none" />
                            )}
                            {activeMedia?.id === m.id && isPlaying ? (
                              <Pause size={13} />
                            ) : (
                              <Play size={13} className="ml-0.5" />
                            )}
                          </button>

                          <div className="flex-1 min-w-[120px]">
                            <div
                              className="flex items-center gap-0.5 h-4 overflow-hidden cursor-pointer group/wave py-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                                const dur = m.duration || mediaDuration || 10;
                                if (activeMedia?.id !== m.id) {
                                  toggleMediaPlayback(
                                    m.id,
                                    'audio',
                                    m.mediaUrl || '',
                                    `Голосовое (${m.duration || 0}с)`,
                                    m.duration || 10
                                  );
                                }
                                setTimeout(() => {
                                  handleSeek(ratio * dur);
                                }, 50);
                              }}
                            >
                              {(() => {
                                const barCount = 22;
                                const rawWave = m.waveform && m.waveform.length > 0
                                  ? m.waveform
                                  : Array.from({ length: barCount }).map((_, idx) =>
                                      Math.floor(Math.sin((idx + (m.id.charCodeAt(0) || 5)) * 0.7) * 35 + 55)
                                    );
                                const dur = m.duration || mediaDuration || 10;

                                return rawWave.slice(0, barCount).map((val, idx) => {
                                  const progress = activeMedia?.id === m.id ? currentTime / dur : 0;
                                  const barRatio = idx / barCount;
                                  const isPlayed = barRatio <= progress;

                                  return (
                                    <span
                                      key={idx}
                                      className={`w-0.5 rounded-full transition-all group-hover/wave:scale-y-110 ${
                                        isPlayed
                                          ? 'bg-sky-500'
                                          : 'bg-slate-300 dark:bg-slate-600'
                                      }`}
                                      style={{
                                        height: `${Math.max(20, Math.min(100, val))}%`,
                                      }}
                                    />
                                  );
                                });
                              })()}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-1.5 font-mono text-[9px]">
                                <span>Голосовое {m.duration ? `${m.duration}с` : ''}</span>
                                {activeMedia?.id === m.id && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPlaybackRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1));
                                    }}
                                    className="text-sky-500 font-bold bg-sky-500/10 hover:bg-sky-500/20 px-1 py-0.2 rounded transition active:scale-90"
                                    title="Изменить скорость"
                                  >
                                    {playbackRate}x
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 ml-2">
                                <span>{formattedTime}</span>
                                {isMe && <MessageStatusIndicator message={m} />}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Voice-to-Text Button (Перевод ГС в текст) */}
                        <div className="mt-1 flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                          <button
                            onClick={() => handleTranscribeAudio(m.id, m.duration)}
                            disabled={transcriptions[m.id]?.loading}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-500 hover:text-sky-600 dark:hover:text-sky-400 transition"
                          >
                            {transcriptions[m.id]?.loading ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <FileText size={10} />
                            )}
                            <span>{transcriptions[m.id]?.text ? 'Обновить расшифровку' : 'ГС в текст (ИИ)'}</span>
                          </button>
                        </div>

                        {transcriptions[m.id]?.text && (
                          <div className="mt-1 p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed animate-fade-in font-sans">
                            <span className="font-bold text-sky-500 text-[10px] block mb-0.5">📝 Текст ГС (ИИ):</span>
                            {transcriptions[m.id].text}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Video Circle ("Видео кружок") Renderer */}
                    {m.mediaType === 'video_circle' && (
                      <VideoCirclePlayer
                        message={m}
                        isExpanded={expandedCircleId === m.id}
                        isActive={activeMedia?.id === m.id}
                        isPlaying={activeMedia?.id === m.id && isPlaying}
                        currentTime={activeMedia?.id === m.id ? currentTime : 0}
                        duration={m.duration || mediaDuration || 10}
                        timestamp={formattedTime}
                        isMe={isMe}
                        onToggleExpand={(e) => {
                          e.stopPropagation();
                          setExpandedCircleId(expandedCircleId === m.id ? null : m.id);
                          if (activeMedia?.id !== m.id) {
                            toggleMediaPlayback(
                              m.id,
                              'video_circle',
                              m.mediaUrl || '',
                              `Видеосообщение (${m.duration || 0}с)`,
                              m.duration || 10
                            );
                          }
                        }}
                        onTogglePlay={(e) => {
                          e.stopPropagation();
                          toggleMediaPlayback(
                            m.id,
                            'video_circle',
                            m.mediaUrl || '',
                            `Видеосообщение (${m.duration || 0}с)`,
                            m.duration || 10
                          );
                        }}
                        onCloseExpand={() => setExpandedCircleId(null)}
                        onSeek={(timeSec) => handleSeek(timeSec)}
                        onTimeUpdate={(t) => {
                          if (activeMedia?.id === m.id) setCurrentTime(t);
                        }}
                        onLoadedMetadata={(dur) => {
                          if (activeMedia?.id === m.id) setMediaDuration(dur);
                        }}
                        onEnded={() => {
                          if (activeMedia?.id === m.id) {
                            setIsPlaying(false);
                            setCurrentTime(0);
                            setExpandedCircleId(null);
                          }
                        }}
                      />
                    )}

                    {/* Image / Video Media Renderer with Lightbox support */}
                    {m.mediaType === 'image' && m.mediaUrl && (
                      <div
                        onClick={() => setFullScreenImage({ url: m.mediaUrl!, title: contact.name })}
                        className="mb-1 rounded-2xl overflow-hidden relative max-w-[260px] sm:max-w-[280px] border border-black/5 dark:border-white/10 shadow-2xs group cursor-pointer"
                      >
                        {dataSaverMode && !unlockedHdMedia[m.id] ? (
                          <div
                            className="relative group cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnlockedHdMedia((prev) => ({ ...prev, [m.id]: true }));
                            }}
                          >
                            <img
                              src={m.mediaUrl}
                              alt="Media preview"
                              className="w-full h-auto object-cover rounded-2xl blur-md scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-2 text-center">
                              <Zap size={18} className="text-amber-400 mb-1" />
                              <span className="text-[11px] font-bold">Экономия трафика</span>
                              <span className="text-[10px] text-slate-300">Нажмите для загрузки HD</span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full overflow-hidden flex items-center justify-center bg-slate-900/10 dark:bg-slate-900/40">
                            <img
                              src={m.mediaUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover scale-150 blur-lg opacity-30 pointer-events-none select-none"
                            />
                            <img
                              src={m.mediaUrl}
                              alt="Media"
                              className="relative z-10 w-full max-h-[280px] object-contain rounded-2xl group-hover:scale-105 transition duration-300"
                            />
                            <div className="absolute inset-0 z-20 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-semibold flex items-center gap-1">
                                <Maximize2 size={12} />
                                <span>Развернуть</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Document Attachment Renderer */}
                    {m.mediaType === 'document' && (
                      <div className="flex items-center gap-3 p-2 rounded-xl bg-black/5 dark:bg-white/5 mb-1">
                        <div className="h-8 w-8 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{m.fileName || m.text}</div>
                          <div className="text-[10px] opacity-75">{m.fileSize || 'Документ'}</div>
                        </div>
                        {m.mediaUrl && (
                          <a
                            href={m.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-current"
                            title="Скачать файл"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Crypto Transfer Badge */}
                    {m.tx && (
                      <div className="flex items-center gap-2 p-2 mb-1 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold text-xs">
                        <ArrowUpRight size={16} />
                        <span>{m.text}</span>
                      </div>
                    )}

                    {/* Standard Text Message with Inline Timestamp & Mini AI Translate Bar */}
                    {!m.tx && m.mediaType !== 'audio' && m.mediaType !== 'video_circle' && m.mediaType !== 'image' && m.mediaType !== 'document' && m.mediaType !== 'sticker' && (
                      <div className="space-y-1">
                        {!isMe && m.text && (
                          <div className="flex items-center justify-between gap-1.5 pb-1 mb-1 border-b border-slate-200/50 dark:border-slate-700/50 text-[10px]">
                            <div className="flex items-center gap-1 text-sky-500 font-semibold">
                              <Globe size={11} />
                              <span>ИИ Перевод</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTranslateMessage(m.id, m.text);
                              }}
                              disabled={translations[m.id]?.loading}
                              className="px-2 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-[9.5px] transition flex items-center gap-1"
                              title="Перевести сообщение через ИИ"
                            >
                              {translations[m.id]?.loading ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Languages size={10} />
                              )}
                              <span>{translations[m.id]?.text ? 'Обновить' : 'Перевести'}</span>
                            </button>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap break-words leading-snug">
                          <span>{m.text}</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-400 font-mono ml-2.5 align-baseline whitespace-nowrap select-none">
                            <span>{formattedTime}</span>
                            {isMe && <MessageStatusIndicator message={m} chatId={contact.id} />}
                          </span>
                        </p>

                        {translations[m.id]?.text && (
                          <div className="mt-1.5 p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-slate-800 dark:text-slate-200 leading-relaxed animate-fade-in">
                            <span className="font-bold text-sky-500 text-[10px] flex items-center gap-1 mb-0.5">
                              <Globe size={11} />
                              <span>Перевод (ИИ):</span>
                            </span>
                            {translations[m.id].text}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamp for Images/Documents/Stickers/Crypto */}
                    {(m.mediaType === 'image' || m.mediaType === 'document' || m.mediaType === 'sticker' || m.tx) && (
                      <div className="text-[10px] mt-0.5 flex items-center justify-end gap-1 text-slate-400 dark:text-slate-400">
                        <span>{formattedTime}</span>
                        {isMe && <MessageStatusIndicator message={m} chatId={contact.id} />}
                      </div>
                    )}

                    {/* Message Reactions Row */}
                    {!reactionsDisabled && m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(m.reactions).map(([emoji, val]) => {
                          const info = val as MessageReactionInfo;
                          if (!info || info.count <= 0) return null;
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(m.id, emoji);
                              }}
                              onTouchStart={(e) => handleReactionBadgeTouchStart(m.id, e)}
                              onTouchEnd={handleReactionBadgeTouchEnd}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setActiveReactionPickerId(m.id);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all transform active:scale-90 select-none ${
                                info.userReacted
                                  ? 'bg-sky-500/25 text-sky-600 dark:text-sky-300 border border-sky-400/50 font-medium shadow-xs scale-105'
                                  : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
                              }`}
                              title={`${emoji} (${info.count})`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-semibold">{info.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Reaction Button on Hover (Reply & Forward moved to top header bar on long-press) */}
                  {!reactionsDisabled && (
                    <div className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity flex items-center gap-0.5 self-center mb-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveReactionPickerId(activeReactionPickerId === m.id ? null : m.id);
                        }}
                        className="h-6 w-6 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 shadow-2xs"
                        title="Реакция"
                      >
                        <Smile size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Invitation banner on first entrance to channel/group */}
        {isChannelGroup && invitationInfo && !hasSeenInvite && (
          <div className="mx-auto my-3 px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-medium text-center shadow-xs w-fit animate-fade-in select-none">
            Вас пригласил пользователь {invitationInfo.inviterName}
          </div>
        )}

        {/* Real-time Typing Bubble Indicator */}
        {isOtherTyping && (
          <div className="flex items-center gap-2 mb-3.5 animate-fade-in pl-1">
            <div
              className={`h-7 w-7 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm relative overflow-hidden`}
            >
              {contact.avatarUrl ? (
                <img src={contact.avatarUrl} alt={contact.name} className="h-full w-full rounded-full object-cover" />
              ) : (
                contact.initials
              )}
            </div>
            <div className="px-3.5 py-2 rounded-2xl rounded-tl-xs bg-white/85 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {typingUserName || contact.name} печатает
              </span>
              <span className="flex items-center gap-1 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recording Voice / Video Circle Banner Overlays */}
      {isRecordingVoice && (
        <div className="p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-white/60 dark:border-slate-800 shrink-0">
          <VoiceRecorder
            onSendVoice={(durationSec, mediaUrl, blob, waveform) => {
              setIsRecordingVoice(false);
              setIsPushToTalk(false);
              setPushStartPos(null);
              handleSendVoiceNote(durationSec, mediaUrl, blob, waveform);
            }}
            onCancel={() => {
              setIsRecordingVoice(false);
              setIsPushToTalk(false);
              setPushStartPos(null);
            }}
            isPushToTalk={isPushToTalk}
            pushStartPos={pushStartPos}
          />
        </div>
      )}

      {isRecordingCircle && (
        <VideoCircleRecorder
          onSendCircle={handleSendVideoCircle}
          onCancel={() => setIsRecordingCircle(false)}
        />
      )}

      {/* Input Control Area */}
      {!isRecordingVoice && !isRecordingCircle && (
        <>
          {/* Reply Preview Bar above input */}
          {replyingToMessage && (
            <div className="mx-3 mb-1 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-sky-500/30 shadow-lg flex items-center justify-between gap-2 text-xs animate-fade-in shrink-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-1 bg-sky-500 rounded-full shrink-0" />
                <div className="truncate">
                  <span className="text-[11px] font-bold text-sky-500 block">
                    Ответ на сообщение ({replyingToMessage.from === 'me' ? 'Вы' : contact.name})
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate block">
                    {replyingToMessage.text || (replyingToMessage.mediaType === 'image' ? 'Фотография' : 'Медиафайл')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setReplyingToMessage(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Отменить ответ"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Pending Media Attachment Preview Bar above input (Photo with Caption) */}
          {pendingMedia && (
            <div className="mx-3 mb-1 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-between gap-3 text-xs animate-fade-in shrink-0 z-20">
              <div className="flex items-center gap-3 min-w-0">
                {pendingMedia.mediaType === 'image' ? (
                  <img src={pendingMedia.url} alt="Attachment" className="h-10 w-10 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs" />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                )}
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">
                    {pendingMedia.fileName || 'Прикреплённый файл'}
                  </span>
                  <span className="text-[10px] text-sky-500 font-semibold block">
                    Медиафайл прикреплён. Добавьте текст и нажмите 'Отправить'
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPendingMedia(null)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Удалить прикрепление"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {!isActuallyJoined ? (
            <div className="p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 safe-bottom shrink-0 shadow-lg">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Вы ещё не {isChannel ? 'подписаны на этот канал' : 'состоите в этой группе'}.
              </div>
              <button
                onClick={async () => {
                  try {
                    await api.joinChannelGroup(contact.id);
                    setJoinedChannelState(true);
                    showToast(`Вы ${isChannel ? 'подписались на канал' : 'вступили в группу'}!`);
                    if (onRefreshContacts) onRefreshContacts();
                  } catch (err: any) {
                    showToast(err.message || 'Ошибка при вступлении');
                  }
                }}
                className="px-5 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 active:scale-95 transition shrink-0 flex items-center gap-1.5"
              >
                <UserPlus size={15} />
                <span>{isChannel ? 'Подписаться' : 'Вступить'}</span>
              </button>
            </div>
          ) : isChannel && !canPostInChannel ? (
            <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 safe-bottom shrink-0">
              <Radio size={16} className="text-sky-500 animate-pulse" />
              <span>В канале могут публиковать записи только автор, администраторы и модераторы</span>
            </div>
          ) : commentsDisabled ? (
            <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 safe-bottom shrink-0">
              <Ban size={16} className="text-amber-500" />
              <span>Комментарии отключены администратором</span>
            </div>
          ) : isGuest ? (
            <div className="p-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-white/60 dark:border-slate-800 flex items-center justify-between gap-3 safe-bottom shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Гости не могут отправлять сообщения.
              </span>
              <button
                onClick={onOpenAuth}
                className="px-3.5 py-1.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium shadow-md shadow-sky-500/20 active:scale-95 transition shrink-0"
              >
                Войти
              </button>
            </div>
          ) : (
            <div className="px-3 pb-3 pt-1 flex items-center gap-2 safe-bottom shrink-0 relative bg-transparent z-20">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />

              {/* Standalone Circular Attachment Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia || slowModeCooldown > 0}
                className="h-10 w-10 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 hover:bg-white dark:hover:bg-slate-800 transition active:scale-95 shrink-0 disabled:opacity-50"
                title="Прикрепить файл или фото"
              >
                {uploadingMedia ? (
                  <Loader2 size={18} className="animate-spin text-sky-500" />
                ) : (
                  <Paperclip size={18} />
                )}
              </button>

              {/* Main Connected Input Bubble (Pill) */}
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-sm relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStickerEmojiPicker(!showStickerEmojiPicker);
                  }}
                  className="p-1 rounded-full text-slate-500 hover:text-amber-500 transition shrink-0"
                  title="Стикеры и эмодзи"
                >
                  <Smile size={19} />
                </button>

                <input
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  placeholder={
                    slowModeCooldown > 0
                      ? `Медленный режим (${slowModeCooldown}с)...`
                      : "Зашифрованное сообщение..."
                  }
                  disabled={slowModeCooldown > 0}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 dark:text-white placeholder:text-slate-400 px-1 disabled:opacity-60"
                />

                {slowModeCooldown > 0 && !isUserAdminOrAuthor && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono text-[10px] font-bold shrink-0 animate-pulse">
                    ⏱ {slowModeCooldown}s
                  </span>
                )}

                {(input.trim() || pendingMedia) ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      disabled={slowModeCooldown > 0}
                      className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-500 dark:text-slate-300 flex items-center justify-center transition active:scale-95 shrink-0 disabled:opacity-50"
                      title="Запланировать отправку сообщения"
                    >
                      <Clock size={15} />
                    </button>
                    <button
                      onClick={() => handleSendText()}
                      disabled={slowModeCooldown > 0}
                      className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition shrink-0 disabled:opacity-50"
                      title="Отправить сообщение"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    onPointerDown={handleRecordPointerDown}
                    onPointerUp={handleRecordPointerUp}
                    onPointerCancel={handleRecordPointerUp}
                    onClick={handleRecordClick}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setInputMode(inputMode === 'mic' ? 'video_circle' : 'mic');
                    }}
                    disabled={slowModeCooldown > 0}
                    className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md transition shrink-0 select-none touch-none active:scale-105 disabled:opacity-50 ${
                      inputMode === 'mic'
                        ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                    }`}
                    title={
                      inputMode === 'mic'
                        ? 'Нажмите для смены на видеокружок. Зажмите для записи ГС.'
                        : 'Нажмите для смены на ГС. Зажмите для записи видеокружка.'
                    }
                  >
                    {inputMode === 'mic' ? <Mic size={16} /> : <Video size={16} />}
                  </button>
                )}
              </div>

              <StickerEmojiPicker
                isOpen={showStickerEmojiPicker}
                onClose={() => setShowStickerEmojiPicker(false)}
                onSelectEmoji={(emoji) => setInput((prev) => prev + emoji)}
                onSelectSticker={(stickerUrl) =>
                  handleSendText('', { mediaType: 'sticker', mediaUrl: stickerUrl })
                }
              />
            </div>
          )}
        </>
      )}

      {/* Modals & Overlays */}
      <E2EESecurityModal
        isOpen={showE2EEModal}
        onClose={() => setShowE2EEModal(false)}
        contactName={contact.name}
      />

      {callType && (
        <CallOverlayModal
          isOpen={!!callType}
          onClose={() => setCallType(null)}
          contact={contact}
          callType={callType}
          currentUserId={user?.id}
        />
      )}

      {/* Send Crypto Modal inside chat */}
      {showSendCryptoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xs rounded-3xl p-5 shadow-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold mb-2">Отправить ORB к {contact.name}</h3>
            <p className="text-xs text-slate-400 mb-3">Ваш баланс: {balance.toFixed(2)} ORB</p>

            <input
              type="number"
              value={cryptoAmount}
              onChange={(e) => setCryptoAmount(e.target.value)}
              placeholder="Сумма ORB"
              className="w-full px-3.5 py-2 mb-3 rounded-2xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowSendCryptoModal(false)}
                className="flex-1 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleSendCryptoInChat}
                disabled={sendingCrypto}
                className="flex-1 py-2 rounded-full bg-sky-500 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1"
              >
                {sendingCrypto ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Отправить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report User Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-amber-500">
                <ShieldAlert size={16} /> Пожаловаться
              </h3>
              <button onClick={() => setShowReportModal(false)} className="p-1 text-slate-400">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-400">Выберите причину жалобы на {contact.name}:</p>

            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
            >
              <option value="Спам или реклама">Спам или реклама</option>
              <option value="Оскорбительное поведение">Оскорбительное поведение</option>
              <option value="Мошенничество">Мошенничество</option>
              <option value="Другое">Другое</option>
            </select>

            <textarea
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="Комментарий для модераторов (необязательно)..."
              className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none h-20 resize-none"
            />

            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={blockAfterReport}
                onChange={(e) => setBlockAfterReport(e.target.checked)}
                className="rounded border-slate-300 text-sky-500 focus:ring-0"
              />
              <span>Заблокировать после отправки</span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={submittingReport}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1"
              >
                {submittingReport ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                <span>Отправить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Message Modal (WhatsApp 1:1 style) */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl p-5 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CornerUpRight size={18} className="text-sky-500" />
                <h3 className="text-sm font-bold">Переслать сообщение</h3>
              </div>
              <button
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardingMessage(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quoted Message Preview */}
            {forwardingMessage && (
              <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border-l-4 border-sky-500 text-xs space-y-0.5">
                <span className="text-[10px] font-bold text-sky-500 block">Сообщение для пересылки:</span>
                <p className="text-slate-700 dark:text-slate-300 truncate">
                  {forwardingMessage.text || (forwardingMessage.mediaType === 'image' ? 'Фотография' : 'Медиафайл')}
                </p>
              </div>
            )}

            {/* Contact Search Bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="Поиск чата или контакта..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
              />
            </div>

            {/* Contacts List */}
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1 no-scrollbar">
              {forwardContacts
                .filter((c) => c.name.toLowerCase().includes(forwardSearch.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleConfirmForward(c)}
                    disabled={sendingForward}
                    className="w-full flex items-center justify-between p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden`}>
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" />
                        ) : (
                          c.initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{c.type === 'channel' ? 'Канал' : 'Контакт'}</div>
                      </div>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shrink-0">
                      <CornerUpRight size={13} />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 animate-fade-in"
          onClick={() => setFullScreenImage(null)}
        >
          {/* Lightbox Header */}
          <div className="w-full flex items-center justify-between z-10 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold">{fullScreenImage.title || 'Просмотр фото'}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={fullScreenImage.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
                title="Скачать фото"
              >
                <Download size={18} />
              </a>
              <button
                onClick={() => setFullScreenImage(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white"
                title="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lightbox Image Container */}
          <div className="flex-1 w-full flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullScreenImage.url}
              alt="Full size view"
              className="max-h-[85vh] max-w-[95vw] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          {/* Lightbox Footer */}
          <div className="text-[11px] text-slate-400 font-mono pb-2" onClick={(e) => e.stopPropagation()}>
            Нажмите X или в любом месте, чтобы закрыть
          </div>
        </div>
      )}

      {/* Wallpaper Background Customizer Modal */}
      <WallpaperModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        settings={wallpaperSettings}
        onSave={handleSaveWallpaper}
        title={contact.isChannelGroup ? 'Фон канала / группы' : 'Индивидуальный фон диалога'}
        subtitle={
          contact.isChannelGroup
            ? isUserAdminOrAuthor
              ? 'Установленный фон будет виден всем участникам одинаково'
              : 'Просмотр фона, заданного автором канала/группы'
            : `Персональные настройки фона для общения с ${contact.name}`
        }
      />

      {/* Schedule Message Picker Modal */}
      <ScheduleMessageModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleMessageConfirm}
        textPreview={input}
        mediaPreview={
          pendingMedia
            ? {
                fileName: pendingMedia.fileName,
                mediaType: pendingMedia.mediaType,
              }
            : null
        }
      />

      {/* Scheduled Messages Queue List Modal */}
      <ScheduledMessagesListModal
        isOpen={showScheduledListModal}
        onClose={() => setShowScheduledListModal(false)}
        scheduledMessages={contactScheduledMessages}
        onSendNow={handleSendScheduledNow}
        onDelete={handleDeleteScheduled}
        contactName={contact.name}
      />
    </div>
  );
};
