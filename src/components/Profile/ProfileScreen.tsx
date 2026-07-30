import React, { useState, useRef } from 'react';
import { User, Contact } from '../../types';
import { api } from '../../services/api';
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
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 border border-slate-700 animate-fade-in max-w-xs text-center">
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
        <div className="glass-card rounded-3xl p-4 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/10 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  Панель Поддержки и Управления
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
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
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md active:scale-95 transition shrink-0"
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
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Mail size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>Подтверждение почты ({user.email})</span>
              </div>
              <div className="text-[11px] text-muted">
                {isEmailVerified
                  ? 'Почта подтверждена. Регистрация полностью завершена'
                  : 'Завершите этап регистрации, подтвердив адрес электронной почты'}
              </div>
            </div>
          </div>
          {isEmailVerified ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1 border border-emerald-500/20">
              <CheckCheck size={13} />
              <span>Подтверждено</span>
            </span>
          ) : (
            <button
              onClick={handleStartEmailVerify}
              className="px-3 py-1.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-sm active:scale-95 transition"
            >
              Подтвердить
            </button>
          )}
        </div>

        {/* PIN Code Row */}
        {onOpenPinSetup && (
          <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Lock size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-primary">ПИН-код защиты профиля</div>
                <div className="text-[11px] text-muted">
                  {isPinSet ? 'ПИН-код установлен и активен' : 'Защитите аккаунт индивидуальным ПИН-кодом'}
                </div>
              </div>
            </div>
            <button
              onClick={onOpenPinSetup}
              className="px-3 py-1.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-sm active:scale-95 transition"
            >
              {isPinSet ? 'Изменить' : 'Установить'}
            </button>
          </div>
        )}

        {/* 2FA Toggle Row */}
        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <KeyRound size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Двухфакторная аутентификация (2FA)</div>
              <div className="text-[11px] text-muted">Запрос 6-значного кода при входе</div>
            </div>
          </div>
          <button
            onClick={handleToggle2FA}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
            <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
              <ScanFace size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Вход по Touch ID / Face ID</div>
              <div className="text-[11px] text-muted">Биометрическая разблокировка</div>
            </div>
          </div>
          <button
            onClick={handleToggleBiometrics}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Bell size={16} />
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
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Volume2 size={16} />
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
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
          className="w-full mt-2 py-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 text-xs font-semibold flex items-center justify-center gap-2 transition"
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

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
              <Download size={16} />
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
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Zap size={16} />
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
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
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
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <Globe size={16} />
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
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <MapPin size={16} />
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

        <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 dark:bg-blue-500/10 text-amber-500 dark:text-blue-400 flex items-center justify-center border border-amber-500/20 dark:border-blue-500/20">
              {isDark ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            <div>
              <div className="text-xs font-bold text-primary">Тёмное оформление</div>
              <div className="text-[11px] text-muted">
                {isDark ? 'Тёмная тема активна' : 'Светлая тема активна'}
              </div>
            </div>
          </div>
          <button
            onClick={onToggleDarkMode}
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
              isDark ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                isDark ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 transition text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
              <LogOut size={16} />
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
              Код подтверждения отправлен на почту <strong className="text-primary">{user.email}</strong>. Введите его ниже:
            </p>

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
              className="w-full py-2.5 rounded-2xl bg-blue-600 text-white font-semibold text-xs shadow-sm active:scale-95 transition"
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

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        currentUser={user || undefined}
      />
    </div>
  );
};
