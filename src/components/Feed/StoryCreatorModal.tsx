import React, { useState, useEffect, useRef } from 'react';
import { Story, User } from '../../types';
import {
  X,
  Plus,
  Trash2,
  Users,
  Globe,
  Lock,
  MessageCircle,
  Heart,
  Image as ImageIcon,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Video as VideoIcon,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api';
import { isVideoUrl, checkVideoDuration, processMediaFileForStory } from '../../utils/media';

interface StoryCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl?: string;
  currentUser?: User | null;
  onStoryCreated: (newStory: Story) => void;
}

export const StoryCreatorModal: React.FC<StoryCreatorModalProps> = ({
  isOpen,
  onClose,
  initialImageUrl = '',
  currentUser,
  onStoryCreated,
}) => {
  const [slides, setSlides] = useState<string[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [caption, setCaption] = useState<string>('');
  const [audience, setAudience] = useState<'everyone' | 'close_friends' | 'contacts'>('everyone');
  const [hideComments, setHideComments] = useState<boolean>(false);
  const [hideReactions, setHideReactions] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize slides whenever modal opens or initialImageUrl is provided
  useEffect(() => {
    if (isOpen) {
      if (initialImageUrl && initialImageUrl.trim() !== '') {
        setSlides([initialImageUrl.trim()]);
      } else {
        setSlides([]);
      }
      setActiveSlideIndex(0);
      setCaption('');
      setIsProcessingFile(false);
    }
  }, [isOpen, initialImageUrl]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFile(true);
    const fileList: File[] = Array.from(files);

    try {
      for (const file of fileList) {
        if (file.type.startsWith('video/')) {
          const { valid } = await checkVideoDuration(file, 60);
          if (!valid) {
            alert(`Видео "${file.name}" превышает 1 минуту (максимально 60 секунд).`);
            continue;
          }
        }

        const mediaUrl = await processMediaFileForStory(file);
        if (mediaUrl) {
          setSlides((prev) => {
            const clean = prev.filter((s) => s.trim() !== '');
            if (clean.length < 5) {
              return [...clean, mediaUrl];
            }
            return prev;
          });
        }
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка обработки файла');
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReplaceActiveSlide = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      if (file.type.startsWith('video/')) {
        const { valid } = await checkVideoDuration(file, 60);
        if (!valid) {
          alert(`Видео "${file.name}" превышает 1 минуту (максимально 60 секунд).`);
          return;
        }
      }

      const mediaUrl = await processMediaFileForStory(file);
      if (mediaUrl) {
        setSlides((prev) => {
          const updated = [...prev];
          updated[activeSlideIndex] = mediaUrl;
          return updated;
        });
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки файла');
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveSlide = (index: number) => {
    const updated = slides.filter((_, i) => i !== index);
    setSlides(updated);
    if (updated.length === 0) {
      setActiveSlideIndex(0);
    } else {
      setActiveSlideIndex(Math.min(activeSlideIndex, updated.length - 1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSlides = slides.map((s) => s.trim()).filter(Boolean);
    if (validSlides.length === 0) {
      alert('Добавьте хотя бы одно фото или короткое видео из памяти устройства');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryUrl = validSlides[0];
      const created = await api.createStory(primaryUrl, caption.trim(), {
        slides: validSlides,
        audience,
        hideComments,
        hideReactions,
      });

      onStoryCreated(created);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Ошибка при создании истории');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSlideUrl = slides[activeSlideIndex] || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl p-5 bg-slate-900 border border-slate-800 text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Новая история</h3>
              <p className="text-[10px] text-slate-400">Фото или видео (до 1 мин) из памяти устройства</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Hidden Multi-file Inputs for Local Storage Picker */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          type="file"
          ref={replaceFileInputRef}
          accept="image/*,video/*"
          onChange={handleReplaceActiveSlide}
          className="hidden"
        />

        {/* Preview & Slide Switcher */}
        <div className="space-y-2.5">
          <div className="relative h-64 w-full rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
            {currentSlideUrl ? (
              isVideoUrl(currentSlideUrl) ? (
                <video
                  src={currentSlideUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={currentSlideUrl}
                  alt="Story Preview"
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-slate-900/50 transition p-4 cursor-pointer"
              >
                {isProcessingFile ? (
                  <RefreshCw size={32} className="animate-spin text-sky-400" />
                ) : (
                  <UploadCloud size={36} className="text-sky-400 animate-pulse" />
                )}
                <span className="text-xs font-semibold text-center leading-snug">
                  {isProcessingFile
                    ? 'Загрузка файла...'
                    : 'Выбрать фото или видео с устройства'}
                </span>
                <span className="text-[10px] text-slate-500 text-center">
                  Поддерживаются фото и видео до 1 минуты (макс. 5 слайдов)
                </span>
              </button>
            )}

            {/* Slide Navigation Buttons */}
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeSlideIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 flex items-center justify-center backdrop-blur-xs transition"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
                  disabled={activeSlideIndex === slides.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white disabled:opacity-30 flex items-center justify-center backdrop-blur-xs transition"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Slide Count Badge & Video Indicator */}
            {slides.length > 0 && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/10">
                {isVideoUrl(currentSlideUrl) && <VideoIcon size={12} className="text-sky-400" />}
                <span>
                  Слайд {activeSlideIndex + 1} из {slides.length}
                </span>
              </div>
            )}
          </div>

          {/* Action Row for Active Slide */}
          {slides.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => replaceFileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold transition active:scale-95"
              >
                <RefreshCw size={13} className={isProcessingFile ? 'animate-spin' : ''} />
                <span>Заменить файл</span>
              </button>

              <button
                type="button"
                onClick={() => handleRemoveSlide(activeSlideIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition active:scale-95"
              >
                <Trash2 size={13} />
                <span>Удалить слайд</span>
              </button>
            </div>
          )}

          {/* Slide Thumbnails List */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {slides.map((s, idx) => {
              const isVideo = isVideoUrl(s);
              return (
                <div
                  key={idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`relative h-14 w-14 rounded-xl border-2 overflow-hidden shrink-0 cursor-pointer transition ${
                    activeSlideIndex === idx
                      ? 'border-sky-500 scale-105 shadow-md shadow-sky-500/20'
                      : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  {isVideo ? (
                    <div className="h-full w-full bg-slate-950 flex items-center justify-center relative">
                      <video src={s} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <VideoIcon size={16} className="text-sky-400 drop-shadow" />
                      </div>
                    </div>
                  ) : (
                    <img src={s} alt="" className="h-full w-full object-cover" />
                  )}

                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSlide(idx);
                      }}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-500/80 text-white hover:bg-red-600"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })}

            {slides.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="h-14 w-14 rounded-xl border border-dashed border-sky-500/50 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 flex flex-col items-center justify-center text-[9px] font-bold gap-0.5 shrink-0 transition"
              >
                <Plus size={16} />
                <span>+ Слайд</span>
              </button>
            )}
          </div>
        </div>

        {/* Input Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* Story Caption */}
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300">
              Подпись к истории
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавьте описание или заголовок..."
              className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-slate-800 bg-slate-950 text-white outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-600"
            />
          </div>

          {/* Audience Selector */}
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300">
              Кто увидят историю?
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setAudience('everyone')}
                className={`py-2 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${
                  audience === 'everyone'
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Globe size={13} />
                <span>Все</span>
              </button>

              <button
                type="button"
                onClick={() => setAudience('close_friends')}
                className={`py-2 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${
                  audience === 'close_friends'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Users size={13} />
                <span>Близкие</span>
              </button>

              <button
                type="button"
                onClick={() => setAudience('contacts')}
                className={`py-2 px-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 border transition ${
                  audience === 'contacts'
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <Lock size={13} />
                <span>Контакты</span>
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span className="flex items-center gap-2">
                <MessageCircle size={14} className="text-sky-400" />
                <span>Отключить комментарии</span>
              </span>
              <input
                type="checkbox"
                checked={hideComments}
                onChange={(e) => setHideComments(e.target.checked)}
                className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
              <span className="flex items-center gap-2">
                <Heart size={14} className="text-pink-400" />
                <span>Отключить реакции</span>
              </span>
              <input
                type="checkbox"
                checked={hideReactions}
                onChange={(e) => setHideReactions(e.target.checked)}
                className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isProcessingFile || slides.length === 0}
            className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-sky-500/20 active:scale-95 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Публикация...' : 'Опубликовать историю'}
          </button>
        </form>
      </div>
    </div>
  );
};
