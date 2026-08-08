import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  LogOut,
  Copy,
  Check,
  Edit3,
  Settings,
  Bell,
  BellOff,
  UserX,
  UserPlus,
  Clock,
  Link,
  Share2,
  BarChart2,
  TrendingUp,
  Plus,
  Loader2,
  Search,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { ChannelGroup, User } from '../../types';
import { api } from '../../services/api';
import { ChannelAnalyticsDashboard } from './ChannelAnalyticsDashboard';
import { WallpaperModal, WallpaperSettings } from './WallpaperModal';

interface ChannelGroupModalProps {
  channelGroupId: string;
  currentUser?: User | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onUpdated?: (updated: ChannelGroup) => void;
  onLeft?: (id: string) => void;
}

export const ChannelGroupModal: React.FC<ChannelGroupModalProps> = ({
  channelGroupId,
  currentUser,
  onClose,
  onDeleted,
  onUpdated,
  onLeft,
}) => {
  const [loading, setLoading] = useState(true);
  const [cg, setCg] = useState<(ChannelGroup & { members?: any[] }) | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'analytics' | 'settings'>('about');

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState<any>('public_channel');
  const [editAllowCalls, setEditAllowCalls] = useState(true);
  const [editSlowMode, setEditSlowMode] = useState(0);
  const [editDisableReactions, setEditDisableReactions] = useState(false);
  const [editAllowedReactions, setEditAllowedReactions] = useState<string[]>(['❤️', '👍', '🔥', '😂', '😮']);
  const [editDisableComments, setEditDisableComments] = useState(false);
  const [editDisableForwarding, setEditDisableForwarding] = useState(false);

  // Background Customization State
  const [editBgPattern, setEditBgPattern] = useState('default');
  const [editBgOpacity, setEditBgOpacity] = useState(35);
  const [editBgAdaptTheme, setEditBgAdaptTheme] = useState(true);
  const [editBgImageUrl, setEditBgImageUrl] = useState('');
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);

  const AVAILABLE_EMOJIS = ['❤️', '👍', '🔥', '😂', '😮', '😢', '🙏', '🎉', '💯', '💩', '😍', '👏'];

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Invite member modal state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberListSearchQuery, setMemberListSearchQuery] = useState('');
  const [memberListSortMode, setMemberListSortMode] = useState<'role' | 'alphabet' | 'recent'>('role');
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);

  useEffect(() => {
    if (showAddMemberModal) {
      api.getContacts().then((contacts) => {
        setFollowersList(contacts || []);
      }).catch(() => {});
    }
  }, [showAddMemberModal]);

  const handleInviteUser = async (targetUser?: any) => {
    if (!cg) return;
    setIsInvitingMember(true);
    try {
      const res = await api.inviteChannelMember(cg.id, {
        targetUserId: targetUser?.id,
        search: !targetUser ? memberSearchQuery : undefined,
      });
      if (res.success && res.channelGroup) {
        setCg(res.channelGroup);
        if (onUpdated) onUpdated(res.channelGroup);
        showToast(res.message || 'Участник успешно добавлен!');
        setShowAddMemberModal(false);
        setMemberSearchQuery('');
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка добавления участника');
    } finally {
      setIsInvitingMember(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getChannelGroupDetails(channelGroupId);
      setCg(data);
      setEditTitle(data.title);
      setEditDesc(data.description || '');
      setEditType(data.type);
      setEditAllowCalls(data.allowCalls !== false);
      setEditSlowMode(data.slowMode || 0);
      setEditDisableReactions(!!data.disableReactions);
      setEditAllowedReactions(data.allowedReactions && data.allowedReactions.length > 0 ? data.allowedReactions : ['❤️', '👍', '🔥', '😂', '😮']);
      setEditDisableComments(!!data.disableComments);
      setEditDisableForwarding(!!data.disableForwarding);
      setEditBgPattern(data.bgPattern || 'default');
      setEditBgOpacity(data.bgOpacity ?? 35);
      setEditBgAdaptTheme(data.bgAdaptTheme ?? true);
      setEditBgImageUrl(data.bgImageUrl || '');
    } catch (err: any) {
      console.error('Error loading channel details:', err);
      showToast('Не удалось загрузить данные канала');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [channelGroupId]);

  if (!cg && loading) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 text-center text-slate-500 shadow-2xl">
          <div className="h-8 w-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Загрузка данных канала...</span>
        </div>
      </div>
    );
  }

  if (!cg) return null;

  const currentUserId = currentUser?.id;
  const isCreator = cg.creatorId === currentUserId;
  const isAdmin = (cg.adminIds || []).includes(currentUserId || '');
  const isModerator = (cg.moderatorIds || []).includes(currentUserId || '');
  const isSysAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sysadmin';
  const canManage = isCreator || isAdmin || isSysAdmin;

  const isChannel = cg.type.includes('channel');

  const handleCopyLink = () => {
    const link = cg.inviteLink || `https://orbit.app/join/${cg.handle?.replace('@', '')}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Ссылка скопирована!');
  };

  const handleSaveSettings = async () => {
    try {
      const res = await api.updateChannelGroup(cg.id, {
        title: editTitle,
        description: editDesc,
        type: editType,
        allowCalls: editAllowCalls,
        slowMode: editSlowMode,
        disableReactions: editDisableReactions,
        allowedReactions: editAllowedReactions,
        disableComments: editDisableComments,
        disableForwarding: editDisableForwarding,
        bgPattern: editBgPattern,
        bgOpacity: editBgOpacity,
        bgAdaptTheme: editBgAdaptTheme,
        bgImageUrl: editBgImageUrl,
      });
      if (res.success) {
        showToast('Настройки канала сохранены');
        setIsEditing(false);
        loadDetails();
        onUpdated?.(res.channelGroup);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка при сохранении настроек');
    }
  };

  const handleSaveWallpaperFromModal = async (newSettings: WallpaperSettings) => {
    setEditBgPattern(newSettings.preset);
    setEditBgOpacity(newSettings.opacity);
    setEditBgAdaptTheme(newSettings.adaptTheme);
    setEditBgImageUrl(newSettings.imageUrl || '');

    try {
      const res = await api.updateChannelGroup(cg.id, {
        bgPattern: newSettings.preset,
        bgOpacity: newSettings.opacity,
        bgAdaptTheme: newSettings.adaptTheme,
        bgImageUrl: newSettings.imageUrl || '',
      });
      if (res.success) {
        showToast('Задний фон канала/группы сохранен для всех!');
        loadDetails();
        onUpdated?.(res.channelGroup);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка сохранения фона');
    }
  };

  const toggleEmojiAllowed = (emoji: string) => {
    if (editAllowedReactions.includes(emoji)) {
      if (editAllowedReactions.length === 1) {
        showToast('Должна остаться хотя бы 1 реакция');
        return;
      }
      setEditAllowedReactions(editAllowedReactions.filter((e) => e !== emoji));
    } else {
      if (editAllowedReactions.length >= 5) {
        showToast('Можно выбрать не более 5 реакций');
        return;
      }
      setEditAllowedReactions([...editAllowedReactions, emoji]);
    }
  };

  const handleDeleteChannel = async () => {
    try {
      const res = await api.deleteChannelGroup(cg.id);
      if (res.success) {
        showToast('Канал / группа удалена');
        onDeleted?.(cg.id);
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка при удалении');
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveChannelGroup(cg.id);
      showToast('Вы покинули канал');
      onLeft?.(cg.id);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Ошибка');
    }
  };

  const handleToggleAdmin = async (targetUserId: string) => {
    try {
      const res = await api.toggleChannelGroupAdmin(cg.id, targetUserId);
      if (res.success) {
        showToast('Роль администратора обновлена');
        loadDetails();
        onUpdated?.(res.channelGroup);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка');
    }
  };

  const handleToggleModerator = async (targetUserId: string) => {
    try {
      const res = await api.toggleChannelGroupModerator(cg.id, targetUserId);
      if (res.success) {
        showToast('Роль модератора обновлена');
        loadDetails();
        onUpdated?.(res.channelGroup);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка');
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    try {
      const res = await api.kickChannelGroupMember(cg.id, targetUserId);
      if (res.success) {
        showToast('Участник исключен');
        loadDetails();
        onUpdated?.(res.channelGroup);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className={`relative w-full ${activeTab === 'analytics' ? 'max-w-3xl' : 'max-w-lg'} bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}>
        {/* Toast alert */}
        {toastMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-medium px-4 py-2 rounded-2xl shadow-xl animate-fade-in whitespace-nowrap">
            {toastMsg}
          </div>
        )}

        {/* Modal Header Cover */}
        <div className={`p-6 bg-gradient-to-br ${cg.avatarColor || 'from-sky-500 to-indigo-600'} text-white relative shrink-0`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-md flex items-center justify-center text-white transition"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black text-white shadow-inner border border-white/30 shrink-0">
              {isChannel ? <Radio size={30} /> : <Users size={30} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full border border-white/30 backdrop-blur-sm">
                  {isChannel ? 'Канал' : 'Группа'}
                </span>
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">
                  {cg.type.includes('public') ? 'Публичный' : 'Приватный'}
                </span>
              </div>
              <h2 className="text-xl font-bold truncate mt-1">{cg.title}</h2>
              <p className="text-xs text-white/80 truncate">{cg.handle}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-4 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'about'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Информация
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'members'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Участники ({cg.members?.length || cg.memberIds?.length || 0})
          </button>
          {canManage && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <BarChart2 size={14} />
              <span>Аналитика</span>
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'settings'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              Настройки
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-sm text-slate-700 dark:text-slate-200">
          {activeTab === 'analytics' && canManage && (
            <ChannelAnalyticsDashboard channelGroup={cg} />
          )}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-fade-in">
              {/* Description */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Описание</span>
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {cg.description || 'Описание пока не добавлено автором.'}
                </p>
              </div>

              {/* Share & Invite link */}
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    <Link size={14} />
                    <span>Пригласительная ссылка</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                    {cg.inviteLink || `https://orbit.app/join/${cg.handle?.replace('@', '')}`}
                  </div>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="h-9 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              {/* Status details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Тип канала</span>
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {cg.type.includes('public') ? 'Публичный' : 'Приватный'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block">Публикации</span>
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {isChannel ? 'Авторы и админы' : 'Все участники'}
                  </span>
                </div>
              </div>

              {/* User actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                {!isCreator && (
                  <button
                    onClick={handleLeave}
                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <LogOut size={16} />
                    <span>Покинуть {isChannel ? 'канал' : 'группу'}</span>
                  </button>
                )}

                {(isCreator || isSysAdmin) && (
                  <div>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full py-3 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 border border-red-500/30 transition"
                      >
                        <Trash2 size={16} />
                        <span>Удалить {isChannel ? 'канал' : 'группу'} навсегда</span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/40 space-y-2 animate-fade-in text-center">
                        <div className="text-xs font-semibold text-red-600 dark:text-red-300">
                          Вы уверены, что хотите полностью удалить этот {isChannel ? 'канал' : 'группу'}? Все посты и сообщения будут удалены.
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleDeleteChannel}
                            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg"
                          >
                            Подтверждаю удаление
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs text-slate-400 font-medium">
                  Участники / Подписчики ({cg.members?.length || 0})
                </div>
                {canManage && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="h-7 w-7 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md active:scale-95 transition shrink-0"
                    title="Добавить участника"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {/* Search & Sorting bar for channel members/subscribers */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberListSearchQuery}
                    onChange={(e) => setMemberListSearchQuery(e.target.value)}
                    placeholder="Поиск участников..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div className="relative shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <ArrowUpDown size={13} className="text-sky-500" />
                  <select
                    value={memberListSortMode}
                    onChange={(e) => setMemberListSortMode(e.target.value as any)}
                    className="bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    <option value="role">По ролям</option>
                    <option value="alphabet">По имени (А–Я)</option>
                    <option value="recent">По дате</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                {(cg.members || [])
                  .filter((m: any) => {
                    if (!memberListSearchQuery.trim()) return true;
                    const q = memberListSearchQuery.toLowerCase();
                    return (
                      (m.username && m.username.toLowerCase().includes(q)) ||
                      (m.handle && m.handle.toLowerCase().includes(q))
                    );
                  })
                  .sort((a: any, b: any) => {
                    if (memberListSortMode === 'alphabet') {
                      return (a.username || '').localeCompare(b.username || '', 'ru');
                    }
                    if (memberListSortMode === 'role') {
                      const getRoleWeight = (mem: any) => {
                        if (mem.id === cg.creatorId) return 4;
                        if (mem.roleInGroup === 'admin') return 3;
                        if (mem.roleInGroup === 'moderator') return 2;
                        return 1;
                      };
                      return getRoleWeight(b) - getRoleWeight(a);
                    }
                    return 0;
                  })
                  .map((m: any) => {
                    const isMemCreator = m.id === cg.creatorId;
                    const isMemAdmin = m.roleInGroup === 'admin';
                    const isMemMod = m.roleInGroup === 'moderator';

                    return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-9 w-9 rounded-xl bg-gradient-to-br ${m.avatarColor || 'from-sky-400 to-indigo-500'} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}
                        >
                          {m.initials || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                            <span className="truncate">{m.username}</span>
                            {isMemCreator && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                                Владелец
                              </span>
                            )}
                            {isMemAdmin && !isMemCreator && (
                              <span className="text-[10px] bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold px-1.5 py-0.5 rounded-full border border-sky-500/30 shrink-0">
                                Админ
                              </span>
                            )}
                            {isMemMod && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                                Модератор
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{m.handle}</div>
                        </div>
                      </div>

                      {canManage && !isMemCreator && m.id !== currentUserId && (
                        <div className="flex items-center gap-1 shrink-0">
                          {isCreator && (
                            <button
                              onClick={() => handleToggleAdmin(m.id)}
                              className={`p-1.5 rounded-lg border text-[11px] font-semibold transition ${
                                isMemAdmin
                                  ? 'bg-sky-500/20 text-sky-600 border-sky-500/40'
                                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent'
                              }`}
                              title={isMemAdmin ? 'Снять админа' : 'Назначить админом'}
                            >
                              <ShieldCheck size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleModerator(m.id)}
                            className={`p-1.5 rounded-lg border text-[11px] font-semibold transition ${
                              isMemMod
                                ? 'bg-indigo-500/20 text-indigo-600 border-indigo-500/40'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent'
                            }`}
                            title={isMemMod ? 'Снять модератора' : 'Назначить модератором'}
                          >
                            <Shield size={14} />
                          </button>

                          <button
                            onClick={() => handleKickMember(m.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 transition"
                            title="Исключить из группы"
                          >
                            <UserX size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'settings' && canManage && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-3">
                {/* Background Wallpaper Settings Block for Channel/Group */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Задний фон {isChannel ? 'канала' : 'группы'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Заданный фон будет одинаково виден всем участникам
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWallpaperModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition shrink-0"
                  >
                    Изменить фон
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Название {isChannel ? 'канала' : 'группы'}</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Описание</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Тип доступа</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none"
                    >
                      <option value={isChannel ? 'public_channel' : 'public_group'}>Публичный</option>
                      <option value={isChannel ? 'private_channel' : 'private_group'}>Приватный</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Медленный режим</label>
                    <select
                      value={editSlowMode}
                      onChange={(e) => setEditSlowMode(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none"
                    >
                      <option value={0}>Выключен</option>
                      <option value={10}>10 секунд</option>
                      <option value={30}>30 секунд</option>
                      <option value={60}>1 минута</option>
                      <option value={300}>5 минут</option>
                      <option value={900}>15 минут</option>
                    </select>
                  </div>
                </div>

                {/* Reactions Settings */}
                <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Реакции на сообщения</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Разрешить участникам ставить эмодзи-реакции</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!editDisableReactions}
                        onChange={(e) => setEditDisableReactions(!e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {!editDisableReactions && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Выбор доступных реакций (макс. 5):</span>
                        <span className="text-[11px] font-bold text-sky-500">{editAllowedReactions.length} / 5</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {AVAILABLE_EMOJIS.map((emoji) => {
                          const isSelected = editAllowedReactions.includes(emoji);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleEmojiAllowed(emoji)}
                              className={`w-9 h-9 text-base rounded-xl flex items-center justify-center transition active:scale-95 ${
                                isSelected
                                  ? 'bg-sky-100 dark:bg-sky-900/50 border-2 border-sky-500 text-slate-900 dark:text-white shadow-sm'
                                  : 'bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100'
                              }`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Comments / Discussion Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {isChannel ? 'Комментарии к публикациям' : 'Ответы в ветках и обсуждения'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isChannel ? 'Разрешить обсуждения записей под постами' : 'Разрешить участникам отвечать на сообщения'}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!editDisableComments}
                      onChange={(e) => setEditDisableComments(!e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {/* Forwarding Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      Разрешить пересылку сообщений
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Позволяет участникам копировать и пересылать посты
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!editDisableForwarding}
                      onChange={(e) => setEditDisableForwarding(!e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-sky-500"></div>
                  </label>
                </div>

                {!isChannel && (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Разрешить звонки участников</span>
                    <input
                      type="checkbox"
                      checked={editAllowCalls}
                      onChange={(e) => setEditAllowCalls(e.target.checked)}
                      className="h-4 w-4 rounded accent-sky-500"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveSettings}
                className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-lg active:scale-95 transition"
              >
                Сохранить изменения
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
                <UserPlus size={18} className="text-sky-500" />
                <span>Добавить участника</span>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Поиск по номеру телефона или никнейму (@username)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Например: @alex, +7900..."
                    className="flex-1 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    disabled={!memberSearchQuery.trim() || isInvitingMember}
                    onClick={() => handleInviteUser()}
                    className="px-3 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold shadow-md shrink-0 transition"
                  >
                    {isInvitingMember ? <Loader2 size={14} className="animate-spin" /> : 'Найти'}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Или выберите из списка контактов:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {followersList.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">Список контактов пуст</div>
                  ) : (
                    followersList.map((contact: any) => {
                      const isAlreadyMember = (cg?.memberIds || []).includes(contact.id);
                      return (
                        <div
                          key={contact.id}
                          className="p-2 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-xl bg-sky-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {(contact.name || contact.username || 'U')[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                {contact.name || contact.username}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {contact.handle || contact.phoneNumber || ''}
                              </div>
                            </div>
                          </div>
                          <button
                            disabled={isAlreadyMember || isInvitingMember}
                            onClick={() => handleInviteUser(contact)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                              isAlreadyMember
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                : 'bg-sky-500 hover:bg-sky-600 text-white shadow-sm'
                            }`}
                          >
                            {isAlreadyMember ? 'В группе' : 'Добавить'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Wallpaper Background Customizer Modal */}
      <WallpaperModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        settings={{
          preset: editBgPattern,
          opacity: editBgOpacity,
          adaptTheme: editBgAdaptTheme,
          imageUrl: editBgImageUrl,
        }}
        onSave={handleSaveWallpaperFromModal}
        title={isChannel ? 'Оформить фон канала' : 'Оформить фон группы'}
        subtitle="Заданный фон сохранится на сервере и будет отображаться всем участникам"
      />
    </div>
  );
};
