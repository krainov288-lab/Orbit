import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Paperclip,
  ArrowUpRight,
  FileText,
  Check,
  CheckCheck,
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
  Radio,
  Search,
  ChevronUp,
  ChevronDown,
  Globe,
  Languages,
} from 'lucide-react';
import { Contact, Message, MessageReactionInfo } from '../../types';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { E2EESecurityModal } from './E2EESecurityModal';
import { CallOverlayModal, CallType } from './CallOverlayModal';
import { VoiceRecorder } from './VoiceRecorder';
import { VideoCircleRecorder } from './VideoCircleRecorder';
import { StickerEmojiPicker } from './StickerEmojiPicker';
import { VideoCirclePlayer } from './VideoCirclePlayer';
import { StickyMediaHeaderPlayer } from './StickyMediaHeaderPlayer';
import { triggerHaptic } from '../../utils/haptics';

interface ChatScreenProps {
  contact: Contact;
  onBack: () => void;
  balance: number;
  onSendCrypto: () => void;
  isDark?: boolean;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  contact,
  onBack,
  balance,
  onSendCrypto,
  isDark,
  isGuest,
  onOpenAuth,
  onOpenUserProfile,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSendCryptoModal, setShowSendCryptoModal] = useState(false);
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [sendingCrypto, setSendingCrypto] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Reaction State
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<string | null>(null);
  const QUICK_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '🎉'];

  // Modals & Modes
  const [showE2EEModal, setShowE2EEModal] = useState(false);
  const [callType, setCallType] = useState<CallType | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingCircle, setIsRecordingCircle] = useState(false);
  const [inputMode, setInputMode] = useState<'mic' | 'video_circle'>('mic');
  const [showStickerEmojiPicker, setShowStickerEmojiPicker] = useState(false);

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

    const unsubRead = socketService.subscribe('messages_read', (data) => {
      if (data.byUserId === contact.id) {
        setMessages((prev) => prev.map((m) => (m.from === 'me' ? { ...m, isRead: true } : m)));
      }
    });

    const unsubMsg = socketService.subscribe('new_message', (data) => {
      if (data.senderId === contact.id && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        api.markMessagesRead(contact.id).catch(() => {});
      }
    });

    const unsubReaction = socketService.subscribe('message_reaction', (data) => {
      if (data.messageId && data.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    });

    return () => {
      unsubRead();
      unsubMsg();
      unsubReaction();
    };
  }, [contact.id]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    triggerHaptic('light');
    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const existing = currentReactions[emoji] || { count: 0, userReacted: false, users: [] };

        let newCount = existing.count;
        let newUserReacted = !existing.userReacted;

        if (existing.userReacted) {
          newCount = Math.max(0, newCount - 1);
        } else {
          newCount = newCount + 1;
        }

        if (newCount === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = {
            ...existing,
            count: newCount,
            userReacted: newUserReacted,
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

  const handleSendText = async (textOverride?: string, extraMediaProps?: Partial<Message>) => {
    const textToSend = (textOverride ?? input).trim();
    if (!textToSend && !extraMediaProps) return;
    triggerHaptic('success');
    if (!textOverride) setInput('');

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMsg: Message = {
      id: tempId,
      from: 'me',
      text: textToSend,
      timestamp: Date.now(),
      isEncrypted: true,
      ...extraMediaProps,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });

    try {
      const actualMsg = await api.sendMessage(contact.id, {
        text: textToSend,
        mediaUrl: extraMediaProps?.mediaUrl,
        mediaType: extraMediaProps?.mediaType,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...actualMsg, ...extraMediaProps, isEncrypted: true } : m))
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendVoiceNote = async (durationSec: number, localMediaUrl?: string, blob?: Blob) => {
    setIsRecordingVoice(false);
    setIsPushToTalk(false);
    let serverUrl = localMediaUrl || 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg';

    if (blob && blob.size > 0) {
      try {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
        const uploadRes = await api.uploadMedia(file);
        if (uploadRes?.url) {
          serverUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Voice note upload fallback to local URL:', err);
      }
    }

    const playUrl = localMediaUrl || serverUrl;

    await handleSendText(`Голосовое сообщение (${durationSec} сек)`, {
      mediaType: 'audio',
      duration: durationSec,
      mediaUrl: playUrl,
    });
  };

  const handleSendVideoCircle = async (durationSec: number, localMediaUrl?: string, blob?: Blob) => {
    setIsRecordingCircle(false);
    let serverUrl = localMediaUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

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

    const playUrl = localMediaUrl || serverUrl;

    await handleSendText(`Видеосообщение (${durationSec} сек)`, {
      mediaType: 'video_circle',
      duration: durationSec,
      mediaUrl: playUrl,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const uploadRes = await api.uploadMedia(file);
      const isDoc = !file.type.startsWith('image/') && !file.type.startsWith('video/');

      await handleSendText(file.name, {
        mediaUrl: uploadRes.url,
        mediaType: isDoc ? 'document' : (uploadRes.mediaType as any),
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      });
    } catch (err) {
      console.error('Media upload failed:', err);
      showToast('Ошибка загрузки медиафайла');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      await api.removeContact(contact.id);
      showToast('Контакт удалён из списка');
      setTimeout(() => onBack(), 1200);
    } catch (err: any) {
      showToast(err.message || 'Ошибка удаления контакта');
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-medium shadow-2xl flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Check size={14} className="text-emerald-400" />
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

        {/* Main Connected Header Bubble (Pill) */}
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
                <span>{contact.isOnline ? 'В сети' : 'Не в сети'}</span>
                <span>· Профиль</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setCallType('voice')}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="Голосовой вызов"
            >
              <Phone size={16} />
            </button>

            <button
              onClick={() => setCallType('video')}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
              title="Видеовызов"
            >
              <Video size={16} />
            </button>

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
                <div className="absolute right-0 top-10 w-52 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-2xl p-1.5 z-50 text-xs animate-fade-in space-y-0.5">
                  {onOpenUserProfile && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenUserProfile(contact.id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                    >
                      <Users size={14} className="text-sky-500" />
                      <span>Посмотреть профиль</span>
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
                      setCallType('group_conference');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Users size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Видеоконференция</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setCallType('channel_stream');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Radio size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Прямая трансляция</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleRemoveContact();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <Trash2 size={14} className="text-slate-500 dark:text-slate-400" />
                    <span>Удалить контакт</span>
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
          <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
            <Loader2 size={16} className="animate-spin mr-2 text-slate-500" /> Загрузка зашифрованного чата...
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

            return (
              <div id={`msg-${m.id}`} key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/row my-0.5`}>
                <div className={`relative flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Bubble Container - Soft Airy Tones */}
                  <div
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
                    {/* Quick Reaction Floating Picker Bar */}
                    {activeReactionPickerId === m.id && (
                      <div
                        className={`absolute z-30 -top-11 ${
                          isMe ? 'right-0' : 'left-0'
                        } flex items-center gap-0.5 p-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl animate-scale-in`}
                      >
                        {QUICK_EMOJIS.map((emoji) => {
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

                          <div className="flex-1 min-w-[110px]">
                            <div className="flex items-center gap-0.5 h-3.5 overflow-hidden">
                              {Array.from({ length: 18 }).map((_, idx) => {
                                const isPlayed =
                                  activeMedia?.id === m.id &&
                                  (idx / 18) * (m.duration || mediaDuration || 10) <= currentTime;
                                return (
                                  <span
                                    key={idx}
                                    className={`w-0.5 rounded-full transition-all ${
                                      isPlayed
                                        ? 'bg-sky-500'
                                        : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                    style={{
                                      height: `${Math.floor(Math.sin(idx * 0.8) * 35 + 50)}%`,
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              <div className="flex items-center gap-1.5 font-mono text-[9px]">
                                <span>Голосовое {m.duration ? `${m.duration}с` : ''}</span>
                                {activeMedia?.id === m.id && (
                                  <span className="text-sky-500 font-bold">{playbackRate}x</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0 ml-2">
                                <span>{formattedTime}</span>
                                {isMe && (
                                  <CheckCheck
                                    size={12}
                                    className={m.isRead ? 'text-sky-500 font-bold' : 'text-slate-400 dark:text-slate-500'}
                                  />
                                )}
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

                    {/* Image / Video Media Renderer */}
                    {m.mediaType === 'image' && m.mediaUrl && (
                      <div className="mb-1 rounded-2xl overflow-hidden relative max-w-[260px] sm:max-w-[280px] border border-black/5 dark:border-white/10 shadow-2xs group">
                        {dataSaverMode && !unlockedHdMedia[m.id] ? (
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => setUnlockedHdMedia((prev) => ({ ...prev, [m.id]: true }))}
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
                            {/* Mirrored background for small images to fit standard block size cleanly */}
                            <img
                              src={m.mediaUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover scale-150 blur-lg opacity-30 pointer-events-none select-none"
                            />
                            <img
                              src={m.mediaUrl}
                              alt="Media"
                              className="relative z-10 w-full max-h-[280px] object-contain rounded-2xl"
                            />
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
                            {isMe && (
                              <CheckCheck
                                size={12}
                                className={`${
                                  m.isRead ? 'text-sky-500 font-bold' : 'text-slate-400 dark:text-slate-500'
                                } inline self-center`}
                              />
                            )}
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
                        {isMe && (
                          <CheckCheck
                            size={12}
                            className={m.isRead ? 'text-sky-500 font-bold' : 'text-slate-400 dark:text-slate-500'}
                          />
                        )}
                      </div>
                    )}

                    {/* Message Reactions Row */}
                    {m.reactions && Object.keys(m.reactions).length > 0 && (
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

                  {/* Reaction Hover Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveReactionPickerId(activeReactionPickerId === m.id ? null : m.id);
                    }}
                    className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 transition-opacity h-6 w-6 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 shadow-2xs self-center mb-1"
                    title="Добавить реакцию"
                  >
                    <Smile size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Voice / Video Circle Banner Overlays */}
      {isRecordingVoice && (
        <div className="p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-white/60 dark:border-slate-800 shrink-0">
          <VoiceRecorder
            onSendVoice={(durationSec, mediaUrl, blob) => {
              setIsRecordingVoice(false);
              setIsPushToTalk(false);
              setPushStartPos(null);
              handleSendVoiceNote(durationSec, mediaUrl, blob);
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
          {contact.isChannelGroup && contact.channelGroupType?.includes('channel') && !contact.isAdmin ? (
            <div className="px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 safe-bottom shrink-0">
              <Radio size={16} className="text-sky-500 animate-pulse" />
              <span>Канал предназначен только для публикаций администраторов</span>
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
                disabled={uploadingMedia}
                className="h-10 w-10 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-slate-800/80 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-500 hover:bg-white dark:hover:bg-slate-800 transition active:scale-95 shrink-0"
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
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  placeholder="Зашифрованное сообщение..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 dark:text-white placeholder:text-slate-400 px-1"
                />

                {input.trim() ? (
                  <button
                    onClick={() => handleSendText()}
                    className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition shrink-0"
                  >
                    <Send size={15} />
                  </button>
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
                    className={`h-8 w-8 rounded-full flex items-center justify-center shadow-md transition shrink-0 select-none touch-none active:scale-105 ${
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
    </div>
  );
};
