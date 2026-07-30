import React, { useEffect } from 'react';
import { MessageSquare, X, ChevronRight, Bell } from 'lucide-react';

interface NotificationToastProps {
  senderName: string;
  senderInitials?: string;
  senderColor?: string;
  text: string;
  onClick: () => void;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  senderName,
  senderInitials = 'U',
  senderColor = 'from-blue-500 to-indigo-600',
  text,
  onClick,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="absolute top-3 left-3 right-3 z-[100] cursor-pointer animate-fade-in transition-all">
      <div
        onClick={onClick}
        className="group relative overflow-hidden p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-blue-500/10 text-slate-900 dark:text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
        {/* Accent Glow Strip */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Top Header: App Branding & Close Button */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-md bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold shadow-xs">
              O
            </div>
            <span className="text-[11px] font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
              Orbit Messenger
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
            <span className="text-[10px] font-semibold text-blue-500">только что</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Закрыть"
          >
            <X size={14} />
          </button>
        </div>

        {/* Main Body: Avatar + Content */}
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div
              className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${senderColor} flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/15 ring-2 ring-white dark:ring-slate-900`}
            >
              {senderInitials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight">
              {senderName}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5 font-normal">
              {text}
            </p>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-medium">
            <MessageSquare size={12} className="text-blue-500" />
            <span>Новое сообщение</span>
          </span>
          <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Открыть диалог</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>
    </div>
  );
};

