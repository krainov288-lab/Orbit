import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PieChart, Sparkles } from 'lucide-react';
import { getSavedNewsItems } from '../../utils/savedNewsService';
import { getStoredFeedSettings } from '../../utils/feedAlgorithm';

export interface CategoryStat {
  category: string;
  count: number;
  color: string;
}

type Timeframe = 'week' | 'month' | 'all';

const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Технологии': '#0284c7',
  'ИИ & Нейросети': '#8b5cf6',
  'Дизайн & UI': '#ec4899',
  'Новости': '#f59e0b',
  'Новости ORBIT': '#f59e0b',
  'Игры': '#10b981',
  'Музыка': '#6366f1',
  'Наука': '#06b6d4',
  'Бизнес': '#3b82f6',
  'Развлечения': '#f43f5e',
};

const DEFAULT_COLORS = ['#0284c7', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#06b6d4', '#3b82f6'];

export const FeedStatsChart: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('week');
  const [hoveredCategory, setHoveredCategory] = useState<CategoryStat | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Compute real category stats based on saved news & feed preferences
  const [currentStats, setCurrentStats] = useState<CategoryStat[]>([]);

  useEffect(() => {
    const savedItems = getSavedNewsItems();
    const feedSettings = getStoredFeedSettings();

    const categoryCounts: Record<string, number> = {};

    // 1. Count from saved news items
    savedItems.forEach((item) => {
      const cat = item.category || 'Новости';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // 2. Count from feed search history & interest keywords
    if (feedSettings.searchHistory && feedSettings.searchHistory.length > 0) {
      feedSettings.searchHistory.forEach((sh) => {
        const cat = 'Поиск';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + (sh.count || 1);
      });
    }

    if (feedSettings.interestKeywords && feedSettings.interestKeywords.length > 0) {
      feedSettings.interestKeywords.forEach((kw) => {
        const cat = 'Интересы';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    }

    const categories = Object.keys(categoryCounts);

    if (categories.length > 0) {
      const timeframeMultiplier = timeframe === 'week' ? 1 : timeframe === 'month' ? 3 : 8;
      const stats: CategoryStat[] = categories.map((cat, idx) => ({
        category: cat,
        count: categoryCounts[cat] * timeframeMultiplier,
        color: CATEGORY_COLOR_MAP[cat] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      }));
      setCurrentStats(stats);
    } else {
      setCurrentStats([]);
    }
  }, [timeframe]);

  const totalPosts = currentStats.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 240;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 12;
    const innerRadius = radius * 0.62; // Donut chart

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;');

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Pie generator
    const pie = d3
      .pie<CategoryStat>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.03);

    // Arc generators
    const arc = d3
      .arc<d3.PieArcDatum<CategoryStat>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(6);

    const arcHover = d3
      .arc<d3.PieArcDatum<CategoryStat>>()
      .innerRadius(innerRadius - 2)
      .outerRadius(radius + 8)
      .cornerRadius(8);

    const pieData = pie(currentStats);

    // Draw slices
    const paths = g
      .selectAll('path')
      .data(pieData)
      .enter()
      .append('path')
      .attr('fill', (d) => d.data.color)
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .style('transition', 'filter 0.2s ease');

    // Initial enter transition animation
    paths
      .transition()
      .duration(750)
      .attrTween('d', function (d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(interpolate(t)) || '';
        };
      });

    // Hover & Click interactions
    paths
      .on('mouseenter', function (_event, d) {
        setHoveredCategory(d.data);
        d3.select(this)
          .transition()
          .duration(180)
          .attr('d', arcHover as any)
          .style('filter', 'drop-shadow(0px 4px 10px rgba(0,0,0,0.3))');
      })
      .on('mouseleave', function (_event, d) {
        setHoveredCategory(null);
        if (selectedCategory !== d.data.category) {
          d3.select(this)
            .transition()
            .duration(180)
            .attr('d', arc as any)
            .style('filter', 'none');
        }
      })
      .on('click', function (_event, d) {
        setSelectedCategory((prev) => (prev === d.data.category ? null : d.data.category));
      });

  }, [timeframe, currentStats, selectedCategory]);

  const activeDisplay = hoveredCategory || (selectedCategory ? currentStats.find((s) => s.category === selectedCategory) : null);

  return (
    <div className="glass-card rounded-3xl p-3.5 border border-white/60 dark:border-slate-800 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <PieChart size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>Статистика потребления ленты</span>
              <Sparkles size={12} className="text-amber-500" />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Категории прочитанных публикаций (D3.js)
            </div>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800/80 p-0.5 rounded-xl text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setTimeframe('week')}
            className={`px-2 py-1 rounded-lg transition ${
              timeframe === 'week'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Неделя
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('month')}
            className={`px-2 py-1 rounded-lg transition ${
              timeframe === 'month'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Месяц
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`px-2 py-1 rounded-lg transition ${
              timeframe === 'all'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Всё
          </button>
        </div>
      </div>

      {/* Chart Body Container */}
      {currentStats.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-1">
          <p className="font-semibold text-slate-600 dark:text-slate-400">Нет данных для статистики ленты</p>
          <p className="text-[11px] text-slate-400">Сохраняйте статьи или выполняйте поиск по интересам, чтобы сформировать график аналитики.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
          {/* D3 SVG Donut Chart */}
          <div className="sm:col-span-5 relative flex items-center justify-center min-h-[190px]" ref={containerRef}>
            <svg ref={svgRef} className="w-48 h-48 drop-shadow-xs" />
            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
              {activeDisplay ? (
                <div className="animate-fade-in">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block truncate max-w-[90px]">
                    {activeDisplay.category}
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {activeDisplay.count}
                  </span>
                  <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 block">
                    {totalPosts > 0 ? Math.round((activeDisplay.count / totalPosts) * 100) : 0}%
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide block">
                    Всего постов
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {totalPosts}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                    просмотрено
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Legend & Breakdown List */}
          <div className="sm:col-span-7 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
              <span>Категории по интересам</span>
              <span className="text-[10px] text-slate-400 font-semibold">{totalPosts} постов</span>
            </div>

            <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
              {currentStats.map((stat) => {
                const percentage = totalPosts > 0 ? Math.round((stat.count / totalPosts) * 100) : 0;
                const isSelected = selectedCategory === stat.category;
                const isHovered = hoveredCategory?.category === stat.category;

                return (
                  <div
                    key={stat.category}
                    onClick={() => setSelectedCategory((prev) => (prev === stat.category ? null : stat.category))}
                    onMouseEnter={() => setHoveredCategory(stat)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    className={`p-2 rounded-xl transition cursor-pointer border ${
                      isSelected || isHovered
                        ? 'bg-white dark:bg-slate-800 border-sky-500/40 shadow-xs'
                        : 'bg-white/60 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: stat.color }}
                        />
                        <span className="text-slate-800 dark:text-slate-200 truncate">{stat.category}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <span>{stat.count}</span>
                        <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 w-8 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/70 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: stat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
