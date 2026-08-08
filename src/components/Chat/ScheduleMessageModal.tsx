import React, { useState } from 'react';
import { Clock, Calendar, X, Send, Sparkles, AlertCircle } from 'lucide-react';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledAtMs: number) => void;
  textPreview: string;
  mediaPreview?: {
    fileName?: string;
    mediaType?: string;
  } | null;
}

export const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  textPreview,
  mediaPreview,
}) => {
  if (!isOpen) return null;

  // Default to 1 hour in the future
  const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
  // Format for datetime-local: YYYY-MM-DDTHH:mm
  const formatDatetimeLocal = (date: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const [selectedDateTime, setSelectedDateTime] = useState<string>(
    formatDatetimeLocal(defaultTime)
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const setQuickTime = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    setSelectedDateTime(formatDatetimeLocal(target));
    setErrorMsg('');
  };

  const setNextMorning = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    setSelectedDateTime(formatDatetimeLocal(target));
    setErrorMsg('');
  };

  const setNextEvening = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(18, 0, 0, 0);
    setSelectedDateTime(formatDatetimeLocal(target));
    setErrorMsg('');
  };

  const handleConfirm = () => {
    const timestamp = new Date(selectedDateTime).getTime();
    if (isNaN(timestamp)) {
      setErrorMsg('Пожалуйста, выберите корректную дату и время');
      return;
    }
    if (timestamp <= Date.now() + 10000) {
      setErrorMsg('Время отправки должно быть в будущем (хотя бы на несколько секунд)');
      return;
    }
    onSchedule(timestamp);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-slate-800 dark:text-white">
      <div className="relative w-full max-w-md rounded-3xl p-5 border border-sky-500/30 bg-white/95 dark:bg-slate-900/95 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sky-500/20 text-sky-500 flex items-center justify-center border border-sky-500/30 shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold flex items-center gap-1.5">
              Отложенная отправка
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Сообщение будет отправлено автоматически в назначенное время
            </p>
          </div>
        </div>

        {/* Message Preview */}
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Предпросмотр сообщения:
          </span>
          <p className="text-slate-700 dark:text-slate-200 line-clamp-3 italic">
            {textPreview || '(Без текста)'}
          </p>
          {mediaPreview && (
            <div className="text-[11px] text-sky-500 font-medium flex items-center gap-1 pt-1">
              <span>📎 Вложение: {mediaPreview.fileName || 'Медиафайл'}</span>
            </div>
          )}
        </div>

        {/* Quick Time Options */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" /> Быстрые варианты:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setQuickTime(10)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 text-xs font-medium transition text-left"
            >
              ⏱ Через 10 мин
            </button>
            <button
              onClick={() => setQuickTime(60)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 text-xs font-medium transition text-left"
            >
              ⏳ Через 1 час
            </button>
            <button
              onClick={setNextMorning}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 text-xs font-medium transition text-left"
            >
              🌅 Завтра в 09:00
            </button>
            <button
              onClick={setNextEvening}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-sky-500 hover:text-white dark:hover:bg-sky-500 text-xs font-medium transition text-left"
            >
              🌙 Завтра в 18:00
            </button>
          </div>
        </div>

        {/* Exact Date & Time Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Calendar size={12} className="text-sky-500" /> Выберите точную дату и время:
          </label>
          <input
            type="datetime-local"
            value={selectedDateTime}
            onChange={(e) => {
              setSelectedDateTime(e.target.value);
              setErrorMsg('');
            }}
            className="w-full px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center gap-1.5 active:scale-95 transition"
          >
            <Clock size={14} />
            Запланировать
          </button>
        </div>
      </div>
    </div>
  );
};
