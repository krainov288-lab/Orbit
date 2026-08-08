import React, { useState } from 'react';
import { ShieldCheck, Mail, Smartphone, PhoneCall, Key, CheckCircle, ArrowRight, X, AlertCircle } from 'lucide-react';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string, secretPhrase: string, recoveryContact: string) => void;
  userEmail?: string;
  isDark?: boolean;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  isDark,
}) => {
  const [step, setStep] = useState<'pin' | 'phrase' | 'verify'>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const [secretPhrase, setSecretPhrase] = useState('');
  const [phraseError, setPhraseError] = useState('');

  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [contactValue, setContactValue] = useState(userEmail || 'user@orbit.app');
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNextPin = () => {
    if (pin.length < 4) {
      setPinError('ПИН-код должен состоять минимум из 4 цифр');
      return;
    }
    if (pin !== confirmPin) {
      setPinError('ПИН-коды не совпадают');
      return;
    }
    setPinError('');
    setStep('phrase');
  };

  const handleNextPhrase = () => {
    if (!secretPhrase.trim() || secretPhrase.trim().length < 3) {
      setPhraseError('Введите секретную фразу (минимум 3 символа)');
      return;
    }
    setPhraseError('');
    setStep('verify');
  };

  const handleSendCode = () => {
    if (!contactValue.trim()) {
      setCodeError('Укажите контактные данные для получения кода');
      return;
    }
    // Generate simulated 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(code);
    setCodeError('');
    setToastMessage(`Код подтверждения (${channel === 'email' ? 'Email' : 'СМС'}): ${code}`);
    setTimeout(() => {
      setToastMessage(null);
    }, 8000);
  };

  const handleFinalizeSetup = () => {
    if (!sentCode) {
      setCodeError('Запросите код подтверждения');
      return;
    }
    if (inputCode.trim() !== sentCode) {
      setCodeError('Неверный код подтверждения');
      return;
    }
    onSuccess(pin, secretPhrase, contactValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      {/* Toast Alert for Verification Code */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-300 text-xs font-medium shadow-xl text-center whitespace-nowrap animate-fade-in pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-sm rounded-3xl p-6 glass-card text-primary border border-white/40 dark:border-slate-800 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass-button flex items-center justify-center text-muted hover:text-primary transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl glass-button text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Установка ПИН-кода</h3>
            <p className="text-xs text-muted">Защита доступа к ORBIT</p>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between gap-1 py-1">
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'pin' ? 'bg-blue-500' : 'bg-blue-500/30'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'phrase' ? 'bg-blue-500' : step === 'verify' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'verify' ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
        </div>

        {/* STEP 1: PIN Input */}
        {step === 'pin' && (
          <div className="space-y-4 animate-fade-in pt-1">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">Придумайте ПИН-код (4 цифры)</label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-2xl border border-custom bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">Повторите ПИН-код</label>
              <input
                type="password"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-2xl border border-custom bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {pinError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={14} />
                <span>{pinError}</span>
              </div>
            )}

            <button
              onClick={handleNextPin}
              className="w-full py-2.5 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <span>Далее: Секретная фраза</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* STEP 2: Secret Phrase */}
        {step === 'phrase' && (
          <div className="space-y-4 animate-fade-in pt-1">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Секретная фраза для восстановления</label>
              <p className="text-[11px] text-muted mb-2">
                Запомните её. Она понадобится для восстановления доступа при забытом ПИН-коде.
              </p>
              <div className="relative">
                <Key size={16} className="absolute left-3.5 top-3 text-muted" />
                <input
                  type="text"
                  value={secretPhrase}
                  onChange={(e) => setSecretPhrase(e.target.value)}
                  placeholder="Например: Майами2026 или ГолубойОкеан"
                  className="w-full pl-10 pr-3 py-2.5 text-xs rounded-2xl border border-custom bg-white/50 dark:bg-slate-800/50 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {phraseError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={14} />
                <span>{phraseError}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep('pin')}
                className="w-1/3 py-2.5 rounded-2xl glass-button text-xs font-semibold text-secondary"
              >
                Назад
              </button>
              <button
                onClick={handleNextPhrase}
                className="flex-1 py-2.5 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <span>Подтверждение</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Verification */}
        {step === 'verify' && (
          <div className="space-y-4 animate-fade-in pt-1">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-2">Способ подтверждения</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChannel('email');
                    setContactValue(userEmail || 'user@orbit.app');
                    setSentCode(null);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold transition ${
                    channel === 'email'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-custom text-secondary'
                  }`}
                >
                  <Mail size={15} />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setChannel('sms');
                    setContactValue('+7 (999) 000-11-22');
                    setSentCode(null);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold transition ${
                    channel === 'sms'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-custom text-secondary'
                  }`}
                >
                  <Smartphone size={15} />
                  <span>СМС</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                {channel === 'email' ? 'Адрес Email' : 'Номер телефона'}
              </label>
              <input
                type="text"
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-2xl border border-custom bg-white/50 dark:bg-slate-800/50 outline-none text-primary"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSendCode}
                className="w-full py-2 rounded-2xl glass-button text-xs font-semibold text-blue-500 flex items-center justify-center gap-1.5"
              >
                <span>{sentCode ? 'Запросить код повторно' : 'Получить код'}</span>
              </button>

              {sentCode && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-secondary">Код из {channel === 'email' ? 'сообщения' : 'СМС'}</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="6 цифр"
                    className="w-full text-center tracking-widest text-base py-2 rounded-2xl border border-custom bg-white/50 dark:bg-slate-800/50 outline-none"
                  />
                </div>
              )}
            </div>

            {codeError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <AlertCircle size={14} />
                <span>{codeError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep('phrase')}
                className="w-1/3 py-2.5 rounded-2xl glass-button text-xs font-semibold text-secondary"
              >
                Назад
              </button>
              <button
                onClick={handleFinalizeSetup}
                className="flex-1 py-2.5 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
              >
                <CheckCircle size={15} />
                <span>Активировать ПИН</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
