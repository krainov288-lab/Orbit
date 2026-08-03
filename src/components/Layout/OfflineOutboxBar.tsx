import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, UploadCloud, AlertCircle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { offlineOutbox, OutboxItem } from '../../services/offlineOutbox';
import { haptics } from '../../utils/haptics';

interface OfflineOutboxBarProps {
  isGuest?: boolean;
}

export const OfflineOutboxBar: React.FC<OfflineOutboxBarProps> = ({ isGuest }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => offlineOutbox.isOnline());
  const [queue, setQueue] = useState<OutboxItem[]>(() => offlineOutbox.getQueue());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      haptics.notification();
    };
    const handleOffline = () => {
      setIsOnline(false);
      haptics.error();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = offlineOutbox.subscribe(() => {
      setQueue(offlineOutbox.getQueue());
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const activeQueue = isGuest
    ? queue.filter((item) => item.type !== 'news_post' && item.type !== 'reel')
    : queue;

  const pendingCount = activeQueue.length;

  if (isOnline && pendingCount === 0) {
    return null;
  }

  const handleManualSync = async () => {
    haptics.tap();
    setIsSyncing(true);
    await offlineOutbox.processQueue();
    setIsSyncing(false);
  };

  const handleRemoveItem = (id: string) => {
    haptics.tap();
    offlineOutbox.removeItem(id);
  };

  const getItemTypeLabel = (type: OutboxItem['type']) => {
    switch (type) {
      case 'voice_note': return 'Голосовое сообщение (ГС)';
      case 'video_circle': return 'Видеосообщение (кружок)';
      case 'story': return 'История (Story)';
      case 'news_post': return 'Новость';
      case 'reel': return 'Рилс (Reel)';
      default: return 'Медиафайл / Сообщение';
    }
  };

  return (
    <div className="relative z-40 w-full bg-gradient-to-r from-amber-500/90 via-orange-500/90 to-amber-600/90 text-white backdrop-blur-lg border-b border-white/20 shadow-lg px-4 py-2 transition-all duration-300">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs">
        {/* Left Status */}
        <div className="flex items-center gap-2 font-medium">
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 text-amber-100 font-bold shrink-0">
              <WifiOff size={14} className="animate-pulse text-amber-200" />
              <span>Офлайн-режим</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/30 text-emerald-100 font-bold shrink-0">
              <UploadCloud size={14} className="animate-bounce text-emerald-300" />
              <span>Синхронизация</span>
            </div>
          )}

          <p className="truncate text-white/90">
            {!isOnline
              ? pendingCount > 0
                ? `Нет подключения. ${pendingCount} файлов/постов сохранены в кэше и отправятся в сеть автоматически.`
                : 'Нет подключения к интернету. Платформа работает из локального кэша.'
              : `В сети. Синхронизируем ${pendingCount} медиафайлов из оффлайн-очереди...`}
          </p>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {pendingCount > 0 && isOnline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-white text-orange-600 font-bold hover:bg-orange-50 transition active:scale-95 shadow-sm"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Отправка...' : 'Отправить сейчас'}</span>
            </button>
          )}

          {pendingCount > 0 && (
            <button
              onClick={() => {
                haptics.tap();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 rounded-full hover:bg-black/20 text-white/90 transition"
              title="Детали очереди"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Outbox Queue Details */}
      {isExpanded && pendingCount > 0 && (
        <div className="max-w-6xl mx-auto mt-2 pt-2 border-t border-white/20 space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
          {activeQueue.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-2 rounded-xl bg-black/20 text-white text-[11px]"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="h-6 w-6 rounded-lg bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {item.status === 'syncing' ? (
                    <RefreshCw size={12} className="animate-spin text-amber-200" />
                  ) : item.status === 'error' ? (
                    <AlertCircle size={12} className="text-red-300" />
                  ) : (
                    <CheckCircle2 size={12} className="text-amber-300" />
                  )}
                </div>
                <div className="truncate">
                  <p className="font-bold truncate">{item.title || getItemTypeLabel(item.type)}</p>
                  <p className="text-[10px] text-amber-100/80">
                    {getItemTypeLabel(item.type)} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleRemoveItem(item.id)}
                className="p-1 text-red-200 hover:text-white hover:bg-red-500/30 rounded-lg transition shrink-0"
                title="Удалить из очереди"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
