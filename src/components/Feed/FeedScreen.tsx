import React, { useState, useEffect, useRef } from 'react';
import { NewsItem, Story, User, NewsComment } from '../../types';
import {
  Plus,
  Send,
  X,
  Newspaper,
  Heart,
  MessageSquare,
  Share2,
  Clock,
  MoreVertical,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Check,
  Video,
} from 'lucide-react';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';
import { StoryViewer } from './StoryViewer';
import { StoryCreatorModal } from './StoryCreatorModal';
import { checkVideoDuration, processMediaFileForStory } from '../../utils/media';

interface FeedScreenProps {
  news: NewsItem[];
  currentUser?: User | null;
  isDark?: boolean;
  isGuest?: boolean;
  onOpenAuth?: () => void;
  onAddNews?: (item: NewsItem) => void;
  onRecordVideoCircle?: () => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  news: propNews,
  currentUser,
  isGuest,
  onOpenAuth,
  onAddNews,
}) => {
  // Local News State with cache fallback
  const [newsList, setNewsList] = useState<NewsItem[]>(() => {
    try {
      const cached = localStorage.getItem('orbit_news_cache');
      return cached ? JSON.parse(cached) : propNews || [];
    } catch {
      return propNews || [];
    }
  });

  const [activeNewsModal, setActiveNewsModal] = useState<NewsItem | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Новости');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const newsFileInputRef = useRef<HTMLInputElement>(null);

  // Stories State with instant localStorage cache
  const [stories, setStories] = useState<Story[]>(() => {
    try {
      const cached = localStorage.getItem('orbit_stories_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [showAddStoryModal, setShowAddStoryModal] = useState(false);
  const [storyImageUrl, setStoryImageUrl] = useState('');
  const [storyCaption, setStoryCaption] = useState('');
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  // Load News from API
  const loadNews = async () => {
    try {
      const fetched = await api.getNews();
      if (Array.isArray(fetched) && fetched.length > 0) {
        setNewsList(fetched);
        localStorage.setItem('orbit_news_cache', JSON.stringify(fetched));
      }
    } catch (err) {
      console.error('Failed to load news:', err);
    }
  };

  // Load Stories from API
  const loadStories = async () => {
    try {
      const list = await api.getStories();
      if (Array.isArray(list)) {
        setStories(list);
        localStorage.setItem('orbit_stories_cache', JSON.stringify(list));
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  };

  useEffect(() => {
    loadNews();
    if (!isGuest) {
      loadStories();

      const unsubNewStory = socketService.subscribe('new_story', (data) => {
        if (data.story) {
          setStories((prev) => {
            const exists = prev.some((s) => s.id === data.story.id);
            const next = exists ? prev.map((s) => (s.id === data.story.id ? data.story : s)) : [data.story, ...prev];
            localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
            return next;
          });
        }
      });

      const unsubStoryUpdated = socketService.subscribe('story_updated', (data) => {
        if (data.story) {
          setStories((prev) => {
            const next = prev.map((s) => (s.id === data.story.id ? { ...s, ...data.story } : s));
            localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
            return next;
          });
        }
      });

      const unsubStoryDeleted = socketService.subscribe('story_deleted', (data) => {
        if (data.storyId) {
          setStories((prev) => {
            const next = prev.filter((s) => s.id !== data.storyId);
            localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
            return next;
          });
        }
      });

      return () => {
        unsubNewStory();
        unsubStoryUpdated();
        unsubStoryDeleted();
      };
    }
  }, [isGuest]);

  const handleLocalStorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        const { valid } = await checkVideoDuration(file, 60);
        if (!valid) {
          alert('Длительность видео не должна превышать 1 минуту (60 секунд).');
          if (e.target) e.target.value = '';
          return;
        }
      }
      const processedUrl = await processMediaFileForStory(file);
      if (processedUrl) {
        setStoryImageUrl(processedUrl);
        setShowAddStoryModal(true);
      }
      if (e.target) e.target.value = '';
    }
  };

  const handleLocalNewsMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVid = file.type.startsWith('video/');
      setMediaType(isVid ? 'video' : 'image');
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMediaUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleLike = async (newsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.toggleNewsLike(newsId);
      if (res.success) {
        setNewsList((prev) =>
          prev.map((n) =>
            n.id === newsId ? { ...n, likesCount: res.likesCount, userLiked: res.userLiked } : n
          )
        );
        if (activeNewsModal && activeNewsModal.id === newsId) {
          setActiveNewsModal((prev) =>
            prev ? { ...prev, likesCount: res.likesCount, userLiked: res.userLiked } : null
          );
        }
      }
    } catch {
      // Ignore
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNewsModal || !commentInput.trim()) return;
    const textToSend = commentInput.trim();
    setCommentInput('');

    try {
      const res = await api.commentOnNews(activeNewsModal.id, textToSend);
      if (res.success && res.comment) {
        const updatedComments = [...(activeNewsModal.comments || []), res.comment];
        const updatedItem = {
          ...activeNewsModal,
          comments: updatedComments,
          commentsCount: updatedComments.length,
        };
        setActiveNewsModal(updatedItem);
        setNewsList((prev) => prev.map((n) => (n.id === updatedItem.id ? updatedItem : n)));
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки комментария');
    }
  };

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (editingNews) {
        const res = await api.updateNews(editingNews.id, {
          title: title.trim(),
          content: content.trim(),
          mediaUrl: mediaUrl.trim() || undefined,
        });
        if (res.success) {
          setNewsList((prev) => prev.map((n) => (n.id === editingNews.id ? res.news : n)));
        }
      } else {
        const created = await api.createNews(title.trim(), content.trim(), {
          tag: tag.trim() || 'Новости',
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType,
        });
        setNewsList((prev) => [created, ...prev]);
        if (onAddNews) onAddNews(created);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения новости');
    } finally {
      setTitle('');
      setContent('');
      setMediaUrl('');
      setShowCreateModal(false);
      setEditingNews(null);
    }
  };

  const handleDeleteNews = async (newsId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту новость?')) return;
    try {
      await api.deleteNews(newsId);
      setNewsList((prev) => prev.filter((n) => n.id !== newsId));
      if (activeNewsModal?.id === newsId) setActiveNewsModal(null);
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
    }
  };

  const handleOpenStory = async (story: Story) => {
    setActiveStory(story);
    if (!story.viewed) {
      try {
        await api.markStoryViewed(story.id);
        setStories((prev) => {
          const next = prev.map((s) => (s.id === story.id ? { ...s, viewed: true } : s));
          localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
          return next;
        });
      } catch {}
    }
  };

  return (
    <div className="px-4 pb-24 space-y-3 mt-1 max-w-xl mx-auto select-none">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={storyFileInputRef}
        accept="image/*,video/*"
        onChange={handleLocalStorySelect}
        className="hidden"
      />
      <input
        type="file"
        ref={newsFileInputRef}
        accept="image/*,video/*"
        onChange={handleLocalNewsMediaSelect}
        className="hidden"
      />

      {/* Stories Horizontal Strip */}
      {!isGuest && (
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          {/* Add story button */}
          <div
            onClick={() => storyFileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
          >
            <div className="relative h-14 w-14 rounded-full p-[2px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500 flex items-center justify-center shadow-xs">
              <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 p-0.5 flex items-center justify-center">
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <div
                    className={`h-full w-full rounded-full bg-gradient-to-br ${
                      currentUser?.avatarColor || 'from-sky-300 to-indigo-200'
                    } flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {currentUser?.initials || 'Я'}
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 h-4.5 w-4.5 rounded-full bg-sky-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                <Plus size={10} strokeWidth={3} />
              </div>
            </div>
            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
              + История
            </span>
          </div>

          {/* Friend Stories */}
          {stories.map((s) => {
            const isUnviewed = !s.viewed;
            return (
              <div
                key={s.id}
                onClick={() => handleOpenStory(s)}
                className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group"
              >
                <div
                  className={`relative h-14 w-14 rounded-full p-[2px] transition-all ${
                    isUnviewed
                      ? 'animate-running-border shadow-md'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                >
                  <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 p-0.5 flex items-center justify-center">
                    {s.userAvatar ? (
                      <img src={s.userAvatar} alt={s.userName} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <div
                        className={`h-full w-full rounded-full bg-gradient-to-br ${
                          s.userColor || 'from-sky-300 to-indigo-200'
                        } flex items-center justify-center text-xs font-bold text-white`}
                      >
                        {s.userInitials || s.userName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[62px]">
                  {s.userName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Action Bar / Create News Input trigger */}
      {isGuest ? (
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Войдите в аккаунт, чтобы публиковать новости и смотреть истории.
          </span>
          <button
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shrink-0"
          >
            Войти
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditingNews(null);
            setTitle('');
            setContent('');
            setMediaUrl('');
            setShowCreateModal(true);
          }}
          className="w-full rounded-2xl p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-between gap-3 text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition">
              <Plus size={16} />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Поделиться новостью или постом...
            </span>
          </div>
          <Newspaper size={16} className="text-slate-400" />
        </button>
      )}

      {/* News Feed List (Redesigned Compact Block matching user photo) */}
      <div className="space-y-3">
        {newsList.map((n) => {
          const isOwnerOrAdmin =
            currentUser &&
            (n.userId === currentUser.id || currentUser.role === 'admin' || currentUser.role === 'sysadmin');

          return (
            <div
              key={n.id}
              onClick={() => setActiveNewsModal(n)}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 shadow-sm hover:shadow-md transition cursor-pointer relative group"
            >
              {/* Header: Author / Tag Row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 p-[1px] shrink-0">
                    {n.authorAvatar ? (
                      <img src={n.authorAvatar} alt="Author" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <div className="h-full w-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {(n.authorName || 'ORBIT').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {n.authorName || 'ORBIT News'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {n.authorHandle || `@${n.tag.toLowerCase()}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40">
                    {n.tag}
                  </span>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={(e) => handleDeleteNews(n.id, e)}
                      className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-300 hover:text-red-500 transition ml-1"
                      title="Удалить"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body Content Row (Flex: Text Left, Thumbnail Right) */}
              <div className="flex items-start justify-between gap-3 my-2.5">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight line-clamp-2">
                    {n.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                    {n.content}
                  </p>
                </div>

                {/* Right Square Thumbnail */}
                {n.mediaUrl ? (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 bg-slate-900">
                    {n.mediaType === 'video' ? (
                      <video src={n.mediaUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={n.mediaUrl} alt={n.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0 border border-slate-100 dark:border-slate-800/80 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-900 flex flex-col items-center justify-center p-2 text-center">
                    <Newspaper size={20} className="text-slate-300 dark:text-slate-600 mb-1" />
                    <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">ORBIT</span>
                  </div>
                )}
              </div>

              {/* Footer Row: Timestamp & Interactive Buttons */}
              <div className="flex items-center justify-between text-slate-400 text-xs pt-2 mt-1 border-t border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock size={12} />
                  <span>{n.timestamp}</span>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => handleToggleLike(n.id, e)}
                    className={`flex items-center gap-1 transition ${
                      n.userLiked ? 'text-rose-500 font-bold' : 'hover:text-rose-500'
                    }`}
                  >
                    <Heart size={14} className={n.userLiked ? 'fill-rose-500' : ''} />
                    <span className="text-xs">{n.likesCount || 0}</span>
                  </button>

                  <div className="flex items-center gap-1 hover:text-sky-500 transition">
                    <MessageSquare size={14} />
                    <span className="text-xs">{n.commentsCount || (n.comments || []).length}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (navigator.share) {
                        navigator.share({ title: n.title, text: n.content }).catch(() => {});
                      } else {
                        alert('Ссылка скопирована!');
                      }
                    }}
                    className="hover:text-sky-500 transition"
                  >
                    <Share2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full News Detail Modal */}
      {activeNewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[90vh] rounded-3xl p-5 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40">
                  {activeNewsModal.tag}
                </span>
                <span className="text-xs text-slate-400">{activeNewsModal.timestamp}</span>
              </div>
              <button
                onClick={() => setActiveNewsModal(null)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                {activeNewsModal.title}
              </h2>

              {activeNewsModal.mediaUrl && (
                <div className="w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-black max-h-72">
                  {activeNewsModal.mediaType === 'video' ? (
                    <video src={activeNewsModal.mediaUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={activeNewsModal.mediaUrl} alt={activeNewsModal.title} className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {activeNewsModal.content}
              </p>

              {/* Likes & Comments Count Header */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  onClick={() => handleToggleLike(activeNewsModal.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition ${
                    activeNewsModal.userLiked
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-500 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Heart size={15} className={activeNewsModal.userLiked ? 'fill-rose-500' : ''} />
                  <span>{activeNewsModal.likesCount || 0} Нравится</span>
                </button>

                <span className="text-slate-400 font-medium">
                  {activeNewsModal.comments?.length || 0} комментариев
                </span>
              </div>

              {/* Comments List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Комментарии</h4>
                {(activeNewsModal.comments || []).length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Пока нет комментариев. Будьте первым!</p>
                ) : (
                  (activeNewsModal.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{c.userName}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment Input Footer */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Написать комментарий..."
                className="flex-1 px-3.5 py-2 rounded-2xl text-xs bg-slate-100 dark:bg-slate-800 border-none outline-none text-slate-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="px-3.5 py-2 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white transition text-xs font-semibold flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      <StoryCreatorModal
        isOpen={showAddStoryModal}
        onClose={() => {
          setShowAddStoryModal(false);
          setStoryImageUrl('');
        }}
        initialImageUrl={storyImageUrl}
        currentUser={currentUser}
        onStoryCreated={(newStory) => {
          setStories((prev) => {
            const next = [newStory, ...prev];
            localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
            return next;
          });
        }}
      />

      {/* Story Viewer */}
      {activeStory && (
        <StoryViewer
          story={activeStory}
          currentUser={currentUser}
          onClose={() => setActiveStory(null)}
          onDeleteStory={(deletedId) => {
            setStories((prev) => {
              const next = prev.filter((s) => s.id !== deletedId);
              localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
              return next;
            });
          }}
          onUpdateStory={(updated) => {
            setStories((prev) => {
              const next = prev.map((s) => (s.id === updated.id ? updated : s));
              localStorage.setItem('orbit_stories_cache', JSON.stringify(next));
              return next;
            });
          }}
        />
      )}

      {/* Create / Edit News Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm rounded-3xl p-5 shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-bold mb-4">
              {editingNews ? 'Редактировать новость' : 'Опубликовать новость'}
            </h3>

            <form onSubmit={handlePublishNews} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Тег / Категория
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Например: Обновление, Важное, Финансы"
                  className="w-full px-3.5 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Заголовок
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Заголовок новости..."
                  className="w-full px-3.5 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Текст новости
                </label>
                <textarea
                  required
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Введите подробности..."
                  className="w-full px-3.5 py-2 rounded-2xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Media Attachment Button */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300">
                  Прикрепить медиафайлы
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => newsFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition"
                  >
                    <ImageIcon size={14} />
                    <span>Выбрать с устройства</span>
                  </button>
                  {mediaUrl && (
                    <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                      <Check size={12} /> Медиа прикреплено
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition"
              >
                <span>{editingNews ? 'Сохранить изменения' : 'Опубликовать'}</span>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
