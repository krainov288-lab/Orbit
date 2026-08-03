import React, { useState, useRef } from 'react';
import { User, Contact, ChatFolder } from '../../types';
import { api } from '../../services/api';
import { cacheService } from '../../services/cacheService';
import { AdminPanelModal } from './AdminPanelModal';
import { useLanguage, SupportedLanguage } from '../../context/LanguageContext';
import { validateNickname } from '../../utils/validation';
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
  Globe,
  MapPin,
  Users,
  UserCheck,
  Search,
  FolderKanban,
  BarChart3,
  Folder,
  FolderMinus,
  Sparkles,
} from 'lucide-react';

interface ProfileScreenProps {
  user: User | null;
  contacts: Contact[];
  isDark: boolean;
  isPinSet?: boolean;
  onOpenPinSetup?: () => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onTriggerTestNotification?: (title: string, body: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  contacts,
  isDark,
  isPinSet,
  onOpenPinSetup,
  onToggleDarkMode,
  onLogout,
  onOpenAuth,
  onTriggerTestNotification,
}) => {
  const { language, setLanguage, t } = useLanguage();

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

  // Notification Preferences
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => localStorage.getItem('orbit_notif_push') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => localStorage.getItem('orbit_notif_sound') !== 'false');

  // Media & Data Saver Preferences
  const [autoDownloadMedia, setAutoDownloadMedia] = useState<boolean>(() => localStorage.getItem('orbit_auto_download_media') !== 'false');
  const [dataSaverMode, setDataSaverMode] = useState<boolean>(() => localStorage.getItem('orbit_data_saver_mode') === 'true');

  // Language & Country Preferences
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => localStorage.getItem('orbit_app_lang') || 'Русский');
  const [selectedCountry, setSelectedCountry] = useState<string>(() => localStorage.getItem('orbit_app_country') || 'Россия');

  // Followers / Following Modals State
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [socialSearchQuery, setSocialSearchQuery] = useState('');

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
      if (saved) return JSON.parse(saved);
    } catch {}
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
      await api.updateProfile({ username: editingUsername.trim() });
      if (user) user.username = editingUsername.trim();
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
      await api.updateProfile({ handle: formatted });
      if (user) user.handle = formatted;
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
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await api.updateProfile({ avatarUrl: dataUrl });
        if (user) user.avatarUrl = dataUrl;
        setToastMessage('Аватар профиля успешно обновлён');
        setTimeout(() => setToastMessage(null), 3000);
      } catch {
        setToastMessage('Ошибка сохранения аватара');
        setTimeout(() => setToastMessage(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartEmailVerify = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentEmailCode(code);
    setShowEmailVerifyModal(true);
    setToastMessage(`Код подтверждения email (${user?.email}): ${code}`);
    setTimeout(() => setToastMessage(null), 10000);
  };

  const handleToggleEmailVerify = () => {
    if (isEmailVerified) {
      setIsEmailVerified(false);
      if (user) {
        localStorage.setItem(`orbit_email_verified_${user.id}`, 'false');
        api.updateProfile({ isEmailVerified: false }).catch(() => {});
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
      await api.updateProfile({ isEmailVerified: true }).catch(() => {});
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
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-fade-in max-w-xs text-center">
          <CheckCircle2 size={16} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
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
              className="h-16 w-16 rounded-full object-cover shadow-md border-2 border-blue-500/30"
            />
          ) : (
            <div
              className={`h-16 w-16 rounded-full bg-gradient-to-br ${user.avatarColor} flex items-center justify-center text-white text-lg font-semibold shadow-md`}
            >
              {user.initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={18} className="text-white" />
          </div>
          <button
            type="button"
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900"
            title="Загрузить аватар"
          >
            <Camera size={12} />
          </button>
        </div>

        {/* Compact User Data (Name, Nickname, Phone) */}
        <div className="mt-2 flex flex-col items-center gap-1 w-full">
          {/* Name - Editable */}
          {isEditingUsername ? (
            <div className="flex items-center gap-1.5 justify-center w-full max-w-[220px]">
              <input
                type="text"
                autoFocus
                value={editingUsername}
                onChange={(e) => setEditingUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
                className="w-full text-center text-sm font-bold px-2.5 py-1 rounded-xl border border-sky-400 bg-white dark:bg-slate-900 text-primary outline-none shadow-xs"
              />
              <button
                onClick={handleSaveUsername}
                className="p-1.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition shrink-0 shadow-xs"
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
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition group"
              title="Нажмите для редактирования имени"
            >
              <span className="text-base font-bold text-primary leading-tight">{user.username}</span>
              <Pencil size={13} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
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
              <span className="text-xs text-muted font-medium">{user.handle}</span>
              <Pencil size={11} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
            </div>
          )}

          {/* Phone (Unchangeable plain text, no blue outline) */}
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
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
              <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
              <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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

      {/* Media & Data Saver Settings */}
      <div className="glass-card rounded-3xl p-3 border border-white/60 dark:border-slate-800 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center justify-between">
          <span>Данные, медиа & экономия трафика</span>
          <HardDrive size={13} />
        </div>

        {/* Folder Analytics Tab Row */}
        <div
          onClick={() => setShowFolderStatsModal(true)}
          className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs flex items-center justify-center shrink-0">
              <FolderKanban size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>Аналитика и статистика папок</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-400/30">
                  {organizationPercentage}% организовано
                </span>
              </div>
              <div className="text-[11px] text-muted">Анализ распределения чатов и сообщений</div>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <Download size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Автозагрузка фото и видео</div>
              <div className="text-[11px] text-muted">Сохранение в память устройства</div>
            </div>
          </div>
          <button
            onClick={() => {
              const val = !autoDownloadMedia;
              setAutoDownloadMedia(val);
              localStorage.setItem('orbit_auto_download_media', val ? 'true' : 'false');
            }}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              autoDownloadMedia ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                autoDownloadMedia ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Экономия трафика</div>
              <div className="text-[11px] text-muted">Предпросмотр обложек медиа в пикселях</div>
            </div>
          </div>
          <button
            onClick={() => {
              const val = !dataSaverMode;
              setDataSaverMode(val);
              localStorage.setItem('orbit_data_saver_mode', val ? 'true' : 'false');
            }}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
              dataSaverMode ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                dataSaverMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
            <div className="h-9 w-9 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 shadow-2xs flex items-center justify-center shrink-0">
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
          <div className="relative w-full max-w-sm rounded-3xl p-5 glass-card border border-white/60 dark:border-slate-800 text-primary shadow-xl space-y-3">
            <button
              onClick={() => {
                setShowFollowersModal(false);
                setSocialSearchQuery('');
              }}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">Подписчики</h3>
                <p className="text-[11px] text-muted">Подписаны на вас ({followersList.length})</p>
              </div>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={socialSearchQuery}
                onChange={(e) => setSocialSearchQuery(e.target.value)}
                placeholder="Поиск по подписчикам..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-900 border border-custom outline-none"
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 no-scrollbar pt-1">
              {followersList
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
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {f.name ? f.name.slice(0, 2).toUpperCase() : 'OR'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-primary">{f.name}</div>
                        <div className="text-[10px] text-muted">{f.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFollowersList((prev) => prev.filter((i) => i.id !== f.id));
                        setToastMessage(`Пользователь ${f.name} удален из подписчиков`);
                        setTimeout(() => setToastMessage(null), 2500);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-red-500 hover:text-white text-primary text-[10px] font-bold transition"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              {followersList.length === 0 && (
                <div className="text-center text-xs text-muted py-6">У вас пока нет подписчиков</div>
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

    </div>
  );
};
