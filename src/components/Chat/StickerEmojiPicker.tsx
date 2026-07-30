import React, { useState, useRef } from 'react';
import { Smile, Sparkles, Search, Check, X, FolderPlus, Upload, Link } from 'lucide-react';

interface StickerEmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

export const StickerEmojiPicker: React.FC<StickerEmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectSticker,
}) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'stickers'>('emoji');
  const [showAddPackModal, setShowAddPackModal] = useState(false);
  const [newPackUrl, setNewPackUrl] = useState('');
  const [customPacks, setCustomPacks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_custom_stickers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [packAddedToast, setPackAddedToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const emojiCategories = [
    { title: 'Улыбки', items: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'] },
    { title: 'Жесты & Сердца', items: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'] },
    { title: 'Природа & Животные', items: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄'] },
  ];

  const defaultStickers = [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=150&auto=format&fit=crop&q=80',
  ];

  const allStickers = [...customPacks, ...defaultStickers];

  const handleUploadLocalStickers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFiles = (Array.from(files) as File[]).slice(0, 20);

    const promises = selectedFiles.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then((dataUrls) => {
      setCustomPacks((prev) => {
        const updated = [...dataUrls, ...prev].slice(0, 50);
        localStorage.setItem('orbit_custom_stickers', JSON.stringify(updated));
        return updated;
      });
      setPackAddedToast(true);
      setTimeout(() => setPackAddedToast(false), 3000);
    });
  };

  const handleAddPack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackUrl.trim()) return;
    setCustomPacks((prev) => {
      const updated = [newPackUrl.trim(), ...prev];
      localStorage.setItem('orbit_custom_stickers', JSON.stringify(updated));
      return updated;
    });
    setNewPackUrl('');
    setShowAddPackModal(false);
    setPackAddedToast(true);
    setTimeout(() => setPackAddedToast(false), 3000);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="absolute bottom-16 right-4 z-[100] w-80 max-w-[90vw] rounded-3xl p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-2xl text-primary animate-fade-in space-y-3 pointer-events-auto"
    >
      {/* Toast Alert */}
      {packAddedToast && (
        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
          <Check size={14} /> Новый стикерпак успешно добавлен!
        </div>
      )}

      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-custom pb-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'emoji'
                ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Smile size={14} /> Emojis
          </button>
          <button
            onClick={() => setActiveTab('stickers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'stickers'
                ? 'bg-white dark:bg-slate-900 text-blue-500 shadow-sm'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Sparkles size={14} /> Стикеры
          </button>
        </div>

        <button
          onClick={onClose}
          className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted hover:text-primary transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content Body */}
      {activeTab === 'emoji' ? (
        <div className="max-h-60 overflow-y-auto space-y-3 pr-1 no-scrollbar">
          {emojiCategories.map((cat) => (
            <div key={cat.title}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                {cat.title}
              </div>
              <div className="grid grid-cols-7 gap-1 text-xl">
                {cat.items.map((emo) => (
                  <button
                    key={emo}
                    onClick={() => {
                      onSelectEmoji(emo);
                      onClose();
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition active:scale-90 flex items-center justify-center"
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            onChange={handleUploadLocalStickers}
            className="hidden"
          />
          <div className="flex items-center justify-between gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
              title="Загрузить до 20 стикеров с телефона"
            >
              <Upload size={13} /> + С телефона (до 20)
            </button>
            <button
              onClick={() => setShowAddPackModal(true)}
              className="text-[11px] font-bold text-muted hover:text-primary flex items-center gap-1"
            >
              <FolderPlus size={13} /> + По ссылке
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-h-56 overflow-y-auto no-scrollbar">
            {allStickers.map((url, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelectSticker(url);
                  onClose();
                }}
                className="aspect-square rounded-2xl overflow-hidden border border-custom hover:border-blue-500/50 p-1 hover:scale-105 transition bg-slate-50 dark:bg-slate-800/50 group"
              >
                <img src={url} alt="Sticker" className="w-full h-full object-cover rounded-xl group-hover:brightness-105 transition" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal Add Sticker Pack */}
      {showAddPackModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <form onSubmit={handleAddPack} className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 border border-custom shadow-2xl text-primary space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                <FolderPlus size={15} className="text-blue-500" /> Добавить стикерпак
              </h4>
              <button
                type="button"
                onClick={() => setShowAddPackModal(false)}
                className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Вставьте URL на изображение или стикерпак формата PNG/WEBP
            </p>
            <input
              type="url"
              required
              value={newPackUrl}
              onChange={(e) => setNewPackUrl(e.target.value)}
              placeholder="https://example.com/sticker.png"
              className="w-full px-3.5 py-2 text-xs rounded-2xl border border-custom bg-slate-50 dark:bg-slate-800 outline-none text-primary"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-2xl bg-blue-500 text-white font-bold text-xs shadow-md active:scale-95 transition"
            >
              Импортировать стикер
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
