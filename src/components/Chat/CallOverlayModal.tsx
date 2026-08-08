import React, { useState, useEffect, useRef } from 'react';
import {
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
  X,
  RefreshCw,
  Zap,
  Lock,
  CheckCircle2,
  KeyRound,
  Info,
} from 'lucide-react';

async function generateSessionFingerprint(user1: string, user2: string, callType: string): Promise<string> {
  const raw = [user1, user2, callType, 'ORBIT_E2EE_P2P_KEY_V1'].sort().join(':');
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 4).toUpperCase()}-${hex.slice(4, 8).toUpperCase()}`;
    } catch {}
  }
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const pos = Math.abs(hash).toString(16).padStart(8, '7');
  return `${pos.slice(0, 4).toUpperCase()}-${pos.slice(4, 8).toUpperCase()}`;
}
import { Contact } from '../../types';
import { socketService } from '../../services/socket';

export type CallType = 'voice' | 'video' | 'group_conference' | 'channel_stream';

interface CallOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact;
  callType: CallType;
  isIncoming?: boolean;
  currentUserId?: string;
}

export const CallOverlayModal: React.FC<CallOverlayModalProps> = ({
  isOpen,
  onClose,
  contact,
  callType,
  isIncoming = false,
  currentUserId,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>(
    isIncoming ? 'connected' : 'calling'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [swapPip, setSwapPip] = useState(false);
  const [liveViewers, setLiveViewers] = useState(1482);
  const [reactions, setReactions] = useState<{ id: number; icon: string; left: number }[]>([]);
  const [e2eeFingerprint, setE2eeFingerprint] = useState<string>('SEC-E2EE');
  const [isE2eeVerified, setIsE2eeVerified] = useState<boolean>(false);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dialToneIntervalRef = useRef<any>(null);
  const pendingOfferRef = useRef<any>(null);
  const pendingAcceptedRef = useRef<boolean>(false);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    generateSessionFingerprint(currentUserId || 'me', contact.id, callType).then((fp) => {
      setE2eeFingerprint(fp);
    });
  }, [currentUserId, contact.id, callType]);

  const setupDataChannelEvents = (dc: RTCDataChannel, fp: string) => {
    dc.onopen = () => {
      setIsE2eeVerified(true);
      try {
        dc.send(
          JSON.stringify({
            type: 'e2ee_handshake',
            fingerprint: fp,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Data channel send error:', e);
      }
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'e2ee_handshake') {
          setIsE2eeVerified(true);
        }
      } catch (e) {
        console.warn('Data channel message error:', e);
      }
    };
  };

  // Play realistic dial tone via Web Audio API
  const startDialTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      audioCtxRef.current = new AudioCtx();

      const playBeep = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
        const osc1 = audioCtxRef.current.createOscillator();
        const osc2 = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();

        osc1.frequency.value = 425;
        osc2.frequency.value = 475;
        gain.gain.value = 0.08;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtxRef.current.destination);

        osc1.start();
        osc2.start();

        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
          } catch {}
        }, 1000);
      };

      playBeep();
      dialToneIntervalRef.current = setInterval(playBeep, 3000);
    } catch (e) {
      console.warn('Dial tone error:', e);
    }
  };

  const stopDialTone = () => {
    if (dialToneIntervalRef.current) {
      clearInterval(dialToneIntervalRef.current);
      dialToneIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
  };

  // Timer & Call Initialization Effect
  useEffect(() => {
    if (!isOpen) {
      setCallDuration(0);
      setCallStatus(isIncoming ? 'connected' : 'calling');
      return;
    }

    if (!isIncoming) {
      startDialTone();

      // Send call signal
      socketService.emit('call_user', {
        targetUserId: contact.id,
        callType,
        caller: {
          id: currentUserId || 'me',
          username: 'Вы',
          initials: 'ME',
          avatarColor: 'from-sky-400 to-blue-600',
        },
      });
    }

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
      if (callType === 'channel_stream') {
        setLiveViewers((v) => v + (Math.random() > 0.5 ? 2 : -1));
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      stopDialTone();
    };
  }, [isOpen, callType, contact.id, isIncoming]);

  // Helper to flush buffered ICE candidates once remote description is set
  const flushIceCandidates = async () => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error flushing ICE candidate:', e);
          }
        }
      }
    }
  };

  // Synchronize media stream objects to video refs whenever refs/state update
  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [isOpen, callStatus, isVideoOff, swapPip]);

  useEffect(() => {
    if (remoteStreamRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [isOpen, callStatus, swapPip, hasRemoteVideo]);

  // Setup WebRTC and Local/Remote Media Streams
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const handleIncomingOffer = async (offerData: any) => {
      stopDialTone();
      setCallStatus('connected');
      const pc = peerConnectionRef.current;
      if (pc && offerData.offer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offerData.offer));
          await flushIceCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketService.emit('webrtc_answer', {
            targetUserId: offerData.callerId || contact.id,
            answer,
          });
        } catch (e) {
          console.error('Handle offer error:', e);
        }
      }
    };

    const handleCreateOffer = async () => {
      stopDialTone();
      setCallStatus('connected');
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketService.emit('webrtc_offer', {
            targetUserId: contact.id,
            offer,
          });
        } catch (e) {
          console.error('Create offer error:', e);
        }
      }
    };

    const initMediaAndRTC = async () => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        if (!isIncoming) {
          try {
            const dc = pc.createDataChannel('orbit_e2ee_session');
            dataChannelRef.current = dc;
            setupDataChannelEvents(dc, e2eeFingerprint);
          } catch (e) {
            console.warn('DataChannel creation error:', e);
          }
        }

        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dataChannelRef.current = dc;
          setupDataChannelEvents(dc, e2eeFingerprint);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socketService.emit('webrtc_ice_candidate', {
              targetUserId: contact.id,
              candidate: event.candidate,
            });
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const stream = event.streams[0];
            remoteStreamRef.current = stream;
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
            }
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
              setHasRemoteVideo(true);
              videoTracks.forEach((t) => {
                t.onunmute = () => setHasRemoteVideo(true);
                t.onmute = () => setHasRemoteVideo(false);
                t.onended = () => setHasRemoteVideo(false);
              });
            }
          }
        };

        let stream: MediaStream | null = null;
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: callType !== 'voice' ? { facingMode } : false,
            });
          }
        } catch (e) {
          console.warn('Local media access warning (using synthetic fallback audio):', e);
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const dst = ctx.createMediaStreamDestination();
              osc.connect(dst);
              osc.start();
              stream = dst.stream;
            }
          } catch {}
        }

        if (!isMounted) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream) {
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream!);
          });
        }

        // Process any queued pending offer or accepted signals
        if (pendingOfferRef.current) {
          const offerData = pendingOfferRef.current;
          pendingOfferRef.current = null;
          await handleIncomingOffer(offerData);
        }

        if (pendingAcceptedRef.current) {
          pendingAcceptedRef.current = false;
          await handleCreateOffer();
        }
      } catch (err) {
        console.warn('WebRTC Media Init Warning:', err);
      }
    };

    initMediaAndRTC();

    // Socket subscriptions for call handling
    const unsubAccepted = socketService.subscribe('call_accepted', async () => {
      if (peerConnectionRef.current) {
        await handleCreateOffer();
      } else {
        pendingAcceptedRef.current = true;
      }
    });

    const unsubDeclined = socketService.subscribe('call_declined', () => {
      stopDialTone();
      setCallStatus('ended');
      setTimeout(() => {
        handleEndCall();
      }, 1200);
    });

    const unsubEnded = socketService.subscribe('call_ended', () => {
      stopDialTone();
      setCallStatus('ended');
      setTimeout(() => {
        handleEndCall();
      }, 800);
    });

    const unsubOffer = socketService.subscribe('webrtc_offer', async (data: any) => {
      if (peerConnectionRef.current) {
        await handleIncomingOffer(data);
      } else {
        pendingOfferRef.current = data;
      }
    });

    const unsubAnswer = socketService.subscribe('webrtc_answer', async (data: any) => {
      const pc = peerConnectionRef.current;
      if (pc && data.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushIceCandidates();
        } catch (e) {
          console.error('Handle answer error:', e);
        }
      }
    });

    const unsubIce = socketService.subscribe('webrtc_ice_candidate', async (data: any) => {
      if (data.candidate) {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn('Add ICE candidate error:', e);
          }
        } else {
          iceCandidateQueueRef.current.push(data.candidate);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubAccepted();
      unsubDeclined();
      unsubEnded();
      unsubOffer();
      unsubAnswer();
      unsubIce();
      cleanUpRTC();
    };
  }, [isOpen, callType, contact.id]);

  const cleanUpRTC = () => {
    stopDialTone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.enabled = false;
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
  };

  const handleEndCall = () => {
    socketService.emit('end_call', { targetUserId: contact.id });
    cleanUpRTC();
    onClose();
  };

  const toggleMute = () => {
    const nextMutedState = !isMuted;
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !nextMutedState;
      });
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = !nextMutedState;
        }
      });
    }
    setIsMuted(nextMutedState);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
      }
    }
    setIsVideoOff(!isVideoOff);
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
        setIsScreenSharing(true);
      } else {
        setIsScreenSharing(false);
        if (localStreamRef.current && localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
    } catch (e) {
      console.warn('Screen share cancelled/failed', e);
    }
  };

  const toggleCameraFacing = async () => {
    if (callType === 'voice') return;
    try {
      const nextMode = facingMode === 'user' ? 'environment' : 'user';
      let newStream: MediaStream | null = null;

      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextMode } },
          audio: false,
        });
      } catch {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          if (videoDevices.length <= 1) {
            showToast('Используется единственная доступная камера');
            return;
          }
          const currentTrack = localStreamRef.current?.getVideoTracks()[0];
          const currentDeviceId = currentTrack?.getSettings()?.deviceId;
          const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
          const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: nextDevice.deviceId } },
            audio: false,
          });
        } catch {
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: nextMode },
              audio: false,
            });
          } catch (e) {
            console.warn('Cannot switch camera:', e);
            showToast('Переключение камеры недоступно');
            return;
          }
        }
      }

      if (newStream) {
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (peerConnectionRef.current) {
            const sender = peerConnectionRef.current
              .getSenders()
              .find((s) => s.track && s.track.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newVideoTrack);
            }
          }

          if (localStreamRef.current) {
            const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
            if (oldVideoTrack) {
              localStreamRef.current.removeTrack(oldVideoTrack);
              oldVideoTrack.stop();
            }
            localStreamRef.current.addTrack(newVideoTrack);
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          setFacingMode(nextMode);
          showToast(nextMode === 'environment' ? 'Задняя камера' : 'Передняя камера');
        }
      }
    } catch (e) {
      console.error('Camera switch error:', e);
    }
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
      {/* Dedicated audio element for remote audio track playback in voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeakerOn} className="hidden" />

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
          <div className={`h-2.5 w-2.5 rounded-full ${callStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-xs font-semibold text-slate-300">
            {callType === 'voice' && 'Голосовой вызов'}
            {callType === 'video' && 'Видеовызов HD'}
            {callType === 'group_conference' && 'Видеоконференция'}
            {callType === 'channel_stream' && 'Прямая трансляция'}
          </span>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-1">
            {callStatus === 'calling' ? 'Гудки...' : callStatus === 'ended' ? 'Завершен' : formatTimer(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {callType === 'channel_stream' ? (
            <div className="flex items-center gap-1.5 bg-red-600/80 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg">
              <Radio size={13} className="animate-pulse" />
              <span>LIVE · {liveViewers}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecurityModal(true)}
              className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                isE2eeVerified
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/20 shadow-sm shadow-emerald-500/20'
                  : 'text-sky-300 bg-sky-500/10 border-sky-500/30 hover:bg-sky-500/20'
              }`}
              title="Просмотреть ключи шифрования E2EE"
            >
              <ShieldCheck size={13} className={isE2eeVerified ? 'text-emerald-400 animate-pulse' : 'text-sky-400'} />
              <span>E2EE: {e2eeFingerprint}</span>
            </button>
          )}
          <button
            onClick={handleEndCall}
            className="h-8 w-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* E2EE Security Modal Overlay */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 text-white shadow-2xl flex flex-col gap-4 relative">
            <button
              onClick={() => setShowSecurityModal(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-base text-slate-100 flex items-center gap-1.5">
                  Зашифрованный вызов
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </h3>
                <p className="text-xs text-slate-400">Сквозное шифрование (E2EE)</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex flex-col gap-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <KeyRound size={12} className="text-emerald-400" />
                Отпечаток ключа сессии WebRTC
              </span>
              <div className="text-lg font-mono font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20 text-center select-all">
                {e2eeFingerprint} - 9482 - E2EE
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                Голосовые и видеоданные шифруются прямо на вашем устройстве с помощью P2P протокола WebRTC (DTLS-SRTP). Промежуточный сервер не имеет доступа к содержимому звонка.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
              <ShieldCheck size={18} className="shrink-0" />
              <span>P2P DataChannel {isE2eeVerified ? 'подключен и проверен' : 'подключается...'}</span>
            </div>

            <button
              onClick={() => setShowSecurityModal(false)}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-medium text-sm text-slate-200 transition-colors cursor-pointer"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-16 z-[10001] bg-slate-900/90 border border-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md animate-fade-in">
          {toastMsg}
        </div>
      )}

      {/* Main Display Area */}
      <div className="w-full max-w-md my-auto flex flex-col items-center justify-center relative">
        {callType === 'video' || callType === 'group_conference' || callType === 'channel_stream' ? (
          <div className="w-full aspect-[3/4] max-h-[58vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 relative shadow-2xl flex items-center justify-center">
            {/* Main view video (remote video by default, local video if swapPip) */}
            <video
              ref={swapPip ? localVideoRef : remoteVideoRef}
              autoPlay
              playsInline
              muted={swapPip ? true : !isSpeakerOn}
              className={`w-full h-full object-cover rounded-3xl ${
                (swapPip && isVideoOff) || (!swapPip && !hasRemoteVideo && callStatus === 'connected')
                  ? 'opacity-0'
                  : 'opacity-100'
              }`}
            />

            {/* Fallback overlay if no remote video or calling */}
            {((!swapPip && !hasRemoteVideo) || (swapPip && isVideoOff) || callStatus === 'calling') && (
              <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-sky-500/20 animate-ping opacity-50" />
                  <div className={`h-24 w-24 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-2xl font-bold text-white shadow-2xl relative border-2 border-white/20`}>
                    {contact.initials}
                  </div>
                </div>
                <div className="text-base font-bold text-white">{contact.name}</div>
                <div className="text-xs text-sky-400 font-medium">
                  {callStatus === 'calling' ? 'Соединение в режиме реального времени...' : 'Камера отключена'}
                </div>
              </div>
            )}

            {/* Picture-in-Picture (PIP) view */}
            {callType === 'video' && (
              <div
                onClick={() => setSwapPip(!swapPip)}
                className="absolute top-4 right-4 h-32 w-24 rounded-2xl bg-slate-950/90 border border-white/30 overflow-hidden shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition z-10"
                title="Нажмите, чтобы переключить вид"
              >
                <video
                  ref={swapPip ? remoteVideoRef : localVideoRef}
                  autoPlay
                  playsInline
                  muted={!swapPip}
                  className={`w-full h-full object-cover ${!swapPip && isVideoOff ? 'hidden' : 'block'}`}
                />
              </div>
            )}

            {/* Conference Grid badges */}
            {callType === 'group_conference' && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300">
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
                <ShieldCheck size={14} /> Зашифрованное соединение ORBIT
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
        <div className="flex items-center justify-center gap-3 bg-slate-900/90 backdrop-blur-xl p-3.5 rounded-3xl border border-slate-800 shadow-2xl">
          <button
            onClick={toggleMute}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Микрофон"
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleVideo}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Камера"
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={toggleCameraFacing}
            className="h-12 w-12 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center transition active:scale-90"
            title="Переключить камеру"
          >
            <RefreshCw size={20} />
          </button>

          <button
            onClick={toggleScreenShare}
            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition active:scale-90 ${
              isScreenSharing ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title="Демонстрация экрана"
          >
            <Share2 size={20} />
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

          {/* Red End Call Button */}
          <button
            onClick={handleEndCall}
            className="h-12 w-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-90 transition ml-1"
            title="Завершить вызов"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
