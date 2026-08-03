import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Phone, PhoneOff, Radio } from 'lucide-react';
import { User, Contact, NewsItem, AppNotification, TabType, CallType } from './types';
import { api } from './services/api';
import { socketService } from './services/socket';
import { cacheService } from './services/cacheService';
import { TopBar } from './components/Layout/TopBar';
import { BottomNav } from './components/Layout/BottomNav';
import { OfflineOutboxBar } from './components/Layout/OfflineOutboxBar';
import { NotificationToast } from './components/Layout/NotificationToast';
import { AuthModal } from './components/Auth/AuthModal';
import { HomeScreen } from './components/Home/HomeScreen';
import { ChatScreen } from './components/Chat/ChatScreen';
import { AIScreen } from './components/AI/AIScreen';
import { WalletScreen } from './components/Wallet/WalletScreen';
import { FeedScreen } from './components/Feed/FeedScreen';
import { ProfileScreen } from './components/Profile/ProfileScreen';
import { UserProfileModal } from './components/Profile/UserProfileModal';
import { ChannelGroupModal } from './components/Chat/ChannelGroupModal';
import { PinSetupModal } from './components/Security/PinSetupModal';
import { PinRecoveryModal } from './components/Security/PinRecoveryModal';
import { PinLockOverlay } from './components/Security/PinLockOverlay';

export default function App() {
  const [tab, setTab] = useState<TabType>('home');
  const [activeChat, setActiveChat] = useState<Contact | null>(null);
  const [user, setUser] = useState<User | null>(() => cacheService.getSync<User>('current_user'));
  const [contacts, setContacts] = useState<Contact[]>(() => cacheService.getCachedContacts() || []);
  const [news, setNews] = useState<NewsItem[]>(() => cacheService.getCachedNews() || []);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>();
  const [aiInitialAction, setAiInitialAction] = useState<string | undefined>();
  const [activeUserProfileId, setActiveUserProfileId] = useState<string | null>(null);

  // PIN & Security State
  const [storedPin, setStoredPin] = useState('');
  const [storedSecretPhrase, setStoredSecretPhrase] = useState('');
  const [storedRecoveryContact, setStoredRecoveryContact] = useState('');
  const [isAppLocked, setIsAppLocked] = useState(false);

  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [isPinRecoveryOpen, setIsPinRecoveryOpen] = useState(false);

  const [pushToast, setPushToast] = useState<{
    senderName: string;
    text: string;
    senderInitials?: string;
    senderColor?: string;
    senderId?: string;
  } | null>(null);

  const [incomingCall, setIncomingCall] = useState<{
    caller: any;
    callType: CallType;
    channelId?: string;
  } | null>(null);

  const handleOpenAI = (prompt?: string, actionLabel?: string) => {
    setAiInitialPrompt(prompt);
    setAiInitialAction(actionLabel);
    setTab('ai');
  };

  // Sync theme when logged in user changes or on logout
  useEffect(() => {
    if (user && user.email) {
      const savedTheme = localStorage.getItem(`orbit_theme_${user.email}`);
      setIsDark(savedTheme === 'true');
    } else {
      setIsDark(false);
    }
  }, [user?.email]);

  // Sync PIN & security settings when logged in user changes or on logout
  useEffect(() => {
    if (user && user.email) {
      const pin = localStorage.getItem(`orbit_pin_code_${user.email}`) || '';
      const phrase = localStorage.getItem(`orbit_secret_phrase_${user.email}`) || '';
      const contact = localStorage.getItem(`orbit_recovery_contact_${user.email}`) || '';
      const wasLocked = localStorage.getItem(`orbit_app_locked_${user.email}`) === 'true';

      setStoredPin(pin);
      setStoredSecretPhrase(phrase);
      setStoredRecoveryContact(contact);
      setIsAppLocked(!!pin && wasLocked);
    } else {
      setStoredPin('');
      setStoredSecretPhrase('');
      setStoredRecoveryContact('');
      setIsAppLocked(false);
    }
  }, [user?.email]);

  // Sync dark mode class and save to user profile
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (user && user.email) {
      localStorage.setItem(`orbit_theme_${user.email}`, isDark ? 'true' : 'false');
    }
  }, [isDark, user?.email]);

  // Load initial app data
  const getDismissedNotifIds = (): string[] => {
    try {
      const saved = localStorage.getItem(`orbit_dismissed_notifs_${user?.email || 'guest'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const saveDismissedNotifIds = (ids: string[]) => {
    try {
      const current = getDismissedNotifIds();
      const updated = Array.from(new Set([...current, ...ids]));
      localStorage.setItem(`orbit_dismissed_notifs_${user?.email || 'guest'}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const refreshData = useCallback(async () => {
    try {
      if (api.getToken()) {
        const u = await api.getCurrentUser().catch(() => null);
        setUser(u);

        if (u) {
          const [cList, txList, notifList] = await Promise.all([
            api.getContacts().catch(() => []),
            api.getTransactions().catch(() => []),
            api.getNotifications().catch(() => []),
          ]);
          setContacts(cList);
          setTransactions(txList);

          const dismissed = getDismissedNotifIds();
          setNotifications((notifList || []).filter((n: AppNotification) => !dismissed.includes(n.id)));
        }
      }

      const newsList = await api.getNews().catch(() => []);
      setNews(newsList);
    } catch (err) {
      console.error('Data refresh error:', err);
    }
  }, [user?.email]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Setup WebSocket connections and listeners
  useEffect(() => {
    if (user) {
      socketService.connect();

      const unsubMsg = socketService.subscribe('new_message', (data) => {
        // Exclude self-messages from push toasts
        const isFromMe = user && String(data.senderId) === String(user.id);
        if (isFromMe) {
          refreshData();
          return;
        }

        const isCurrentActiveChat =
          activeChat &&
          (String(activeChat.id) === String(data.senderId) ||
            String(activeChat.id) === String(data.channelGroupId));

        if (!isCurrentActiveChat) {
          const targetId = data.channelGroupId || data.senderId;
          setPushToast({
            senderName: data.senderName,
            senderInitials: data.senderInitials,
            senderColor: data.senderColor,
            text: data.message?.text || 'Отправил вложение',
            senderId: targetId,
          });
        }
        refreshData();
      });

      const unsubCgDeleted = socketService.subscribe('channel_group_deleted', (data) => {
        if (data.id) {
          setActiveChat((prev) => (prev && String(prev.id) === String(data.id) ? null : prev));
          refreshData();
        }
      });

      const unsubNotif = socketService.subscribe('push_notification', (data) => {
        if (data.notification) {
          setNotifications((prev) => [data.notification, ...prev]);
        }
      });

      const unsubBal = socketService.subscribe('balance_update', (data) => {
        if (data.newBalance !== undefined) {
          setUser((prev) => (prev ? { ...prev, balance: data.newBalance } : null));
        }
        refreshData();
      });

      const unsubUserUpdated = socketService.subscribe('user_updated', (data) => {
        if (data.user) {
          setUser((prev) => (prev && prev.id === data.user.id ? { ...prev, ...data.user } : prev));
          setContacts((prev) => {
            const updated = prev.map((c) =>
              c.id === data.user.id
                ? {
                    ...c,
                    name: data.user.username || c.name,
                    avatarUrl: data.user.avatarUrl,
                    initials: data.user.initials || c.initials,
                    handle: data.user.handle || c.handle,
                  }
                : c
            );
            cacheService.setCachedContacts(updated);
            return updated;
          });
          setActiveChat((prev) =>
            prev && prev.id === data.user.id
              ? {
                  ...prev,
                  name: data.user.username || prev.name,
                  avatarUrl: data.user.avatarUrl,
                  initials: data.user.initials || prev.initials,
                  handle: data.user.handle || prev.handle,
                }
              : prev
          );
          refreshData();
        }
      });

      const unsubNewStory = socketService.subscribe('new_story', () => {
        refreshData();
      });

      const unsubIncomingCall = socketService.subscribe('incoming_call', (data) => {
        if (data.caller && data.caller.id !== user?.id) {
          setIncomingCall({
            caller: data.caller,
            callType: data.callType || 'voice',
            channelId: data.channelId,
          });
        }
      });

      const unsubLiveStream = socketService.subscribe('live_stream_started', (data) => {
        const notifItem: AppNotification = {
          id: `live_${Date.now()}`,
          userId: user?.id || 'guest',
          title: `🔴 Прямой эфир в ${data.channelTitle || 'канале'}`,
          body: `${data.authorName || 'Автор'} начал прямой эфир!`,
          timestamp: Date.now(),
          isRead: false,
        };
        setNotifications((prev) => [notifItem, ...prev]);
        setPushToast({
          senderName: data.channelTitle || 'Канал',
          text: `🔴 Прямой эфир от ${data.authorName}!`,
          senderInitials: '🔴',
          senderColor: 'from-red-500 to-rose-600',
        });
      });

      return () => {
        unsubMsg();
        unsubCgDeleted();
        unsubNotif();
        unsubBal();
        unsubUserUpdated();
        unsubNewStory();
        unsubIncomingCall();
        unsubLiveStream();
        socketService.disconnect();
      };
    }
  }, [user, refreshData]);

  const handleLogout = () => {
    api.clearToken();
    socketService.disconnect();
    cacheService.clearAllCache();
    setUser(null);
    setActiveChat(null);
    setContacts([]);
  };

  const handleLockApp = () => {
    if (!user?.email) return;
    setIsAppLocked(true);
    localStorage.setItem(`orbit_app_locked_${user.email}`, 'true');
  };

  const handleUnlockApp = () => {
    if (!user?.email) return;
    setIsAppLocked(false);
    localStorage.setItem(`orbit_app_locked_${user.email}`, 'false');
  };

  const handleClearNotifications = async () => {
    const ids = notifications.map((n) => n.id);
    saveDismissedNotifIds(ids);
    setNotifications([]);
    try {
      await api.clearNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    const ids = notifications.map((n) => n.id);
    saveDismissedNotifIds(ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.markNotificationsRead();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTriggerTestNotification = (title: string, body: string) => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      userId: user?.id || 'usr_guest',
      title,
      body,
      timestamp: Date.now(),
      isRead: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setPushToast({
      senderName: title,
      text: body,
      senderInitials: 'OR',
      senderColor: 'from-blue-500 to-indigo-600',
    });
  };

  const handleSavePinSetup = (pin: string, phrase: string, contact: string) => {
    if (!user?.email) return;

    setStoredPin(pin);
    localStorage.setItem(`orbit_pin_code_${user.email}`, pin);

    setStoredSecretPhrase(phrase);
    localStorage.setItem(`orbit_secret_phrase_${user.email}`, phrase);

    setStoredRecoveryContact(contact);
    localStorage.setItem(`orbit_recovery_contact_${user.email}`, contact);

    handleLockApp();
  };

  const handleSaveNewPinFromRecovery = (newPin: string) => {
    if (!user?.email) return;

    setStoredPin(newPin);
    localStorage.setItem(`orbit_pin_code_${user.email}`, newPin);
    handleUnlockApp();
    setIsPinRecoveryOpen(false);
  };

  const totalUnread = contacts.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[#e2e8f0] dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans antialiased">
      <div
        className="relative overflow-hidden shadow-2xl transition-all flex flex-col sm:rounded-[40px] sm:my-4 sm:border sm:border-white/60 dark:sm:border-slate-800"
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '100dvh',
          maxHeight: '932px',
          background: isDark
            ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)'
            : 'linear-gradient(180deg, #E6F0FA 0%, #EEF4FC 50%, #E6F0FA 100%)',
        }}
      >
        {/* Ambient background blobs matching original screenshot style */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 -left-10 w-72 h-72 rounded-full bg-blue-200/50 dark:bg-blue-500/10 blur-3xl" />
          <div className="absolute top-48 -right-10 w-72 h-72 rounded-full bg-pink-200/40 dark:bg-pink-500/10 blur-3xl" />
          <div className="absolute bottom-32 left-10 w-64 h-64 rounded-full bg-purple-200/40 dark:bg-purple-500/10 blur-3xl" />
        </div>

        {/* Real-time Push Toast */}
        {pushToast && !isAppLocked && (
          <NotificationToast
            senderName={pushToast.senderName}
            senderInitials={pushToast.senderInitials}
            senderColor={pushToast.senderColor}
            text={pushToast.text}
            onClose={() => setPushToast(null)}
            onClick={() => {
              const senderId = pushToast.senderId;
              const target = contacts.find((c) => String(c.id) === String(senderId));
              if (target) {
                setActiveChat(target);
                setTab('home');
              } else if (senderId) {
                if (senderId.startsWith('cg_')) {
                  api.getChannelGroupDetails(senderId).then((cg) => {
                    const channelContact: Contact = {
                      id: cg.id,
                      name: cg.title,
                      handle: cg.handle,
                      initials: cg.type.includes('channel') ? '📢' : '👥',
                      color: cg.avatarColor || 'from-sky-500 to-indigo-600',
                      avatarUrl: cg.avatarUrl,
                      last: 'Публикация канала',
                      time: 'Только что',
                      unread: 0,
                      isOnline: true,
                      isChannelGroup: true,
                    };
                    setActiveChat(channelContact);
                    setTab('home');
                  }).catch(() => {});
                } else {
                  const fallbackContact: Contact = {
                    id: senderId,
                    name: pushToast.senderName,
                    avatarUrl: undefined,
                    initials:
                      pushToast.senderInitials ||
                      pushToast.senderName.substring(0, 2).toUpperCase(),
                    color: pushToast.senderColor || 'from-sky-400 to-blue-600',
                    handle: '@' + pushToast.senderName.toLowerCase().replace(/\s+/g, ''),
                    last: pushToast.text,
                    time: 'только что',
                    unread: 0,
                  };
                  setActiveChat(fallbackContact);
                  setTab('home');
                }
              }
              setPushToast(null);
            }}
          />
        )}

        {/* Full-Screen PIN Lock Overlay (Cybersecurity compliance) */}
        <PinLockOverlay
          isLocked={isAppLocked}
          storedPin={storedPin}
          onUnlock={handleUnlockApp}
          onOpenRecovery={() => setIsPinRecoveryOpen(true)}
        />

        {/* Main Application Container */}
        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          {activeChat ? (
            <div className="flex-1 min-h-0">
              <ChatScreen
                contact={activeChat}
                onBack={() => {
                  setActiveChat(null);
                  refreshData();
                }}
                balance={user ? user.balance : 0}
                onSendCrypto={() => refreshData()}
                isDark={isDark}
                isGuest={!user}
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenUserProfile={(id) => setActiveUserProfileId(id)}
              />
            </div>
          ) : (
            <>
              {/* Offline & Outbox Sync Status Banner */}
              <OfflineOutboxBar isGuest={!user} />

              {/* Top Bar Navigation (Only shown for home and wallet screens) */}
              {user && (tab === 'home' || tab === 'wallet') && (
                <TopBar
                  user={user}
                  notifications={notifications}
                  isPinSet={!!storedPin}
                  onNavigateProfile={() => setTab('profile')}
                  onSettings={() => setTab('profile')}
                  onLogout={handleLogout}
                  onOpenAuth={() => setIsAuthOpen(true)}
                  onOpenPinSetup={() => setIsPinSetupOpen(true)}
                  onLockApp={handleLockApp}
                  onClearNotifications={handleClearNotifications}
                  onMarkAllRead={handleMarkAllRead}
                  isDark={isDark}
                />
              )}

              {/* Guest Top Header (Shown for guest users on home and wallet screens) */}
              {!user && (tab === 'home' || tab === 'wallet') && (
                <div className="flex items-center justify-between px-5 pt-5 pb-2 relative z-30">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                      OR
                    </div>
                    <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Orbit Messenger</span>
                  </div>
                  <button
                    onClick={() => setIsAuthOpen(true)}
                    className="px-3.5 py-1.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium shadow-md shadow-blue-500/20 active:scale-95 transition"
                  >
                    Войти
                  </button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-1 relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="h-full w-full flex flex-col"
                  >
                    {tab === 'home' && (
                      <HomeScreen
                        contacts={contacts}
                        news={news}
                        setTab={setTab}
                        openChat={(c) => {
                          if (!user) {
                            setIsAuthOpen(true);
                          } else {
                            setActiveChat(c);
                          }
                        }}
                        onAskAI={handleOpenAI}
                        isDark={isDark}
                        onRefreshContacts={refreshData}
                        currentUser={user}
                        onOpenUserProfile={(id) => setActiveUserProfileId(id)}
                        onOpenAuth={() => setIsAuthOpen(true)}
                      />
                    )}

                    {tab === 'ai' && (
                      <AIScreen
                        initialPrompt={aiInitialPrompt}
                        initialAction={aiInitialAction}
                        onClearInitial={() => {
                          setAiInitialPrompt(undefined);
                          setAiInitialAction(undefined);
                        }}
                        isDark={isDark}
                        isGuest={!user}
                        user={user}
                        onOpenAuth={() => setIsAuthOpen(true)}
                      />
                    )}

                    {tab === 'wallet' && (
                      <WalletScreen
                        balance={user ? user.balance : 0}
                        transactions={transactions}
                        contacts={contacts}
                        setTab={setTab}
                        onRefreshBalance={refreshData}
                        isDark={isDark}
                        isGuest={!user}
                        onOpenAuth={() => setIsAuthOpen(true)}
                      />
                    )}

                    {tab === 'feed' && (
                      <FeedScreen
                        news={news}
                        currentUser={user}
                        isDark={isDark}
                        isGuest={!user}
                        onOpenAuth={() => setIsAuthOpen(true)}
                        onAddNews={(item) => setNews((prev) => [item, ...prev])}
                      />
                    )}

                    {tab === 'profile' && (
                      <ProfileScreen
                        user={user}
                        contacts={contacts}
                        isDark={isDark}
                        isPinSet={!!storedPin}
                        onOpenPinSetup={() => setIsPinSetupOpen(true)}
                        onToggleDarkMode={() => setIsDark(!isDark)}
                        onLogout={handleLogout}
                        onOpenAuth={() => setIsAuthOpen(true)}
                        onTriggerTestNotification={handleTriggerTestNotification}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <BottomNav tab={tab} setTab={setTab} unreadCount={totalUnread} isDark={isDark} />
            </>
          )}
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(u) => {
            setUser(u);
            refreshData();
          }}
          isDark={isDark}
        />

        {/* PIN Setup Modal */}
        <PinSetupModal
          isOpen={isPinSetupOpen}
          onClose={() => setIsPinSetupOpen(false)}
          onSuccess={handleSavePinSetup}
          userEmail={user?.email}
          isDark={isDark}
        />

        {/* PIN Recovery Modal */}
        <PinRecoveryModal
          isOpen={isPinRecoveryOpen}
          onClose={() => setIsPinRecoveryOpen(false)}
          onSuccess={handleSaveNewPinFromRecovery}
          storedSecretPhrase={storedSecretPhrase}
          recoveryContact={storedRecoveryContact}
        />

        {/* User / Channel / Group Profile Modal */}
        {activeUserProfileId && (
          activeUserProfileId.startsWith('cg_') ? (
            <ChannelGroupModal
              channelGroupId={activeUserProfileId}
              currentUser={user}
              onClose={() => setActiveUserProfileId(null)}
              onDeleted={() => {
                setActiveChat(null);
                refreshData();
              }}
              onUpdated={() => {
                refreshData();
              }}
              onLeft={() => {
                setActiveChat(null);
                refreshData();
              }}
            />
          ) : (
            <UserProfileModal
              targetUserId={activeUserProfileId}
              currentUserId={user?.id}
              onClose={() => setActiveUserProfileId(null)}
              onOpenChat={(c) => {
                setActiveChat(c);
                setTab('home');
              }}
            />
          )
        )}

        {/* Real-time Incoming Call Banner */}
        {incomingCall && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md p-4 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-sky-500/40 shadow-2xl text-white animate-bounce-short">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${incomingCall.caller?.avatarColor || 'from-sky-400 to-blue-600'} flex items-center justify-center font-bold text-base text-white shadow-lg animate-pulse shrink-0`}>
                  {incomingCall.caller?.initials || '??'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 truncate">
                    <span className="truncate">{incomingCall.caller?.username || 'Пользователь'}</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/30 shrink-0">
                      {incomingCall.callType === 'voice' && 'Голосовой вызов'}
                      {incomingCall.callType === 'video' && 'Видеовызов'}
                      {incomingCall.callType === 'group_conference' && 'Конференция'}
                      {incomingCall.callType === 'channel_stream' && 'Прямой эфир'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">Входящий вызов в ORBIT...</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    socketService.emit('decline_call', { callerId: incomingCall.caller.id });
                    setIncomingCall(null);
                  }}
                  className="h-9 w-9 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg active:scale-95 transition"
                  title="Отклонить"
                >
                  <PhoneOff size={16} />
                </button>
                <button
                  onClick={() => {
                    const targetContact: Contact = {
                      id: incomingCall.caller.id,
                      name: incomingCall.caller.username || 'Пользователь',
                      handle: incomingCall.caller.handle || '@user',
                      initials: incomingCall.caller.initials || 'U',
                      color: incomingCall.caller.avatarColor || 'from-sky-400 to-blue-600',
                      avatarUrl: incomingCall.caller.avatarUrl,
                      last: 'Входящий вызов',
                      time: 'Только что',
                      unread: 0,
                      isOnline: true,
                    };
                    socketService.emit('accept_call', { callerId: incomingCall.caller.id });
                    setActiveChat(targetContact);
                    setIncomingCall(null);
                  }}
                  className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white shadow-lg active:scale-95 transition animate-pulse"
                  title="Ответить"
                >
                  <Phone size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
