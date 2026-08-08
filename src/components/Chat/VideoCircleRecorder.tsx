import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Pause, Play, Sun, Layers, Scissors, Lock, Volume2, Sparkles } from 'lucide-react';

interface VideoCircleRecorderProps {
  onSendCircle: (durationSec: number, mediaUrl: string, blob?: Blob) => void;
  onCancel: () => void;
}

export const VideoCircleRecorder: React.FC<VideoCircleRecorderProps> = ({
  onSendCircle,
  onCancel,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [bgLight, setBgLight] = useState<'dark' | 'white'>('dark');
  const [quality, setQuality] = useState<'1080p' | '720p' | '480p' | '360p'>('720p');
  const [isProcessing, setIsProcessing] = useState(false);

  const cycleQuality = () => {
    if (quality === '1080p') setQuality('720p');
    else if (quality === '720p') setQuality('480p');
    else if (quality === '480p') setQuality('360p');
    else setQuality('1080p');
  };
  const [maskOverlay, setMaskOverlay] = useState(false);

  // Trimming State
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Dragging Handle State
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | null>(null);

  // Audio Bitrate Waveform Samples (1 per half-second / second)
  const [waveform, setWaveform] = useState<number[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const maxDuration = 60;

  const stopStream = () => {
    if (streamRef.current) {
      const customStream = streamRef.current as unknown as { _sampleInterval?: NodeJS.Timeout };
      if (customStream._sampleInterval) clearInterval(customStream._sampleInterval);
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.enabled = false;
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCancelCircle = () => {
    stopStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    onCancel();
  };

  // Initialize camera, audio context, audio analyzer & recording
  useEffect(() => {
    chunksRef.current = [];
    setWaveform([]);
    const dimMap: Record<string, number> = {
      '1080p': 1080,
      '720p': 720,
      '480p': 480,
      '360p': 360,
    };
    const targetDim = dimMap[quality] || 720;
    const videoConstraint = { width: { ideal: targetDim }, height: { ideal: targetDim } };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', ...videoConstraint }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Set up Web Audio API to measure audio bitrate/amplitude for waveform
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const sampleInterval = setInterval(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                  sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                // Normalize bitrate level between 0.15 and 1.0
                const normalized = Math.max(0.15, Math.min(1.0, (avg / 255) * 2.5 + Math.random() * 0.1));
                setWaveform((prev) => [...prev, normalized]);
              }
            }, 300);

            (stream as unknown as { _sampleInterval: NodeJS.Timeout })._sampleInterval = sampleInterval;
          }
        } catch (e) {
          console.warn('Audio Context init warning:', e);
        }

        // MediaRecorder setup
        try {
          let options: MediaRecorderOptions = {};
          if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
              options = { mimeType: 'video/webm;codecs=vp8,opus' };
            } else if (MediaRecorder.isTypeSupported('video/webm')) {
              options = { mimeType: 'video/webm' };
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
              options = { mimeType: 'video/mp4' };
            }
          }
          const recorder = new MediaRecorder(stream, options);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };
          recorder.start(100);
        } catch (e) {
          console.warn('MediaRecorder init error:', e);
        }
      })
      .catch(() => {
        setHasCamera(false);
      });

    // Recording seconds timer
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev >= maxDuration) {
          if (timerRef.current) clearInterval(timerRef.current);
          return maxDuration;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      stopStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, [quality]);

  // Keep trimEnd updated during active recording if not manually adjusted
  useEffect(() => {
    if (!isPaused && seconds > 0) {
      setTrimEnd(seconds);
    }
  }, [seconds, isPaused]);

  // Toggle pause
  const togglePause = () => {
    if (isPaused) {
      // Resume recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        try {
          mediaRecorderRef.current.resume();
        } catch (e) {
          console.warn('Resume error:', e);
        }
      }
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => (prev >= maxDuration ? maxDuration : prev + 1));
      }, 1000);
      setIsPaused(false);
    } else {
      // Pause recording (Enables trimming editor mode!)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.pause();
        } catch (e) {
          console.warn('Pause error:', e);
        }
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPaused(true);
      if (trimEnd === 0 || trimEnd > seconds) {
        setTrimEnd(seconds);
      }
    }
  };

  // Dragging logic for Trimming handles (TikTok style)
  const handlePointerDown = (handle: 'start' | 'end', e: React.PointerEvent) => {
    if (!isPaused) return; // Only allow trimming when paused
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(handle);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag || !timelineRef.current || seconds <= 1) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = offsetX / rect.width;
    const calculatedSec = Math.round(ratio * seconds);

    if (activeDrag === 'start') {
      const validStart = Math.min(Math.max(0, calculatedSec), Math.max(0, trimEnd - 1));
      setTrimStart(validStart);
    } else if (activeDrag === 'end') {
      const validEnd = Math.max(Math.min(seconds, calculatedSec), trimStart + 1);
      setTrimEnd(validEnd);
    }
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  const progressPct = (seconds / maxDuration) * 100;
  const strokeDashoffset = 314 - (314 * progressPct) / 100;

  const handleSend = () => {
    const finalDuration = Math.max(trimEnd - trimStart, 1);
    const recorder = mediaRecorderRef.current;

    const finalizeAndSend = (rawBlob: Blob) => {
      stopStream();
      const mediaUrl = rawBlob.size > 0 ? URL.createObjectURL(rawBlob) : '';
      onSendCircle(finalDuration, mediaUrl, rawBlob.size > 0 ? rawBlob : undefined);
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        finalizeAndSend(blob);
      };
      recorder.stop();
    } else {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      finalizeAndSend(blob);
    }
  };

  // Percentages for Timeline styling
  const startPct = seconds > 0 ? (trimStart / seconds) * 100 : 0;
  const endPct = seconds > 0 ? (trimEnd / seconds) * 100 : 100;

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-300 animate-fade-in select-none ${
        bgLight === 'white' ? 'bg-white text-slate-900' : 'bg-slate-950/90 text-white backdrop-blur-md'
      }`}
    >
      <div className="relative flex flex-col items-center gap-4 w-full max-w-sm">
        {/* Top Minimal Controls */}
        <div className="w-full flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBgLight(bgLight === 'white' ? 'dark' : 'white')}
              className="h-8 w-8 rounded-full bg-slate-800/30 hover:bg-slate-800/50 flex items-center justify-center transition active:scale-95"
              title="Переключить подсветку"
            >
              <Sun size={15} />
            </button>
            <button
              onClick={cycleQuality}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/30 hover:bg-slate-800/50 transition active:scale-95 flex items-center gap-1"
              title="Качество видео"
            >
              <span>{quality}</span>
            </button>
            <button
              onClick={() => setMaskOverlay(!maskOverlay)}
              className={`h-8 w-8 rounded-full flex items-center justify-center transition active:scale-95 ${
                maskOverlay ? 'bg-sky-500 text-white' : 'bg-slate-800/30'
              }`}
              title="Маска"
            >
              <Layers size={15} />
            </button>
          </div>

          <button
            onClick={handleCancelCircle}
            className="h-9 w-9 rounded-full bg-slate-800/30 hover:bg-slate-800/50 flex items-center justify-center transition active:scale-95"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Circular Preview Container with Progress Ring */}
        <div className="relative h-60 w-60 rounded-full p-2 flex items-center justify-center bg-slate-900 border-4 border-slate-800 shadow-2xl">
          <svg className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none" viewBox="0 0 110 110">
            <circle cx="55" cy="55" r="50" className="stroke-slate-800" strokeWidth="4" fill="transparent" />
            <circle
              cx="55"
              cy="55"
              r="50"
              className="stroke-sky-500 transition-all duration-1000"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray="314"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Video stream element */}
          <div className="h-52 w-52 rounded-full overflow-hidden bg-slate-950 flex items-center justify-center relative shadow-inner">
            {hasCamera ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <span className="text-xs font-semibold text-slate-300">Камера активна</span>
              </div>
            )}
            {maskOverlay && (
              <div className="absolute inset-0 border-4 border-dashed border-sky-400/40 rounded-full pointer-events-none" />
            )}
            {isPaused && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1">
                <div className="px-3 py-1 rounded-full bg-amber-500/90 text-slate-950 font-bold text-[10px] tracking-wider uppercase shadow-md flex items-center gap-1">
                  <Scissors size={12} /> Режим обрезки
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono font-bold tracking-widest bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
            0:{seconds.toString().padStart(2, '0')} / 1:00
          </div>
          {isPaused && (
            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span>Итого: {Math.max(trimEnd - trimStart, 1)} сек</span>
            </div>
          )}
        </div>

        {/* TIKTOK-STYLE WIDE TIMELINE TRIMMING BAR WITH AUDIO BITRATE WAVEFORM */}
        <div className="w-full space-y-1.5 px-1">
          {/* Status / Instructions Header above bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold px-1">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Volume2 size={13} className="text-sky-400" />
              <span>Шкала битрейта звука</span>
            </span>

            {isPaused ? (
              <span className="text-amber-400 flex items-center gap-1 animate-pulse">
                <Scissors size={12} /> Двигайте края для обрезки
              </span>
            ) : (
              <span className="text-slate-500 flex items-center gap-1">
                <Lock size={11} /> Пауза для обрезки
              </span>
            )}
          </div>

          {/* Main Wide Timeline Track (TikTok Style) */}
          <div
            ref={timelineRef}
            className={`relative w-full h-20 rounded-2xl bg-slate-900/90 border border-slate-700/80 overflow-hidden shadow-inner flex items-center ${
              !isPaused ? 'opacity-70' : 'cursor-pointer'
            }`}
          >
            {/* Audio Bitrate Waveform Bars Grid across full width */}
            <div className="absolute inset-0 px-3 py-2 flex items-center justify-between gap-[2px] opacity-80 pointer-events-none">
              {Array.from({ length: 42 }).map((_, idx) => {
                const sampleVal =
                  waveform.length > 0
                    ? waveform[idx % waveform.length]
                    : Math.max(0.2, Math.sin(idx * 0.4) * 0.5 + 0.5);
                const barHeightPct = Math.max(15, Math.min(100, sampleVal * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-sky-400/60 rounded-full transition-all duration-300"
                    style={{ height: `${barHeightPct}%` }}
                  />
                );
              })}
            </div>

            {/* Darkened Overlay Mask OUTSIDE Trimmed Range (Left Side: 0..start) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-slate-950/80 backdrop-blur-[1px] border-r border-amber-400/50 z-10 transition-all duration-75"
              style={{ width: `${startPct}%` }}
            />

            {/* Darkened Overlay Mask OUTSIDE Trimmed Range (Right Side: end..100) */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-slate-950/80 backdrop-blur-[1px] border-l border-amber-400/50 z-10 transition-all duration-75"
              style={{ width: `${100 - endPct}%` }}
            />

            {/* Selected Active TikTok Box Highlight */}
            {seconds > 0 && (
              <div
                className={`absolute top-0 bottom-0 border-y-2 z-20 pointer-events-none transition-all duration-75 ${
                  isPaused ? 'border-amber-400 bg-amber-400/10' : 'border-sky-500/40 bg-sky-500/5'
                }`}
                style={{
                  left: `${startPct}%`,
                  width: `${Math.max(0, endPct - startPct)}%`,
                }}
              />
            )}

            {/* Lock overlay when NOT paused */}
            {!isPaused && (
              <div className="absolute inset-0 z-30 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-300">
                <Lock size={13} className="text-amber-400" />
                <span>Нажмите паузу, чтобы обрезать видео</span>
              </div>
            )}

            {/* LEFT DRAG HANDLE (Start handle) */}
            {isPaused && seconds > 0 && (
              <div
                onPointerDown={(e) => handlePointerDown('start', e)}
                className="absolute top-0 bottom-0 w-6 -ml-3 bg-gradient-to-r from-amber-400 to-amber-500 rounded-l-xl z-40 flex items-center justify-center cursor-ew-resize shadow-lg active:scale-105 transition-transform border-2 border-white/80"
                style={{ left: `${startPct}%` }}
                title="Начало обрезки"
              >
                <div className="w-1 h-6 bg-slate-950/80 rounded-full" />
                {/* Time Badge above handle */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-mono font-extrabold text-[10px] px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
                  0:{trimStart.toString().padStart(2, '0')}
                </div>
              </div>
            )}

            {/* RIGHT DRAG HANDLE (End handle) */}
            {isPaused && seconds > 0 && (
              <div
                onPointerDown={(e) => handlePointerDown('end', e)}
                className="absolute top-0 bottom-0 w-6 -mr-3 bg-gradient-to-r from-amber-400 to-amber-500 rounded-r-xl z-40 flex items-center justify-center cursor-ew-resize shadow-lg active:scale-105 transition-transform border-2 border-white/80"
                style={{ left: `${endPct}%` }}
                title="Конец обрезки"
              >
                <div className="w-1 h-6 bg-slate-950/80 rounded-full" />
                {/* Time Badge above handle */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-mono font-extrabold text-[10px] px-1.5 py-0.5 rounded-md shadow-md whitespace-nowrap">
                  0:{trimEnd.toString().padStart(2, '0')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Controls: Pause/Resume & Send */}
        <div className="flex items-center gap-4 pt-1 w-full justify-center">
          <button
            onClick={togglePause}
            className={`h-12 px-5 rounded-2xl flex items-center gap-2 font-bold text-xs shadow-md transition active:scale-95 ${
              isPaused
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800/60 text-slate-200 border border-slate-700 hover:bg-slate-800'
            }`}
            title={isPaused ? 'Продолжить запись' : 'Поставить на паузу'}
          >
            {isPaused ? (
              <>
                <Play size={16} className="text-emerald-400" />
                <span>Продолжить</span>
              </>
            ) : (
              <>
                <Pause size={16} className="text-amber-400" />
                <span>Пауза</span>
              </>
            )}
          </button>

          <button
            onClick={handleSend}
            className="px-7 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/30 flex items-center gap-2 active:scale-95 transition"
          >
            <Send size={15} />
            <span>Отправить ({Math.max(trimEnd - trimStart, 1)}с)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
