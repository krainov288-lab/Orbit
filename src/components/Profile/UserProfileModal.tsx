import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Contact } from '../../types';
import {
  X,
  MessageSquare,
  Phone,
  UserPlus,
  UserCheck,
  Image,
  Music,
  FileText,
  Link2,
  ExternalLink,
  Download,
  Play,
  Volume2,
  Radio,
  FileCode,
  Calendar,
  Layers,
} from 'lucide-react';

interface UserProfileModalProps {
  targetUserId: string;
  currentUserId?: string;
  onClose: () => void;
  onOpenChat?: (contact: Contact) => void;
  onTriggerCall?: (contact: Contact) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  targetUserId,
  currentUserId,
  onClose,
  onOpenChat,
  onTriggerCall,
}) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    handle: string;
    initials: string;
    avatarColor: string;
    avatarUrl?: string;
    phone?: string;
    isOnline: boolean;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    isFollower: boolean;
    sharedMedia: {
      id: string;
      type: 'media' | 'audio' | 'document' | 'link';
      url: string;
      name: string;
      size?: string;
      duration?: number;
      timestamp: number;
    }[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'media' | 'audio' | 'document' | 'link'>('media');
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getUserPublicProfile(targetUserId)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          setIsFollowing(data.isFollowing);
          setFollowersCount(data.followersCount);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load user profile:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUserId]);

  const handleToggleFollow = async () => {
    if (!profile) return;
    const previousState = isFollowing;
    const previousCount = followersCount;

    setIsFollowing(!previousState);
    setFollowersCount(previousState ? previousCount - 1 : previousCount + 1);

    try {
      if (previousState) {
        await api.unfollowUser(targetUserId);
      } else {
        await api.followUser(targetUserId);
      }
    } catch {
      // Revert on failure
      setIsFollowing(previousState);
      setFollowersCount(previousCount);
    }
  };

  const handleStartChat = () => {
    if (!profile) return;
    const contactObj: Contact = {
      id: profile.id,
      name: profile.username,
      initials: profile.initials,
      color: profile.avatarColor,
      avatarUrl: profile.avatarUrl,
      handle: profile.handle,
      last: '',
      time: 'сейчас',
      unread: 0,
      isOnline: profile.isOnline,
    };
    onClose();
    if (onOpenChat) {
      onOpenChat(contactObj);
    }
  };

  const mediaItems = profile?.sharedMedia?.filter((m) => m.type === 'media') || [];
  const audioItems = profile?.sharedMedia?.filter((m) => m.type === 'audio') || [];
  const documentItems = profile?.sharedMedia?.filter((m) => m.type === 'document') || [];
  const linkItems = profile?.sharedMedia?.filter((m) => m.type === 'link') || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-white animate-scale-up"
      >
        {/* Modal Header Bar */}
        <div className="relative px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full">
              Профиль пользователя
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-8 w-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Загрузка профиля...</span>
          </div>
        ) : !profile ? (
          <div className="p-8 text-center text-slate-400 text-xs">Не удалось загрузить данные пользователя</div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
            {/* User Profile Card */}
            <div className="glass-card rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm flex flex-col items-center text-center relative">
              {/* Avatar with status badge */}
              <div className="relative mb-3">
                <div className="h-20 w-20 rounded-full p-[2px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500 shadow-md">
                  <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 p-0.5 flex items-center justify-center">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={profile.username}
                        className="h-full w-full rounded-full object-cover cursor-pointer hover:opacity-90 transition"
                        onClick={() => setSelectedPreviewUrl(profile.avatarUrl!)}
                      />
                    ) : (
                      <div
                        className={`h-full w-full rounded-full bg-gradient-to-br ${profile.avatarColor} flex items-center justify-center text-xl font-bold text-white`}
                      >
                        {profile.initials}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${
                    profile.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  title={profile.isOnline ? 'В сети' : 'Не в сети'}
                />
              </div>

              {/* Names */}
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {profile.firstName || profile.lastName
                  ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
                  : profile.username}
              </h3>
              <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mt-0.5">{profile.handle}</p>

              {/* Stats & Online state */}
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  <span className="font-bold text-slate-800 dark:text-white mr-1">{followersCount}</span>
                  <span>подписчиков</span>
                </div>
                <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-white mr-1">{profile.followingCount}</span>
                  <span>подписок</span>
                </div>
              </div>

              {/* Action Buttons: Message / Call / Follow */}
              <div className="grid grid-cols-3 gap-2 w-full mt-4">
                <button
                  onClick={handleStartChat}
                  className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <MessageSquare size={14} />
                  <span>Чат</span>
                </button>

                <button
                  onClick={() => {
                    if (onTriggerCall) {
                      const contactObj: Contact = {
                        id: profile.id,
                        name: profile.username,
                        initials: profile.initials,
                        color: profile.avatarColor,
                        avatarUrl: profile.avatarUrl,
                        handle: profile.handle,
                        last: '',
                        time: 'сейчас',
                        unread: 0,
                        isOnline: profile.isOnline,
                      };
                      onTriggerCall(contactObj);
                    }
                  }}
                  className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                >
                  <Phone size={14} />
                  <span>Звонок</span>
                </button>

                <button
                  onClick={handleToggleFollow}
                  className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                    isFollowing
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                  <span>{isFollowing ? 'Вы подписаны' : 'Читать'}</span>
                </button>
              </div>
            </div>

            {/* Shared Media Section Header & Folders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-sky-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Архив общих медиа
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">
                  {profile.sharedMedia?.length || 0} файлов
                </span>
              </div>

              {/* Folder Tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                <button
                  onClick={() => setActiveTab('media')}
                  className={`py-1.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1 transition ${
                    activeTab === 'media'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Image size={13} />
                  <span className="hidden sm:inline">Медиа</span>
                  <span className="text-[10px] opacity-75">({mediaItems.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('audio')}
                  className={`py-1.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1 transition ${
                    activeTab === 'audio'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Music size={13} />
                  <span className="hidden sm:inline">Аудио</span>
                  <span className="text-[10px] opacity-75">({audioItems.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('document')}
                  className={`py-1.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1 transition ${
                    activeTab === 'document'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <FileText size={13} />
                  <span className="hidden sm:inline">Файлы</span>
                  <span className="text-[10px] opacity-75">({documentItems.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('link')}
                  className={`py-1.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1 transition ${
                    activeTab === 'link'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Link2 size={13} />
                  <span className="hidden sm:inline">Ссылки</span>
                  <span className="text-[10px] opacity-75">({linkItems.length})</span>
                </button>
              </div>

              {/* Folder Items Container */}
              <div className="min-h-[160px] max-h-[280px] overflow-y-auto no-scrollbar rounded-2xl p-2 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800">
                {/* 1. MEDIA COLLAGE */}
                {activeTab === 'media' && (
                  mediaItems.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedPreviewUrl(item.url)}
                          className="group relative aspect-square rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-pointer border border-slate-300/40 dark:border-slate-700/40 shadow-xs hover:opacity-90 transition"
                        >
                          <img
                            src={item.url}
                            alt="Media"
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-200"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <Image size={18} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-1">
                      <Image size={28} strokeWidth={1.5} />
                      <p className="text-xs font-medium">Нет пересланных медиафайлов</p>
                    </div>
                  )
                )}

                {/* 2. AUDIO */}
                {activeTab === 'audio' && (
                  audioItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {audioItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
                        >
                          <div className="h-9 w-9 rounded-full bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                            <Volume2 size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {item.name || 'Аудиозапись'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>
                                {new Date(item.timestamp).toLocaleDateString([], {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                              {item.duration && <span>{Math.round(item.duration)} сек.</span>}
                            </div>
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-sky-500 hover:text-white transition"
                          >
                            <Play size={14} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-1">
                      <Music size={28} strokeWidth={1.5} />
                      <p className="text-xs font-medium">Нет пересланных голосовых и аудио</p>
                    </div>
                  )
                )}

                {/* 3. DOCUMENTS */}
                {activeTab === 'document' && (
                  documentItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {documentItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
                        >
                          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {item.name || 'Документ'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>
                                {new Date(item.timestamp).toLocaleDateString([], {
                                  day: '2-digit',
                                  month: '2-digit',
                                })}
                              </span>
                              {item.size && <span>{item.size}</span>}
                            </div>
                          </div>
                          <a
                            href={item.url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500 hover:text-white transition"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-1">
                      <FileText size={28} strokeWidth={1.5} />
                      <p className="text-xs font-medium">Нет пересланных документов</p>
                    </div>
                  )
                )}

                {/* 4. LINKS */}
                {activeTab === 'link' && (
                  linkItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {linkItems.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition group"
                        >
                          <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                            <Link2 size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-sky-500 transition">
                              {item.name || item.url}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.url}
                            </div>
                          </div>
                          <ExternalLink size={14} className="text-slate-400 group-hover:text-sky-500 shrink-0" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-slate-400 gap-1">
                      <Link2 size={28} strokeWidth={1.5} />
                      <p className="text-xs font-medium">Нет сохраненных веблинков</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Image Preview Modal */}
      {selectedPreviewUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPreviewUrl(null)}
        >
          <button
            onClick={() => setSelectedPreviewUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition z-10"
          >
            <X size={20} />
          </button>
          <img
            src={selectedPreviewUrl}
            alt="Preview"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
