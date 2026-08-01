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
  Flag,
  Ban,
  Loader2,
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
  const [activeMenuNewsId, setActiveMenuNewsId] = useState<string | null>(null);
  const [doubleTapHeart, setDoubleTapHeart] = useState<{ id: string; x: number; y: number } | null>(null);
  const lastTapMap = useRef<{ [key: string]: number }>({});
  const tapTimeoutMap = useRef<{ [key: string]: any }>({});

  // In-app Notification / Toast & Action Modals State
  const [commentInput, setCommentInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newsToDelete, setNewsToDelete] = useState<NewsItem | null>(null);
  const [newsToReport, setNewsToReport] = useState<NewsItem | null>(null);
  const [reportReasonInput, setReportReasonInput] = useState('');
  const [userToBlock, setUserToBlock] = useState<{ userId: string; userName: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

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

  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isStoriesLoading, setIsStoriesLoading] = useState(false);

  // Load News from API
  const loadNews = async () => {
    setIsNewsLoading(true);
    try {
      const fetched = await api.getNews();
      if (Array.isArray(fetched)) {
        setNewsList(fetched);
        localStorage.setItem('orbit_news_cache', JSON.stringify(fetched));
      }
    } catch (err) {
      console.error('Failed to load news:', err);
    } finally {
      setIsNewsLoading(false);
    }
  };

  // Load Stories from API
  const loadStories = async () => {
    setIsStoriesLoading(true);
    try {
      const list = await api.getStories();
      if (Array.isArray(list)) {
        setStories(list);
        localStorage.setItem('orbit_stories_cache', JSON.stringify(list));
      }
    } catch (err) {
      console.error('Failed to load stories:', err);
    } finally {
      setIsStoriesLoading(false);
    }
  };

  useEffect(() => {
    loadNews();

    const unsubNewNews = socketService.subscribe('new_news', (data) => {
      if (data.news) {
        setNewsList((prev) => {
          const exists = prev.some((n) => n.id === data.news.id);
          const next = exists ? prev.map((n) => (n.id === data.news.id ? data.news : n)) : [data.news, ...prev];
          localStorage.setItem('orbit_news_cache', JSON.stringify(next));
          return next;
        });
      }
    });

    const unsubNewsUpdated = socketService.subscribe('news_updated', (data) => {
      if (data.news) {
        setNewsList((prev) => {
          const next = prev.map((n) => (n.id === data.news.id ? data.news : n));
          localStorage.setItem('orbit_news_cache', JSON.stringify(next));
          return next;
        });
        setActiveNewsModal((prev) => (prev?.id === data.news.id ? data.news : prev));
      }
    });

    const unsubNewsDeleted = socketService.subscribe('news_deleted', (data) => {
      if (data.newsId) {
        setNewsList((prev) => {
          const next = prev.filter((n) => n.id !== data.newsId);
          localStorage.setItem('orbit_news_cache', JSON.stringify(next));
          return next;
        });
        setActiveNewsModal((prev) => (prev?.id === data.newsId ? null : prev));
      }
    });

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
        unsubNewNews();
        unsubNewsUpdated();
        unsubNewsDeleted();
        unsubNewStory();
        unsubStoryUpdated();
        unsubStoryDeleted();
      };
    } else {
      return () => {
        unsubNewNews();
        unsubNewsUpdated();
        unsubNewsDeleted();
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
    if (!title.trim() && !content.trim()) {
      alert('Заполните заголовок или текст новости');
      return;
    }
    if (isPublishing) return;

    setIsPublishing(true);
    try {
      if (editingNews) {
        const res = await api.updateNews(editingNews.id, {
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          mediaUrl: mediaUrl.trim() || undefined,
          tag: tag.trim() || 'Новости',
          mediaType,
        });
        if (res.success && res.news) {
          setNewsList((prev) => prev.map((n) => (n.id === editingNews.id ? res.news : n)));
          if (activeNewsModal && activeNewsModal.id === editingNews.id) {
            setActiveNewsModal(res.news);
          }
        }
      } else {
        const created = await api.createNews(title.trim(), content.trim(), {
          tag: tag.trim() || 'Новости',
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType,
        });
        setNewsList((prev) => {
          const exists = prev.some((n) => n.id === created.id);
          if (exists) return prev;
          return [created, ...prev];
        });
        if (onAddNews) onAddNews(created);
      }
      setShowCreateModal(false);
      setEditingNews(null);
      setTitle('');
      setContent('');
      setMediaUrl('');
    } catch (err: any) {
      alert(err.message || 'Ошибка сохранения новости');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStartEditNews = (n: NewsItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingNews(n);
    setTitle(n.title || '');
    setContent(n.content || '');
    setTag(n.tag || 'Новости');
    setMediaUrl(n.mediaUrl || '');
    setMediaType(n.mediaType || 'image');
    setShowCreateModal(true);
  };

  const handleDeleteNews = (newsItem: NewsItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuNewsId(null);
    setNewsToDelete(newsItem);
  };

  const confirmDeleteNews = async () => {
    if (!newsToDelete) return;
    const targetId = newsToDelete.id;
    setNewsToDelete(null);

    try {
      await api.deleteNews(targetId);
    } catch (err: any) {
      console.error('Error deleting news:', err);
    } finally {
      setNewsList((prev) => {
        const next = prev.filter((n) => n.id !== targetId);
        localStorage.setItem('orbit_news_cache', JSON.stringify(next));
        return next;
      });
      if (activeNewsModal?.id === targetId) setActiveNewsModal(null);
      showToast('Новость успешно удалена');
    }
  };

  const handleReportNews = (news: NewsItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuNewsId(null);
    setNewsToReport(news);
    setReportReasonInput('');
  };

  const confirmReportNews = async () => {
    if (!newsToReport) return;
    const targetNews = newsToReport;
    const reason = reportReasonInput.trim() || 'Нарушение правил';
    setNewsToReport(null);
    setReportReasonInput('');

    try {
      const res = await api.reportNews(targetNews.id, reason);
      showToast(res.message || 'Жалоба отправлена модераторам');
    } catch (err: any) {
      showToast('Жалоба принята на рассмотрение');
    }
  };

  const handleBlockUser = (news: NewsItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuNewsId(null);
    if (!news.userId) {
      showToast('Невозможно заблокировать этого автора');
      return;
    }
    setUserToBlock({ userId: news.userId, userName: news.authorName || 'Пользователь' });
  };

  const confirmBlockUser = async () => {
    if (!userToBlock) return;
    const targetUserId = userToBlock.userId;
    const name = userToBlock.userName;
    setUserToBlock(null);

    try {
      await api.blockUser(targetUserId);
    } catch (err: any) {
      console.error('Error blocking user:', err);
    } finally {
      setNewsList((prev) => {
        const next = prev.filter((n) => n.userId !== targetUserId);
        localStorage.setItem('orbit_news_cache', JSON.stringify(next));
        return next;
      });
      if (activeNewsModal && activeNewsModal.userId === targetUserId) setActiveNewsModal(null);
      showToast(`Пользователь ${name} заблокирован`);
    }
  };

  const handleNewsCardClick = (n: NewsItem, e: React.MouseEvent) => {
    const now = Date.now();
    const lastTap = lastTapMap.current[n.id] || 0;

    if (now - lastTap < 300) {
      // Double tap detected!
      if (tapTimeoutMap.current[n.id]) {
        clearTimeout(tapTimeoutMap.current[n.id]);
        tapTimeoutMap.current[n.id] = null;
      }

      // Trigger instant reaction / like
      handleToggleLike(n.id);

      // Heart animation
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDoubleTapHeart({ id: n.id, x, y });
      setTimeout(() => setDoubleTapHeart(null), 800);

      lastTapMap.current[n.id] = 0;
    } else {
      lastTapMap.current[n.id] = now;
      tapTimeoutMap.current[n.id] = setTimeout(() => {
        setActiveNewsModal(n);
        lastTapMap.current[n.id] = 0;
      }, 300);
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
    <div className="w-full px-4 pb-24 space-y-3 mt-1 select-none">
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

      {/* Floating Plus Button for Adding News (Platform Style) */}
      <button
        type="button"
        onClick={() => {
          if (isGuest) {
            onOpenAuth();
          } else {
            setEditingNews(null);
            setTitle('');
            setContent('');
            setMediaUrl('');
            setShowCreateModal(true);
          }
        }}
        className="fixed bottom-20 right-5 z-40 h-13 w-13 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/25"
        title="Опубликовать новость"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* News Feed List (Redesigned Compact Block matching user photo) */}
      <div className="space-y-3">
        {(() => {
          const displayedNewsList = isGuest
            ? newsList.filter((n) => {
                const tagLower = (n.tag || '').toLowerCase();
                const authorLower = (n.authorName || '').toLowerCase();
                const isDevTag =
                  tagLower.includes('обновлен') ||
                  tagLower.includes('dev') ||
                  tagLower.includes('план') ||
                  tagLower.includes('разработ') ||
                  tagLower.includes('релиз') ||
                  tagLower.includes('безопасн') ||
                  tagLower.includes('инфо') ||
                  tagLower.includes('важн') ||
                  tagLower.includes('система');
                const isDevAuthor =
                  authorLower.includes('orbit') ||
                  authorLower.includes('разраб') ||
                  authorLower.includes('admin') ||
                  authorLower.includes('система') ||
                  authorLower.includes('команда');
                return isDevTag || isDevAuthor;
              })
            : newsList;

          if (isNewsLoading && displayedNewsList.length === 0) {
            return (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
                  <Loader2 size={18} className="animate-spin text-sky-500 absolute" />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 animate-pulse">
                  Загрузка новостей с сервера...
                </span>
              </div>
            );
          }

          if (displayedNewsList.length === 0) {
            return (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 text-center text-slate-400 text-xs">
                {isGuest ? 'Официальных новостей разработок пока нет.' : 'Новостей пока нет. Будьте первым, кто опубликует!'}
              </div>
            );
          }

          return displayedNewsList.map((n) => {
            const isOwnerOrAdmin =
              currentUser &&
              (n.userId === currentUser.id ||
                currentUser.role === 'admin' ||
                currentUser.role === 'sysadmin' ||
                currentUser.username.toLowerCase() === 'admin' ||
                currentUser.handle.toLowerCase() === '@admin');

            return (
              <div
                key={n.id}
                onClick={(e) => handleNewsCardClick(n, e)}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-4 shadow-sm hover:shadow-md transition cursor-pointer relative group overflow-hidden"
              >
                {/* Floating Heart Effect on Double Tap */}
                {doubleTapHeart?.id === n.id && (
                  <div
                    style={{ left: doubleTapHeart.x, top: doubleTapHeart.y }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none animate-ping text-rose-500 drop-shadow-lg"
                  >
                    <Heart size={48} className="fill-rose-500 text-rose-500" />
                  </div>
                )}

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

                  <div className="flex items-center gap-1 shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40">
                      {n.tag}
                    </span>

                    {/* Author/Admin Actions (Edit / Delete) */}
                    {isOwnerOrAdmin ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={(e) => handleStartEditNews(n, e)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-sky-500 transition"
                          title="Редактировать"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteNews(n, e)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition"
                          title="Удалить"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      /* Non-Author / Non-Admin Actions (Dropdown menu: Report / Block) */
                      currentUser && (
                        <div className="relative ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuNewsId(activeMenuNewsId === n.id ? null : n.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Опции"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {activeMenuNewsId === n.id && (
                            <div className="absolute right-0 top-7 z-30 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 animate-fade-in text-xs font-medium">
                              <button
                                onClick={(e) => handleReportNews(n, e)}
                                className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-amber-600 dark:text-amber-400 transition"
                              >
                                <Flag size={13} />
                                <span>Пожаловаться на новость</span>
                              </button>
                              {n.userId && n.userId !== currentUser.id && (
                                <button
                                  onClick={(e) => handleBlockUser(n, e)}
                                  className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-rose-600 dark:text-rose-400 transition"
                                >
                                  <Ban size={13} />
                                  <span>Заблокировать автора</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Body Content Row: Title & Content */}
                <div className="my-2.5">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight line-clamp-2">
                    {n.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-3 whitespace-pre-wrap">
                    {n.content}
                  </p>
                </div>

                {/* Media Attachment (Photo / Video) - ONLY IF mediaUrl exists! Zero empty frames when no photo */}
                {n.mediaUrl && (
                  <div className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-900 my-2.5">
                    {n.mediaType === 'video' ? (
                      <video src={n.mediaUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={n.mediaUrl} alt={n.title} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}

                {/* Footer Row: Timestamp & Interactive Buttons */}
                <div className="flex items-center justify-between text-slate-400 text-xs pt-2 mt-1 border-t border-slate-50 dark:border-slate-800/50">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock size={12} />
                    <span>{n.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleToggleLike(n.id, e)}
                      className={`flex items-center gap-1 transition ${
                        n.userLiked ? 'text-rose-500 font-bold' : 'hover:text-rose-500'
                      }`}
                    >
                      <Heart size={14} className={n.userLiked ? 'fill-rose-500' : ''} />
                      <span className="text-xs">{n.likesCount || 0}</span>
                    </button>

                    <div
                      onClick={() => setActiveNewsModal(n)}
                      className="flex items-center gap-1 hover:text-sky-500 transition cursor-pointer"
                    >
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
          });
        })()}
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
              <div className="flex items-center gap-2">
                {currentUser &&
                (activeNewsModal.userId === currentUser.id ||
                  currentUser.role === 'admin' ||
                  currentUser.role === 'sysadmin' ||
                  currentUser.username.toLowerCase() === 'admin' ||
                  currentUser.handle.toLowerCase() === '@admin') ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        const n = activeNewsModal;
                        setActiveNewsModal(null);
                        handleStartEditNews(n, e);
                      }}
                      className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-sky-500 transition"
                      title="Редактировать"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteNews(activeNewsModal.id, e)}
                      className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  currentUser && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleReportNews(activeNewsModal, e)}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-500 transition"
                        title="Пожаловаться"
                      >
                        <Flag size={14} />
                      </button>
                      {activeNewsModal.userId && activeNewsModal.userId !== currentUser.id && (
                        <button
                          onClick={(e) => handleBlockUser(activeNewsModal, e)}
                          className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition"
                          title="Заблокировать автора"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  )
                )}
                <button
                  onClick={() => setActiveNewsModal(null)}
                  className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <X size={16} />
                </button>
              </div>
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
                disabled={isPublishing}
                className="w-full mt-2 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition"
              >
                <span>{isPublishing ? 'Сохранение...' : editingNews ? 'Сохранить изменения' : 'Опубликовать'}</span>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-slate-700 animate-fade-in">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Delete News Confirmation Modal */}
      {newsToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Удалить новость?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                "{newsToDelete.title}"
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setNewsToDelete(null)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmDeleteNews}
                className="flex-1 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report News Modal */}
      {newsToReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <Flag size={18} />
                <span>Пожаловаться</span>
              </div>
              <button
                onClick={() => setNewsToReport(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Укажите причину жалобы на публикацию "{newsToReport.title}":
            </p>
            <textarea
              rows={3}
              value={reportReasonInput}
              onChange={(e) => setReportReasonInput(e.target.value)}
              placeholder="Спам, оскорбления, фейк..."
              className="w-full px-3 py-2 rounded-2xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-white resize-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNewsToReport(null)}
                className="flex-1 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmReportNews}
                className="flex-1 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold shadow-md shadow-amber-500/20 transition"
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Modal */}
      {userToBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xs rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
              <Ban size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Заблокировать {userToBlock.userName}?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Публикации этого автора перестанут быть видимыми для вас.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUserToBlock(null)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmBlockUser}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition"
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
