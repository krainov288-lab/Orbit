import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Pause, Play, ChevronLeft } from 'lucide-react';

interface VoiceRecorderProps {
  onSendVoice: (durationSec: number, mediaUrl: string, blob?: Blob) => void;
  onCancel: () => void;
  isPushToTalk?: boolean;
  pushStartPos?: { x: number; y: number } | null;
  onLockRecording?: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoice,
  onCancel,
  isPushToTalk = false,
  pushStartPos = null,
  onLockRecording,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(Array(20).fill(15));
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [isLockHovered, setIsLockHovered] = useState(false);
  const [isLocked, setIsLocked] = useState(!isPushToTalk);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  // Sync isLocked if isPushToTalk changes externally
  useEffect(() => {
    if (!isPushToTalk) {
      setIsLocked(true);
    }
  }, [isPushToTalk]);

  // Window pointer listeners for push-to-talk gesture release/cancel/lock
  useEffect(() => {
    if (isLocked || !isPushToTalk || !pushStartPos) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = e.clientX - pushStartPos.x;
      const deltaY = e.clientY - pushStartPos.y;

      if (deltaY < -40) {
        setIsLockHovered(true);
        setIsCancelHovered(false);
      } else if (deltaX < -60) {
        setIsCancelHovered(true);
        setIsLockHovered(false);
      } else {
        setIsCancelHovered(false);
        setIsLockHovered(false);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const deltaX = e.clientX - pushStartPos.x;
      const deltaY = e.clientY - pushStartPos.y;

      if (deltaY < -40) {
        // Lock hands-free recording
        setIsLocked(true);
        if (onLockRecording) onLockRecording();
      } else if (deltaX < -60) {
        handleCancelVoice();
      } else {
        handleFinishAndSend();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPushToTalk, pushStartPos, isLocked]);

  useEffect(() => {
    chunksRef.current = [];
    let animationFrameId: number;

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;

        // Initialize Web Audio API Analyser for real-time waveform visualization
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            if (audioCtx.state === 'suspended') {
              audioCtx.resume();
            }
            audioCtxRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.75;
            source.connect(analyser);
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateWaveform = () => {
              if (analyserRef.current && !isPaused) {
                analyserRef.current.getByteFrequencyData(dataArray);
                const barsCount = 20;
                const newLevels: number[] = [];
                const step = Math.max(1, Math.floor(bufferLength / barsCount));

                for (let i = 0; i < barsCount; i++) {
                  const val = dataArray[i * step] || 0;
                  // Map [0..255] to percentage height [12% .. 100%]
                  const normalized = Math.min(100, Math.max(12, (val / 255) * 100 * 1.6));
                  newLevels.push(normalized);
                }
                setWaveformLevels(newLevels);
              } else if (isPaused) {
                setWaveformLevels(Array(20).fill(15));
              }
              animationFrameId = requestAnimationFrame(updateWaveform);
            };

            updateWaveform();
          }
        } catch (e) {
          console.warn('Real-time AudioContext waveform setup failed:', e);
        }

        // Initialize MediaRecorder
        try {
          let options: MediaRecorderOptions = {};
          if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              options = { mimeType: 'audio/webm;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
              options = { mimeType: 'audio/webm' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: 'audio/mp4' };
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
          console.warn('MediaRecorder error:', e);
        }
      })
      .catch((err) => {
        console.warn('Microphone permission or stream error:', err);
      });

    const timer = setInterval(() => {
      if (!isPaused) {
        setSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.enabled = false;
            t.stop();
          } catch {}
        });
        streamRef.current = null;
      }
    };
  }, []);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.enabled = false;
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }
  };

  const handleCancelVoice = () => {
    handleStopStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    onCancel();
  };

  const handleFinishAndSend = () => {
    const dur = Math.max(secondsRef.current, 1);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        handleStopStream();
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const mediaUrl = blob.size > 0 ? URL.createObjectURL(blob) : '';
        onSendVoice(dur, mediaUrl, blob.size > 0 ? blob : undefined);
      };
      recorder.stop();
    } else {
      handleStopStream();
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const mediaUrl =
        blob.size > 0
          ? URL.createObjectURL(blob)
          : 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg';
      onSendVoice(dur, mediaUrl, blob.size > 0 ? blob : undefined);
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-full border shadow-lg transition-all duration-200 w-full select-none ${
        isCancelHovered
          ? 'bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-200 backdrop-blur-xl'
          : 'bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-white border-white/60 dark:border-slate-800/80 backdrop-blur-xl shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleCancelVoice}
          className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition active:scale-95"
          title="Отменить запись"
        >
          <Trash2 size={17} />
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-red-500">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span>{formatTime(seconds)}</span>
        </div>
      </div>

      {/* Real-Time Web Audio API Waveform Visualizer with Animation */}
      <div className="flex items-center gap-1 h-7 px-2 overflow-hidden flex-1 justify-center relative">
        {isPushToTalk && isCancelHovered ? (
          <div className="text-xs text-red-500 font-medium animate-pulse flex items-center gap-1">
            <span>Отпустите для отмены</span>
          </div>
        ) : (
          <>
            {waveformLevels.map((heightPct, i) => (
              <span
                key={i}
                style={{ height: `${heightPct}%` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isCancelHovered
                    ? 'bg-red-400'
                    : isPaused
                    ? 'bg-slate-300 dark:bg-slate-700'
                    : 'bg-sky-500 animate-pulse'
                }`}
              />
            ))}
          </>
        )}
      </div>

      {/* Swipe hint in push-to-talk mode */}
      {isPushToTalk && !isCancelHovered && (
        <div className="hidden sm:flex items-center gap-0.5 text-[11px] text-slate-400 font-medium shrink-0 animate-pulse mr-1">
          <ChevronLeft size={14} />
          <span>Смахните влево</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {(isLocked || !isPushToTalk) ? (
          <button
            type="button"
            onClick={() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                if (isPaused) {
                  mediaRecorderRef.current.resume();
                } else {
                  mediaRecorderRef.current.pause();
                }
              }
              setIsPaused(!isPaused);
            }}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title={isPaused ? "Продолжить запись" : "Пауза записи"}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsLocked(true);
              if (onLockRecording) onLockRecording();
            }}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition text-[10px] font-medium"
            title="Зафиксировать запись"
          >
            Зафиксировать
          </button>
        )}

        <button
          type="button"
          onClick={handleFinishAndSend}
          className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 active:scale-95 transition shrink-0"
          title="Отправить голосовое сообщение"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
