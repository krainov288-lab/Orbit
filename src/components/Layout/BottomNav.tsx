import React from 'react';
import { MessageCircle, Wallet, Newspaper, User } from 'lucide-react';
import { TabType } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { triggerHaptic } from '../../utils/haptics';

interface BottomNavProps {
  tab: TabType;
  setTab: (tab: TabType) => void;
  unreadCount?: number;
  isDark?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({ tab, setTab, unreadCount = 0, isDark }) => {
  const { t } = useLanguage();

  const items = [
    { key: 'home' as TabType, icon: MessageCircle, label: t.chats },
    { key: 'feed' as TabType, icon: Newspaper, label: t.feed },
    { key: 'wallet' as TabType, icon: Wallet, label: t.wallet },
    { key: 'profile' as TabType, icon: User, label: t.profile },
  ];

  return (
    <div className="px-5 pb-5 pt-2 safe-bottom shrink-0">
      <div className="glass-card flex items-center justify-around rounded-full px-3 py-2">
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => {
                triggerHaptic('selection');
                setTab(it.key);
              }}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1 relative active:scale-95 transition"
            >
              <it.icon
                size={18}
                className={active ? 'text-blue-500' : 'text-muted'}
                strokeWidth={active ? 2.4 : 2}
              />
              <span className={`text-[11px] ${active ? 'text-blue-500 font-semibold' : 'text-muted'}`}>
                {it.label}
              </span>
              {it.key === 'home' && unreadCount > 0 && (
                <span className="absolute top-0 right-1 h-3.5 min-w-3.5 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
