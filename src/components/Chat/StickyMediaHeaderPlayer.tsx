import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, X, Mic, Video } from 'lucide-react';

interface StickyMediaHeaderPlayerProps {
  title: string;
  type: 'audio' | 'video_circle';
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onChangeSpeed: (rate: number) => void;
  onClose: () => void;
}

export const StickyMediaHeaderPlayer: React.FC<StickyMediaHeaderPlayerProps> = ({
  title,
  type,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onSeek,
  onChangeSpeed,
  onClose,
}) => {
  const [showSpeedPopover, setShowSpeedPopover] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Convert rate [0.5..3.0] to percentage height [0..100]
  const rateToPercent = (rate: number): number => {
    return Math.max(0, Math.min(100, ((rate - 0.5) / 2.5) * 100));
  };

  const calculateRateFromClientY = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    // 0 = bottom (0.5x), 1 = top (3.0x)
    const norm = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    const rate = 0.5 + norm * 2.5;
    const roundedRate = Math.round(rate * 10) / 10;
    onChangeSpeed(Math.max(0.5, Math.min(3.0, roundedRate)));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    calculateRateFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      calculateRateFromClientY(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const fillPercent = rateToPercent(playbackRate);

  return (
    <div className="mx-3 my-2 z-20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-lg shadow-black/5 rounded-full px-3.5 py-2 text-xs flex items-center justify-between gap-3 animate-fade-in text-slate-800 dark:text-slate-100 shrink-0">
      {/* Play/Pause Button */}
      <button
        onClick={onTogglePlay}
        className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/20 active:scale-95 transition"
      >
        {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      {/* Title & Seek Scrubber */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-200">
          <span className="flex items-center gap-1.5 truncate">
            {type === 'audio' ? (
              <Mic size={13} className="text-sky-500 dark:text-sky-400" />
            ) : (
              <Video size={13} className="text-indigo-500 dark:text-indigo-400" />
            )}
            <span className="truncate font-semibold text-slate-800 dark:text-white">{title}</span>
          </span>
          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Seek Progress Scrubber */}
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            onSeek(pos * duration);
          }}
          className="h-1.5 w-full bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden cursor-pointer relative group"
        >
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full bg-sky-500 dark:bg-sky-400 transition-all duration-100 rounded-full"
          />
        </div>
      </div>

      {/* Speed Rate Control with Ultra Minimalist Vertical Slider Track */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowSpeedPopover(!showSpeedPopover)}
          className="px-2.5 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 border border-slate-300/30 dark:border-slate-700/40 transition active:scale-95"
          title="Скорость воспроизведения"
        >
          {playbackRate.toFixed(1)}x
        </button>

        {showSpeedPopover && (
          <div className="absolute top-9 right-0 z-50 p-2 rounded-2xl bg-white/40 dark:bg-slate-900/50 backdrop-blur-md border border-white/30 dark:border-slate-800/40 shadow-lg flex flex-col items-center space-y-1 animate-fade-in w-10 text-slate-800 dark:text-white">
            <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 select-none">
              {playbackRate.toFixed(1)}x
            </span>

            {/* Custom Minimalist Vertical Drag Track without background box */}
            <div
              ref={trackRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="h-28 w-1 bg-slate-300/40 dark:bg-slate-700/40 rounded-full relative cursor-pointer flex items-end justify-center select-none touch-none my-1"
            >
              {/* Fill */}
              <div
                style={{ height: `${fillPercent}%` }}
                className="w-full bg-sky-500 rounded-full"
              />
              {/* Handle */}
              <div
                style={{ bottom: `calc(${fillPercent}% - 5px)` }}
                className="absolute h-2.5 w-2.5 bg-sky-500 border border-white rounded-full shadow-sm pointer-events-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Close Player */}
      <button
        onClick={onClose}
        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition"
      >
        <X size={15} />
      </button>
    </div>
  );
};
