import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Users,
  UserPlus,
  ShieldAlert,
  Share2,
  Check,
  Ban,
  RefreshCw,
  MessageSquare,
  UserCheck,
  Trash2,
  AlertTriangle,
  Radio,
  Megaphone,
  Loader2,
  Plus
} from 'lucide-react';
import { Contact } from '../../types';
import { api } from '../../services/api';

interface ContactSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (contact: Contact) => void;
  onRefreshContacts?: () => void;
  onCreateChannelGroup?: () => void;
}

// Demo phonebook contacts to offer one-click sync test
const DEMO_PHONEBOOK = [
  { name: 'Алексей Смирнов', phone: '+7 999 123-45-67', email: 'alexey@orbit.app' },
  { name: 'Мария Иванова', phone: '+7 999 234-56-78', email: 'maria@orbit.app' },
  { name: 'Дмитрий Петров', phone: '+7 999 345-67-89', email: 'dmitry@orbit.app' },
  { name: 'Елена Соколова', phone: '+7 916 555-01-23', email: 'elena@example.com' },
  { name: 'Игорь Кузнецов', phone: '+7 925 777-88-99', email: 'igor@company.ru' },
  { name: 'Ольга Морозова', phone: '+7 903 111-22-33', email: 'olga@gmail.com' },
];

export const ContactSyncModal: React.FC<ContactSyncModalProps> = ({
  isOpen,
  onClose,
  onOpenChat,
  onRefreshContacts,
  onCreateChannelGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'sync' | 'search' | 'blocked'>('sync');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [matchedUsers, setMatchedUsers] = useState<any[]>([]);
  const [unregisteredContacts, setUnregisteredContacts] = useState<any[]>([]);
  const [hasSynced, setHasSynced] = useState(false);

  // Blocked list state
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // Report Modal State
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState(' Спам или реклама');
  const [reportComment, setReportComment] = useState('');
  const [blockAfterReport, setBlockAfterReport] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Contact Search State (inside Contacts tab)
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Groups & Channels Search State
  const [channelsSearchQuery, setChannelsSearchQuery] = useState('');
  const [channelResults, setChannelResults] = useState<any[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);
  const [joiningChannelId, setJoiningChannelId] = useState<string | null>(null);

  // Status Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'blocked') {
        fetchBlockedUsers();
      } else if (activeTab === 'search') {
        handleChannelsSearch('');
      }
    }
  }, [isOpen, activeTab]);

  const handleChannelsSearch = async (query: string) => {
    setChannelsSearchQuery(query);
    setIsSearchingChannels(true);
    try {
      const results = await api.searchChannelsGroups(query);
      setChannelResults(results || []);
    } catch (e) {
      console.error('Channel search error:', e);
    } finally {
      setIsSearchingChannels(false);
    }
  };

  const handleJoinChannel = async (cg: any) => {
    setJoiningChannelId(cg.id);
    try {
      await api.joinChannelGroup(cg.id);
      showToast(`Вы присоединились к "${cg.title}"!`);
      setChannelResults((prev) =>
        prev.map((item) => (item.id === cg.id ? { ...item, isMember: true } : item))
      );
      if (onRefreshContacts) onRefreshContacts();
    } catch (err: any) {
      showToast(err.message || 'Ошибка вступления в группу');
    } finally {
      setJoiningChannelId(null);
    }
  };

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true);
    try {
      const list = await api.getBlockedUsers();
      setBlockedUsers(list);
    } catch (e) {
      console.error('Failed to fetch blocked users:', e);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.searchUsers(query);
      setSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Device Sync Handler
  const handleDeviceSync = async (contactsToSync = DEMO_PHONEBOOK) => {
    setIsSyncing(true);
    try {
      // Attempt device Web Contacts Picker API if available
      let listToProcess = contactsToSync;
      if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
        try {
          const props = ['name', 'tel', 'email'];
          const opts = { multiple: true };
          const deviceContacts = await (navigator as any).contacts.select(props, opts);
          if (deviceContacts && deviceContacts.length > 0) {
            listToProcess = deviceContacts.map((c: any) => ({
              name: c.name?.[0] || 'Без имени',
              phone: c.tel?.[0] || '',
              email: c.email?.[0] || '',
            }));
          }
        } catch (e) {
          console.log('Web Contacts Picker not granted or cancelled, falling back to sync engine', e);
        }
      }

      const res = await api.syncContacts(listToProcess);
      setMatchedUsers(res.matched || []);
      setUnregisteredContacts(res.unregistered || []);
      setHasSynced(true);
      showToast(`Синхронизировано контактов: ${res.totalSynced}. Найдено в Orbit: ${res.matched.length}`);
      if (onRefreshContacts) onRefreshContacts();
    } catch (err: any) {
      showToast(err.message || 'Ошибка синхронизации контактов');
    } finally {
      setIsSyncing(false);
    }
  };

  // Action Handlers
  const handleRemoveContact = async (contactUserId: string) => {
    try {
      await api.removeContact(contactUserId);
      showToast('Контакт удалён из вашего списка');
      setMatchedUsers((prev) => prev.filter((u) => u.id !== contactUserId));
      if (onRefreshContacts) onRefreshContacts();
    } catch (e: any) {
      showToast(e.message || 'Ошибка удаления контакта');
    }
  };

  const handleBlockUser = async (targetUserId: string) => {
    try {
      await api.blockUser(targetUserId);
      showToast('Пользователь заблокирован');
      setMatchedUsers((prev) => prev.filter((u) => u.id !== targetUserId));
      setSearchResults((prev) => prev.filter((u) => u.id !== targetUserId));
      if (onRefreshContacts) onRefreshContacts();
      if (activeTab === 'blocked') fetchBlockedUsers();
    } catch (e: any) {
      showToast(e.message || 'Ошибка блокировки');
    }
  };

  const handleUnblockUser = async (targetUserId: string) => {
    try {
      await api.unblockUser(targetUserId);
      showToast('Пользователь разблокирован');
      fetchBlockedUsers();
      if (onRefreshContacts) onRefreshContacts();
    } catch (e: any) {
      showToast(e.message || 'Ошибка разблокировки');
    }
  };

  const handleInviteContact = (contact: any) => {
    const inviteText = `Привет! Присоединяйся ко мне в безопасном мессенджере Orbit: https://orbit.app/invite`;
    if (navigator.share) {
      navigator.share({
        title: 'Приглашение в Orbit',
        text: inviteText,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteText);
      showToast('Текст приглашения скопирован в буфер обмена!');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;

    setIsSubmittingReport(true);
    try {
      await api.reportUser({
        targetUserId: reportTarget.id,
        reason: reportReason,
        comment: reportComment,
        blockAfterReport,
      });
      showToast('Жалоба отправлена модераторам');
      if (blockAfterReport) {
        setMatchedUsers((prev) => prev.filter((u) => u.id !== reportTarget.id));
        setSearchResults((prev) => prev.filter((u) => u.id !== reportTarget.id));
        if (onRefreshContacts) onRefreshContacts();
      }
      setReportTarget(null);
      setReportComment('');
    } catch (e: any) {
      showToast(e.message || 'Ошибка отправки жалобы');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-primary">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-full glass-card bg-blue-500/20 text-blue-500 text-xs font-medium shadow-2xl flex items-center gap-2 border border-blue-500/30">
          <Check size={14} className="text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-md h-[540px] max-h-[85vh] rounded-3xl p-5 shadow-2xl glass-card border border-white/20 dark:border-white/10 text-primary flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-custom shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl glass-button text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">Контакты, группы, каналы</h3>
              <p className="text-[11px] text-muted">Синхронизация, поиск и безопасность</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full glass-button flex items-center justify-center text-secondary hover:text-primary transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1.5 my-3.5 border-b border-custom pb-2.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'sync'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Users size={13} />
            <span>Контакты</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'search'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Radio size={13} />
            <span>Группы / Каналы</span>
          </button>

          <button
            onClick={() => setActiveTab('blocked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'blocked'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Ban size={13} />
            <span>Заблокировано</span>
          </button>
        </div>

        {/* Tab content area with fixed size wrapper */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* TAB 1: PHONE CONTACT SYNC & SEARCH */}
          {activeTab === 'sync' && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              {/* Search bubble at the top of Contacts tab */}
              <div className="relative flex items-center shrink-0">
                <Search size={15} className="absolute left-3.5 text-slate-400" />
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setContactSearchQuery(q);
                    if (q.trim()) {
                      handleSearch(q);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  placeholder="Поиск по контактам, имени, @username..."
                  className="w-full pl-10 pr-9 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
                {contactSearchQuery && (
                  <button
                    onClick={() => {
                      setContactSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {contactSearchQuery.trim() ? (
                /* LIVE CONTACT SEARCH RESULTS */
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 no-scrollbar pr-1">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-400 gap-2">
                      <RefreshCw size={20} className="animate-spin text-blue-500" />
                      <span>Поиск пользователей...</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-400 text-center space-y-2">
                      <Search size={22} className="text-slate-400" />
                      <span>Пользователи не найдены</span>
                    </div>
                  ) : (
                    searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-xs font-bold text-white shadow-xs`}>
                            {user.initials}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-white">{user.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{user.handle}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onOpenChat(user);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-medium transition flex items-center gap-1 shadow-xs"
                          >
                            <MessageSquare size={13} />
                            <span>Написать</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* REGULAR SYNC CONTENT */
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 no-scrollbar pr-1">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-blue-500 text-white shrink-0">
                        <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                          Синхронизация контактов
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Найдите знакомых из вашей телефонной книги, зарегистрированных в Orbit Messenger.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={() => handleDeviceSync()}
                        disabled={isSyncing}
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-98 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                        <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать контакты'}</span>
                      </button>
                    </div>
                  </div>

                  {/* SYNC RESULTS */}
                  {hasSynced ? (
                    <div className="space-y-4">
                      {/* Matched Users */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <UserCheck size={14} className="text-emerald-500" />
                            <span>Зарегистрированы в Orbit ({matchedUsers.length})</span>
                          </span>
                        </div>

                        {matchedUsers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                            Пользователи из выбранной книги пока не найдены в мессенджере.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {matchedUsers.map((user) => (
                              <div
                                key={user.id}
                                className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between shadow-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-xs font-bold text-white shadow-xs`}>
                                      {user.initials}
                                    </div>
                                    {user.isOnline && (
                                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                      <span>{user.name}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {user.handle} • {user.phone}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      onOpenChat({
                                        id: user.id,
                                        name: user.name,
                                        initials: user.initials,
                                        color: user.color,
                                        handle: user.handle,
                                        last: '',
                                        time: '',
                                        unread: 0,
                                        isOnline: user.isOnline,
                                      });
                                      onClose();
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-medium transition flex items-center gap-1 shadow-xs"
                                  >
                                    <MessageSquare size={13} />
                                    <span>Написать</span>
                                  </button>

                                  <button
                                    onClick={() => handleRemoveContact(user.id)}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                    title="Удалить из списка"
                                  >
                                    <Trash2 size={14} />
                                  </button>

                                  <button
                                    onClick={() => setReportTarget({ id: user.id, name: user.name })}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition"
                                    title="Пожаловаться или заблокировать"
                                  >
                                    <ShieldAlert size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Unregistered Contacts */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <UserPlus size={14} className="text-blue-500" />
                            <span>Пригласить в Orbit ({unregisteredContacts.length})</span>
                          </span>
                        </div>

                        {unregisteredContacts.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                            Все контакты из списка уже зарегистрированы!
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {unregisteredContacts.map((contact) => (
                              <div
                                key={contact.id}
                                className="p-3 rounded-2xl bg-white/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                              >
                                <div>
                                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    {contact.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {contact.phone}
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleInviteContact(contact)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[11px] font-medium transition flex items-center gap-1"
                                >
                                  <Share2 size={13} />
                                  <span>Пригласить</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 space-y-3 flex flex-col items-center justify-center h-48">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <Users size={28} />
                      </div>
                      <p className="text-xs max-w-xs leading-relaxed">
                        Нажмите «Синхронизировать контакты», чтобы найти своих друзей в Orbit Messenger.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GROUPS & CHANNELS PUBLIC SEARCH */}
          {activeTab === 'search' && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 flex items-center">
                  <Search size={16} className="absolute left-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={channelsSearchQuery}
                    onChange={(e) => handleChannelsSearch(e.target.value)}
                    placeholder="Поиск публичных групп и каналов..."
                    className="w-full pl-10 pr-9 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                  {channelsSearchQuery && (
                    <button
                      onClick={() => handleChannelsSearch('')}
                      className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {onCreateChannelGroup && (
                  <button
                    onClick={() => {
                      onClose();
                      onCreateChannelGroup();
                    }}
                    className="h-9 px-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1 text-xs font-bold shadow-xs active:scale-95 transition shrink-0"
                    title="Создать канал или группу"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span>Создать</span>
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 no-scrollbar pr-1">
                {isSearchingChannels ? (
                  <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-400 gap-2">
                    <RefreshCw size={20} className="animate-spin text-blue-500" />
                    <span>Поиск публичных каналов и групп...</span>
                  </div>
                ) : channelResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-44 text-xs text-slate-400 text-center space-y-2 px-4">
                    <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <Radio size={24} />
                    </div>
                    <span>
                      {channelsSearchQuery
                        ? 'Публичные каналы и группы не найдены'
                        : 'Введите название или @ссылку публичной группы или канала'}
                    </span>
                  </div>
                ) : (
                  channelResults.map((cg) => {
                    const isChannelItem = cg.type?.includes('channel');
                    return (
                      <div
                        key={cg.id}
                        className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-xs hover:border-blue-200 dark:hover:border-slate-600 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${cg.avatarColor || 'from-sky-400 to-indigo-500'} flex items-center justify-center text-xs font-bold text-white shadow-xs overflow-hidden shrink-0`}>
                            {cg.avatarUrl ? (
                              <img src={cg.avatarUrl} alt={cg.title} className="h-full w-full object-cover" />
                            ) : (
                              cg.title?.[0]?.toUpperCase() || 'C'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                              <span className="truncate">{cg.title}</span>
                              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase shrink-0 ${isChannelItem ? 'bg-sky-500/10 text-sky-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                {isChannelItem ? 'Канал' : 'Группа'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              {cg.handle} • {cg.memberIds?.length || 1} участников
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {cg.isMember ? (
                            <button
                              onClick={() => {
                                onOpenChat({
                                  id: cg.id,
                                  name: cg.title,
                                  initials: cg.title[0],
                                  color: cg.avatarColor || 'from-sky-400 to-indigo-500',
                                  handle: cg.handle,
                                  isChannelGroup: true,
                                  channelGroupType: cg.type,
                                  avatarUrl: cg.avatarUrl,
                                  last: '',
                                  time: '',
                                  unread: 0,
                                });
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition"
                            >
                              Открыть
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoinChannel(cg)}
                              disabled={joiningChannelId === cg.id}
                              className="px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-[11px] font-semibold transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                            >
                              {joiningChannelId === cg.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Plus size={13} />
                              )}
                              <span>Присоединиться</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: BLOCKED USERS */}
          {activeTab === 'blocked' && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 no-scrollbar pr-1">
              {loadingBlocked ? (
                <div className="flex flex-col items-center justify-center h-40 text-xs text-slate-400 gap-2">
                  <RefreshCw size={20} className="animate-spin text-slate-400" />
                  <span>Загрузка списка...</span>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-xs text-slate-400 text-center space-y-2 px-4">
                  <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                    <Ban size={24} />
                  </div>
                  <span className="font-medium text-slate-600 dark:text-slate-300">Список пуст</span>
                  <p className="text-[11px] text-slate-400">Заблокированные пользователи не смогут отправлять вам сообщения.</p>
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center text-xs font-bold text-white opacity-75`}>
                        {user.initials}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white opacity-80">
                          {user.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{user.handle}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnblockUser(user.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold transition active:scale-95"
                    >
                      Разблокировать
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* REPORT & BLOCK MODAL SUB-COMPONENT */}
      {reportTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <AlertTriangle size={16} />
                <span>Жалоба на пользователя</span>
              </div>
              <button
                onClick={() => setReportTarget(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs mb-3 font-medium">
              Пользователь: <span className="text-blue-500">{reportTarget.name}</span>
            </p>

            <form onSubmit={handleSubmitReport} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Укажите причину:
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="Спам или реклама">Спам или реклама</option>
                  <option value="Оскорбление или домогательство">Оскорбление или домогательство</option>
                  <option value="Мошенничество или фишинг">Мошенничество или фишинг</option>
                  <option value="Вредоносные ссылки">Вредоносные ссылки</option>
                  <option value="Другое">Другое</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Комментарий (опционально):
                </label>
                <textarea
                  rows={2}
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  placeholder="Дополнительные детали..."
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="blockCheck"
                  checked={blockAfterReport}
                  onChange={(e) => setBlockAfterReport(e.target.checked)}
                  className="rounded accent-amber-500"
                />
                <label htmlFor="blockCheck" className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Также заблокировать пользователя
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportTarget(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReport}
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition shadow-xs flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <ShieldAlert size={14} />
                  <span>Отправить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
