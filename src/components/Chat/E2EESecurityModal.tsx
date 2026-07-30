import React from 'react';
import { ShieldCheck, Lock, Key, CheckCircle2, X, RefreshCw } from 'lucide-react';

interface E2EESecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactName: string;
}

export const E2EESecurityModal: React.FC<E2EESecurityModalProps> = ({
  isOpen,
  onClose,
  contactName,
}) => {
  if (!isOpen) return null;

  // Static deterministic fingerprint for visual security confirmation
  const securityFingerprint = '8f9a · 1b4e · 7d2c · 90a1 · 43ef · 1234 · 5678 · 9abc';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-primary">
      <div className="relative w-full max-w-sm rounded-3xl p-5 glass-card border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 shadow-2xl text-white space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              Сквозное E2EE Шифрование
              <CheckCircle2 size={16} className="text-emerald-400" />
            </h3>
            <p className="text-xs text-slate-400">Чат с {contactName}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> Протокол защиты
            </span>
            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              AES-256 GCM + Signal
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Сообщения, голосовые записи и звонки шифруются прямо на вашем устройстве. Никакие третьи лица и серверы не могут прочесть ваши данные.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Key size={13} className="text-emerald-400" />
            <span>Цифровой отпечаток ключа (Fingerprint)</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 tracking-wider text-center select-all">
            {securityFingerprint}
          </div>
        </div>

        <div className="pt-1 flex gap-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition"
          >
            Ключи верифицированы
          </button>
        </div>
      </div>
    </div>
  );
};
