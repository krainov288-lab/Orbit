import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  Megaphone,
  AlertTriangle,
  Users,
  Trash2,
  Clock,
  Plus,
  CheckCircle2,
  Activity,
  Headphones,
  Lock,
  Ban,
  UserCheck,
  Search,
  Filter,
  FileText,
  Server,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Zap,
  MousePointerClick,
  ExternalLink,
  Download,
} from 'lucide-react';
import { api } from '../../services/api';
import { SystemAnnouncement, AdminReport, AuditLogItem, SystemStats, UserRole, User } from '../../types';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
  onAnnouncementsChanged?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAnnouncementsChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'news' | 'reports' | 'users' | 'audit'>('stats');
  
  // Data States
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  
  // Filter & Search States
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole | 'blocked'>('all');
  const [reportFilter, setReportFilter] = useState<'all' | 'new' | 'resolved'>('all');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Confirmation States (Inline deletion)
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Resolution Note Modal State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Announcement Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('Обновление приложения');
  const [type, setType] = useState<'update' | 'security' | 'info'>('update');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [isButton, setIsButton] = useState(false);
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');

  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState<'all' | 'auth' | 'admin' | 'story' | 'transfer' | 'msg'>('all');

  const handleDownloadAuditLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `orbit_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const currentUserRole: UserRole = currentUser?.role || (currentUser?.username?.toLowerCase() === 'admin' ? 'sysadmin' : 'user');
  const isSysAdmin = currentUserRole === 'sysadmin';
  const isAdminOrSysAdmin = currentUserRole === 'admin' || isSysAdmin;

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, annData, repData, userData, logsData] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminAnnouncements().catch(() => []),
        api.getAdminReports().catch(() => []),
        api.getAdminUsers().catch(() => []),
        api.getAdminAuditLogs().catch(() => []),
      ]);

      setStats(statsData);
      setAnnouncements(annData);
      setReports(repData);
      setUsers(userData);
      setAuditLogs(logsData);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки данных администратора');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Заполните текст новости');
      return;
    }

    let scheduledAtTimestamp: number | undefined = undefined;
    if (isScheduled && scheduledDateTime) {
      const dateObj = new Date(scheduledDateTime);
      if (isNaN(dateObj.getTime())) {
        setError('Некорректная дата/время публикации');
        return;
      }
      scheduledAtTimestamp = dateObj.getTime();
    }

    try {
      setLoading(true);
      setError('');
      await api.createAnnouncement({
        title: title.trim() || undefined,
        content: content.trim(),
        tag,
        type,
        scheduledAt: scheduledAtTimestamp,
        isButton,
        buttonText: buttonText.trim() || undefined,
        buttonUrl: buttonUrl.trim() || undefined,
      });

      setSuccessMsg('Новость успешно опубликована');
      setTitle('');
      setContent('');
      setIsScheduled(false);
      setScheduledDateTime('');
      setIsButton(false);
      setButtonText('');
      setButtonUrl('');
      setTimeout(() => setSuccessMsg(''), 3000);

      const [updatedAnn, updatedLogs] = await Promise.all([
        api.getAdminAnnouncements(),
        api.getAdminAuditLogs(),
      ]);
      setAnnouncements(updatedAnn);
      setAuditLogs(updatedLogs);
      if (onAnnouncementsChanged) onAnnouncementsChanged();
    } catch (e: any) {
      setError(e.message || 'Не удалось опубликовать новость');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteAnnouncement = async (id: string) => {
    try {
      setLoading(true);
      setError('');
      await api.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setSuccessMsg('Новость удалена');
      setTimeout(() => setSuccessMsg(''), 3000);
      setDeletingAnnId(null);
      if (onAnnouncementsChanged) onAnnouncementsChanged();
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления новости');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      await api.resolveReport(reportId, resolutionNote || 'Рассмотрено');
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: 'resolved', resolutionNote: resolutionNote || 'Рассмотрено', resolvedBy: currentUser?.username }
            : r
        )
      );
      setSelectedReportId(null);
      setResolutionNote('');
      setSuccessMsg('Обращение решено');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Ошибка обновления обращения');
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await api.deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSuccessMsg('Обращение удалено');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления обращения');
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole, targetName: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setSuccessMsg(`Роль ${targetName} изменена`);
      setTimeout(() => setSuccessMsg(''), 3000);

      const logs = await api.getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e: any) {
      setError(e.message || 'Ошибка смены роли');
    }
  };

  const handleToggleBlock = async (userId: string, targetName: string) => {
    try {
      await api.toggleUserBlock(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isBlocked: !u.isBlocked } : u))
      );
      setSuccessMsg(`Статус ${targetName} обновлён`);
      setTimeout(() => setSuccessMsg(''), 3000);

      const logs = await api.getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e: any) {
      setError(e.message || 'Ошибка изменения блокировки');
    }
  };

  const handleConfirmDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      await api.deleteAdminUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccessMsg('Пользователь удалён');
      setTimeout(() => setSuccessMsg(''), 3000);
      setDeletingUserId(null);

      const logs = await api.getAdminAuditLogs();
      setAuditLogs(logs);
    } catch (e: any) {
      setError(e.message || 'Ошибка удаления пользователя');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.handle?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.phone?.includes(userSearchQuery);

    if (!matchesSearch) return false;

    if (roleFilter === 'blocked') return u.isBlocked;
    if (roleFilter !== 'all') return u.role === roleFilter;

    return true;
  });

  const filteredReports = reports.filter((r) => {
    if (reportFilter === 'new') return r.status !== 'resolved';
    if (reportFilter === 'resolved') return r.status === 'resolved';
    return true;
  });

  function getRoleBadgeText(role: UserRole) {
    switch (role) {
      case 'sysadmin':
        return 'Сис. Админ';
      case 'admin':
        return 'Администратор';
      case 'support':
        return 'Поддержка';
      default:
        return 'Пользователь';
    }
  }

  function getRoleBadgeStyle(role: UserRole) {
    switch (role) {
      case 'sysadmin':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'admin':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'support':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'glass-button text-muted border-white/10';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in text-primary">
      {/* FIXED CONTAINER WITH GLASSMORPHISM */}
      <div className="glass-card w-full max-w-2xl h-[620px] max-h-[88vh] rounded-3xl p-5 flex flex-col shadow-2xl relative border border-white/20 dark:border-white/10 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-custom shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl glass-button text-blue-500 flex items-center justify-center border border-blue-500/20 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                Панель администрирования
              </h2>
              <p className="text-[11px] text-muted">
                Безопасность, управление пользователями и обращениями
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full glass-button flex items-center justify-center text-muted hover:text-primary transition border border-white/10 active:scale-95"
            title="Закрыть"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 my-3 border-b border-custom pb-2.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'stats'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Activity size={13} />
            <span>Система</span>
          </button>

          {isAdminOrSysAdmin && (
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
                activeTab === 'news'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  : 'glass-button border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Megaphone size={13} />
              <span>Новости ({announcements.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'reports'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Headphones size={13} />
            <span>Обращения ({reports.filter((r) => r.status !== 'resolved').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
              activeTab === 'users'
                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : 'glass-button border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Users size={13} />
            <span>Пользователи</span>
          </button>

          {isAdminOrSysAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold transition whitespace-nowrap border ${
                activeTab === 'audit'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  : 'glass-button border-transparent text-secondary hover:text-primary'
              }`}
            >
              <Lock size={13} />
              <span>Журнал</span>
            </button>
          )}
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mb-2 px-3 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium shrink-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="p-0.5 hover:text-rose-400">
              <X size={12} />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="mb-2 px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium shrink-0 flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1 space-y-4">
          {/* TAB 1: SYSTEM STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-card rounded-2xl p-3.5 border border-white/10">
                  <div className="flex items-center gap-2 text-muted mb-1 text-[11px] font-semibold">
                    <Users size={13} className="text-blue-500" />
                    <span>Пользователи</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {stats?.totalUsers ?? users.length}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-3.5 border border-white/10">
                  <div className="flex items-center gap-2 text-muted mb-1 text-[11px] font-semibold">
                    <Headphones size={13} className="text-blue-500" />
                    <span>Поддержка</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {stats?.supportCount ?? users.filter((u) => u.role === 'support').length}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-3.5 border border-white/10">
                  <div className="flex items-center gap-2 text-muted mb-1 text-[11px] font-semibold">
                    <Shield size={13} className="text-blue-500" />
                    <span>Администраторы</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {(stats?.adminCount ?? 0) + (stats?.sysadminCount ?? 0)}
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-3.5 border border-white/10">
                  <div className="flex items-center gap-2 text-muted mb-1 text-[11px] font-semibold">
                    <AlertTriangle size={13} className="text-amber-500" />
                    <span>Открытые обращения</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {stats?.openReports ?? reports.filter((r) => r.status !== 'resolved').length}
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="glass-card rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-2xl glass-button text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-primary flex items-center gap-2">
                      Защита системы активна
                      <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        ОК
                      </span>
                    </h3>
                    <p className="text-xs text-secondary mt-1 leading-relaxed">
                      Хэширование паролей (Bcrypt), JWT-сессии с валидацией ролей и защита от удаления суперпользователя активны.
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="glass-card rounded-2xl p-4 space-y-2 border border-white/10">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Server size={14} className="text-blue-500" />
                  Параметры сервера
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl glass-button">
                    <span className="text-secondary">Время работы:</span>
                    <span className="font-semibold text-primary">
                      {Math.floor((stats?.uptimeMs || 60000) / 60000)} мин.
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl glass-button">
                    <span className="text-secondary">Сообщений в базе:</span>
                    <span className="font-semibold text-primary">
                      {stats?.totalMessages ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANNOUNCEMENTS */}
          {activeTab === 'news' && isAdminOrSysAdmin && (
            <div className="space-y-4 animate-fade-in">
              <form onSubmit={handleCreateAnnouncement} className="glass-card rounded-2xl p-4 space-y-3 border border-white/10 shrink-0">
                <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Plus size={14} className="text-blue-500" />
                  Создать новость
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-secondary mb-1">
                      Заголовок <span className="text-muted font-normal">(необязательно)</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Без заголовка (необязательно)..."
                      className="w-full glass-button rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-secondary mb-1">
                      Категория
                    </label>
                    <select
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full glass-button rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-blue-500/50"
                    >
                      <option value="Обновление приложения" className="bg-slate-900 text-white">Обновление приложения</option>
                      <option value="Защита и Безопасность" className="bg-slate-900 text-white">Защита и Безопасность</option>
                      <option value="Важная информация" className="bg-slate-900 text-white">Важная информация</option>
                      <option value="Технические работы" className="bg-slate-900 text-white">Технические работы</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Содержание публикации *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Текст новости..."
                    className="w-full glass-button rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-blue-500/50 resize-none h-20 min-h-[80px]"
                  />
                </div>

                {/* Make text/publication a button toggle */}
                <div className="pt-2 border-t border-custom space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isButtonCheckModal"
                      checked={isButton}
                      onChange={(e) => setIsButton(e.target.checked)}
                      className="rounded accent-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="isButtonCheckModal" className="text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer">
                      <MousePointerClick size={14} className="text-blue-500" />
                      Сделать текст/новость кнопкой (действие)
                    </label>
                  </div>

                  {isButton && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-semibold text-secondary mb-1">
                          Ссылка или действие (URL)
                        </label>
                        <input
                          type="text"
                          value={buttonUrl}
                          onChange={(e) => setButtonUrl(e.target.value)}
                          placeholder="https://example.com или #действие"
                          className="w-full glass-button rounded-xl px-2.5 py-1.5 text-xs text-primary outline-none focus:border-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-secondary mb-1">
                          Текст отдельной кнопки (необязательно)
                        </label>
                        <input
                          type="text"
                          value={buttonText}
                          onChange={(e) => setButtonText(e.target.value)}
                          placeholder="Если пусто — кликабелен весь блок"
                          className="w-full glass-button rounded-xl px-2.5 py-1.5 text-xs text-primary outline-none focus:border-blue-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-custom flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedCheckModal"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded accent-blue-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="schedCheckModal" className="text-xs font-semibold text-primary flex items-center gap-1.5 cursor-pointer">
                      <Clock size={13} className="text-blue-500" />
                      Запланировать публикацию
                    </label>
                  </div>

                  {isScheduled && (
                    <input
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="glass-button rounded-xl px-2.5 py-1 text-xs text-primary outline-none focus:border-blue-500/50"
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-2xl glass-button bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold transition flex items-center justify-center gap-1.5 active:scale-98"
                >
                  <Megaphone size={14} />
                  <span>{isScheduled ? 'Запланировать' : 'Опубликовать'}</span>
                </button>
              </form>

              {/* Published Announcements */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-primary">
                  Опубликованное ({announcements.length})
                </h4>
                {announcements.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted glass-card rounded-2xl">
                    Новостей пока нет.
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="glass-card rounded-2xl p-3 flex flex-col gap-1.5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {ann.tag}
                          </span>
                          <span className="text-[10px] text-muted">
                            {new Date(ann.createdAt).toLocaleString('ru-RU')}
                          </span>
                        </div>

                        {deletingAnnId === ann.id ? (
                          <div className="flex items-center gap-1.5 animate-fade-in">
                            <span className="text-[10px] text-rose-500 font-semibold">Удалить?</span>
                            <button
                              onClick={() => handleConfirmDeleteAnnouncement(ann.id)}
                              className="px-2 py-0.5 rounded-lg glass-button bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[10px] font-bold"
                            >
                              Да
                            </button>
                            <button
                              onClick={() => setDeletingAnnId(null)}
                              className="px-2 py-0.5 rounded-lg glass-button text-muted text-[10px]"
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingAnnId(ann.id)}
                            className="px-2.5 py-1 rounded-xl glass-button text-muted hover:text-rose-500 text-xs font-semibold flex items-center gap-1 transition"
                            title="Удалить новость"
                          >
                            <Trash2 size={12} />
                            <span>Удалить</span>
                          </button>
                        )}
                      </div>
                      <h5 className="text-xs font-bold text-primary">{ann.title}</h5>
                      <p className="text-xs text-secondary leading-relaxed">{ann.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-custom pb-2">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Headphones size={14} className="text-blue-500" />
                  Обращения ({reports.length})
                </h4>

                <div className="flex gap-1">
                  <button
                    onClick={() => setReportFilter('all')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                      reportFilter === 'all'
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Все
                  </button>
                  <button
                    onClick={() => setReportFilter('new')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                      reportFilter === 'new'
                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Новые
                  </button>
                  <button
                    onClick={() => setReportFilter('resolved')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border ${
                      reportFilter === 'resolved'
                        ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Решённые
                  </button>
                </div>
              </div>

              {filteredReports.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted glass-card rounded-2xl">
                  Обращений не найдено.
                </div>
              ) : (
                filteredReports.map((r) => (
                  <div key={r.id} className="glass-card rounded-2xl p-3.5 space-y-2 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full border ${
                            r.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                          }`}
                        >
                          {r.status === 'resolved' ? 'Решено' : r.reason}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(r.timestamp).toLocaleString('ru-RU')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {r.status !== 'resolved' && (
                          <button
                            onClick={() => setSelectedReportId(r.id)}
                            className="px-2.5 py-1 rounded-xl glass-button bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <CheckCircle2 size={12} />
                            <span>Ответить</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(r.id)}
                          className="p-1.5 rounded-xl glass-button text-muted hover:text-rose-500 transition"
                          title="Удалить"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-primary font-medium">
                      <span className="text-secondary">Отправитель:</span> {r.reporterName || r.reporterId}
                    </div>

                    {r.comment && (
                      <div className="text-xs text-secondary glass-button p-2.5 rounded-xl leading-relaxed">
                        "{r.comment}"
                      </div>
                    )}

                    {r.resolutionNote && (
                      <div className="text-xs text-emerald-500 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/20">
                        <span className="font-bold">Ответ ({r.resolvedBy}):</span> {r.resolutionNote}
                      </div>
                    )}

                    {selectedReportId === r.id && (
                      <div className="pt-2 space-y-2 border-t border-custom animate-fade-in">
                        <textarea
                          rows={2}
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="Введите ответ поддержки..."
                          className="w-full glass-button rounded-xl p-2.5 text-xs text-primary outline-none focus:border-emerald-500/50"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelectedReportId(null)}
                            className="px-3 py-1 rounded-xl glass-button text-xs font-semibold text-secondary"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={() => handleResolveReport(r.id)}
                            className="px-3 py-1 rounded-xl glass-button bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-semibold"
                          >
                            Сохранить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Поиск по имени, нику или телефону..."
                    className="w-full glass-button rounded-xl pl-8 pr-3 py-2 text-xs text-primary outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition border ${
                      roleFilter === 'all'
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Все ({users.length})
                  </button>
                  <button
                    onClick={() => setRoleFilter('support')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition border ${
                      roleFilter === 'support'
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Поддержка
                  </button>
                  <button
                    onClick={() => setRoleFilter('admin')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition border ${
                      roleFilter === 'admin'
                        ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Админы
                  </button>
                  <button
                    onClick={() => setRoleFilter('blocked')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition border ${
                      roleFilter === 'blocked'
                        ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        : 'glass-button border-transparent text-secondary'
                    }`}
                  >
                    Бан
                  </button>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted glass-card rounded-2xl">
                  Пользователи не найдены.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isRoot = u.username?.toLowerCase() === 'admin' || u.handle?.toLowerCase() === '@admin';
                  return (
                    <div
                      key={u.id}
                      className={`glass-card rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${
                        u.isBlocked ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${
                            u.avatarColor || 'from-blue-400 to-indigo-500'
                          } flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}
                        >
                          {u.initials || 'U'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-primary truncate flex items-center gap-1.5">
                            <span>{u.username}</span>
                            <span className="text-[10px] text-muted font-normal">{u.handle}</span>
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                                u.role || 'user'
                              )}`}
                            >
                              {getRoleBadgeText(u.role || 'user')}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted truncate mt-0.5">
                            {u.email} {u.phone ? `• ${u.phone}` : ''}
                          </div>
                        </div>
                      </div>

                      {!isRoot && (
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {isAdminOrSysAdmin && (
                            <select
                              value={u.role || 'user'}
                              onChange={(e) =>
                                handleChangeRole(u.id, e.target.value as UserRole, u.username)
                              }
                              className="glass-button rounded-xl px-2.5 py-1 text-[11px] font-semibold text-primary outline-none cursor-pointer border border-white/10"
                            >
                              <option value="user" className="bg-slate-900 text-white">Пользователь</option>
                              <option value="support" className="bg-slate-900 text-white">Служба поддержки</option>
                              <option value="admin" className="bg-slate-900 text-white">Администратор</option>
                              {isSysAdmin && (
                                <option value="sysadmin" className="bg-slate-900 text-white">Сис. Администратор</option>
                              )}
                            </select>
                          )}

                          {isAdminOrSysAdmin && (
                            <button
                              onClick={() => handleToggleBlock(u.id, u.username)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition border ${
                                u.isBlocked
                                  ? 'glass-button bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'glass-button bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                              }`}
                              title={u.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                            >
                              {u.isBlocked ? <UserCheck size={12} /> : <Ban size={12} />}
                              <span>{u.isBlocked ? 'Разбан' : 'Бан'}</span>
                            </button>
                          )}

                          {isAdminOrSysAdmin && (
                            deletingUserId === u.id ? (
                              <div className="flex items-center gap-1 animate-fade-in">
                                <button
                                  onClick={() => handleConfirmDeleteUser(u.id)}
                                  className="px-2 py-1 rounded-xl glass-button bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[11px] font-bold"
                                >
                                  Да
                                </button>
                                <button
                                  onClick={() => setDeletingUserId(null)}
                                  className="px-2 py-1 rounded-xl glass-button text-muted text-[11px]"
                                >
                                  Нет
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingUserId(u.id)}
                                className="p-1.5 rounded-xl glass-button text-muted hover:text-rose-500 transition border border-white/10"
                                title="Удалить пользователя"
                              >
                                <Trash2 size={13} />
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && isAdminOrSysAdmin && (
            <div className="space-y-2.5 animate-fade-in">
              <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Lock size={14} className="text-blue-500" />
                Журнал действий ({auditLogs.length})
              </h4>

              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted glass-card rounded-2xl">
                  Записи журнала отсутствуют.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="glass-card rounded-2xl p-3 space-y-1 text-xs border border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-muted">
                        {new Date(log.timestamp).toLocaleString('ru-RU')}
                      </span>
                    </div>
                    <div className="text-primary font-semibold">
                      Инициатор: <span className="text-blue-500">{log.actorName}</span>
                    </div>
                    <div className="text-secondary leading-relaxed font-mono text-[11px]">
                      {log.details}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
