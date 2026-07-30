import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Languages, TrendingUp, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface AIScreenProps {
  isDark?: boolean;
  isGuest?: boolean;
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
  { icon: FileText, label: 'Суммаризация' },
  { icon: Languages, label: 'Перевод текста' },
  { icon: TrendingUp, label: 'Анализ портфеля' },
];

export const AIScreen: React.FC<AIScreenProps> = ({
  isDark,
  isGuest,
  onOpenAuth,
  initialPrompt,
  initialAction,
  onClearInitial,
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      from: 'ai',
      text: 'Привет! Я Orbit AI. Задавайте любые вопросы, суммаризируйте чаты или переводите сообщения.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (customPrompt?: string, actionLabel?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend && !actionLabel) return;

    if (!customPrompt) setInput('');

    const userMessage: AIMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      from: 'me',
      text: actionLabel && !textToSend ? `[Действие]: ${actionLabel}` : textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await api.sendAIChat(textToSend, actionLabel);
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
          <div className="flex justify-start items-center gap-2 text-xs text-muted py-2">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            <span>Orbit AI думает...</span>
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
              if (isGuest && onOpenAuth) {
                onOpenAuth();
              } else {
                handleSend('', a.label.toLowerCase());
              }
            }}
            className="glass-button flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-full px-3.5 py-2 text-xs font-medium active:scale-95 transition"
          >
            <a.icon size={14} className="text-blue-500" />
            <span>{a.label}</span>
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
              placeholder="Спросите Orbit AI..."
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
