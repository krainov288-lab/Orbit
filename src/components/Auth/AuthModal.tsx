import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { cacheService } from '../../services/cacheService';
import { User } from '../../types';
import { validateNickname } from '../../utils/validation';
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  AtSign,
  ArrowRight,
  X,
  AlertCircle,
  ScanFace,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  PhoneCall,
  MessageSquare,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  isDark?: boolean;
}

const COUNTRY_CODES = [
  { code: '+7', flag: '🇷🇺', country: 'Россия' },
  { code: '+7', flag: '🇰🇿', country: 'Казахстан' },
  { code: '+375', flag: '🇧🇾', country: 'Беларусь' },
  { code: '+998', flag: '🇺🇿', country: 'Узбекистан' },
  { code: '+374', flag: '🇦🇲', country: 'Армения' },
  { code: '+995', flag: '🇬🇪', country: 'Грузия' },
  { code: '+992', flag: '🇹🇯', country: 'Таджикистан' },
  { code: '+996', flag: '🇰🇬', country: 'Кыргызстан' },
  { code: '+994', flag: '🇦🇿', country: 'Азербайджан' },
  { code: '+373', flag: '🇲🇩', country: 'Молдова' },
  { code: '+380', flag: '🇺🇦', country: 'Украина' },
  { code: '+90', flag: '🇹🇷', country: 'Турция' },
  { code: '+1', flag: '🇺🇸', country: 'США / Канада' },
  { code: '+49', flag: '🇩🇪', country: 'Германия' },
  { code: '+44', flag: '🇬🇧', country: 'Великобритания' },
  { code: '+971', flag: '🇦🇪', country: 'ОАЭ' },
];

const RESIDENCE_COUNTRIES = [
  'Россия',
  'Казахстан',
  'Беларусь',
  'Узбекистан',
  'Армения',
  'Грузия',
  'Таджикистан',
  'Кыргызстан',
  'Азербайджан',
  'Молдова',
  'Украина',
  'Турция',
  'США',
  'Германия',
  'Великобритания',
  'ОАЭ',
];

const LANGUAGES = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, isDark }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration split name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [handle, setHandle] = useState('');

  // Phone state with country selector
  const [selectedCountryCode, setSelectedCountryCode] = useState(COUNTRY_CODES[0]);
  const [phoneBody, setPhoneBody] = useState('');
  const [phoneError, setPhoneError] = useState(false);

  // Country of residence & language
  const [residenceCountry, setResidenceCountry] = useState('Россия');
  const [platformLanguage, setPlatformLanguage] = useState('ru');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password / Recovery States
  const [forgotPasswordStep, setForgotPasswordStep] = useState<0 | 1 | 2>(0);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Phone verification step after registration form submission
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'call'>('sms');
  const [phoneVerificationStep, setPhoneVerificationStep] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [generatedPhoneCode, setGeneratedPhoneCode] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // 2FA state for login
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [sentTwoFactorCode, setSentTwoFactorCode] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reset 2FA & Phone steps whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRequiresTwoFactor(false);
      setTwoFactorCode('');
      setSentTwoFactorCode(null);
      setPendingUser(null);
      setPhoneVerificationStep(false);
      setPhoneVerificationCode('');
      setError(null);
      setPhoneError(false);
    }
  }, [isOpen]);

  // Countdown timer for code resend
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  const fullPhoneNumber = `${selectedCountryCode.code} ${phoneBody}`.trim();

  const handleClose = () => {
    setRequiresTwoFactor(false);
    setTwoFactorCode('');
    setSentTwoFactorCode(null);
    setPendingUser(null);
    setPhoneVerificationStep(false);
    setError(null);
    setPhoneError(false);
    onClose();
  };

  // Toggle Password Visibility for 3s
  const togglePasswordVisibility = () => {
    if (!showPassword) {
      setShowPassword(true);
      setTimeout(() => setShowPassword(false), 3000);
    } else {
      setShowPassword(false);
    }
  };

  const toggleConfirmPasswordVisibility = () => {
    if (!showConfirmPassword) {
      setShowConfirmPassword(true);
      setTimeout(() => setShowConfirmPassword(false), 3000);
    } else {
      setShowConfirmPassword(false);
    }
  };

  const passwordCriteria = {
    length: password.length >= 8,
    hasUpperLower: /[A-Z]/.test(password) && /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid =
    passwordCriteria.length &&
    passwordCriteria.hasUpperLower &&
    passwordCriteria.hasNumber &&
    passwordCriteria.hasSpecial;

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetEmail) {
      setError('Укажите адрес электронной почты');
      return;
    }
    setLoading(true);
    try {
      const res = await api.requestPasswordReset(resetEmail);
      if (res.code) {
        setToastMessage(`Код сброса пароля: ${res.code}`);
        setTimeout(() => setToastMessage(null), 10000);
      }
      setForgotPasswordStep(2);
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки кода восстановления');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetCode) {
      setError('Введите код подтверждения');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword({
        email: resetEmail,
        code: resetCode,
        newPassword,
      });
      setToastMessage('Пароль успешно изменён! Войдите с новым паролем.');
      setTimeout(() => setToastMessage(null), 5000);
      setForgotPasswordStep(0);
      setIsLogin(true);
      setEmail(resetEmail);
    } catch (err: any) {
      setError(err.message || 'Ошибка сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(false);

    if (isLogin) {
      setLoading(true);
      try {
        const res = await api.login({ email, password });
        const loggedInUser = res.user;

        const is2FA =
          loggedInUser.isTwoFactorEnabled ||
          localStorage.getItem(`orbit_2fa_${loggedInUser.email}`) === 'true';

        if (is2FA) {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setSentTwoFactorCode(code);
          setPendingUser(loggedInUser);
          setRequiresTwoFactor(true);
          setToastMessage(`Код 2FA на почту ${loggedInUser.email}: ${code}`);
          setTimeout(() => setToastMessage(null), 8000);
          setLoading(false);
          return;
        }

        cacheService.clearAllCache();
        onSuccess(loggedInUser);
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Ошибка входа. Проверьте адрес почты и пароль.');
      } finally {
        setLoading(false);
      }
    } else {
      // REGISTRATION - Form Validation
      if (!firstName.trim() || !lastName.trim()) {
        setError('Укажите ваше имя и фамилию');
        return;
      }

      // Handle / Nickname Validation
      const rawHandle = handle.trim() || `${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;
      const handleValidation = validateNickname(rawHandle);
      if (!handleValidation.isValid) {
        setError(handleValidation.error || 'Неверный формат никнейма');
        return;
      }
      const formattedHandle = handleValidation.formattedHandle!;

      const cleanDigits = phoneBody.replace(/[^\d]/g, '');
      if (!phoneBody || cleanDigits.length < 6) {
        setPhoneError(true);
        setError('Заполните обязательное поле номера телефона');
        return;
      }

      if (!email || !email.includes('@') || !email.includes('.')) {
        setError('Укажите корректный адрес электронной почты');
        return;
      }

      if (password !== confirmPassword) {
        setError('Пароли не совпадают. Проверьте повторный ввод.');
        return;
      }

      if (!isPasswordValid) {
        setError('Пароль не соответствует требованиям безопасности.');
        return;
      }

      setLoading(true);
      try {
        const fullUsername = `${firstName.trim()} ${lastName.trim()}`;

        const avail = await api.checkAvailability({
          email,
          handle: formattedHandle,
          phone: fullPhoneNumber,
        });

        if (avail.phoneAvailable === false) {
          setPhoneError(true);
          setError('Пользователь с таким номером телефона уже зарегистрирован.');
          setLoading(false);
          return;
        }

        if (!avail.emailAvailable) {
          setError('Пользователь с такой почтой уже зарегистрирован.');
          setLoading(false);
          return;
        }

        if (!avail.handleAvailable) {
          setError('Этот никнейм уже занят. Выберите другой.');
          setLoading(false);
          return;
        }

        // Trigger Phone Verification Page (Step 2)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedPhoneCode(code);
        setPhoneVerificationStep(true);
        setResendCountdown(30);

        setToastMessage(`💬 Код подтверждения на ${fullPhoneNumber}: ${code}`);
        setTimeout(() => setToastMessage(null), 12000);
      } catch (err: any) {
        setError(err.message || 'Ошибка проверки данных.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResendPhoneCode = (method?: 'sms' | 'call') => {
    const newMethod = method || verificationMethod;
    if (method) setVerificationMethod(method);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedPhoneCode(code);
    setResendCountdown(30);
    setError(null);

    if (newMethod === 'sms') {
      setToastMessage(`💬 Повторный СМС-код на ${fullPhoneNumber}: ${code}`);
    } else {
      setToastMessage(`📞 Голосовой звонок на ${fullPhoneNumber}. Код: ${code}`);
    }
    setTimeout(() => setToastMessage(null), 12000);
  };

  const handleVerifyPhoneAndRegister = async () => {
    setError(null);
    if (!phoneVerificationCode || phoneVerificationCode.trim() !== generatedPhoneCode) {
      setError('Неверный код подтверждения.');
      return;
    }

    setLoading(true);
    try {
      const fullUsername = `${firstName.trim()} ${lastName.trim()}`;
      const formattedHandle = handle
        ? handle.startsWith('@')
          ? handle.trim()
          : `@${handle.trim()}`
        : `@${firstName.trim().toLowerCase()}_${lastName.trim().toLowerCase()}`;

      const res = await api.register({
        username: fullUsername,
        email,
        phone: fullPhoneNumber,
        password,
        handle: formattedHandle,
      });

      // Update profile with country, language and split names
      await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        country: residenceCountry,
        language: platformLanguage,
      });

      cacheService.clearAllCache();
      onSuccess(res.user);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка создания аккаунта.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = () => {
    if (!twoFactorCode || twoFactorCode.trim() !== sentTwoFactorCode) {
      setError('Неверный код 2FA аутентификации');
      return;
    }
    if (pendingUser) {
      onSuccess(pendingUser);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all animate-fade-in text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-slate-700 dark:border-slate-300 animate-bounce max-w-sm text-center">
          <KeyRound size={16} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div
        className={`relative w-full max-w-sm rounded-3xl p-6 shadow-xl border my-auto transition-all ${
          isDark
            ? 'bg-slate-900/95 border-slate-800 text-slate-100'
            : 'bg-white/95 border-slate-100 text-slate-800'
        }`}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center border border-blue-500/20 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">
              {forgotPasswordStep === 1 || forgotPasswordStep === 2
                ? 'Восстановление пароля'
                : phoneVerificationStep
                ? 'Подтверждение телефона'
                : requiresTwoFactor
                ? '2FA Аутентификация'
                : isLogin
                ? 'Вход в ORBIT'
                : 'Регистрация в ORBIT'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {phoneVerificationStep
                ? 'Шаг 2 из 2: Подтверждение номера'
                : requiresTwoFactor
                ? 'Код отправлен на вашу почту'
                : isLogin
                ? 'Авторизация пользователя'
                : 'Заполните данные профиля'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-500">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* PHONE VERIFICATION STEP (PAGE 2 AFTER REGISTRATION FORM) */}
        {phoneVerificationStep ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <div className="font-bold text-slate-800 dark:text-white">
                Подтверждение номера {fullPhoneNumber}
              </div>
              <p className="text-[11px] leading-relaxed">
                Выберите удобный способ получения одноразового кода для завершения регистрации:
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleResendPhoneCode('sms')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    verificationMethod === 'sms'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>СМС-код</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResendPhoneCode('call')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    verificationMethod === 'call'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <PhoneCall size={13} />
                  <span>Голосовой звонок</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                Код подтверждения
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                value={phoneVerificationCode}
                onChange={(e) => setPhoneVerificationCode(e.target.value)}
                placeholder="6 цифр"
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-2xl border border-blue-300 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
              />
            </div>

            <button
              onClick={handleVerifyPhoneAndRegister}
              disabled={loading || phoneVerificationCode.length < 6}
              className="w-full py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Регистрация...</span>
              ) : (
                <>
                  <span>Завершить регистрацию</span>
                  <Check size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPhoneVerificationStep(false)}
              className="w-full py-1 text-center text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              Вернуться к редактированию данных
            </button>
          </div>
        ) : requiresTwoFactor ? (
          /* 2FA LOGIN STEP */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                Код двухфакторной аутентификации
              </label>
              <input
                type="text"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="6 цифр"
                className="w-full text-center text-lg tracking-[0.4em] font-mono py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <button
              onClick={handleVerify2FA}
              className="w-full py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 transition"
            >
              <span>Войти в систему</span>
              <ArrowRight size={15} />
            </button>

            <button
              onClick={() => {
                setRequiresTwoFactor(false);
                setTwoFactorCode('');
              }}
              className="w-full py-2 rounded-2xl text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            >
              Отмена
            </button>
          </div>
        ) : (
          /* MAIN REGISTRATION / LOGIN FORM */
          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <>
                {/* Two Separate Bubbles: First Name and Last Name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                      Имя
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Алексей"
                      className="w-full px-3 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                      Фамилия
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Смирнов"
                      className="w-full px-3 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* Handle / Nickname */}
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                    Имя пользователя (@никнейм)
                  </label>
                  <div className="relative flex items-center">
                    <AtSign size={15} className="absolute left-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@alexey.orbit"
                      className="w-full pl-10 pr-3.5 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* PHONE INPUT WITH COUNTRY CODES AND CONDITIONAL ERROR HIGHLIGHT */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className={`block text-xs font-semibold ${
                        phoneError ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {phoneError ? 'обязательное поле' : 'Номер телефона'}
                    </label>
                  </div>
                  <div
                    className={`flex items-center rounded-2xl border transition ${
                      phoneError
                        ? 'border-red-500 border-2 bg-red-50/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50'
                    }`}
                  >
                    {/* Country code tab */}
                    <select
                      value={selectedCountryCode.country}
                      onChange={(e) => {
                        const found = COUNTRY_CODES.find((c) => c.country === e.target.value);
                        if (found) setSelectedCountryCode(found);
                      }}
                      className="px-2.5 py-2 text-xs font-semibold bg-transparent border-r border-slate-200 dark:border-slate-800 outline-none text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c, i) => (
                        <option key={i} value={c.country} className="bg-white dark:bg-slate-900">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>

                    <input
                      type="tel"
                      required
                      value={phoneBody}
                      onChange={(e) => {
                        setPhoneBody(e.target.value);
                        setPhoneError(false);
                      }}
                      placeholder="(999) 000-00-00"
                      className="w-full px-3 py-2 text-xs bg-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Residence Country & Language */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-500 dark:text-slate-400">
                      Страна проживания
                    </label>
                    <select
                      value={residenceCountry}
                      onChange={(e) => setResidenceCountry(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none"
                    >
                      {RESIDENCE_COUNTRIES.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-slate-900">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1 text-slate-500 dark:text-slate-400">
                      Язык платформы
                    </label>
                    <select
                      value={platformLanguage}
                      onChange={(e) => setPlatformLanguage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900">
                          {l.flag} {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                Электронная почта
              </label>
              <div className="relative flex items-center">
                <Mail size={15} className="absolute left-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alexey@orbit.app"
                  className="w-full pl-10 pr-3.5 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Пароль
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setForgotPasswordStep(1);
                      setResetEmail(email);
                    }}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock size={15} className="absolute left-3.5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition"
                  title="Показать пароль на 3 секунды"
                >
                  {showPassword ? <EyeOff size={15} className="text-blue-500" /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field for Registration */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Подтверждение пароля
                </label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3.5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition"
                  >
                    {showConfirmPassword ? <EyeOff size={15} className="text-blue-500" /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 transition disabled:opacity-50 mt-1"
            >
              {loading ? (
                <span className="animate-pulse">Обработка...</span>
              ) : isLogin ? (
                <>
                  <span>Войти в аккаунт</span>
                  <ArrowRight size={15} />
                </>
              ) : (
                <>
                  <span>Зарегистрироваться</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>

            {/* Toggle Login/Register */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(null);
                  setPhoneError(false);
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
