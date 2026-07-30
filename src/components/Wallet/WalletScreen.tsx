import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, QrCode, Check, X } from 'lucide-react';
import { Transaction, Contact, TabType } from '../../types';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface WalletScreenProps {
  balance: number;
  transactions: Transaction[];
  contacts: Contact[];
  setTab: (tab: TabType) => void;
  onRefreshBalance: () => void;
  isDark?: boolean;
  isGuest?: boolean;
  onOpenAuth?: () => void;
}

const GLASS_GLOW = {
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -6px 14px rgba(255,255,255,0.12)',
};

const GLASS_GLOW_DARK = {
  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -6px 14px rgba(0,0,0,0.2)',
};

export const WalletScreen: React.FC<WalletScreenProps> = ({
  balance,
  transactions,
  contacts,
  setTab,
  onRefreshBalance,
  isDark,
  isGuest,
  onOpenAuth,
}) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isGuest) {
    return (
      <div className="px-5 pt-12 pb-4 text-center">
        <div className="glass-card max-w-xs mx-auto rounded-3xl p-6 text-primary border border-white/60 dark:border-slate-800 shadow-sm">
          <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-500/20">
            ORB
          </div>
          <h3 className="text-base font-semibold mb-1">Криптокошелек недоступен</h3>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            Войдите в аккаунт, чтобы просматривать баланс, совершать переводы и проверять историю транзакций.
          </p>
          <button
            onClick={onOpenAuth}
            className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white dark:bg-blue-500 dark:hover:bg-blue-400 font-medium text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
          >
            Войти / Зарегистрироваться
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async () => {
    setError(null);
    const num = parseFloat(amount);
    if (!recipient.trim()) {
      setError('Выберите или введите получателя');
      return;
    }
    if (isNaN(num) || num <= 0 || num > balance) {
      setError('Некорректная сумма или недостаточно средств');
      return;
    }

    setLoading(true);
    try {
      await api.sendCrypto(recipient, num);
      onRefreshBalance();
      setAmount('');
      setRecipient('');
      setShowSendModal(false);
    } catch (err: any) {
      setError(err.message || 'Ошибка перевода');
    } finally {
      setLoading(false);
    }
  };

  const { t } = useLanguage();

  return (
    <div className="px-5 pt-1 pb-4">
      {/* Wallet Balance Card */}
      <div
        style={isDark ? GLASS_GLOW_DARK : GLASS_GLOW}
        className={`relative rounded-3xl p-5 border shadow-xl bg-gradient-to-br from-indigo-300 via-violet-200 to-sky-200 ${
          isDark ? 'border-slate-700/55' : 'border-white/55'
        }`}
      >
        <span className="text-xs text-white/90">{t.orbBalance}</span>
        <div className="text-2xl font-semibold text-white mt-1">{balance.toFixed(2)} ORB</div>
        <span className="text-xs text-white/80">≈ ${(balance * 1.69).toFixed(2)}</span>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setShowSendModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-white/32 backdrop-blur-2xl py-2.5 text-sm font-medium text-white transition active:scale-95"
          >
            <ArrowUpRight size={14} /> Отправить
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-white/32 backdrop-blur-2xl py-2.5 text-sm font-medium text-white transition active:scale-95"
          >
            <ArrowDownLeft size={14} /> Получить
          </button>
          <button
            onClick={() => setShowQrModal(true)}
            className="h-9 w-9 shrink-0 rounded-full bg-white/32 backdrop-blur-2xl flex items-center justify-center active:scale-95 transition"
          >
            <QrCode size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Send Crypto Form */}
      {showSendModal && (
        <div className="mt-4 p-4 rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-slate-800 shadow-lg text-slate-800 dark:text-white animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Отправить ORB</span>
            <button onClick={() => setShowSendModal(false)} className="text-slate-400 p-1">
              <X size={16} />
            </button>
          </div>

          {error && <div className="mb-2 p-2 rounded-xl bg-red-500/10 text-red-500 text-xs">{error}</div>}

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Выберите из контактов</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setRecipient(c.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      recipient === c.name
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Получатель (@username)</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Elena Petrova или @elena.orbit"
                className="w-full px-3.5 py-2 rounded-2xl text-xs border border-white/60 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Сумма (ORB)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00 ORB"
                className="w-full px-3.5 py-2 rounded-2xl text-xs border border-white/60 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 outline-none"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold text-xs shadow-md flex items-center justify-center gap-1"
            >
              <Check size={14} />
              <span>Подтвердить перевод</span>
            </button>
          </div>
        </div>
      )}

      {/* Transaction History Ledger */}
      <div className="mt-5">
        <span className="text-sm font-semibold px-1 text-primary">История транзакций</span>
        <div className="glass-card rounded-3xl p-2 mt-2">
          {transactions.length === 0 ? (
            <div className="text-center text-xs py-6 text-muted">История пока пуста</div>
          ) : (
            transactions.map((t, i) => (
              <div
                key={t.id || i}
                className={`flex items-center gap-3 px-3 py-3 ${
                  i !== transactions.length - 1 ? 'border-b border-custom' : ''
                }`}
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                    t.type === 'out' ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'
                  }`}
                >
                  {t.type === 'out' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-primary truncate">
                    {t.type === 'out' ? `Перевод ${t.recipientName}` : `Получено от ${t.recipientName}`}
                  </div>
                  <div className="text-[10px] text-muted">{t.timestamp}</div>
                </div>
                <span
                  className={`text-xs font-bold ${
                    t.type === 'out' ? 'text-orange-500' : 'text-emerald-500'
                  }`}
                >
                  {t.type === 'out' ? '-' : '+'}{t.amount.toFixed(2)} ORB
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xs rounded-3xl p-6 shadow-2xl bg-white dark:bg-slate-900 text-center text-slate-800 dark:text-white">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-slate-400"
            >
              <X size={18} />
            </button>
            <h3 className="text-sm font-semibold mb-2">Получить ORB</h3>
            <p className="text-[11px] text-slate-400 mb-4">Отсканируйте QR-код для перевода</p>

            <div className="bg-white p-4 rounded-2xl shadow-inner border max-w-[180px] mx-auto mb-4">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=orbit:wallet:address:0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
                alt="QR Address"
                className="w-full h-auto"
              />
            </div>

            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-mono break-all text-slate-600 dark:text-slate-300">
              0x71C7656EC7ab88b098defB751B7401B5f6d8976F
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
