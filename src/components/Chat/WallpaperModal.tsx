import React, { useState } from 'react';
import { Palette, Check, X, Moon, Sun, Sparkles, Layers, Sliders, RefreshCw } from 'lucide-react';

export interface WallpaperSettings {
  preset: string;
  adaptTheme: boolean;
  opacity: number;
}

export const DEFAULT_WALLPAPER_SETTINGS: WallpaperSettings = {
  preset: 'default',
  adaptTheme: true,
  opacity: 35,
};

export const WALLPAPER_PRESETS = [
  // Patterns
  { id: 'default', name: 'По умолчанию', type: 'pattern', desc: 'Классический минималистичный фон' },
  { id: 'doodle', name: 'Дудлы и Иконки', type: 'pattern', desc: 'Элементы чата и геометрические фигурки' },
  { id: 'dots', name: 'Точечная матрица', type: 'pattern', desc: 'Мелкие аккуратные точки' },
  { id: 'grid', name: 'Геометрическая сетка', type: 'pattern', desc: 'Сетка в стиле миллиметровки' },
  { id: 'diagonal', name: 'Диагональные линии', type: 'pattern', desc: 'Легкие параллельные полосы' },
  { id: 'constellation', name: 'Созвездия', type: 'pattern', desc: 'Звездные точки и мерцающие искры' },
  
  // Gradients
  { id: 'aurora', name: 'Северное сияние', type: 'gradient', desc: 'Изумрудно-голубые размытые тона' },
  { id: 'sunset', name: 'Теплый закат', type: 'gradient', desc: 'Розово-янтарный мягкий градиент' },
  { id: 'ocean', name: 'Океанский бриз', type: 'gradient', desc: 'Бирюзово-синяя свежесть' },
  { id: 'neon_night', name: 'Неоновая ночь', type: 'gradient', desc: 'Глубокие индиго и ультрафиолет' },
  { id: 'cosmic', name: 'Космический туман', type: 'gradient', desc: 'Фиолетовый млечный путь' },

  // Tints
  { id: 'emerald_tint', name: 'Изумрудный оттенок', type: 'tint', desc: 'Мягкий травяной тон' },
  { id: 'sky_tint', name: 'Лазурный оттенок', type: 'tint', desc: 'Нежно-голубой тон' },
  { id: 'lavender_tint', name: 'Лавандовый оттенок', type: 'tint', desc: 'Пастельно-фиолетовый тон' },
  { id: 'amber_tint', name: 'Янтарный оттенок', type: 'tint', desc: 'Теплый песочный тон' },
];

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WallpaperSettings;
  onSave: (newSettings: WallpaperSettings) => void;
}

export const WallpaperModal: React.FC<WallpaperModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(settings.preset || 'default');
  const [adaptTheme, setAdaptTheme] = useState<boolean>(settings.adaptTheme ?? true);
  const [opacity, setOpacity] = useState<number>(settings.opacity ?? 35);
  const [activeTab, setActiveTab] = useState<'pattern' | 'gradient' | 'tint'>('pattern');

  if (!isOpen) return null;

  const handleApply = () => {
    onSave({
      preset: selectedPreset,
      adaptTheme,
      opacity,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedPreset(DEFAULT_WALLPAPER_SETTINGS.preset);
    setAdaptTheme(DEFAULT_WALLPAPER_SETTINGS.adaptTheme);
    setOpacity(DEFAULT_WALLPAPER_SETTINGS.opacity);
  };

  const filteredPresets = WALLPAPER_PRESETS.filter((p) => p.type === activeTab);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in text-slate-800 dark:text-slate-100">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
              <Palette size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Оформление фона чата</h3>
              <p className="text-[11px] text-slate-400">Настройка узоров, градиентов и темы</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Wallpaper Preview Card */}
        <div className="p-4 shrink-0 border-b border-slate-100 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/50">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
            <span>Предварительный просмотр</span>
            <span className="text-[10px] font-normal text-sky-500 font-mono">
              {WALLPAPER_PRESETS.find((p) => p.id === selectedPreset)?.name}
            </span>
          </div>

          <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col justify-center p-3 space-y-2 bg-slate-50 dark:bg-slate-950">
            {/* Background Render Layer inside Preview */}
            <WallpaperBackgroundLayer preset={selectedPreset} adaptTheme={adaptTheme} opacity={opacity} />

            {/* Simulated Chat Messages */}
            <div className="relative z-10 flex justify-start">
              <div className="px-3 py-1.5 rounded-2xl rounded-tl-xs bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-xs text-[11px] text-slate-700 dark:text-slate-200 max-w-[70%]">
                Привет! Посмотри обновленный фон чата ✨
              </div>
            </div>
            <div className="relative z-10 flex justify-end">
              <div className="px-3 py-1.5 rounded-2xl rounded-tr-xs bg-sky-500 text-white shadow-xs text-[11px] font-medium max-w-[70%]">
                Отлично смотрится! Очень мягко и стильно 👍
              </div>
            </div>
          </div>
        </div>

        {/* Controls Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 no-scrollbar">
          {/* Light/Dark Compatibility Toggle */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 dark:bg-indigo-500/10 text-amber-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                {adaptTheme ? <Sun size={16} className="dark:hidden" /> : null}
                {adaptTheme ? <Moon size={16} className="hidden dark:block" /> : null}
                {!adaptTheme && <Sparkles size={16} className="text-sky-500" />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Адаптация к теме</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-semibold">
                    {adaptTheme ? 'Включена' : 'Выключена'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {adaptTheme
                    ? 'Автоматический контраст для тёмного и светлого режима'
                    : 'Фиксированная яркость фона без привязки к теме'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setAdaptTheme(!adaptTheme)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                adaptTheme ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  adaptTheme ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Opacity / Intensity Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} className="text-sky-500" /> Интенсивность / Прозрачность
              </span>
              <span className="font-mono text-[11px] text-sky-500">{opacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg outline-none"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveTab('pattern')}
              className={`flex-1 py-1.5 rounded-xl transition ${
                activeTab === 'pattern'
                  ? 'bg-white dark:bg-slate-900 text-sky-500 shadow-xs font-bold'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Узоры ({WALLPAPER_PRESETS.filter((p) => p.type === 'pattern').length})
            </button>
            <button
              onClick={() => setActiveTab('gradient')}
              className={`flex-1 py-1.5 rounded-xl transition ${
                activeTab === 'gradient'
                  ? 'bg-white dark:bg-slate-900 text-sky-500 shadow-xs font-bold'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Градиенты ({WALLPAPER_PRESETS.filter((p) => p.type === 'gradient').length})
            </button>
            <button
              onClick={() => setActiveTab('tint')}
              className={`flex-1 py-1.5 rounded-xl transition ${
                activeTab === 'tint'
                  ? 'bg-white dark:bg-slate-900 text-sky-500 shadow-xs font-bold'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Оттенки ({WALLPAPER_PRESETS.filter((p) => p.type === 'tint').length})
            </button>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {filteredPresets.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between relative overflow-hidden group ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/5 dark:bg-sky-500/10 ring-2 ring-sky-500/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <div className="h-4 w-4 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                        <Check size={10} />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 line-clamp-1">{preset.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition flex items-center gap-1"
          >
            <RefreshCw size={13} />
            <span>Сбросить</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
            >
              Отмена
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20 transition"
            >
              Сохранить фон
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

{/* Helper component rendering the wallpaper layer */}
export const WallpaperBackgroundLayer: React.FC<WallpaperSettings> = ({
  preset,
  adaptTheme,
  opacity,
}) => {
  const normOpacity = (opacity ?? 35) / 100;

  if (preset === 'default') {
    return (
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]" />
    );
  }

  // Tints
  if (preset === 'emerald_tint') {
    return (
      <div
        className="absolute inset-0 pointer-events-none bg-emerald-500/10 dark:bg-emerald-950/20 transition-opacity"
        style={{ opacity: normOpacity }}
      />
    );
  }
  if (preset === 'sky_tint') {
    return (
      <div
        className="absolute inset-0 pointer-events-none bg-sky-500/10 dark:bg-sky-950/20 transition-opacity"
        style={{ opacity: normOpacity }}
      />
    );
  }
  if (preset === 'lavender_tint') {
    return (
      <div
        className="absolute inset-0 pointer-events-none bg-purple-500/10 dark:bg-purple-950/20 transition-opacity"
        style={{ opacity: normOpacity }}
      />
    );
  }
  if (preset === 'amber_tint') {
    return (
      <div
        className="absolute inset-0 pointer-events-none bg-amber-500/10 dark:bg-amber-950/20 transition-opacity"
        style={{ opacity: normOpacity }}
      />
    );
  }

  // Gradients
  if (preset === 'aurora') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          background:
            'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.25), transparent 45%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.25), transparent 45%), radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.2), transparent 50%)',
        }}
      />
    );
  }
  if (preset === 'sunset') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          background:
            'radial-gradient(circle at 10% 20%, rgba(244, 63, 94, 0.25), transparent 45%), radial-gradient(circle at 90% 80%, rgba(245, 158, 11, 0.25), transparent 45%), radial-gradient(circle at 50% 90%, rgba(139, 92, 246, 0.2), transparent 50%)',
        }}
      />
    );
  }
  if (preset === 'ocean') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          background:
            'radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.3), transparent 45%), radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.3), transparent 45%), radial-gradient(circle at 50% 30%, rgba(16, 185, 129, 0.2), transparent 50%)',
        }}
      />
    );
  }
  if (preset === 'neon_night') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          background:
            'radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.3), transparent 50%), radial-gradient(circle at 70% 70%, rgba(236, 72, 153, 0.25), transparent 50%)',
        }}
      />
    );
  }
  if (preset === 'cosmic') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          background:
            'radial-gradient(circle at 50% 20%, rgba(168, 85, 247, 0.3), transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.25), transparent 50%), radial-gradient(circle at 20% 70%, rgba(59, 130, 246, 0.2), transparent 40%)',
        }}
      />
    );
  }

  // Patterns
  if (preset === 'dots') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          backgroundImage: 'radial-gradient(circle, currentColor 1.2px, transparent 1.2px)',
          backgroundSize: '18px 18px',
        }}
      />
    );
  }

  if (preset === 'grid') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
    );
  }

  if (preset === 'diagonal') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          backgroundImage:
            'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 14px)',
        }}
      />
    );
  }

  if (preset === 'constellation') {
    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          backgroundImage:
            'radial-gradient(circle at 20% 30%, currentColor 1.5px, transparent 1.5px), radial-gradient(circle at 70% 80%, currentColor 2px, transparent 2px), radial-gradient(circle at 80% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 30% 70%, currentColor 1.8px, transparent 1.8px)',
          backgroundSize: '80px 80px',
        }}
      />
    );
  }

  if (preset === 'doodle') {
    // Elegant SVG Telegram/WhatsApp style Chat Doodles Pattern
    const doodleSvg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 25 a10 10 0 0 1 20 0 a10 10 0 0 1 -20 0" />
        <path d="M75 20 l12 12 m-12 0 l12 -12" />
        <polygon points="20,80 30,70 40,85 30,95" />
        <circle cx="85" cy="80" r="10" />
        <path d="M50 45 c5 -10, 15 -10, 20 0 c-5 10, -15 10, -20 0" />
        <path d="M80 45 l5 8 l8 1 l-6 6 l1 8 l-8 -4 l-8 4 l1 -8 l-6 -6 l8 -1 z" />
        <path d="M20 50 l6 -6 m0 6 l-6 -6" />
        <circle cx="55" cy="95" r="4" />
      </svg>`
    );

    return (
      <div
        className="absolute inset-0 pointer-events-none transition-opacity"
        style={{
          opacity: normOpacity,
          backgroundImage: `url("data:image/svg+xml,${doodleSvg}")`,
          backgroundSize: '160px 160px',
        }}
      />
    );
  }

  return null;
};
