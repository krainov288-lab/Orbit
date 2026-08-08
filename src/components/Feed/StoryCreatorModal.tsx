import React, { useState, useEffect, useRef } from 'react';
import { Story, User, FollowerGroup, Contact } from '../../types';
import {
  X,
  Plus,
  Trash2,
  Users,
  Globe,
  Lock,
  MessageCircle,
  Heart,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Video as VideoIcon,
  UploadCloud,
  RefreshCw,
  Loader2,
  Check,
  UserCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { isVideoUrl, checkVideoDuration, processMediaFileForStory } from '../../utils/media';
import { haptics } from '../../utils/haptics';
import { FollowerGroupsModal } from './FollowerGroupsModal';

interface StoryCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImageUrl?: string;
  currentUser?: User | null;
  followersList?: Contact[];
  onStoryCreated: (newStory: Story) => void;
}

export const StoryCreatorModal: React.FC<StoryCreatorModalProps> = ({
  isOpen,
  onClose,
  initialImageUrl = '',
  currentUser,
  followersList = [],
  onStoryCreated,
}) => {
  const [slides, setSlides] = useState<string[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [caption, setCaption] = useState<string>('');
  const [audience, setAudience] = useState<'everyone' | 'groups'>('everyone');
  const [targetGroups, setTargetGroups] = useState<string[]>([]);
  const [followerGroups, setFollowerGroups] = useState<FollowerGroup[]>([]);
  const [isGroupsModalOpen, setIsGroupsModalOpen] = useState(false);
  const [hideComments, setHideComments] = useState<boolean>(false);
  const [hideReactions, setHideReactions] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

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
      loadGroups();
      haptics.tap();
    }
  }, [isOpen, initialImageUrl]);

  const loadGroups = async () => {
    try {
      const groups = await api.getFollowerGroups();
      setFollowerGroups(groups || []);
    } catch (e) {
      console.error('Failed to load follower groups in StoryCreatorModal', e);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    haptics.tap();
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
          haptics.success();
        }
      }
    } catch (err: any) {
      haptics.error();
      alert(err.message || 'Ошибка обработки файла');
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleReplaceActiveSlide = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    haptics.tap();
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
        haptics.success();
      }
    } catch (err: any) {
      haptics.error();
      alert(err.message || 'Ошибка загрузки файла');
    } finally {
      setIsProcessingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveSlide = (index: number) => {
    haptics.tap();
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
      haptics.error();
      alert('Добавьте хотя бы одно фото или видео из памяти устройства');
      return;
    }

    if (audience === 'groups' && targetGroups.length === 0) {
      haptics.error();
      alert('Выберите хотя бы одну группу подписчиков или переключите на "Все подписчики"');
      return;
    }

    haptics.medium();
    setIsSubmitting(true);
    try {
      const primaryUrl = validSlides[0];
      const created = await api.createStory(primaryUrl, caption.trim(), {
        slides: validSlides,
        audience,
        targetGroups: audience === 'groups' ? targetGroups : [],
        hideComments,
        hideReactions,
      });

      haptics.success();
      onStoryCreated(created);
      onClose();
    } catch (err: any) {
      haptics.error();
      alert(err.message || 'Ошибка при создании истории');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSlideUrl = slides[activeSlideIndex] || '';

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xl animate-fade-in">
      {/* Light minimalist glassmorphism container with floating ambient bubbles */}
      <div className="relative w-full max-w-md bg-white/85 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/80 dark:border-slate-800/80 rounded-3xl shadow-2xl shadow-sky-500/10 p-5 overflow-hidden flex flex-col max-h-[92vh] text-slate-800 dark:text-slate-100 space-y-4">
        {/* Floating Glass Ambient Bubbles */}
        <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-gradient-to-br from-sky-300/30 to-indigo-300/20 blur-2xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-gradient-to-tr from-purple-300/30 to-pink-300/20 blur-2xl pointer-events-none animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-sky-200/20 dark:bg-sky-500/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white flex items-center justify-center font-black shadow-md shadow-sky-500/20 shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Новая история</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Фото или видео из памяти устройства</p>
            </div>
          </div>
          <button
            onClick={() => {
              haptics.tap();
              onClose();
            }}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 transition active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Hidden Inputs */}
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

        {/* Modal Content - Scrollable */}
        <div className="relative z-10 overflow-y-auto no-scrollbar space-y-4 pr-0.5 flex-1">
          {/* Preview Canvas */}
          <div className="relative h-64 w-full rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex items-center justify-center shadow-inner group">
            {isProcessingFile && (
              <div className="absolute inset-0 z-30 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center text-white p-4 space-y-2 animate-fade-in">
                <Loader2 size={32} className="animate-spin text-sky-400" />
                <span className="text-xs font-bold">⚡ Сжатие и загрузка медиафайла...</span>
                <span className="text-[10px] text-slate-300">Оптимизация размера изображения в реальном времени</span>
              </div>
            )}
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
                onClick={() => {
                  haptics.tap();
                  fileInputRef.current?.click();
                }}
                disabled={isProcessingFile}
                className="w-full h-full flex flex-col items-center justify-center gap-2.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition p-5 cursor-pointer bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm"
              >
                {isProcessingFile ? (
                  <RefreshCw size={32} className="animate-spin text-sky-500" />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center shadow-md">
                    <UploadCloud size={30} className="animate-pulse" />
                  </div>
                )}
                <span className="text-xs font-bold text-center text-slate-800 dark:text-slate-200">
                  {isProcessingFile ? 'Загрузка медиафайла...' : 'Нажмите для выбора фото или видео'}
                </span>
                <span className="text-[10px] text-slate-400 text-center font-medium max-w-xs">
                  Поддерживаются видео до 1 минуты и фото высокое разрешение (до 5 слайдов)
                </span>
              </button>
            )}

            {/* Slide Navigation Buttons */}
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setActiveSlideIndex((prev) => Math.max(0, prev - 1));
                  }}
                  disabled={activeSlideIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black text-slate-800 dark:text-white disabled:opacity-30 flex items-center justify-center backdrop-blur-md transition shadow"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setActiveSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
                  }}
                  disabled={activeSlideIndex === slides.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 dark:bg-black/60 hover:bg-white dark:hover:bg-black text-slate-800 dark:text-white disabled:opacity-30 flex items-center justify-center backdrop-blur-md transition shadow"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* Slide Counter Badge */}
            {slides.length > 0 && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 dark:bg-black/70 backdrop-blur-md text-[10px] font-bold text-slate-800 dark:text-white shadow border border-white/50 dark:border-white/10">
                {isVideoUrl(currentSlideUrl) && <VideoIcon size={12} className="text-sky-500" />}
                <span>
                  Слайд {activeSlideIndex + 1} из {slides.length}
                </span>
              </div>
            )}
          </div>

          {/* Action Row for Active Slide */}
          {slides.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  haptics.tap();
                  replaceFileInputRef.current?.click();
                }}
                disabled={isProcessingFile}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 text-xs font-semibold transition active:scale-95"
              >
                <RefreshCw size={13} className={isProcessingFile ? 'animate-spin' : ''} />
                <span>Заменить файл</span>
              </button>

              <button
                type="button"
                onClick={() => handleRemoveSlide(activeSlideIndex)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition active:scale-95"
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
                  onClick={() => {
                    haptics.tap();
                    setActiveSlideIndex(idx);
                  }}
                  className={`relative h-14 w-14 rounded-xl border-2 overflow-hidden shrink-0 cursor-pointer transition ${
                    activeSlideIndex === idx
                      ? 'border-sky-500 scale-105 shadow-md shadow-sky-500/20'
                      : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  {isVideo ? (
                    <div className="h-full w-full bg-slate-900 flex items-center justify-center relative">
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
                onClick={() => {
                  haptics.tap();
                  fileInputRef.current?.click();
                }}
                disabled={isProcessingFile}
                className="h-14 w-14 rounded-xl border border-dashed border-sky-400/60 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex flex-col items-center justify-center text-[10px] font-bold gap-0.5 shrink-0 transition"
              >
                <Plus size={16} />
                <span>+ Слайд</span>
              </button>
            )}
          </div>

          {/* Form Controls */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Подпись к истории
                </label>
                <span className={`text-[10px] font-mono ${caption.length >= 90 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                  {caption.length}/100
                </span>
              </div>
              <input
                type="text"
                value={caption}
                maxLength={100}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Добавьте описание или мысль (макс. 100 символов)..."
                className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-medium border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
              />
            </div>

            {/* Audience Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Кому видна история
                </label>
                <button
                  type="button"
                  onClick={() => setIsGroupsModalOpen(true)}
                  className="text-[11px] font-bold text-sky-500 hover:text-sky-600 transition flex items-center gap-1"
                >
                  <Plus size={12} /> Настроить группы
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setAudience('everyone');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    audience === 'everyone'
                      ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200'
                  }`}
                >
                  <Users size={14} />
                  <span>Все подписчики</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    setAudience('groups');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                    audience === 'groups'
                      ? 'bg-indigo-500 text-white border-indigo-500 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-200'
                  }`}
                >
                  <UserCheck size={14} />
                  <span>Выбранные группы</span>
                </button>
              </div>

              {/* Group Checkboxes when 'groups' selected */}
              {audience === 'groups' && (
                <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Выберите группы для показа:
                  </div>
                  {followerGroups.length === 0 ? (
                    <div className="text-center py-3 text-xs text-slate-400">
                      У вас нет созданных групп.{' '}
                      <button
                        type="button"
                        onClick={() => setIsGroupsModalOpen(true)}
                        className="text-sky-500 font-bold underline"
                      >
                        Создать группу
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                      {followerGroups.map((g) => {
                        const isChecked = targetGroups.includes(g.id);
                        return (
                          <label
                            key={g.id}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{g.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({g.memberIds?.length || 0} уст.)
                              </span>
                            </span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                haptics.tap();
                                setTargetGroups((prev) =>
                                  prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                                );
                              }}
                              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <FollowerGroupsModal
              isOpen={isGroupsModalOpen}
              onClose={() => setIsGroupsModalOpen(false)}
              followersList={followersList}
              onGroupsUpdated={(updated) => setFollowerGroups(updated)}
            />

            {/* Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-sky-500" />
                  <span>Отключить комментарии</span>
                </span>
                <input
                  type="checkbox"
                  checked={hideComments}
                  onChange={(e) => {
                    haptics.tap();
                    setHideComments(e.target.checked);
                  }}
                  className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Heart size={14} className="text-pink-500" />
                  <span>Отключить реакции</span>
                </span>
                <input
                  type="checkbox"
                  checked={hideReactions}
                  onChange={(e) => {
                    haptics.tap();
                    setHideReactions(e.target.checked);
                  }}
                  className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || isProcessingFile || slides.length === 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-sky-500/25 active:scale-98 transition flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Опубликование истории...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Опубликовать историю</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
