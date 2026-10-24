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

interface ChannelInfo {
  id: string;
  code: string;
  name: string;
}

interface UseKitaComEngineProps {
  serverUrl?: string;
  workspaceId: string;
  channelId: string;
  channelName?: string;
  channelCode?: string;
  channels?: ChannelInfo[];
  onSelectChannel?: (channelId: string) => void;
  workspaceName?: string;
  user: {
    userId: string;
    userName: string;
    role: 'KOORDINATOR_KEAMANAN' | 'KETUA_PELAKSANA' | 'ANGGOTA_KEAMANAN' | 'PENGURUS_INTI' | 'PEMBINA';
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
  workspaceId,
  channelId,
  channelName,
  channelCode,
  channels,
  onSelectChannel,
  workspaceName,
  user
}: UseKitaComEngineProps) {
  // States
  const [isConnected, setIsConnected] = useState(false);
  const [isDutyActive, setIsDutyActive] = useState(false); // Mode Siaga KitaCom (Radio Power ON/OFF)
  const [floorState, setFloorState] = useState<FloorBroadcastState>({
    status: 'IDLE',
    channelId,
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
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
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
      audioCtxRef.current.resume();
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
          sampleRate: 48000,
          // Mobile & browser-level Acoustic Echo Cancellation hints
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true
        } as MediaTrackConstraints
      });
      // Default: muted (Half-Duplex PTT: silence until button is actively held)
      stream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      localStreamRef.current = stream;

      // Attach or replace track on all existing WebRTC peer connections
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        peerConnectionsRef.current.forEach((pc, targetSocketId) => {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(err => {
              console.warn('[KitaCom WebRTC] replaceTrack error:', err);
            });
          } else {
            pc.addTrack(audioTrack, stream);
            // Renegotiate offer with target peer
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                socketRef.current?.emit('webrtc:offer', {
                  toSocketId: targetSocketId,
                  offer: pc.localDescription
                });
              })
              .catch(err => console.error('[KitaCom WebRTC] Error renegotiating after addTrack:', err));
          }
        });
      }
      return stream;
    } catch (err) {
      console.warn('[KitaCom WebRTC] Izin mikrofon belum diberikan:', err);
      return null;
    }
  }, []);

  // WebRTC Peer Connection Factory (Mesh P2P with Opus Codec)
  const createPeerConnection = useCallback((targetSocketId: string, isInitiator: boolean, socket: Socket): RTCPeerConnection => {
    if (!peerConnectionsRef.current || !(peerConnectionsRef.current instanceof Map)) {
      peerConnectionsRef.current = new Map();
    }
    const existing = peerConnectionsRef.current.get(targetSocketId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    console.log(`[KitaCom WebRTC] Inisialisasi peer connection ke ${targetSocketId} (initiator: ${isInitiator})`);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(targetSocketId, pc);

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
      // Strict Half-Duplex: jika radio mati ATAU sedang bicara (transmit), wajib bisu (mute)
      const shouldMute = !isDutyActiveRef.current || isTransmittingRef.current;
      audioEl.muted = shouldMute;
      audioEl.volume = shouldMute ? 0.0 : 1.0;
      audioEl.srcObject = incomingStream;
      if (!shouldMute) {
        audioEl.play().catch(e => console.warn('[KitaCom WebRTC] audioEl play error:', e));
      }
    };

    // Attach local track if mic already acquired
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onconnectionstatechange = () => {
      console.log(`[KitaCom WebRTC Peer ${targetSocketId}] State:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        peerConnectionsRef.current.delete(targetSocketId);
      }
    };

    if (isInitiator) {
      const initiateOffer = async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
          });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', {
            toSocketId: targetSocketId,
            offer: pc.localDescription
          });
        } catch (err) {
          console.error('[KitaCom WebRTC] Gagal membuat offer:', err);
        }
      };
      initiateOffer();
    }

    return pc;
  }, [initAudioEngine]);

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
        console.log('[KitaCom] Screen WakeLock acquired');
      } catch (err) {
        console.warn('[KitaCom] WakeLock request failed:', err);
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
    anchor.volume = 0.5; // silence.wav hening total (0x00), volume 0.5 wajib agar Android MediaController aktif
    if (anchor.paused) {
      anchor.play().then(() => {
        console.log('[KitaCall] Lockscreen audio anchor aktif');
      }).catch((e) => {
        console.warn('[KitaCall] Audio anchor play notice:', e);
      });
    }
    return anchor;
  }, []);

  // Toggle Mode Siaga KitaCom (Radio Power ON / OFF & Background Tembus Latar Belakang)
  const toggleDutyMode = useCallback(async () => {
    const ctx = initAudioEngine();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const newActive = !isDutyActive;
    isDutyActiveRef.current = newActive;
    setIsDutyActive(newActive);

    // KUNCI LOCKSCREEN MOBILE: Mulai audio anchor /silence.wav seketika dalam gesture sentuhan user tanpa terhambat await!
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

    // Gating Audio Level Hardware (langsung set nilai tanpa lag desync)
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
        channelId,
        audioCtxState: ctx.state,
        wakeLock: newActive,
        dutyMode: newActive,
        batteryLvl: batteryLevel
      });
    }
  }, [initAudioEngine, isDutyActive, ensureAnchorPlaying, requestWakeLock, releaseWakeLock, ensureLocalStream, channelId, user.userId, batteryLevel]);

  // Connect Socket.IO & WebRTC Listeners
  useEffect(() => {
    const isExplicitRemote = serverUrl && !serverUrl.includes('localhost');
    const targetUrl = isExplicitRemote ? `${serverUrl}/kitaradio` : '/kitaradio';
    const socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('[KitaRadio Socket] Connected:', socket.id);
      setIsConnected(true);

      // Warm up audio context
      initAudioEngine();

      // Join channel immediately
      socket.emit('kitacom:join_channel', {
        workspaceId,
        channelId,
        userId: userRef.current.userId,
        userName: userRef.current.userName,
        role: userRef.current.role,
        dutyMode: isDutyActiveRef.current,
        posJaga: userRef.current.posJaga
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

      if (state.status === 'LOCKED') {
        // Suara HANYA masuk dan direspons jika Mode Siaga AKTIF dan bukan diri sendiri
        if (!isTransmittingRef.current && isDutyActiveRef.current) {
          setIsReceiving(true);
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

    // Access Denied: Personel tidak terdaftar di frekuensi ini
    socket.on('kitacom:access_denied', async (data: { channelId: string; channelCode?: string; reason: string }) => {
      console.warn('[KitaCom Security] Akses frekuensi ditolak:', data);
      if (audioCtxRef.current) {
        await TacticalAudioSynthesizer.playChannelBusyTone(audioCtxRef.current);
      }
      alert(data.reason || 'Akses ditolak: Anda belum ditugaskan oleh Koordinator di saluran ini.');
    });

    // Roster update: Hubungkan WebRTC Mesh dengan anggota lain
    socket.on('kitacom:roster_update', async (data: { channelId: string; roster: ChannelMember[] }) => {
      if (data.channelId === channelId) {
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

    // WebRTC Signaling: Offer
    socket.on('webrtc:offer', async (data: { fromSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        console.log('[KitaCom WebRTC] Menerima offer dari:', data.fromSocketId);
        const pc = createPeerConnection(data.fromSocketId, false, socket);
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
        if (pc) {
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
            // Antrekan candidate jika remoteDescription belum siap
            const list = pendingCandidatesRef.current.get(data.fromSocketId) || [];
            list.push(data.candidate);
            pendingCandidatesRef.current.set(data.fromSocketId, list);
          }
        }
      } catch (err) {
        console.error('[KitaCom WebRTC] Gagal menambahkan ICE candidate:', err);
      }
    });

    // Emergency Siren (Alarm Darurat Komando tetap tembus silent jika disiagakan)
    socket.on('ptt:emergency_alert', async (data: { commanderName: string; emergencyNote: string }) => {
      setEmergencyAlert({ commanderName: data.commanderName, note: data.emergencyNote });
      if (audioCtxRef.current) {
        await TacticalAudioSynthesizer.playEmergencySiren(audioCtxRef.current);
      }
      if (navigator.vibrate) {
        navigator.vibrate([600, 150, 600, 150, 1200]);
      }
    });

    // Cleanup: Menutup semua koneksi WebRTC, membuang audio element & disconnect socket
    return () => {
      console.log('[KitaRadio Socket] Membersihkan koneksi socket & WebRTC:', socket.id);
      
      peerConnectionsRef.current.forEach((pc) => {
        try { pc.close(); } catch (e) {}
      });
      peerConnectionsRef.current.clear();

      remoteAudioElementsRef.current.forEach((audioEl) => {
        try {
          audioEl.pause();
          audioEl.srcObject = null;
          audioEl.remove();
        } catch (e) {}
      });
      remoteAudioElementsRef.current.clear();

      pendingCandidatesRef.current.clear();

      // kitacall-lockscreen-anchor dijaga tetap hidup agar kendali MediaSession lockscreen tidak terputus saat berganti saluran

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, workspaceId, channelId, user.userId, createPeerConnection, initAudioEngine]);

  // Periodic Heartbeat (Tiap 15 Detik sesuai PRD)
  useEffect(() => {
    const timer = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('kitacom:heartbeat', {
          userId: user.userId,
          channelId,
          audioCtxState: audioCtxRef.current?.state || 'suspended',
          wakeLock: isWakeLocked,
          dutyMode: isDutyActiveRef.current,
          batteryLvl: batteryLevel
        });
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [channelId, user.userId, isWakeLocked, batteryLevel]);

  // 2. Start Transmitting (PTT Ditekan)
  const startTransmitting = useCallback(async () => {
    // Kunci PTT: Radio OFF tidak bisa transmit
    if (!isDutyActiveRef.current) {
      console.warn('[KitaCom] PTT Ditolak: Mode Siaga belum aktif.');
      return;
    }

    const ctx = initAudioEngine();
    if (ctx.state === 'suspended') {
      await ctx.resume();
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
        channelId,
        userId: currentUser.userId,
        userName: currentUser.userName,
        role: currentUser.role,
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
  }, [initAudioEngine, ensureLocalStream, channelId]);

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
        channelId,
        userId: userRef.current.userId
      });
    }

    // Umpan balik haptik lepas: [30, 50, 30]
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  }, [channelId]);

  // Lapis 3: Media Session API (Kendali Layar Terkunci / Lockscreen HP & Headset TWS ala Spotify)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const displayCode = channelCode || (channels?.find(c => c.id === channelId)?.code) || channelId;
    const displayName = channelName || (channels?.find(c => c.id === channelId)?.name) || 'Saluran Taktis';
    const channelIdx = channels ? channels.findIndex(c => c.id === channelId || c.code === channelId) : -1;
    const channelCounter = channelIdx >= 0 && channels && channels.length > 0 
      ? `(${channelIdx + 1}/${channels.length})` 
      : '';

    let title = `📻 ${displayCode}: ${displayName}`;
    let artist = `▶️ Buka Mic | ⏭️ Ganti Saluran ${channelCounter}`;
    let album = `KitaCall • ${workspaceName || 'Transceiver Taktis'}`;

    if (isTransmitting) {
      title = `🔴 [TRANSMIT] ${displayCode}: ${displayName}`;
      artist = '🎙️ Anda Sedang Bicara • Tekan ⏸️ utk Selesai';
      album = 'KitaCall Transceiver (Transmisi Aktif)';
    } else if (floorState.speakerId && floorState.speakerId !== user.userId) {
      title = `🔊 ${floorState.speakerName || 'Personel'} Bicara...`;
      artist = `Saluran ${displayCode} • ${displayName} ${channelCounter}`;
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

      // Menjaga status media session aktif agar widget lockscreen selalu tampil
      if (isTransmitting) {
        navigator.mediaSession.playbackState = 'playing';
      } else if (isDutyActive) {
        navigator.mediaSession.playbackState = 'playing';
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch (e) {}

    // Sync ke Service Worker Sticky Lockscreen Notification (Garis pertahanan ganda untuk lockscreen HP)
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        if (isDutyActive) {
          const micActionTitle = isTransmitting ? '⏹️ Tutup Mic' : '🎙️ Buka Mic';
          reg.showNotification(title, {
            body: artist,
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'kitacall-radio-live',
            renotify: false,
            silent: true,
            requireInteraction: true,
            data: { url: '/?source=lockscreen' },
            actions: [
              { action: 'toggle_mic', title: micActionTitle },
              { action: 'next_channel', title: '⏭️ Saluran Lain' }
            ]
          }).catch(() => {});
        } else {
          reg.getNotifications({ tag: 'kitacall-radio-live' }).then((notifications) => {
            notifications.forEach((n) => n.close());
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    // Handler Aksi Lockscreen & Headset TWS (Play/Pause keduanya berfungsi sebagai toggle PTT mic):
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

    // 4. Next Track (⏭️) / Seek Forward (⏩) -> Ganti Channel Berikutnya (Spotify style)
    const handleNextChannel = () => {
      const list = channelsRef.current;
      if (list && list.length > 1 && onSelectChannelRef.current) {
        const curId = channelIdRef.current;
        const currentIdx = list.findIndex(c => c.id === curId || c.code === curId);
        const nextIdx = (currentIdx + 1) % list.length;
        const targetChan = list[nextIdx];
        if (targetChan) {
          onSelectChannelRef.current(targetChan.id);
          if (audioCtxRef.current) {
            TacticalAudioSynthesizer.playPreflightGuard(audioCtxRef.current);
          }
          if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        }
      }
    };

    // 5. Previous Track (⏮️) / Seek Backward (⏪) -> Ganti Channel Sebelumnya (Spotify style)
    const handlePrevChannel = () => {
      const list = channelsRef.current;
      if (list && list.length > 1 && onSelectChannelRef.current) {
        const curId = channelIdRef.current;
        const currentIdx = list.findIndex(c => c.id === curId || c.code === curId);
        const prevIdx = (currentIdx - 1 + list.length) % list.length;
        const targetChan = list[prevIdx];
        if (targetChan) {
          onSelectChannelRef.current(targetChan.id);
          if (audioCtxRef.current) {
            TacticalAudioSynthesizer.playPreflightGuard(audioCtxRef.current);
          }
          if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        }
      }
    };

    try {
      navigator.mediaSession.setActionHandler('nexttrack', handleNextChannel);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevChannel);
      navigator.mediaSession.setActionHandler('seekforward', handleNextChannel);
      navigator.mediaSession.setActionHandler('seekbackward', handlePrevChannel);
    } catch (e) {}
  }, [
    isDutyActive,
    channelId,
    channelCode,
    channelName,
    channels,
    workspaceName,
    isTransmitting,
    floorState.speakerId,
    floorState.speakerName,
    startTransmitting,
    stopTransmitting,
    toggleDutyMode
  ]);

  // Listener Pesan Interaktif dari Notifikasi Layar Kunci Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'LOCKSCREEN_TOGGLE_MIC') {
        if (!isDutyActiveRef.current) {
          toggleDutyMode();
        }
        if (!isTransmittingRef.current) {
          startTransmitting();
        } else {
          stopTransmitting();
        }
      } else if (e.data?.type === 'LOCKSCREEN_NEXT_CHANNEL') {
        const list = channelsRef.current;
        if (list && list.length > 1 && onSelectChannelRef.current) {
          const curId = channelIdRef.current;
          const currentIdx = list.findIndex(c => c.id === curId || c.code === curId);
          const nextIdx = (currentIdx + 1) % list.length;
          const targetChan = list[nextIdx];
          if (targetChan) {
            onSelectChannelRef.current(targetChan.id);
            if (audioCtxRef.current) {
              TacticalAudioSynthesizer.playPreflightGuard(audioCtxRef.current);
            }
            if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [toggleDutyMode, startTransmitting, stopTransmitting]);

  // Trigger Emergency Broadcast
  const triggerEmergencyAlert = useCallback((note: string) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('ptt:emergency_alert', {
        workspaceId,
        channelId,
        commanderName: user.userName,
        emergencyNote: note || 'Panggilan Siaga Merah Lapangan'
      });
    }
  }, [workspaceId, channelId, user.userName]);

  // Aktivasi eksplisit kendali lockscreen & perizinan
  const activateLockscreen = useCallback(async () => {
    // 1. Minta izin Notifikasi jika belum (wajib untuk Android 13+)
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }

    // 2. Minta izin Mikrofon
    try {
      await ensureLocalStream();
    } catch (e) {}

    // 3. Pastikan audio anchor & mode siaga aktif
    ensureAnchorPlaying();

    if (!isDutyActiveRef.current) {
      await toggleDutyMode();
    }

    // 4. Kirim notifikasi sistem konfirmasi via Service Worker (bebas crash di Android!)
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready;
        const displayCode = channelCodeRef.current || channelIdRef.current || 'CH-01';
        await reg.showNotification(`📻 Saluran ${displayCode}: Kendali Lockscreen Aktif`, {
          body: '▶️ Buka Mic | ⏭️ Ganti Saluran • Kendali Saku & Headset Siap!',
          icon: '/logo.png',
          badge: '/logo.png',
          tag: 'kitacall-radio-live',
          renotify: false,
          silent: true,
          requireInteraction: true,
          actions: [
            { action: 'toggle_mic', title: '🎙️ Buka/Tutup Mic' },
            { action: 'next_channel', title: '⏭️ Ganti Saluran' }
          ]
        });
      } catch (e) {
        console.warn('[KitaCall SW Notification Error]:', e);
      }
    }
  }, [ensureLocalStream, ensureAnchorPlaying, toggleDutyMode]);

  return {
    isConnected,
    isDutyActive,
    toggleDutyMode,
    activateLockscreen,
    floorState,
    roster,
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
