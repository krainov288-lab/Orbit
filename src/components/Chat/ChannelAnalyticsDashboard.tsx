import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Share2,
  Calendar,
  Sparkles,
  Download,
  RefreshCw,
  BarChart2,
  Clock,
  PieChart as PieChartIcon,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import { ChannelAnalyticsData, ChannelGroup } from '../../types';
import { api } from '../../services/api';
import { haptics } from '../../utils/haptics';

interface ChannelAnalyticsDashboardProps {
  channelGroup: ChannelGroup & { members?: any[] };
  onClose?: () => void;
}

export const ChannelAnalyticsDashboard: React.FC<ChannelAnalyticsDashboardProps> = ({
  channelGroup,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState<boolean>(true);
  const [analytics, setAnalytics] = useState<ChannelAnalyticsData | null>(null);
  const [activeChart, setActiveChart] = useState<'growth' | 'engagement' | 'hourly' | 'breakdown'>('growth');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await api.getChannelAnalytics(channelGroup.id, timeframe);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load channel analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [channelGroup.id, timeframe]);

  const handleTimeframeChange = (tf: '7d' | '30d' | '90d') => {
    haptics.tap();
    setTimeframe(tf);
  };

  const handleRefresh = () => {
    haptics.tap();
    loadAnalytics();
  };

  const handleExportCSV = () => {
    haptics.success();
    if (!analytics) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Date,Subscribers,Joined,Left,Views,Reactions,Comments\n';
    
    analytics.subscriberGrowthTrend.forEach((item, index) => {
      const eng = analytics.engagementMetrics[index] || { views: 0, reactions: 0, comments: 0 };
      csvContent += `${item.date},${item.subscribers},${item.joined},${item.left},${eng.views},${eng.reactions},${eng.comments}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analytics_${channelGroup.handle || 'channel'}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 text-slate-400">
        <RefreshCw size={28} className="animate-spin text-sky-500" />
        <p className="text-xs font-medium">Расчет аналитики и метрик вовлеченности...</p>
      </div>
    );
  }

  if (!analytics) return null;

  const { summary } = analytics;

  return (
    <div className="space-y-5 text-slate-800 dark:text-slate-100 animate-fade-in">
      {/* Analytics Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-slate-800">
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === tf
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tf === '7d' ? '7 дней' : tf === '30d' ? '30 дней' : '90 дней'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95"
            title="Обновить данные"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition active:scale-95"
          >
            <Download size={14} />
            <span>Экспорт CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Subscribers */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-blue-500/5 border border-sky-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Подписчики</span>
            <div className="p-1.5 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
              <Users size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summary.totalSubscribers.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            <ArrowUpRight size={13} />
            <span>+{summary.subscriberGrowthNet} ({summary.subscriberGrowthPct}%)</span>
          </div>
        </div>

        {/* Card 2: Views */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Просмотры</span>
            <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Eye size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summary.totalViews > 9999 ? `${(summary.totalViews / 1000).toFixed(1)}k` : summary.totalViews.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            <ArrowUpRight size={13} />
            <span>+{summary.viewsGrowthPct}% за период</span>
          </div>
        </div>

        {/* Card 3: ER (Engagement Rate) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ERR (Вовлеченность)</span>
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Zap size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summary.engagementRate}%
          </div>
          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1">
            Охват ~{summary.reachRate}% подп.
          </div>
        </div>

        {/* Card 4: Avg Reactions */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Реакций / пост</span>
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400">
              <Heart size={14} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summary.avgReactionsPerPost}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Всего постов: {summary.totalPosts}
          </div>
        </div>
      </div>

      {/* Main Chart Switcher Tabs */}
      <div className="p-4 rounded-3xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-sky-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Графики и тренды
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveChart('growth')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                activeChart === 'growth'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Динамика подписчиков
            </button>
            <button
              onClick={() => setActiveChart('engagement')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                activeChart === 'engagement'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Просмотры и реакции
            </button>
            <button
              onClick={() => setActiveChart('hourly')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                activeChart === 'hourly'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Активность по часам
            </button>
            <button
              onClick={() => setActiveChart('breakdown')}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                activeChart === 'breakdown'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Типы реакций
            </button>
          </div>
        </div>

        {/* Recharts Area 1: Subscriber Growth */}
        {activeChart === 'growth' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Общая численность участников канала</span>
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                Прирост: +{summary.subscriberGrowthNet}
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.subscriberGrowthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorJoined" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: '#fff',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="subscribers"
                    name="Подписчики"
                    stroke="#38bdf8"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSubscribers)"
                  />
                  <Bar dataKey="joined" name="Пришло" fill="#10b981" radius={[4, 4, 0, 0]} barSize={8} />
                  <Bar dataKey="left" name="Ушло" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={8} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recharts Area 2: Engagement & Views */}
        {activeChart === 'engagement' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Просмотры публикаций (столбцы) и реакции (линия)</span>
              <span className="font-semibold text-indigo-500">Всего: {summary.totalViews} просмотров</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analytics.engagementMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Bar yAxisId="left" dataKey="views" name="Просмотры" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={12} />
                  <Line yAxisId="right" type="monotone" dataKey="reactions" name="Реакции" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="comments" name="Комментарии" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recharts Area 3: Hourly Activity */}
        {activeChart === 'hourly' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Почасовая активность подписчиков в течение суток (онлайн)</span>
              <span className="font-semibold text-amber-500">Пик: 18:00 – 21:00</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourlyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="activeUsers" name="Активных читателей" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recharts Area 4: Reaction Breakdown PieChart */}
        {activeChart === 'breakdown' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-500 px-1">
              Распределение видов активности аудитории (реакции, репосты, комменты)
            </div>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.interactionBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.interactionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#fff',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top Posts Performance List */}
      <div className="p-4 rounded-3xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Топ публикаций канала
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">По реакциям и просмотрам</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
          {analytics.topPosts.map((post, idx) => (
            <div
              key={post.id}
              className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-7 w-7 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                  #{idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                    {post.title}
                  </p>
                  <span className="text-[10px] text-slate-400">{post.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-xs">
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                  <Eye size={12} className="text-indigo-400" />
                  {post.views}
                </span>
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                  <Heart size={12} />
                  {post.reactions}
                </span>
                <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium">
                  <MessageSquare size={12} />
                  {post.comments}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Recommendations Box */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-500/30 flex items-start gap-3">
        <div className="p-2.5 rounded-2xl bg-sky-500 text-white shrink-0 shadow-md">
          <Sparkles size={18} />
        </div>
        <div className="text-xs space-y-1">
          <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            Умная аналитика Orbit AI
          </h5>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Ваши подписчики наиболее активны с <strong>18:00 до 21:00</strong>. Посты с медиафайлами и опросами получают на <strong>45% больше реакций</strong>. Для повышения ERR рекомендуется публиковать не менее 2 качественных материалов в день.
          </p>
        </div>
      </div>
    </div>
  );
};
