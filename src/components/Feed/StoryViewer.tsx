import React, { useState, useEffect, useRef } from 'react';
import { Story, User } from '../../types';
import { UserStoryGroup } from '../../utils/storyGroups';
import {
  X,
  MessageCircle,
  Send,
  Trash2,
  Heart,
  MoreVertical,
  Users,
  Volume2,
  VolumeX,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../../services/api';
import { isVideoUrl } from '../../utils/media';
import { triggerHaptic } from '../../utils/haptics';

interface StoryViewerProps {
  story?: Story;
  storyGroups?: UserStoryGroup[];
  initialGroupIndex?: number;
  currentUser?: User | null;
  onClose: () => void;
  onDeleteStory?: (storyId: string) => void;
  onUpdateStory?: (updatedStory: Story) => void;
  onStoryViewed?: (storyId: string) => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  story,
  storyGroups = [],
  initialGroupIndex = 0,
  currentUser,
  onClose,
  onDeleteStory,
  onUpdateStory,
  onStoryViewed,
}) => {
  const [activeGroupIndex, setActiveGroupIndex] = useState<number>(initialGroupIndex);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Audio mute state for videos
  const [isMuted, setIsMuted] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);

  // Active group & current story resolution
  const currentGroup = storyGroups && storyGroups.length > 0 ? storyGroups[activeGroupIndex] : null;
  const currentStoryProp = currentGroup ? currentGroup.stories[activeStoryIndex] : story;

  // Local story state for reactive updates
  const [currentStory, setCurrentStory] = useState<Story | undefined>(currentStoryProp);

  useEffect(() => {
    setCurrentStory(currentStoryProp);
    setActiveSlideIndex(0);
    setProgress(0);
  }, [currentStoryProp?.id, activeGroupIndex, activeStoryIndex]);

  const slides = currentStory?.slides && currentStory.slides.length > 0 ? currentStory.slides : [currentStory?.mediaUrl || ''];

  useEffect(() => {
    setIsMediaLoading(true);
  }, [activeSlideIndex, currentStory?.id]);

  // Floating reaction picker on long-press
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Focus state for comment input (auto-pauses story)
  const [isCommentInputFocused, setIsCommentInputFocused] = useState(false);

  // Vertical comments carousel active index
  const [activeCommentIndex, setActiveCommentIndex] = useState<number>(0);

  // Pre-selected active reaction emoji
  const [selectedEmoji, setSelectedEmoji] = useState<string>('❤️');
  // Bottom-right reaction pop animations queue
  const [bottomRightAnims, setBottomRightAnims] = useState<Array<{ id: string; emoji: string }>>([]);

  const SLIDE_DURATION = 5000; // 5 seconds per slide
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);
  const touchStartYRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ id: string; emoji: string } | null>(null);

  const isOwner = currentUser?.id && currentStory?.userId ? String(currentUser.id) === String(currentStory.userId) : true;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sysadmin';
  const canManage = isOwner || isAdmin;

  // Sync active comment index to the latest comment when comments change
  useEffect(() => {
    if (currentStory?.comments && currentStory.comments.length > 0) {
      setActiveCommentIndex(currentStory.comments.length - 1);
    }
  }, [currentStory?.comments?.length]);

  // Mark story as viewed on mount / story change
  useEffect(() => {
    if (currentStory && !currentStory.viewed) {
      api.markStoryViewed(currentStory.id).catch(() => {});
      setCurrentStory((prev) => (prev ? { ...prev, viewed: true } : prev));
      if (onStoryViewed) onStoryViewed(currentStory.id);
    }
  }, [currentStory?.id]);

  // Sync props to active group/story indices
  useEffect(() => {
    if (storyGroups && storyGroups.length > 0) {
      let gIdx = initialGroupIndex >= 0 && initialGroupIndex < storyGroups.length ? initialGroupIndex : -1;
      if (gIdx === -1 && story) {
        gIdx = storyGroups.findIndex((g) => g.stories.some((s) => s.id === story.id));
      }
      if (gIdx >= 0) {
        setActiveGroupIndex(gIdx);
        if (story) {
          const sIdx = storyGroups[gIdx].stories.findIndex((s) => s.id === story.id);
          if (sIdx >= 0) setActiveStoryIndex(sIdx);
        }
      }
    }
  }, [story?.id, initialGroupIndex, storyGroups?.length]);

  // Handle Next Slide / Next Story / Next User Group
  const handleNextSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlideIndex < slides.length - 1) {
      setActiveSlideIndex((prev) => prev + 1);
      setProgress(0);
    } else if (currentGroup && activeStoryIndex < currentGroup.stories.length - 1) {
      // Advance to next story of same user
      setActiveStoryIndex((prev) => prev + 1);
      setActiveSlideIndex(0);
      setProgress(0);
    } else if (storyGroups && activeGroupIndex < storyGroups.length - 1) {
      // Advance to next user group automatically!
      setActiveGroupIndex((prev) => prev + 1);
      setActiveStoryIndex(0);
      setActiveSlideIndex(0);
      setProgress(0);
    } else {
      // End of all stories of all users
      onClose();
    }
  };

  const handlePrevSlide = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (activeSlideIndex > 0) {
      setActiveSlideIndex((prev) => prev - 1);
      setProgress(0);
    } else if (currentGroup && activeStoryIndex > 0) {
      // Go to previous story of same user
      const prevStoryIdx = activeStoryIndex - 1;
      const prevStory = currentGroup.stories[prevStoryIdx];
      const prevSlides = prevStory?.slides && prevStory.slides.length > 0 ? prevStory.slides : [prevStory?.mediaUrl || ''];
      setActiveStoryIndex(prevStoryIdx);
      setActiveSlideIndex(prevSlides.length - 1);
      setProgress(0);
    } else if (storyGroups && activeGroupIndex > 0) {
      // Go to previous user group!
      const prevGroupIdx = activeGroupIndex - 1;
      const prevGroup = storyGroups[prevGroupIdx];
      const lastStoryIdx = prevGroup.stories.length - 1;
      const lastStory = prevGroup.stories[lastStoryIdx];
      const prevSlides = lastStory?.slides && lastStory.slides.length > 0 ? lastStory.slides : [lastStory?.mediaUrl || ''];
      setActiveGroupIndex(prevGroupIdx);
      setActiveStoryIndex(lastStoryIdx);
      setActiveSlideIndex(prevSlides.length - 1);
      setProgress(0);
    }
  };

  // Slide timer progress & auto-advance
  useEffect(() => {
    if (
      isPaused ||
      showCommentsModal ||
      showSettingsModal ||
      showReactionPicker ||
      isCommentInputFocused ||
      showConfirmDelete ||
      isVideoUrl(slides[activeSlideIndex])
    ) {
      return;
    }

    const interval = 50; // update every 50ms
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (interval / SLIDE_DURATION) * 100;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            handleNextSlide();
          }, 0);
          return 100;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [
    activeGroupIndex,
    activeStoryIndex,
    activeSlideIndex,
    slides.length,
    isPaused,
    showCommentsModal,
    showSettingsModal,
    showReactionPicker,
    isCommentInputFocused,
    showConfirmDelete,
    currentGroup,
    storyGroups,
  ]);

  const spawnBottomRightAnimation = (emoji: string) => {
    const animId = `anim_${Date.now()}_${Math.random()}`;
    setBottomRightAnims((prev) => [...prev, { id: animId, emoji }]);
    setTimeout(() => {
      setBottomRightAnims((prev) => prev.filter((a) => a.id !== animId));
    }, 1200);
  };

  const handleAddReaction = async (emoji: string) => {
    if (currentStory.hideReactions) return;

    setSelectedEmoji(emoji);
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

  // Touch and mouse long-press triggers reaction picker & pauses story
  const handleMediaPressStart = () => {
    isLongPressRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      triggerHaptic('impactMedium');
      setShowReactionPicker(true);
      setIsPaused(true);
    }, 450);
  };

  const handleMediaPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Tap handler: Single-tap toggles video sound, Double-tap adds reaction with heart animation
  const handleMediaTap = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_THRESHOLD = 300;

    if (now - lastTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
      // DOUBLE TAP DETECTED: Trigger Reaction & Big Animated Heart
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      const emojiToUse = selectedEmoji || '❤️';
      handleAddReaction(emojiToUse);
      triggerHaptic('impactMedium');

      const heartId = `heart_${now}`;
      setDoubleTapHeart({ id: heartId, emoji: emojiToUse });
      setTimeout(() => {
        setDoubleTapHeart(null);
      }, 900);
    } else {
      // SINGLE TAP: Schedule sound toggle if video
      lastTapTimeRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);

      singleTapTimerRef.current = setTimeout(() => {
        if (isVideoUrl(slides[activeSlideIndex])) {
          setIsMuted((prev) => !prev);
          triggerHaptic('selection');
        }
      }, DOUBLE_TAP_THRESHOLD);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || currentStory.hideComments) return;

    const textToSend = commentText.trim();
    setCommentText('');
    setIsCommentInputFocused(false);
    setIsPaused(false);

    try {
      const res = await api.commentOnStory(currentStory.id, textToSend);
      if (res.success && res.comment) {
        const updated = {
          ...currentStory,
          comments: [...(currentStory.comments || []), res.comment],
        };
        setCurrentStory(updated);
        setActiveCommentIndex(updated.comments.length - 1);
        if (onUpdateStory) onUpdateStory(updated);
      }
    } catch (err: any) {
      console.error('Error adding comment:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteStory(currentStory.id);
      if (onDeleteStory) onDeleteStory(currentStory.id);
      onClose();
    } catch (err: any) {
      console.error('Error deleting story:', err);
      if (onDeleteStory) onDeleteStory(currentStory.id);
      onClose();
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

  const allowedEmojis = currentStory.allowedReactions || ['❤️', '🔥', '👏', '😍', '😂', '😮', '👍', '🎉'];

  // Comments & Carousel Helpers
  const comments = currentStory.comments || [];
  const curComment = comments.length > 0 ? comments[activeCommentIndex % comments.length] || comments[comments.length - 1] : null;
  const nextComment = comments.length > 1 ? comments[(activeCommentIndex + 1) % comments.length] : null;

  const formatSnippet = (text: string) => {
    if (!text) return '';
    return text.length > 10 ? text.slice(0, 10) + '...' : text;
  };

  const handleCarouselNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (comments.length === 0) return;
    setActiveCommentIndex((prev) => (prev + 1) % comments.length);
    triggerHaptic('selection');
  };

  const handleCarouselPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (comments.length === 0) return;
    setActiveCommentIndex((prev) => (prev - 1 + comments.length) % comments.length);
    triggerHaptic('selection');
  };

  // Carousel vertical touch swipe
  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleCarouselTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (deltaY < -15) {
      handleCarouselNext();
    } else if (deltaY > 15) {
      handleCarouselPrev();
    }
  };

  if (!currentStory) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 dark:bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between select-none animate-fade-in overflow-hidden"
      onClick={() => {
        if (isCommentInputFocused) {
          setIsCommentInputFocused(false);
          setIsPaused(false);
        }
      }}
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

            {/* Dropdown Settings Menu */}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettingsModal(false);
                    setShowConfirmDelete(true);
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

      {/* Main Slide Content Area with Single/Double-Tap Reaction & Long-Press Picker */}
      <div
        className="relative flex-1 my-auto flex items-center justify-center overflow-hidden cursor-pointer"
        onMouseDown={handleMediaPressStart}
        onMouseUp={handleMediaPressEnd}
        onMouseLeave={handleMediaPressEnd}
        onTouchStart={handleMediaPressStart}
        onTouchEnd={handleMediaPressEnd}
        onClick={handleMediaTap}
      >
        {/* Double-tap Reaction Animated Burst */}
        {doubleTapHeart && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-in duration-200">
            <div className="text-8xl filter drop-shadow-[0_10px_35px_rgba(0,0,0,0.85)] animate-bounce">
              {doubleTapHeart.emoji}
            </div>
          </div>
        )}
        {/* Left Tap Zone for Prev Slide */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handlePrevSlide(e);
          }}
          className="absolute left-0 top-0 bottom-0 w-1/4 z-20 cursor-pointer"
        />

        {/* Right Tap Zone for Next Slide */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleNextSlide(e);
          }}
          className="absolute right-0 top-0 bottom-0 w-1/4 z-20 cursor-pointer"
        />

        {/* Dynamic Media Loading Spinner Circle */}
        {isMediaLoading && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40 backdrop-blur-xs rounded-2xl pointer-events-none">
            <div className="relative flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <Loader2 size={18} className="animate-spin text-white absolute" />
            </div>
            <span className="text-xs text-white/90 font-medium animate-pulse">
              Загрузка сториз...
            </span>
          </div>
        )}

        {/* Slide Media (Image or Video) */}
        {isVideoUrl(slides[activeSlideIndex]) ? (
          <div className="relative max-h-[75vh] flex items-center justify-center">
            <video
              key={slides[activeSlideIndex]}
              src={slides[activeSlideIndex]}
              autoPlay
              playsInline
              muted={isMuted}
              onLoadedData={() => setIsMediaLoading(false)}
              onCanPlay={() => setIsMediaLoading(false)}
              onWaiting={() => setIsMediaLoading(true)}
              onTimeUpdate={(e) => {
                const video = e.currentTarget;
                if (video.duration && video.duration > 0) {
                  setProgress((video.currentTime / video.duration) * 100);
                }
              }}
              onEnded={() => {
                handleNextSlide();
              }}
              onError={() => {
                setIsMediaLoading(false);
                handleNextSlide();
              }}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
                triggerHaptic('selection');
              }}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-black/60 transition shadow-lg z-30"
              title={isMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        ) : (
          <img
            src={slides[activeSlideIndex]}
            alt={`Slide ${activeSlideIndex + 1}`}
            onLoad={() => setIsMediaLoading(false)}
            onError={(e) => {
              setIsMediaLoading(false);
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop';
            }}
            className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
          />
        )}

        {/* Bottom-Left Story Caption & Comments Stack (No background boxes) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-4 right-16 z-30 flex flex-col items-start gap-1.5 pointer-events-auto select-none max-w-[85%]"
        >
          {/* Story Caption (Transparent, no background, with text-shadow) */}
          {currentStory.caption && (
            <div className="text-white text-xs font-semibold leading-normal drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] [text-shadow:_0_2px_6px_rgba(0,0,0,0.95)] max-h-20 overflow-y-auto no-scrollbar pr-2">
              {currentStory.caption}
            </div>
          )}

          {/* Bottom-Left Backgroundless Carousel for Comments */}
          {!currentStory.hideComments && curComment && (
            <div
              onTouchStart={handleCarouselTouchStart}
              onTouchEnd={handleCarouselTouchEnd}
              onWheel={(e) => {
                if (e.deltaY > 0) handleCarouselNext();
                else if (e.deltaY < 0) handleCarouselPrev();
              }}
              className="flex flex-col items-start cursor-pointer w-full"
            >
              <div className="relative flex flex-col items-start gap-1">
                {/* Stacked Carousel Layer Behind (Next comment peek) */}
                {comments.length > 1 && nextComment && (
                  <div className="opacity-45 scale-95 origin-left pointer-events-none transition-all duration-300 flex items-center gap-1 text-[11px] text-white font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_3px_rgba(0,0,0,0.95)]">
                    <span className="font-bold opacity-80">{nextComment.userName}:</span>
                    <span className="opacity-75">{formatSnippet(nextComment.text)}</span>
                  </div>
                )}

                {/* Foreground Active Comment (Truncated to 10 chars, No background box/bubble) */}
                <div
                  onClick={() => {
                    setShowCommentsModal(true);
                    setIsPaused(true);
                  }}
                  className="flex items-center gap-1.5 text-xs text-white font-semibold drop-shadow-[0_1.5px_4px_rgba(0,0,0,0.95)] [text-shadow:_0_1.5px_4px_rgba(0,0,0,0.95)] hover:opacity-90 transition active:scale-98"
                >
                  <div className="h-5 w-5 rounded-full bg-sky-500 text-white flex items-center justify-center text-[9px] font-bold shrink-0 shadow-sm">
                    {curComment.userName?.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="font-bold text-sky-300 drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.95)]">
                    {curComment.userName}:
                  </span>
                  <span className="text-white font-semibold drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.95)]">
                    {formatSnippet(curComment.text)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

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

      {/* Bottom Interactive Bar (Comment Input Only) */}
      <div
        className="relative z-30 p-3 pb-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {!currentStory.hideComments ? (
            <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => {
                  setIsCommentInputFocused(true);
                  setIsPaused(true);
                }}
                onBlur={() => {
                  setIsCommentInputFocused(false);
                  setIsPaused(false);
                }}
                placeholder="Отправить сообщение..."
                className="flex-1 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs placeholder:text-white/60 outline-none focus:ring-1 focus:ring-sky-400/50"
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

          {/* View Comments Drawer Toggle */}
          <button
            onClick={() => {
              setShowCommentsModal(true);
              setIsPaused(true);
            }}
            className="relative h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            <MessageCircle size={14} />
            <span>{(currentStory.comments || []).length}</span>
          </button>
        </div>
      </div>

      {/* Temporary Floating Reaction Picker (Opens on Long-Press & Auto-Pauses Story) */}
      {showReactionPicker && !currentStory.hideReactions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in select-none"
          onClick={() => {
            setShowReactionPicker(false);
            setIsPaused(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-3.5 rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-2xl flex items-center gap-2.5 animate-scale-up"
          >
            {allowedEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setShowReactionPicker(false);
                  setIsPaused(false);
                  handleAddReaction(emoji);
                }}
                className="h-11 w-11 rounded-2xl bg-white/10 hover:bg-sky-500/30 hover:scale-125 border border-white/15 text-2xl flex items-center justify-center transition active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Light-Theme Platform-Style Comments Drawer / Modal */}
      {showCommentsModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex flex-col justify-end animate-fade-in"
          onClick={() => {
            setShowCommentsModal(false);
            setIsPaused(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto h-[65vh] rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col p-4 animate-slide-up shadow-2xl select-none"
          >
            {/* Light-Theme Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-sky-500" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Комментарии</h4>
                <span className="text-xs text-slate-400 font-medium">
                  ({(currentStory.comments || []).length})
                </span>
              </div>
              <button
                onClick={() => {
                  setShowCommentsModal(false);
                  setIsPaused(false);
                }}
                className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Platform-Style Chat Message Bubbles */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-3">
              {(currentStory.comments || []).length > 0 ? (
                currentStory.comments?.map((c) => {
                  const isMe = currentUser?.id && String(currentUser.id) === String(c.userId);
                  return (
                    <div
                      key={c.id}
                      className={`flex gap-2.5 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                        {c.userName.substring(0, 2).toUpperCase()}
                      </div>
                      <div
                        className={`max-w-[78%] p-3 rounded-2xl shadow-sm text-xs ${
                          isMe
                            ? 'bg-sky-500 text-white rounded-br-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/60 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-bold text-[11px] ${isMe ? 'text-sky-100' : 'text-sky-600 dark:text-sky-400'}`}>
                            {c.userName}
                          </span>
                          <span className={`text-[9px] ${isMe ? 'text-sky-200' : 'text-slate-400'}`}>
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="break-words leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <MessageCircle size={36} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-500">Пока нет комментариев</p>
                  <p className="text-[11px] text-slate-400">Напишите первый комментарий под этой историей</p>
                </div>
              )}
            </div>

            {/* Light-Theme Drawer Input */}
            {!currentStory.hideComments && (
              <form onSubmit={handleSendComment} className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onFocus={() => {
                    setIsCommentInputFocused(true);
                    setIsPaused(true);
                  }}
                  onBlur={() => {
                    setIsCommentInputFocused(false);
                  }}
                  placeholder="Написать комментарий..."
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white font-semibold text-xs shadow-md transition"
                >
                  <Send size={15} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Story Deletion Modal */}
      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-xs rounded-3xl p-5 bg-slate-900 border border-slate-700/80 text-white shadow-2xl space-y-4 text-center select-none animate-scale-up">
            <div className="h-12 w-12 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold">Удалить историю?</h4>
              <p className="text-xs text-slate-400 mt-1">
                История будет безвозвратно удалена для всех зрителей.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
