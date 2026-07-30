import React, { useState, useEffect, useRef } from 'react';
import { Story, User } from '../../types';
import {
  X,
  MessageCircle,
  Send,
  Trash2,
  Heart,
  MoreVertical,
  Users,
} from 'lucide-react';
import { api } from '../../services/api';
import { isVideoUrl } from '../../utils/media';

interface StoryViewerProps {
  story: Story;
  currentUser?: User | null;
  onClose: () => void;
  onDeleteStory?: (storyId: string) => void;
  onUpdateStory?: (updatedStory: Story) => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  story,
  currentUser,
  onClose,
  onDeleteStory,
  onUpdateStory,
}) => {
  const slides = story.slides && story.slides.length > 0 ? story.slides : [story.mediaUrl];
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Pre-selected active reaction emoji (default: ❤️)
  const [selectedEmoji, setSelectedEmoji] = useState<string>('❤️');
  // Bottom-right reaction animations queue
  const [bottomRightAnims, setBottomRightAnims] = useState<Array<{ id: string; emoji: string }>>([]);

  // Local story state for reactive updates
  const [currentStory, setCurrentStory] = useState<Story>(story);

  const SLIDE_DURATION = 5000; // 5 seconds per slide
  const lastTapRef = useRef<number>(0);

  const isOwner = currentUser?.id ? String(currentUser.id) === String(currentStory.userId) : true;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sysadmin';
  const canManage = isOwner || isAdmin;

  // Mark story as viewed on mount
  useEffect(() => {
    if (!currentStory.viewed) {
      api.markStoryViewed(currentStory.id).catch(() => {});
      setCurrentStory((prev) => ({ ...prev, viewed: true }));
    }
  }, [currentStory.id]);

  // Slide timer progress
  useEffect(() => {
    if (isPaused || showCommentsModal || showSettingsModal) return;

    const interval = 50; // update every 50ms
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (activeSlideIndex < slides.length - 1) {
            setActiveSlideIndex((idx) => idx + 1);
            return 0;
          } else {
            clearInterval(timer);
            onClose();
            return 100;
          }
        }
        return prev + (interval / SLIDE_DURATION) * 100;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeSlideIndex, slides.length, isPaused, showCommentsModal, showSettingsModal, onClose]);

  const handleNextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlideIndex < slides.length - 1) {
      setActiveSlideIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlideIndex > 0) {
      setActiveSlideIndex((prev) => prev - 1);
      setProgress(0);
    }
  };

  const spawnBottomRightAnimation = (emoji: string) => {
    const animId = `anim_${Date.now()}_${Math.random()}`;
    setBottomRightAnims((prev) => [...prev, { id: animId, emoji }]);
    setTimeout(() => {
      setBottomRightAnims((prev) => prev.filter((a) => a.id !== animId));
    }, 1200);
  };

  const handleAddReaction = async (emoji: string) => {
    if (currentStory.hideReactions) return;
    
    // Select this emoji as the active reaction
    setSelectedEmoji(emoji);
    
    // Trigger bottom-right animation
    spawnBottomRightAnimation(emoji);

    try {
      const res = await api.reactToStory(currentStory.id, emoji);
      if (res.success && res.reaction) {
        setCurrentStory((prev) => ({
          ...prev,
          reactions: [...(prev.reactions || []), res.reaction],
        }));
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // Double tap handler on main story image
  const handleMediaTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.stopPropagation();
      // Double tap detected! Trigger reaction with pre-selected emoji
      handleAddReaction(selectedEmoji);
    }
    lastTapRef.current = now;
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || currentStory.hideComments) return;

    const textToSend = commentText.trim();
    setCommentText('');

    try {
      const res = await api.commentOnStory(currentStory.id, textToSend);
      if (res.success && res.comment) {
        const updated = {
          ...currentStory,
          comments: [...(currentStory.comments || []), res.comment],
        };
        setCurrentStory(updated);
        if (onUpdateStory) onUpdateStory(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки комментария');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить эту историю?')) return;
    try {
      await api.deleteStory(currentStory.id);
      if (onDeleteStory) onDeleteStory(currentStory.id);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления истории');
    }
  };

  const handleToggleComments = async () => {
    try {
      const newStatus = !currentStory.hideComments;
      const res = await api.updateStory(currentStory.id, { hideComments: newStatus });
      if (res.success) {
        const updated = { ...currentStory, hideComments: newStatus };
        setCurrentStory(updated);
        if (onUpdateStory) onUpdateStory(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка изменения настроек');
    }
  };

  const handleToggleReactions = async () => {
    try {
      const newStatus = !currentStory.hideReactions;
      const res = await api.updateStory(currentStory.id, { hideReactions: newStatus });
      if (res.success) {
        const updated = { ...currentStory, hideReactions: newStatus };
        setCurrentStory(updated);
        if (onUpdateStory) onUpdateStory(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка изменения настроек');
    }
  };

  const allowedEmojis = currentStory.allowedReactions || ['❤️', '🔥', '👏', '😍', '😂', '😮'];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between select-none animate-fade-in overflow-hidden"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <style>{`
        @keyframes storyReactionPop {
          0% { transform: scale(0.2) translateY(20px); opacity: 0; }
          25% { transform: scale(1.35) translateY(-10px); opacity: 1; }
          65% { transform: scale(1.1) translateY(-35px); opacity: 0.9; }
          100% { transform: scale(0.7) translateY(-75px); opacity: 0; }
        }
        .animate-story-reaction-pop {
          animation: storyReactionPop 1.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {/* Top Header Controls & Progress Bars */}
      <div className="relative z-30 p-4 pt-3 bg-gradient-to-b from-black/70 via-black/30 to-transparent space-y-2">
        {/* Progress Bars */}
        <div className="flex items-center gap-1.5 w-full">
          {slides.map((_, idx) => {
            let widthPercent = 0;
            if (idx < activeSlideIndex) widthPercent = 100;
            else if (idx === activeSlideIndex) widthPercent = progress;
            else widthPercent = 0;

            return (
              <div key={idx} className="h-[2px] flex-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all ease-linear"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* User Info Bar */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500 p-[1.5px] shadow-sm">
              {currentStory.userAvatar ? (
                <img
                  src={currentStory.userAvatar}
                  alt={currentStory.userName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                  {currentStory.userInitials || currentStory.userName?.substring(0, 2).toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate max-w-[150px]">{currentStory.userName}</span>
                {currentStory.audience === 'close_friends' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold flex items-center gap-1 border border-emerald-500/30">
                    <Users size={10} />
                    <span>Близкие</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-white/70 block">
                {new Date(currentStory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 relative" onClick={(e) => e.stopPropagation()}>
            {canManage && (
              <button
                onClick={() => setShowSettingsModal(!showSettingsModal)}
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition active:scale-95"
                title="Управление историей"
              >
                <MoreVertical size={18} />
              </button>
            )}

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition active:scale-95"
            >
              <X size={18} />
            </button>

            {/* Minimalist Glassmorphism Dropdown Menu */}
            {showSettingsModal && (
              <div
                className="absolute top-11 right-0 z-50 w-56 p-2 rounded-2xl bg-black/60 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-slate-700/60 shadow-2xl space-y-1 animate-scale-up text-white select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 border-b border-white/10 mb-1">
                  Управление историей
                </div>

                <button
                  onClick={async () => {
                    setShowSettingsModal(false);
                    await handleToggleComments();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/15 dark:hover:bg-white/10 transition text-xs font-medium text-slate-100"
                >
                  <span>{currentStory.hideComments ? 'Включить комментарии' : 'Отключить комментарии'}</span>
                  <MessageCircle size={15} className="text-sky-300" />
                </button>

                <button
                  onClick={async () => {
                    setShowSettingsModal(false);
                    await handleToggleReactions();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/15 dark:hover:bg-white/10 transition text-xs font-medium text-slate-100"
                >
                  <span>{currentStory.hideReactions ? 'Включить реакции' : 'Отключить реакции'}</span>
                  <Heart size={15} className="text-pink-300" />
                </button>

                <div className="my-1 border-t border-white/10" />

                <button
                  onClick={async () => {
                    setShowSettingsModal(false);
                    await handleDelete();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-red-500/25 text-red-300 transition text-xs font-semibold"
                >
                  <span>Удалить историю</span>
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Slide Content Area with Tap Navigation & Double Tap Reaction */}
      <div
        className="relative flex-1 my-auto flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleMediaTap}
      >
        {/* Left Tap Zone for Prev */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePrevSlide(e);
          }}
          className="absolute left-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
        />

        {/* Right Tap Zone for Next */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNextSlide(e);
          }}
          className="absolute right-0 top-0 bottom-0 w-1/3 z-20 cursor-pointer"
        />

        {/* Slide Media (Image or Video) */}
        {isVideoUrl(slides[activeSlideIndex]) ? (
          <video
            src={slides[activeSlideIndex]}
            autoPlay
            playsInline
            loop
            controls
            className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
          />
        ) : (
          <img
            src={slides[activeSlideIndex]}
            alt={`Slide ${activeSlideIndex + 1}`}
            className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
            }}
          />
        )}

        {/* Bottom-Left Compact Story Caption Bubble */}
        {currentStory.caption && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-16 left-3.5 z-30 max-w-[68%] bg-black/20 dark:bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-white text-[11px] font-medium leading-tight shadow-sm animate-fade-in"
          >
            {currentStory.caption}
          </div>
        )}

        {/* Comments Overlay Carousel Directly Over Story (No background box) */}
        {(currentStory.comments || []).length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 left-3 right-3 z-30 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5"
          >
            {currentStory.comments?.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 dark:bg-black/30 backdrop-blur-md border border-white/10 text-white shrink-0 text-[11px] max-w-[210px] shadow-sm"
              >
                <span className="font-bold text-sky-300 truncate max-w-[65px]">{c.userName}:</span>
                <span className="text-white/95 truncate">{c.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom-Right Double-Tap Reaction Pop Animation */}
        <div className="absolute bottom-16 right-5 pointer-events-none z-40 flex flex-col items-end">
          {bottomRightAnims.map((anim) => (
            <div
              key={anim.id}
              className="text-4xl animate-story-reaction-pop drop-shadow-xl"
            >
              {anim.emoji}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Interactive Bar (Reaction Selector & Comment Input) */}
      <div
        className="relative z-30 p-3 pb-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent space-y-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Reaction Selector */}
        {!currentStory.hideReactions && (
          <div className="flex items-center justify-center gap-2 px-2">
            {allowedEmojis.map((emoji) => {
              const isSelected = selectedEmoji === emoji;
              return (
                <button
                  key={emoji}
                  onClick={() => handleAddReaction(emoji)}
                  className={`h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center text-lg transition active:scale-125 hover:scale-110 shadow-md ${
                    isSelected
                      ? 'bg-sky-500/30 border-2 border-sky-400 ring-2 ring-sky-400/50 scale-105'
                      : 'bg-white/10 hover:bg-white/20 border border-white/10'
                  }`}
                  title={isSelected ? 'Выбранная реакция (двойной тап по сториз)' : 'Предварительный выбор реакции'}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}

        {/* Comment input or disabled note */}
        <div className="flex items-center gap-2">
          {!currentStory.hideComments ? (
            <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Отправить сообщение..."
                className="flex-1 px-3.5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs placeholder:text-white/60 outline-none focus:ring-1 focus:ring-sky-400/50"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white flex items-center justify-center shadow-md transition shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          ) : (
            <div className="flex-1 text-center text-xs text-white/50 py-1 font-medium">
              Комментарии отключены автором
            </div>
          )}

          {/* View Comments Button */}
          <button
            onClick={() => setShowCommentsModal(true)}
            className="relative h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            <MessageCircle size={14} />
            <span>{(currentStory.comments || []).length}</span>
          </button>
        </div>
      </div>

      {/* Comments Drawer / Modal */}
      {showCommentsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col justify-end animate-fade-in"
          onClick={() => setShowCommentsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto h-[60vh] rounded-t-3xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-700/50 text-white flex flex-col p-4 animate-slide-up shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-sky-400" />
                <h4 className="font-bold text-sm">Комментарии к истории</h4>
                <span className="text-xs text-slate-400 font-normal">
                  ({(currentStory.comments || []).length})
                </span>
              </div>
              <button
                onClick={() => setShowCommentsModal(false)}
                className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2.5">
              {(currentStory.comments || []).length > 0 ? (
                currentStory.comments?.map((c) => (
                  <div key={c.id} className="flex gap-2.5 items-start bg-white/5 p-2.5 rounded-2xl border border-white/10">
                    <div className="h-7 w-7 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {c.userName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">{c.userName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 break-words">{c.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-1">
                  <MessageCircle size={32} strokeWidth={1.5} />
                  <p className="text-xs font-medium">Пока нет комментариев</p>
                  <p className="text-[10px] text-slate-500">Напишите первый комментарий выше</p>
                </div>
              )}
            </div>

            {/* Bottom Add Comment */}
            {!currentStory.hideComments && (
              <form onSubmit={handleSendComment} className="pt-2 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ваш комментарий..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs transition"
                >
                  Отправить
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

