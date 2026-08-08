import React, { useState, useRef, useEffect } from 'react';
import { Send, Languages, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { User } from '../../types';
import { Skeleton } from '../Common/Skeleton';

interface AIScreenProps {
  isDark?: boolean;
  isGuest?: boolean;
  user?: User | null;
  onOpenAuth?: () => void;
  initialPrompt?: string;
  initialAction?: string;
  onClearInitial?: () => void;
}

interface AIMessage {
  id: string;
  from: 'ai' | 'me';
  text: string;
}

const aiQuickActions = [
  { icon: Languages, label: 'Перевод текста', action: 'translate' },
  { icon: TrendingUp, label: 'Анализ портфеля', action: 'portfolio', disabled: true },
];

export const AIScreen: React.FC<AIScreenProps> = ({
  isDark,
  isGuest,
  user,
  onOpenAuth,
  initialPrompt,
  initialAction,
  onClearInitial,
}) => {
  const userName = user?.username || user?.firstName || '';
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      from: 'ai',
      text: userName
        ? `Привет, ${userName}! Я Orbit AI. Чем я могу помочь вам сегодня?`
        : 'Привет! Я Orbit AI. Чем я могу помочь вам сегодня?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTranslationMode, setIsTranslationMode] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (customPrompt?: string, actionLabel?: string) => {
    const textToSend = customPrompt || input.trim();
    const actionClean = (actionLabel || '').toLowerCase();

    // 1) Handle Portfolio Analysis action (Temporarily Unavailable)
    if (actionClean.includes('portfolio') || actionClean.includes('анализ')) {
      if (onClearInitial) onClearInitial();
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          from: 'ai',
          text: 'Функция "Анализ портфеля" временно недоступна.',
        },
      ]);
      return;
    }

    // 2) Handle Translate Action (Prompt user for text explicitly without fake user message)
    if ((actionClean.includes('translate') || actionClean.includes('перевод')) && !textToSend) {
      if (onClearInitial) onClearInitial();
      setIsTranslationMode(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          from: 'ai',
          text: 'Какой текст вы хотите перевести? Напишите или вставьте его в поле ниже, и я переведу его для вас.',
        },
      ]);
      return;
    }

    if (!textToSend) return;

    if (!customPrompt) setInput('');

    const userMessage: AIMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      from: 'me',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const activeTransMode = isTranslationMode;
    setIsTranslationMode(false);

    try {
      const res = await api.sendAIChat(textToSend, activeTransMode ? 'translate' : undefined, activeTransMode);
      const aiMessage: AIMessage = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        from: 'ai',
        text: res.reply,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          from: 'ai',
          text: 'Извините, произошла ошибка при подключении к AI. Попробуйте еще раз.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPrompt || initialAction) {
      const promptToSend = initialPrompt;
      const actionToSend = initialAction;
      if (onClearInitial) onClearInitial();
      handleSend(promptToSend, actionToSend);
    }
  }, [initialPrompt, initialAction]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 space-y-3 py-3 no-scrollbar">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.from === 'me'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                  : 'glass-card text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in py-2">
            <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800/80 space-y-2.5 max-w-[85%] shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-500 pb-1">
                <Loader2 size={13} className="animate-spin" />
                <span>Orbit AI генерирует ответ...</span>
              </div>
              <Skeleton className="h-3.5 w-64 rounded-md" />
              <Skeleton className="h-3.5 w-48 rounded-md" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Quick Action Pills */}
      <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0 touch-pan-x cursor-grab active:cursor-grabbing select-none">
        {aiQuickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => {
              if (a.disabled) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `ai_${Date.now()}`,
                    from: 'ai',
                    text: 'Функция "Анализ портфеля" временно недоступна.',
                  },
                ]);
                return;
              }
              if (isGuest && onOpenAuth) {
                onOpenAuth();
              } else {
                handleSend('', a.action);
              }
            }}
            className={`glass-button flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition ${
              a.disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <a.icon size={14} className={a.disabled ? 'text-slate-400' : 'text-blue-500'} />
            <span>{a.label}</span>
            {a.disabled && <span className="text-[10px] text-slate-400 ml-1">(недоступно)</span>}
          </button>
        ))}
      </div>

      {/* Input Field */}
      {isGuest ? (
        <div className="mx-5 mb-6 p-3.5 glass-card rounded-2xl flex items-center justify-between gap-3 border border-white/60 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Обращение к ИИ доступно авторизованным пользователям.
          </span>
          <button
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium shadow-md shadow-blue-500/20 active:scale-95 transition shrink-0"
          >
            Войти
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 pb-6 pt-2 safe-bottom shrink-0">
          <div className="flex-1 flex items-center glass-button rounded-full px-4 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isTranslationMode ? 'Вставьте текст для перевода...' : 'Спросите Orbit AI...'}
              className="flex-1 bg-transparent text-sm outline-none text-primary placeholder:text-muted"
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="h-10 w-10 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 disabled:opacity-50 active:scale-95 transition"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

