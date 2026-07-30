import React, { useState } from 'react';
import { KeyRound, Mail, Smartphone, PhoneCall, ShieldAlert, CheckCircle, ArrowRight, X, AlertCircle } from 'lucide-react';

interface PinRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPin: string) => void;
  storedSecretPhrase: string;
  recoveryContact?: string;
}

export const PinRecoveryModal: React.FC<PinRecoveryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  storedSecretPhrase,
  recoveryContact = 'user@orbit.app',
}) => {
  const [method, setMethod] = useState<'email' | 'sms' | 'call'>('email');
  const [contactInput, setContactInput] = useState(recoveryContact);
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [inputPhrase, setInputPhrase] = useState('');

  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const [step, setStep] = useState<'verify' | 'new_pin'>('verify');
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendRecoveryCode = () => {
    if (!contactInput.trim()) {
      setErrorMsg('Укажите контактные данные');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(code);
    setErrorMsg('');

    let methodLabel = 'Email';
    if (method === 'sms') methodLabel = 'СМС';
    if (method === 'call') methodLabel = 'Звонок';

    setToastMessage(`Код восстановления (${methodLabel}): ${code}`);
    setTimeout(() => {
      setToastMessage(null);
    }, 8000);
  };

  const handleVerifyStep = () => {
    setErrorMsg('');
    if (!sentCode) {
      setErrorMsg('Запросите код восстановления');
      return;
    }
    if (inputCode.trim() !== sentCode) {
      setErrorMsg('Неверный код восстановления');
      return;
    }
    if (storedSecretPhrase && inputPhrase.trim().toLowerCase() !== storedSecretPhrase.trim().toLowerCase()) {
      setErrorMsg('Секретная фраза не совпадает');
      return;
    }

    setStep('new_pin');
  };

  const handleSaveNewPin = () => {
    if (newPin.length < 4) {
      setErrorMsg('ПИН-код должен быть от 4 цифр');
      return;
    }
    if (newPin !== confirmNewPin) {
      setErrorMsg('ПИН-коды не совпадают');
      return;
    }

    onSuccess(newPin);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in text-primary">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 glass-card bg-blue-500/20 text-blue-500 text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-blue-500/30">
          <KeyRound size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-sm rounded-3xl p-6 glass-card border border-white/20 dark:border-white/10 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass-button flex items-center justify-center text-secondary hover:text-primary transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl glass-button text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primary">Восстановление ПИН-кода</h3>
            <p className="text-xs text-muted">Секретная фраза + код подтверждения</p>
          </div>
        </div>

        {step === 'verify' && (
          <div className="space-y-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1.5">Канал связи</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setMethod('email')}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border text-[11px] font-semibold transition ${
                    method === 'email'
                      ? 'border-blue-500/30 bg-blue-500/15 text-blue-500'
                      : 'glass-button border-transparent text-secondary'
                  }`}
                >
                  <Mail size={16} />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('sms')}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border text-[11px] font-semibold transition ${
                    method === 'sms'
                      ? 'border-blue-500/30 bg-blue-500/15 text-blue-500'
                      : 'glass-button border-transparent text-secondary'
                  }`}
                >
                  <Smartphone size={16} />
                  <span>СМС</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('call')}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border text-[11px] font-semibold transition ${
                    method === 'call'
                      ? 'border-blue-500/30 bg-blue-500/15 text-blue-500'
                      : 'glass-button border-transparent text-secondary'
                  }`}
                >
                  <PhoneCall size={16} />
                  <span>Звонок</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                {method === 'email' ? 'Email адрес' : 'Номер телефона'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-2xl glass-button border border-white/10 outline-none text-primary focus:border-blue-500/50"
                />
                <button
                  onClick={handleSendRecoveryCode}
                  className="px-3 py-2 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 text-xs font-semibold transition shrink-0"
                >
                  {sentCode ? 'Повторить' : 'Код'}
                </button>
              </div>
            </div>

            {sentCode && (
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">Код подтверждения</label>
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="6-значный код"
                  className="w-full text-center tracking-widest text-base py-2 rounded-2xl glass-button border border-white/10 outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Ваша секретная фраза</label>
              <input
                type="text"
                value={inputPhrase}
                onChange={(e) => setInputPhrase(e.target.value)}
                placeholder="Введите секретную фразу"
                className="w-full px-3 py-2.5 text-xs rounded-2xl glass-button border border-white/10 text-primary outline-none focus:border-blue-500/50"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleVerifyStep}
              className="w-full mt-1 py-2.5 rounded-2xl glass-button bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <span>Проверить данные</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {step === 'new_pin' && (
          <div className="space-y-4 pt-1">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle size={16} />
              <span>Личность подтверждена. Укажите новый ПИН-код.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Новый ПИН-код</label>
              <input
                type="password"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-2xl glass-button border border-white/10 outline-none focus:border-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">Повторите новый ПИН-код</label>
              <input
                type="password"
                maxLength={6}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • •"
                className="w-full text-center text-xl tracking-[0.5em] font-mono py-2.5 rounded-2xl glass-button border border-white/10 outline-none focus:border-blue-500/50"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleSaveNewPin}
              className="w-full py-2.5 rounded-2xl glass-button bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold text-xs flex items-center justify-center gap-2 active:scale-98 transition"
            >
              <CheckCircle size={16} />
              <span>Сохранить новый ПИН-код</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
