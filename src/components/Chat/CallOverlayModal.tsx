import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Users,
  Radio,
  Share2,
  Hand,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import { Contact } from '../../types';

export type CallType = 'voice' | 'video' | 'group_conference' | 'channel_stream';

interface CallOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  callType: CallType;
}

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  isOpen,
  onClose,
  contact,
  callType,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [liveViewers, setLiveViewers] = useState(1482);
  const [reactions, setReactions] = useState<{ id: number; icon: string; left: number }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Timer Effect
  useEffect(() => {
    if (!isOpen) {
      setCallDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
      if (callType === 'channel_stream') {
        setLiveViewers((v) => v + (Math.random() > 0.5 ? 2 : -1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, callType]);

  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      activeStreamRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      localVideoRef.current.srcObject = null;
    }
  };

  // Request camera stream if video call or conference
  useEffect(() => {
    if (isOpen && (callType === 'video' || callType === 'group_conference') && !isVideoOff) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          activeStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // Camera permission or fallback
        });
    } else if (isVideoOff) {
      stopTracks();
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, callType, isVideoOff]);

  const handleEndCall = () => {
    stopTracks();
    onClose();
  };

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendReaction = (emoji: string) => {
    const newReaction = {
      id: Date.now(),
      icon: emoji,
      left: Math.random() * 80 + 10,
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-between p-4 text-white select-none overflow-hidden animate-fade-in">
      {/* Floating live reaction hearts/emojis */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-24 text-2xl animate-bounce transition-all duration-1000"
          >
            {r.icon}
          </div>
        ))}
      </div>

      {/* Top Bar Header */}
      <div className="w-full max-w-md flex items-center justify-between pt-4 px-2 z-10">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">
            {callType === 'voice' && 'Голосовой вызов'}
            {callType === 'video' && 'Видеовызов HD'}
            {callType === 'group_conference' && 'Видеоконференция'}
            {callType === 'channel_stream' && 'Прямая трансляция'}
          </span>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-1">
            {formatTimer(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {callType === 'channel_stream' ? (
            <div className="flex items-center gap-1.5 bg-red-600/80 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg">
              <Radio size={13} className="animate-pulse" />
              <span>LIVE · {liveViewers}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-slate-900/80 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <ShieldCheck size={13} />
              <span>E2EE: 9482</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="w-full max-w-md my-auto flex flex-col items-center justify-center relative">
        {callType === 'video' || callType === 'group_conference' || callType === 'channel_stream' ? (
          <div className="w-full aspect-[3/4] max-h-[58vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 relative shadow-2xl flex items-center justify-center">
            {isVideoOff ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`h-24 w-24 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-2xl font-bold text-white shadow-2xl`}
                >
                  {contact.initials}
                </div>
                <div className="text-sm font-semibold text-slate-300">{contact.name}</div>
                <div className="text-xs text-slate-500">Камера отключена</div>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted={isMuted}
                onError={(e) => {
                  e.preventDefault();
                }}
                className="w-full h-full object-cover rounded-3xl"
              />
            )}

            {/* PIP overlay for 1-on-1 video call */}
            {callType === 'video' && !isVideoOff && (
              <div className="absolute top-4 right-4 h-28 w-20 rounded-2xl bg-slate-950/80 border border-white/20 overflow-hidden shadow-xl flex items-center justify-center">
                <div
                  className={`h-8 w-8 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-xs font-bold`}
                >
                  {contact.initials}
                </div>
              </div>
            )}

            {/* Conference Grid badges */}
            {callType === 'group_conference' && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-slate-950/70 backdrop-blur-md border border-slate-800 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  <span>Участников: 6</span>
                </div>
                {isHandRaised && (
                  <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Hand size={12} /> Рука поднята
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Voice Call Big Avatar Screen */
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping opacity-40" />
              <div
                className={`h-32 w-32 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-4xl font-bold text-white shadow-2xl relative border-4 border-slate-900`}
              >
                {contact.initials}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">{contact.name}</h2>
              <p className="text-xs text-emerald-400 font-semibold mt-1 flex items-center justify-center gap-1">
                <ShieldCheck size={14} /> Зашифрованное соединение
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stream Reactions for Live Channel */}
      {callType === 'channel_stream' && (
        <div className="flex gap-2 mb-3">
          {['❤️', '🔥', '👏', '🚀', '🎉'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSendReaction(emoji)}
              className="h-10 w-10 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 flex items-center justify-center text-lg active:scale-90 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-md pb-6 space-y-3 z-10">
        <div className="flex items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-xl p-3.5 rounded-3xl border border-slate-800">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Микрофон"
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Камера"
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              !isSpeakerOn ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Динамик"
          >
            {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {callType === 'group_conference' && (
            <button
              onClick={() => setIsHandRaised(!isHandRaised)}
              className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
                isHandRaised ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title="Поднять руку"
            >
              <Hand size={20} />
            </button>
          )}

          {/* Red End Call Button */}
          <button
            onClick={handleEndCall}
            className="h-12 w-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-90 transition ml-2"
            title="Завершить вызов"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
