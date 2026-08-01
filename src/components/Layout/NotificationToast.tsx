import React, { useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { haptics } from '../../utils/haptics';

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
  senderColor = 'from-sky-400 to-blue-600',
  text,
  onClick,
  onClose,
}) => {
  useEffect(() => {
    haptics.notification();
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-3 left-3 right-3 max-w-sm mx-auto z-[100] animate-fade-in select-none">
      <div
        onClick={onClick}
        className="flex items-center gap-2.5 p-2 pl-3 rounded-full bg-white/80 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/60 dark:border-slate-700/60 shadow-xl shadow-sky-500/10 cursor-pointer hover:scale-[1.01] active:scale-[0.98] transition-all"
      >
        <div
          className={`h-9 w-9 rounded-full bg-gradient-to-tr ${senderColor} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
        >
          {senderInitials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {senderName}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-medium leading-tight">
            {text}
          </p>
        </div>

        {/* Direct "В диалог" Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-bold shadow-md shadow-sky-500/20 flex items-center gap-0.5 shrink-0 transition active:scale-95"
        >
          <span>В диалог</span>
          <ChevronRight size={13} />
        </button>

        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition shrink-0 mr-1"
          title="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};


