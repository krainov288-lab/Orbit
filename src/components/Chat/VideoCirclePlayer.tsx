import React, { useRef, useState } from 'react';
import { Play, Pause, CheckCheck, Minimize2 } from 'lucide-react';
import { Message } from '../../types';

interface VideoCirclePlayerProps {
  message: Message;
  isExpanded: boolean;
  isActive: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  timestamp?: string;
  isMe?: boolean;
  onToggleExpand: (e: React.MouseEvent) => void;
  onTogglePlay: (e: React.MouseEvent) => void;
  onCloseExpand: () => void;
  onSeek?: (timeSec: number) => void;
  onTimeUpdate?: (timeSec: number) => void;
  onLoadedMetadata?: (durSec: number) => void;
  onEnded?: () => void;
}

export const VideoCirclePlayer: React.FC<VideoCirclePlayerProps> = ({
  message,
  isExpanded,
  isActive,
  isPlaying,
  currentTime,
  duration,
  timestamp,
  isMe,
  onToggleExpand,
  onTogglePlay,
  onCloseExpand,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isScrubbingRef = useRef(false);
  const [showControlIndicator, setShowControlIndicator] = useState<'play' | 'pause' | null>(null);

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      if (Math.abs(v.currentTime - currentTime) > 0.5) {
        try {
          v.currentTime = currentTime;
        } catch {}
      }
      if (isPlaying) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
    }
  }, [isActive, isPlaying]);

  const effectiveDuration = duration || message.duration || 10;
  const progress = effectiveDuration > 0 ? Math.min(1, Math.max(0, currentTime / effectiveDuration)) : 0;

  // SVG ring dimensions - constrained so expanded circle strictly fits inside dialogue container (max 280px)
  const maxExpandedSize = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 280) : 280;
  const size = isExpanded ? maxExpandedSize : 150;
  const strokeWidth = isExpanded ? 4 : 3;
  // Radius aligned so video inner container touches progress stroke directly with 0 gap
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - circumference * progress;

  // Calculate runner dot coordinates (0° angleDeg = 3 o'clock unrotated = 12 o'clock with SVG -rotate-90)
  const center = size / 2;
  const angleDeg = progress * 360;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = center + radius * Math.cos(angleRad);
  const dotY = center + radius * Math.sin(angleRad);

  const calculateTimeFromPointer = (clientX: number, clientY: number, rect: DOMRect) => {
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const rad = Math.atan2(dy, dx);
    const deg = (rad * 180) / Math.PI;
    const normDeg = (deg + 90 + 360) % 360;
    const fraction = normDeg / 360;
    return fraction * effectiveDuration;
  };

  const handleRingPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isScrubbingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const seekTime = calculateTimeFromPointer(e.clientX, e.clientY, rect);
    if (onSeek) onSeek(seekTime);
  };

  const handleRingPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isScrubbingRef.current) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const seekTime = calculateTimeFromPointer(e.clientX, e.clientY, rect);
      if (onSeek) onSeek(seekTime);
    }
  };

  const handleRingPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isScrubbingRef.current) {
      e.stopPropagation();
      isScrubbingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleVideoTap = (e: React.MouseEvent) => {
    if (isScrubbingRef.current) return;
    e.stopPropagation();
    if (!isExpanded) {
      onToggleExpand(e);
    } else {
      onTogglePlay(e);
      setShowControlIndicator(isPlaying ? 'pause' : 'play');
      setTimeout(() => setShowControlIndicator(null), 800);
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className={`relative my-1.5 flex flex-col items-center justify-center w-full transition-all duration-300 select-none ${isExpanded ? 'py-2' : ''}`}>
      {/* Circle Container */}
      <div
        onClick={handleVideoTap}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="relative cursor-pointer group flex items-center justify-center shrink-0 transition-all duration-300"
      >
        {/* Circular Progress Ring with Interactive Scrubbing */}
        <svg
          onPointerDown={handleRingPointerDown}
          onPointerMove={handleRingPointerMove}
          onPointerUp={handleRingPointerUp}
          onPointerCancel={handleRingPointerUp}
          className="absolute inset-0 w-full h-full -rotate-90 z-20 touch-none cursor-pointer"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Thin Translucent Timeline Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="stroke-white/30 dark:stroke-white/20"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* White Translucent Active Progress Ring */}
          {isActive && (
            <>
              <circle
                cx={center}
                cy={center}
                r={radius}
                className="stroke-white/95 transition-all duration-75"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
              {/* White Runner Dot */}
              <circle
                cx={dotX}
                cy={dotY}
                r={strokeWidth + 2}
                className="fill-white stroke-white/80 shadow-md cursor-grab active:cursor-grabbing"
                strokeWidth="1"
              />
            </>
          )}
        </svg>

        {/* Video Circle Content - Fits strictly on the contour with 0 gap */}
        <div
          style={{ width: `${size - strokeWidth * 2}px`, height: `${size - strokeWidth * 2}px` }}
          className="rounded-full overflow-hidden bg-black/80 backdrop-blur-md relative transition-all duration-300 shadow-md"
        >
          {/* Collapse Button when Expanded */}
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseExpand();
              }}
              className="absolute top-4 right-4 z-40 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md flex items-center justify-center transition active:scale-95 shadow-lg border border-white/20"
              title="Свернуть"
            >
              <Minimize2 size={16} />
            </button>
          )}

          {message.mediaUrl && (
            <video
              ref={videoRef}
              src={message.mediaUrl}
              preload="metadata"
              playsInline
              onLoadStart={() => setIsLoading(true)}
              onWaiting={() => setIsLoading(true)}
              onCanPlay={() => setIsLoading(false)}
              onPlaying={() => setIsLoading(false)}
              onTimeUpdate={(e) => {
                if (isActive && onTimeUpdate) {
                  onTimeUpdate(e.currentTarget.currentTime);
                }
              }}
              onLoadedMetadata={(e) => {
                if (isActive && onLoadedMetadata) {
                  onLoadedMetadata(e.currentTarget.duration);
                }
              }}
              onEnded={() => {
                setIsLoading(false);
                if (isActive && onEnded) {
                  onEnded();
                }
              }}
              onError={(e) => {
                e.preventDefault();
                setIsLoading(false);
              }}
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {/* Clockwise rotating loading spinner ring around play/pause when loading */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-30">
              <div className="h-10 w-10 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Minimalist Play Overlay Icon (White, translucent, NO background card) */}
          {(!isActive || !isPlaying) && (
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 flex items-center justify-center transition">
              <Play
                size={isExpanded ? 38 : 26}
                className="text-white/85 fill-white/85 drop-shadow-md ml-0.5"
              />
            </div>
          )}

          {/* Pause/Play indicator feedback on tap (NO background card) */}
          {showControlIndicator && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 animate-ping duration-500 z-30 pointer-events-none">
              {showControlIndicator === 'play' ? (
                <Play size={isExpanded ? 46 : 32} className="text-white/90 fill-white/90 ml-1 drop-shadow-lg" />
              ) : (
                <Pause size={isExpanded ? 46 : 32} className="text-white/90 fill-white/90 drop-shadow-lg" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timestamp placed directly below the video circle */}
      {timestamp && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-slate-400 font-mono select-none">
          <span>{timestamp}</span>
          {isMe && (
            <CheckCheck
              size={12}
              className={message.isRead ? 'text-sky-500 font-bold' : 'text-slate-400 dark:text-slate-500'}
            />
          )}
        </div>
      )}
    </div>
  );
};
