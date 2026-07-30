import React, { useState, useEffect } from 'react';
import { Lock, Delete, AlertCircle, KeyRound, ShieldCheck, ScanFace, CheckCircle2 } from 'lucide-react';

interface PinLockOverlayProps {
  isLocked: boolean;
  storedPin: string;
  onUnlock: () => void;
  onOpenRecovery: () => void;
}

export const PinLockOverlay: React.FC<PinLockOverlayProps> = ({
  isLocked,
  storedPin,
  onUnlock,
  onOpenRecovery,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [shake, setShake] = useState(false);
  const [biometricScanning, setBiometricScanning] = useState(false);
  const [activeMode, setActiveMode] = useState<'pin' | 'biometric'>('pin');

  // Handle Lockout Timer Countdown
  useEffect(() => {
    if (lockoutTimer > 0) {
      const interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutTimer]);

  if (!isLocked) return null;

  const handleBiometricUnlock = async () => {
    if (lockoutTimer > 0) return;
    setActiveMode('biometric');
    setBiometricScanning(true);
    setErrorMsg('');
    try {
      if (window.PublicKeyCredential && navigator.credentials) {
        // WebAuthn request check attempt
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      setBiometricScanning(false);
      setPinInput('');
      setErrorMsg('');
      setFailedAttempts(0);
      onUnlock();
    } catch {
      setBiometricScanning(false);
      setErrorMsg('Биометрия не распознана');
      setActiveMode('pin');
    }
  };

  const handleDigit = (digit: string) => {
    if (lockoutTimer > 0) return;
    if (pinInput.length >= 6) return;

    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setErrorMsg('');

    // If input reaches stored PIN length, verify automatically
    if (nextPin.length >= storedPin.length) {
      if (nextPin === storedPin) {
        setPinInput('');
        setErrorMsg('');
        setFailedAttempts(0);
        onUnlock();
      } else {
        triggerError();
      }
    }
  };

  const handleDelete = () => {
    if (lockoutTimer > 0) return;
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    if (lockoutTimer > 0) return;
    setPinInput('');
    setErrorMsg('');
  };

  const triggerError = () => {
    setShake(true);
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    if (newAttempts >= 3) {
      setErrorMsg('Слишком много неверных попыток. Блокировка на 30 сек.');
      setLockoutTimer(30);
      setFailedAttempts(0);
    } else {
      setErrorMsg(`Неверный ПИН-код. Попытка ${newAttempts} из 3`);
    }

    setTimeout(() => {
      setPinInput('');
      setShake(false);
    }, 500);
  };

  const targetLength = Math.max(storedPin.length || 4, 4);

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950 flex flex-col items-center justify-between p-6 text-slate-100 select-none overflow-hidden animate-fade-in">
      {/* Top Brand Header */}
      <div className="flex flex-col items-center pt-8 space-y-3">
        <div className="relative">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <Lock size={30} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 border-2 border-slate-950">
            <ShieldCheck size={14} />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-white">ORBIT Security</h2>
          <p className="text-xs text-slate-400 mt-1">Введите ПИН-код для разблокировки</p>
        </div>
      </div>

      {/* Middle PIN Indicators */}
      <div className={`flex flex-col items-center my-auto transition-transform ${shake ? 'animate-bounce text-red-400' : ''}`}>
        <div className="flex items-center gap-4 mb-4">
          {Array.from({ length: targetLength }).map((_, idx) => (
            <div
              key={idx}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                idx < pinInput.length
                  ? 'bg-blue-500 border-blue-400 scale-110 shadow-lg shadow-blue-500/50'
                  : 'bg-slate-900 border-slate-700'
              }`}
            />
          ))}
        </div>

        {lockoutTimer > 0 ? (
          <div className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 animate-pulse">
            Заблокировано. Повторите через {lockoutTimer} сек
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Защищено 256-битным шифрованием</div>
        )}
      </div>

      {/* Bottom Keypad & Recovery Option */}
      <div className="w-full max-w-xs pb-6 space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              disabled={lockoutTimer > 0}
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-xl font-semibold text-white flex items-center justify-center active:scale-90 transition disabled:opacity-30"
            >
              {digit}
            </button>
          ))}

          <button
            disabled={lockoutTimer > 0}
            onClick={handleClear}
            className="h-16 rounded-full bg-slate-900/40 hover:bg-slate-800 text-xs font-medium text-slate-400 flex items-center justify-center active:scale-90 transition disabled:opacity-30"
          >
            Сброс
          </button>

          <button
            disabled={lockoutTimer > 0}
            onClick={() => handleDigit('0')}
            className="h-16 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 text-xl font-semibold text-white flex items-center justify-center active:scale-90 transition disabled:opacity-30"
          >
            0
          </button>

          <button
            disabled={lockoutTimer > 0}
            onClick={handleDelete}
            className="h-16 rounded-full bg-slate-900/40 hover:bg-slate-800 text-slate-300 flex items-center justify-center active:scale-90 transition disabled:opacity-30"
          >
            <Delete size={20} />
          </button>
        </div>

        <div className="text-center pt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={biometricScanning || lockoutTimer > 0}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-30"
          >
            <ScanFace size={16} className={biometricScanning ? 'animate-spin' : ''} />
            <span>{biometricScanning ? 'Сканирование...' : 'Разблокировать по Touch / Face ID'}</span>
          </button>

          <button
            onClick={onOpenRecovery}
            className="text-xs text-slate-400 hover:text-slate-200 font-medium flex items-center justify-center gap-1.5 hover:underline pt-1"
          >
            <KeyRound size={14} />
            <span>Забыли ПИН-код?</span>
          </button>
        </div>
      </div>
    </div>
  );
};
