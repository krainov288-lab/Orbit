import React from 'react';
import { Clock, Send, Trash2, X, AlertCircle } from 'lucide-react';
import { ScheduledMessage } from '../../types';

interface ScheduledMessagesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledMessages: ScheduledMessage[];
  onSendNow: (msg: ScheduledMessage) => void;
  onDelete: (id: string) => void;
  contactName: string;
}

export const ScheduledMessagesListModal: React.FC<ScheduledMessagesListModalProps> = ({
  isOpen,
  onClose,
  scheduledMessages,
  onSendNow,
  onDelete,
  contactName,
}) => {
  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-slate-800 dark:text-white">
      <div className="relative w-full max-w-md rounded-3xl p-5 border border-sky-500/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <div className="h-10 w-10 rounded-2xl bg-sky-500/20 text-sky-500 flex items-center justify-center border border-sky-500/30 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              Отложенные сообщения
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Чат: {contactName} ({scheduledMessages.length})
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {scheduledMessages.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Clock size={32} className="opacity-40" />
              <span>Нет запланированных сообщений для этого чата.</span>
            </div>
          ) : (
            scheduledMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-sky-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {formatDate(msg.scheduledAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSendNow(msg)}
                      className="px-2 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium text-[11px] flex items-center gap-1 transition"
                      title="Отправить прямо сейчас"
                    >
                      <Send size={11} /> Сейчас
                    </button>
                    <button
                      onClick={() => onDelete(msg.id)}
                      className="p-1 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                      title="Удалить запланированное сообщение"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p className="text-slate-800 dark:text-slate-200 break-words font-normal">
                  {msg.text || <span className="italic text-slate-400">(Без текста)</span>}
                </p>

                {msg.pendingMedia && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-200/50 dark:bg-slate-900/50 p-1.5 rounded-xl flex items-center gap-1">
                    <span>📎 Вложение: {msg.pendingMedia.fileName || 'Медиафайл'}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-2 shrink-0 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
