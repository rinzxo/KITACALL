import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { TacticalAudioSynthesizer } from '../lib/audioTones';

export interface ChannelMember {
  userId: string;
  userName: string;
  role: string;
  socketId: string;
  dutyMode: boolean;
  audioCtxState: 'running' | 'suspended' | 'closed';
  wakeLock: boolean;
  batteryLvl?: number;
  posJaga?: string;
}

export interface FloorBroadcastState {
  status: 'IDLE' | 'LOCKED';
  channelId: string;
  speakerId: string | null;
  speakerSocketId?: string | null;
  speakerName: string | null;
  role: string | null;
  timestamp: number;
}

export interface ChannelInfo {
  id: string;
  code: string;
  name: string;
  memberCount?: number;
}

interface UseKitaComEngineProps {
  serverUrl?: string;
  workspaceId?: string;
  channelId: string; // Pairing Code Channel (e.g. KT-8492)
  channelName?: string;
  channelCode?: string;
  channels?: ChannelInfo[];
  onSelectChannel?: (channelId: string) => void;
  workspaceName?: string;
  user: {
    userId: string;
    userName: string;
    role?: 'KOORDINATOR_KEAMANAN' | 'KETUA_PELAKSANA' | 'ANGGOTA_KEAMANAN' | 'PENGURUS_INTI' | 'PEMBINA';
    posJaga?: string;
  };
}

// STUN & TURN Relay Servers for WebRTC
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export function useKitaComEngine({
  serverUrl = import.meta.env.VITE_RELAY_SERVER_URL || '',
  workspaceId = 'default-network',
  channelId,
  channelName,
  channelCode,
  channels,
  onSelectChannel,
  workspaceName,
  user
}: UseKitaComEngineProps) {
  // Normalize Channel ID / Pairing Code
  const normalizedChannelId = (channelId || 'CH-01').toUpperCase().trim();

  // States
  const [isConnected, setIsConnected] = useState(false);
  const [isDutyActive, setIsDutyActive] = useState(false); // Mode Siaga KitaCom (Radio Power ON/OFF)
  const [floorState, setFloorState] = useState<FloorBroadcastState>({
    status: 'IDLE',
    channelId: normalizedChannelId,
    speakerId: null,
    speakerSocketId: null,
    speakerName: null,
    role: null,
    timestamp: Date.now()
  });
  const [roster, setRoster] = useState<ChannelMember[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false); // Local PTT active
  const [isReceiving, setIsReceiving] = useState(false); // Incoming audio playing
  const [isWakeLocked, setIsWakeLocked] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>(undefined);
  const [emergencyAlert, setEmergencyAlert] = useState<{ commanderName: string; note: string } | null>(null);

  // Audio, WebRTC & Web API Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dutyMasterGainRef = useRef<GainNode | null>(null); // Master Radio Power Gating
  const silentAnchorRef = useRef<HTMLAudioElement | null>(null); // Keepalive Background Audio for Mobile OS
  const wakeLockRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const isTransmittingRef = useRef<boolean>(false);
  const isDutyActiveRef = useRef<boolean>(isDutyActive);
  isDutyActiveRef.current = isDutyActive;
  const floorStateRef = useRef<FloorBroadcastState>(floorState);
  floorStateRef.current = floorState;
  const rosterRef = useRef<ChannelMember[]>(roster);
  rosterRef.current = roster;
  const userRef = useRef(user);
  userRef.current = user;
  const channelIdRef = useRef(normalizedChannelId);
  channelIdRef.current = normalizedChannelId;
  const channelNameRef = useRef(channelName);
  channelNameRef.current = channelName;
  const channelCodeRef = useRef(channelCode);
  channelCodeRef.current = channelCode;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const onSelectChannelRef = useRef(onSelectChannel);
  onSelectChannelRef.current = onSelectChannel;

  // WebRTC Native Voice Mesh Refs
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Monitor Battery API
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // 1. AudioContext with Duty Master Gain Node (Radio Power Gating)
  const initAudioEngine = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      // Master Radio Gain: Bila Siaga mati, suara radio 0.0 (hening total)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isDutyActiveRef.current ? 1.0 : 0.0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      dutyMasterGainRef.current = masterGain;
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }

    return audioCtxRef.current;
  }, []);

  // Ensure Local Microphone MediaStream (Acquires mic with hardware echo cancellation)
  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        } as MediaTrackConstraints
      });
      
      // Default: disabled (Half-Duplex PTT: silence until button is actively held)
      stream.getAudioTracks().forEach(track => {
        track.enabled = isTransmittingRef.current;
      });
      localStreamRef.current = stream;

      // Pasang track ke semua RTCPeerConnection yang sudah ada via replaceTrack atau sender
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(err => {
              console.warn('[KitaCom WebRTC] replaceTrack error:', err);
            });
          } else {
            try {
              pc.addTrack(audioTrack, stream);
            } catch (e) {
              console.warn('[KitaCom WebRTC] addTrack fallback notice:', e);
            }
          }
        });
      }
      return stream;
    } catch (err) {
      console.warn('[KitaCom WebRTC] Izin mikrofon belum diberikan:', err);
      return null;
    }
  }, []);

  // WebRTC Peer Connection Factory (Mesh P2P with Perfect Negotiation)
  const createPeerConnection = useCallback((targetSocketId: string, isInitiator: boolean, socket: Socket): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(targetSocketId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    console.log(`[KitaCom WebRTC] Inisialisasi peer connection ke ${targetSocketId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetSocketId, pc);
    makingOfferRef.current.set(targetSocketId, false);

    // KUNCI EMAS WEBRTC BERGANTIAN: Selalu tambahkan transceiver audio sendrecv di awal!
    // Ini memastikan jalur Opus dua arah terbentuk sempurna sebelum mic dipegang.
    if (localStreamRef.current && localStreamRef.current.getAudioTracks()[0]) {
      pc.addTrack(localStreamRef.current.getAudioTracks()[0], localStreamRef.current);
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && socket.connected) {
        socket.emit('webrtc:ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Play remote WebRTC Opus voice directly through browser audio subsystem
    pc.ontrack = (event) => {
      console.log('[KitaCom WebRTC] Menerima aliran suara dari:', targetSocketId, event.streams);
      
      const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
      let audioEl = remoteAudioElementsRef.current.get(targetSocketId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        (audioEl as any).playsInline = true;
        document.body.appendChild(audioEl);
        remoteAudioElementsRef.current.set(targetSocketId, audioEl);
      }
      
      audioEl.srcObject = incomingStream;
      const shouldMute = !isDutyActiveRef.current || isTransmittingRef.current;
      audioEl.muted = shouldMute;
      audioEl.volume = shouldMute ? 0.0 : 1.0;
      if (!shouldMute) {
        audioEl.play().catch(e => console.warn('[KitaCom WebRTC] audioEl play error:', e));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[KitaCom WebRTC Peer ${targetSocketId}] State:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        peerConnectionsRef.current.delete(targetSocketId);
        makingOfferRef.current.delete(targetSocketId);
      }
    };

    // Inisiasi offer jika ditugaskan sebagai initiator (misal socket.id lebih kecil)
    if (isInitiator) {
      const initiateOffer = async () => {
        try {
          makingOfferRef.current.set(targetSocketId, true);
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {
            toSocketId: targetSocketId,
            offer: pc.localDescription
          });
        } catch (err) {
          console.error('[KitaCom WebRTC] Gagal membuat offer:', err);
        } finally {
          makingOfferRef.current.set(targetSocketId, false);
        }
      };
      initiateOffer();
    }

    return pc;
  }, []);

  // Screen Wake Lock
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setIsWakeLocked(true);
        lock.addEventListener('release', () => {
          setIsWakeLocked(false);
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('[KitaCom] WakeLock request notice:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsWakeLocked(false);
    }
  }, []);

  // Anchor Audio Background untuk Lockscreen Android & iOS
  const ensureAnchorPlaying = useCallback(() => {
    let anchor = document.getElementById('kitacall-lockscreen-anchor') as HTMLAudioElement;
    if (!anchor) {
      anchor = document.createElement('audio');
      anchor.id = 'kitacall-lockscreen-anchor';
      anchor.src = '/silence.wav';
      anchor.loop = true;
      (anchor as any).playsInline = true;
      anchor.style.position = 'fixed';
      anchor.style.width = '1px';
      anchor.style.height = '1px';
      anchor.style.bottom = '0';
      anchor.style.left = '0';
      anchor.style.opacity = '0.01';
      anchor.style.pointerEvents = 'none';
      anchor.style.zIndex = '-1';
      document.body.appendChild(anchor);
    }
    silentAnchorRef.current = anchor;
    anchor.volume = 0.5;
    if (anchor.paused) {
      anchor.play().catch(() => {});
    }
    return anchor;
  }, []);

  // Toggle Mode Siaga KitaCom (Radio Power ON / OFF)
  const toggleDutyMode = useCallback(async () => {
    const ctx = initAudioEngine();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const newActive = !isDutyActive;
    isDutyActiveRef.current = newActive;
    setIsDutyActive(newActive);

    if (newActive) {
      ensureAnchorPlaying();
      requestWakeLock();
      if (navigator.vibrate) navigator.vibrate(60);
      TacticalAudioSynthesizer.playPreflightGuard(ctx).catch(() => {});
      ensureLocalStream().catch(() => {});
    } else {
      releaseWakeLock();
      const anchor = (document.getElementById('kitacall-lockscreen-anchor') as HTMLAudioElement) || silentAnchorRef.current;
      if (anchor) {
        anchor.pause();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      TacticalAudioSynthesizer.playChannelBusyTone(ctx).catch(() => {});
      if (navigator.vibrate) navigator.vibrate([40, 40]);
    }

    // Gating Audio Level Hardware
    if (dutyMasterGainRef.current) {
      dutyMasterGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
      dutyMasterGainRef.current.gain.setValueAtTime(newActive ? 1.0 : 0.0, ctx.currentTime);
    }

    // Mute / Unmute dan Resume semua remote audio element sesuai status Siaga
    remoteAudioElementsRef.current.forEach((el) => {
      el.muted = !newActive;
      el.volume = newActive ? 1.0 : 0.0;
      if (newActive) {
        el.play().catch(e => console.warn('[KitaCall WebRTC] Gagal me-resume audio peer:', e));
      }
    });

    // Inform server via heartbeat
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('kitacom:heartbeat', {
        userId: user.userId,
        channelId: channelIdRef.current,
        audioCtxState: ctx.state,
        wakeLock: newActive,
        dutyMode: newActive,
        batteryLvl: batteryLevel
      });
    }
  }, [initAudioEngine, isDutyActive, ensureAnchorPlaying, requestWakeLock, releaseWakeLock, ensureLocalStream, user.userId, batteryLevel]);

  // Connect Socket.IO & WebRTC Listeners
  useEffect(() => {
    const isExplicitRemote = serverUrl && !serverUrl.includes('localhost');
    const targetUrl = isExplicitRemote ? `${serverUrl}/kitaradio` : '/kitaradio';
    const socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 25,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('[KitaRadio Socket] Connected:', socket.id);
      setIsConnected(true);

      // Warm up audio context
      initAudioEngine();

      // Join pairing channel immediately
      socket.emit('kitacom:join_channel', {
        workspaceId,
        channelId: channelIdRef.current,
        channelName: channelNameRef.current,
        userId: userRef.current.userId,
        userName: userRef.current.userName,
        role: userRef.current.role || 'ANGGOTA_KEAMANAN',
        dutyMode: isDutyActiveRef.current,
        posJaga: userRef.current.posJaga || 'Patroli Lapangan'
      });
    });

    socket.on('disconnect', () => {
      console.log('[KitaRadio Socket] Disconnected');
      setIsConnected(false);
    });

    // Floor state updates (LOCKED vs IDLE)
    socket.on('ptt:floor_state', async (state: FloorBroadcastState) => {
      floorStateRef.current = state;
      setFloorState(state);

      const isMeSpeaking = state.speakerSocketId 
        ? state.speakerSocketId === socket.id 
        : state.speakerId === userRef.current.userId;

      if (state.status === 'LOCKED') {
        // Suara HANYA masuk dan direspons jika Mode Siaga AKTIF dan bukan diri kita sendiri yang sedang bicara
        if (!isMeSpeaking && isDutyActiveRef.current) {
          setIsReceiving(true);
          // Buka suara remote audio elements seketika
          remoteAudioElementsRef.current.forEach((audioEl) => {
            audioEl.muted = false;
            audioEl.volume = 1.0;
            audioEl.play().catch(() => {});
          });
        }
      } else if (state.status === 'IDLE') {
        setIsReceiving(false);
        setIsTransmitting(false);
        isTransmittingRef.current = false;

        // Pastikan track mikrofon lokal termute
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => {
            t.enabled = false;
          });
        }

        // Roger Beep hanya berbunyi jika Mode Siaga AKTIF
        if (audioCtxRef.current && isDutyActiveRef.current) {
          await TacticalAudioSynthesizer.playRogerBeep(audioCtxRef.current);
        }
      }
    });

    // Floor Denied / Busy
    socket.on('ptt:floor_denied', async () => {
      setIsTransmitting(false);
      isTransmittingRef.current = false;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => {
          t.enabled = false;
        });
      }
      if (audioCtxRef.current) {
        await TacticalAudioSynthesizer.playChannelBusyTone(audioCtxRef.current);
      }
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    });

    // Preempted by Commander
    socket.on('ptt:preempted', async (data: { preemptedUserId: string; commanderName: string }) => {
      if (data.preemptedUserId === user.userId) {
        stopTransmitting();
        if (audioCtxRef.current) {
          await TacticalAudioSynthesizer.playChannelBusyTone(audioCtxRef.current);
        }
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    });

    // Roster update: Hubungkan WebRTC Mesh dengan anggota lain di saluran pairing
    socket.on('kitacom:roster_update', async (data: { channelId: string; roster: ChannelMember[] }) => {
      if (data.channelId === channelIdRef.current) {
        setRoster(data.roster);
        rosterRef.current = data.roster;

        // Siapkan WebRTC Mesh untuk setiap peer lain di channel
        data.roster.forEach((member) => {
          if (member.socketId && member.socketId !== socket.id) {
            // Gunakan konvensi: socket.id lebih kecil menjadi initiator offer
            const isInitiator = socket.id < member.socketId;
            createPeerConnection(member.socketId, isInitiator, socket);
          }
        });

        // Bersihkan peer yang keluar dari roster
        const activeSocketIds = new Set(data.roster.map(m => m.socketId));
        peerConnectionsRef.current.forEach((pc, sid) => {
          if (!activeSocketIds.has(sid)) {
            pc.close();
            peerConnectionsRef.current.delete(sid);
            makingOfferRef.current.delete(sid);
            const audioEl = remoteAudioElementsRef.current.get(sid);
            if (audioEl) {
              audioEl.pause();
              audioEl.srcObject = null;
              audioEl.remove();
              remoteAudioElementsRef.current.delete(sid);
            }
          }
        });
      }
    });

    // WebRTC Signaling: Offer (dengan Perfect Negotiation)
    socket.on('webrtc:offer', async (data: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        console.log('[KitaCom WebRTC] Menerima offer dari:', data.fromSocketId);
        const pc = createPeerConnection(data.fromSocketId, false, socket);
        
        // Perfect Negotiation Collision check:
        const isPolite = socket.id > data.fromSocketId;
        const isMakingOffer = makingOfferRef.current.get(data.fromSocketId) || false;
        const offerCollision = isMakingOffer || pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            console.log('[KitaCom WebRTC] Mengabaikan collision offer dari peer impolite');
            return;
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Flush any queued ICE candidates
        const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
        for (const cand of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        pendingCandidatesRef.current.delete(data.fromSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', {
          toSocketId: data.fromSocketId,
          answer: pc.localDescription
        });
      } catch (err) {
        console.error('[KitaCom WebRTC] Gagal memproses offer:', err);
      }
    });

    // WebRTC Signaling: Answer
    socket.on('webrtc:answer', async (data: { fromSocketId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        console.log('[KitaCom WebRTC] Menerima answer dari:', data.fromSocketId);
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

          // Flush any queued ICE candidates
          const queued = pendingCandidatesRef.current.get(data.fromSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(data.fromSocketId);
        }
      } catch (err) {
        console.error('[KitaCom WebRTC] Gagal memproses answer:', err);
      }
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('webrtc:ice_candidate', async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(data.fromSocketId);
        if (pc && data.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } else {
            const list = pendingCandidatesRef.current.get(data.fromSocketId) || [];
            list.push(data.candidate);
            pendingCandidatesRef.current.set(data.fromSocketId, list);
          }
        }
      } catch (err) {
        console.error('[KitaCom WebRTC] Gagal menambahkan ICE candidate:', err);
      }
    });

    // Emergency Siren
    socket.on('ptt:emergency_alert', async (data: { commanderName: string; emergencyNote: string }) => {
      setEmergencyAlert({ commanderName: data.commanderName, note: data.emergencyNote });
      if (audioCtxRef.current) {
        await TacticalAudioSynthesizer.playEmergencySiren(audioCtxRef.current);
      }
      if (navigator.vibrate) {
        navigator.vibrate([600, 150, 600, 150, 1200]);
      }
    });

    // Cleanup saat unmount atau saat channel berganti
    return () => {
      peerConnectionsRef.current.forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peerConnectionsRef.current.clear();
      makingOfferRef.current.clear();

      remoteAudioElementsRef.current.forEach((audioEl) => {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
        } catch (e) {}
      });
      remoteAudioElementsRef.current.clear();

      pendingCandidatesRef.current.clear();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, normalizedChannelId, user.userId, createPeerConnection, initAudioEngine]);

  // Periodic Heartbeat
  useEffect(() => {
    const timer = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('kitacom:heartbeat', {
          userId: user.userId,
          channelId: channelIdRef.current,
          audioCtxState: audioCtxRef.current?.state || 'suspended',
          wakeLock: isWakeLocked,
          dutyMode: isDutyActiveRef.current,
          batteryLvl: batteryLevel
        });
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [normalizedChannelId, user.userId, isWakeLocked, batteryLevel]);

  // 2. Start Transmitting (PTT Ditekan)
  const startTransmitting = useCallback(async () => {
    // Kunci PTT: Radio OFF tidak bisa transmit
    if (!isDutyActiveRef.current) {
      console.warn('[KitaCom] PTT Ditolak: Mode Siaga belum aktif.');
      return;
    }

    const ctx = initAudioEngine();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    isTransmittingRef.current = true;
    setIsTransmitting(true);

    // Half-Duplex: Bisu (mute) semua audio masuk saat kita bicara agar tidak ada feedback / echo lokal
    remoteAudioElementsRef.current.forEach(el => {
      el.muted = true;
    });

    // Request floor to server
    const currentUser = userRef.current;
    const isPriority = currentUser.role === 'KOORDINATOR_KEAMANAN' || currentUser.role === 'KETUA_PELAKSANA';

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('ptt:request_floor', {
        channelId: channelIdRef.current,
        userId: currentUser.userId,
        userName: currentUser.userName,
        role: currentUser.role || 'ANGGOTA_KEAMANAN',
        isPriority
      });
    }

    // Mainkan Talk Permit Chirp & Umpan Balik Getar Haptik
    await TacticalAudioSynthesizer.playTalkPermitChirp(ctx);
    if (navigator.vibrate) navigator.vibrate(40);

    // Buka transmisi mic lokal ke WebRTC Opus Stream
    try {
      const stream = await ensureLocalStream();
      if (stream && isTransmittingRef.current) {
        stream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        console.log('[KitaCom WebRTC] Transmisi suara aktif (track.enabled = true)');
      }
    } catch (err) {
      console.warn('[KitaCom WebRTC] Gagal mengaktifkan transmisi mikrofon:', err);
      isTransmittingRef.current = false;
      setIsTransmitting(false);
    }
  }, [initAudioEngine, ensureLocalStream]);

  // 3. Stop Transmitting (PTT Dilepas)
  const stopTransmitting = useCallback(() => {
    isTransmittingRef.current = false;
    setIsTransmitting(false);

    // Pulihkan status speaker remote setelah PTT dilepas
    remoteAudioElementsRef.current.forEach(el => {
      el.muted = !isDutyActiveRef.current;
      el.volume = isDutyActiveRef.current ? 1.0 : 0.0;
      if (isDutyActiveRef.current) {
        el.play().catch(() => {});
      }
    });

    // Mute track audio lokal (suara berhenti seketika tanpa delay)
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('[KitaCom WebRTC] Transmisi suara dihentikan (track.enabled = false)');
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('ptt:release_floor', {
        channelId: channelIdRef.current,
        userId: userRef.current.userId
      });
    }

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }, []);

  // Lapis 3: Media Session API (Kendali Layar Terkunci / Lockscreen HP & Headset TWS)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const displayCode = channelCode || channelIdRef.current || 'CH-01';
    const displayName = channelName || 'Saluran Taktis';

    let title = `📻 ${displayCode}: ${displayName}`;
    let artist = `▶️ Buka Mic | ⏭️ Ganti Saluran`;
    let album = `KitaCall • ${workspaceName || 'Transceiver Taktis'}`;

    if (isTransmitting) {
      title = `🔴 [TRANSMIT] ${displayCode}: ${displayName}`;
      artist = '🎙️ Anda Sedang Bicara • Lepas PTT utk Selesai';
      album = 'KitaCall Transceiver (Transmisi Aktif)';
    } else if (floorState.speakerId && floorState.speakerSocketId !== socketRef.current?.id) {
      title = `🔊 ${floorState.speakerName || 'Personel'} Bicara...`;
      artist = `Saluran ${displayCode} • ${displayName}`;
      album = 'KitaCall Monitor Frekuensi';
    } else if (!isDutyActive) {
      title = `🔴 Radio Nonaktif — ${displayCode}`;
      artist = 'Tekan ▶️ untuk Aktifkan Siaga';
      album = 'KitaCall Standby';
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: `${origin}/logo.png`, sizes: '192x192', type: 'image/png' },
          { src: `${origin}/KitaCall%20Emblem.png`, sizes: '512x512', type: 'image/png' }
        ]
      });

      if (isTransmitting || isDutyActive) {
        navigator.mediaSession.playbackState = 'playing';
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch (e) {}

    const handleToggleMic = () => {
      if (!isDutyActiveRef.current) {
        toggleDutyMode();
      }
      if (!isTransmittingRef.current) {
        startTransmitting();
      } else {
        stopTransmitting();
      }
    };

    navigator.mediaSession.setActionHandler('play', handleToggleMic);
    navigator.mediaSession.setActionHandler('pause', handleToggleMic);
    navigator.mediaSession.setActionHandler('stop', () => {
      if (isTransmittingRef.current) {
        stopTransmitting();
      }
    });
  }, [
    isDutyActive,
    normalizedChannelId,
    channelCode,
    channelName,
    workspaceName,
    isTransmitting,
    floorState.speakerId,
    floorState.speakerSocketId,
    floorState.speakerName,
    startTransmitting,
    stopTransmitting,
    toggleDutyMode
  ]);

  // Trigger Emergency Broadcast
  const triggerEmergencyAlert = useCallback((note: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('ptt:emergency_alert', {
        workspaceId,
        channelId: channelIdRef.current,
        commanderName: user.userName,
        emergencyNote: note || 'Panggilan Siaga Merah Lapangan'
      });
    }
  }, [workspaceId, user.userName]);

  // Aktivasi eksplisit kendali lockscreen & perizinan
  const activateLockscreen = useCallback(async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }

    try {
      await ensureLocalStream();
    } catch (e) {}

    ensureAnchorPlaying();

    if (!isDutyActiveRef.current) {
      await toggleDutyMode();
    }
  }, [ensureLocalStream, ensureAnchorPlaying, toggleDutyMode]);

  return {
    isConnected,
    isDutyActive,
    toggleDutyMode,
    activateLockscreen,
    floorState,
    roster,
    currentSocketId: socketRef.current?.id,
    isTransmitting,
    isReceiving,
    startTransmitting,
    stopTransmitting,
    isWakeLocked,
    batteryLevel,
    emergencyAlert,
    dismissEmergencyAlert: () => setEmergencyAlert(null),
    triggerEmergencyAlert
  };
}
