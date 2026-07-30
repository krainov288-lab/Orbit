import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Bell,
  Lock,
  User as UserIcon,
  LogOut,
  UserCheck,
  Shield,
  ChevronRight,
  CheckCheck,
  Trash2,
  BellRing,
  MessageSquare,
  BellOff,
} from 'lucide-react';
import { User, AppNotification } from '../../types';

interface TopBarProps {
  user: User | null;
  notifications: AppNotification[];
  isPinSet: boolean;
  onNavigateProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenPinSetup: () => void;
  onLockApp: () => void;
  onClearNotifications?: () => void;
  onMarkAllRead?: () => void;
  isDark?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  notifications,
  isPinSet,
  onNavigateProfile,
  onSettings,
  onLogout,
  onOpenAuth,
  onOpenPinSetup,
  onLockApp,
  onClearNotifications,
  onMarkAllRead,
  isDark,
}) => {
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const unreadNotifs = notifications.filter((n) => !n.isRead);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-0 relative z-30">
      {/* Left: Avatar Circle + Dropdown (Only shown if user is logged in) */}
      {user ? (
        <div className="relative" ref={avatarMenuRef}>
          <button
            onClick={() => setShowAvatarMenu(!showAvatarMenu)}
            className="relative group focus:outline-none"
            title="Меню профиля"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-10 w-10 rounded-full object-cover shadow-md ring-2 ring-white/60 dark:ring-slate-800 transition active:scale-95"
              />
            ) : (
              <div
                className={`h-10 w-10 rounded-full bg-gradient-to-br ${user.avatarColor} flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white/60 dark:ring-slate-800 transition active:scale-95`}
              >
                {user.initials}
              </div>
            )}
          </button>

          {/* Avatar Popover Menu */}
          {showAvatarMenu && (
            <div className="absolute left-0 top-12 z-50 w-56 rounded-3xl p-2.5 glass-card shadow-2xl border border-white/60 dark:border-slate-800 animate-fade-in text-primary">
              <div className="px-3 py-2 border-b border-custom mb-1">
                <div className="text-xs font-bold text-primary truncate">{user.username}</div>
                <div className="text-[11px] text-muted truncate">{user.handle}</div>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    onNavigateProfile();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold transition"
                >
                  <div className="flex items-center gap-2">
                    <UserIcon size={15} className="text-slate-500" />
                    <span>Перейти в профиль</span>
                  </div>
                  <ChevronRight size={14} className="text-muted" />
                </button>

                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold text-red-500 transition"
                >
                  <div className="flex items-center gap-2">
                    <LogOut size={15} />
                    <span>Выйти из профиля</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-10 w-10" />
      )}

      {/* Right: Settings, Notifications, Lock Button */}
      <div className="flex items-center gap-2">
        {/* Settings Button */}
        <button
          onClick={() => {
            if (!user) {
              onOpenAuth();
            } else {
              onSettings();
            }
          }}
          className="glass-button h-9 w-9 rounded-full flex items-center justify-center active:scale-95 transition"
          title="Настройки"
        >
          <Settings size={16} className="text-secondary" />
        </button>

        {/* Notifications Button */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                setShowNotifs(!showNotifs);
              }
            }}
            className="glass-button h-9 w-9 rounded-full flex items-center justify-center relative active:scale-95 transition"
            title="Уведомления"
          >
            <Bell size={16} className="text-secondary" />
            {user && unreadNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center">
                {unreadNotifs.length}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute -right-12 sm:right-0 top-11 z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-3xl p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-slate-900/20 text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-7 w-7 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                    <BellRing size={14} />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Уведомления
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {unreadNotifs.length > 0 && onMarkAllRead && (
                    <button
                      onClick={onMarkAllRead}
                      className="px-2 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                      title="Прочесть все"
                    >
                      <CheckCheck size={12} />
                      <span>Прочесть</span>
                    </button>
                  )}
                  {notifications.length > 0 && onClearNotifications && (
                    <button
                      onClick={onClearNotifications}
                      className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
                      title="Очистить список"
                    >
                      <Trash2 size={12} />
                      <span>Очистить</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Items */}
              <div className="max-h-72 overflow-y-auto space-y-2 pt-2.5 no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4 space-y-2">
                    <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60">
                      <BellOff size={20} />
                    </div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Нет новых уведомлений
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight max-w-[200px]">
                      Здесь будут появляться системные сообщения и важные события
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`relative p-3 rounded-2xl text-xs transition-all flex items-start gap-3 border ${
                        n.isRead
                          ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/80 opacity-80 hover:opacity-100'
                          : 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/25 dark:border-blue-500/30 font-medium shadow-2xs'
                      }`}
                    >
                      {!n.isRead && (
                        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-500" />
                      )}

                      <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20 mt-0.5">
                        <MessageSquare size={15} />
                      </div>

                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                          {n.title}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">
                          {n.body}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* PIN Code Lock Button */}
        <button
          onClick={() => {
            if (isPinSet) {
              onLockApp();
            } else {
              onOpenPinSetup();
            }
          }}
          className={`h-9 w-9 rounded-full flex items-center justify-center relative active:scale-95 transition ${
            isPinSet
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20'
              : 'glass-button text-secondary'
          }`}
          title={isPinSet ? 'Заблокировать ПИН-кодом' : 'Установить ПИН-код'}
        >
          <Lock size={16} />
          {isPinSet && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>
      </div>
    </div>
  );
};
