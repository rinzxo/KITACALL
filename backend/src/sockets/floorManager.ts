import { ChannelFloorState, FloorBroadcastState, RequestFloorPayload, UserRole } from '../types';
import { Server } from 'socket.io';

class FloorControlManager {
  private floors: Map<string, ChannelFloorState> = new Map();
  private readonly MAX_TOT_SECONDS = 60; // 60 detik Time-Out Timer

  public initChannelFloor(channelId: string) {
    if (!this.floors.has(channelId)) {
      this.floors.set(channelId, {
        channelId,
        status: 'IDLE',
        speakerId: null,
        speakerSocketId: null,
        speakerName: null,
        role: null,
        startedAt: null
      });
    }
  }

  public getFloorState(channelId: string): ChannelFloorState {
    this.initChannelFloor(channelId);
    return this.floors.get(channelId)!;
  }

  public requestFloor(
    payload: RequestFloorPayload, 
    io: Server, 
    onTotExpire: (channelId: string, speakerId: string) => void
  ): { granted: boolean; reason?: string; preemptedUser?: string | null } {
    const { channelId, userId, socketId, userName, role, isPriority } = payload;
    this.initChannelFloor(channelId);
    const floor = this.floors.get(channelId)!;

    // Skenario 1: Kanal sedang bebas (IDLE)
    if (floor.status === 'IDLE') {
      this.lockFloor(floor, userId, socketId || null, userName, role, channelId, onTotExpire);
      return { granted: true };
    }

    // Skenario 2: Kanal sedang terkunci oleh perangkat / socket lain
    const isLockedByOther = floor.speakerSocketId ? (floor.speakerSocketId !== socketId) : (floor.speakerId !== userId);
    if (floor.status === 'LOCKED' && isLockedByOther) {
      // Periksa apakah penantang memiliki hak Priority Override
      const isCommander = role === 'KOORDINATOR_KEAMANAN' || role === 'KETUA_PELAKSANA' || isPriority;
      const currentSpeakerIsCommander = floor.role === 'KOORDINATOR_KEAMANAN' || floor.role === 'KETUA_PELAKSANA';

      if (isCommander && !currentSpeakerIsCommander) {
        // Priority Override: Putus transmisi penutur sebelumnya secara paksa
        const previousSpeakerId = floor.speakerId;
        if (floor.totTimeout) clearTimeout(floor.totTimeout);

        // Beri tahu penutur sebelumnya bahwa jalurnya diambil alih
        io.to(channelId).emit('ptt:preempted', {
          preemptedUserId: previousSpeakerId,
          commanderName: userName,
          reason: 'PRIORITY_OVERRIDE_BY_COMMANDER'
        });

        // Kunci untuk komandan
        this.lockFloor(floor, userId, socketId || null, userName, role, channelId, onTotExpire);
        return { granted: true, preemptedUser: previousSpeakerId };
      }

      // Jika bukan komandan atau penutur saat ini juga komandan, tolak transmisi (BUSY)
      return { granted: false, reason: 'CHANNEL_BUSY' };
    }

    // Jika pengguna / socket yang sama sudah memegang lock
    return { granted: true };
  }

  private lockFloor(
    floor: ChannelFloorState, 
    userId: string, 
    socketId: string | null,
    userName: string, 
    role: UserRole, 
    channelId: string,
    onTotExpire: (channelId: string, speakerId: string) => void
  ) {
    if (floor.totTimeout) clearTimeout(floor.totTimeout);

    floor.status = 'LOCKED';
    floor.speakerId = userId;
    floor.speakerSocketId = socketId;
    floor.speakerName = userName;
    floor.role = role;
    floor.startedAt = Date.now();

    // Set Time-Out Timer (TOT) 60 detik
    floor.totTimeout = setTimeout(() => {
      this.releaseFloor(channelId, socketId || userId);
      onTotExpire(channelId, userId);
    }, this.MAX_TOT_SECONDS * 1000);
  }

  public releaseFloor(channelId: string, socketIdOrUserId: string): boolean {
    const floor = this.floors.get(channelId);
    if (!floor) return false;

    // Pemegang lock sah (dicocokkan via socketId atau userId)
    if (floor.status === 'LOCKED' && (floor.speakerSocketId === socketIdOrUserId || floor.speakerId === socketIdOrUserId)) {
      if (floor.totTimeout) clearTimeout(floor.totTimeout);

      floor.status = 'IDLE';
      floor.speakerId = null;
      floor.speakerSocketId = null;
      floor.speakerName = null;
      floor.role = null;
      floor.startedAt = null;
      floor.totTimeout = undefined;
      return true;
    }
    return false;
  }

  public canTransmitAudio(channelId: string, socketIdOrUserId: string): boolean {
    const floor = this.floors.get(channelId);
    if (!floor || floor.status !== 'LOCKED') return false;
    return floor.speakerSocketId === socketIdOrUserId || floor.speakerId === socketIdOrUserId;
  }

  public toBroadcastState(channelId: string): FloorBroadcastState {
    const floor = this.getFloorState(channelId);
    return {
      status: floor.status,
      channelId,
      speakerId: floor.speakerId,
      speakerSocketId: floor.speakerSocketId,
      speakerName: floor.speakerName,
      role: floor.role,
      timestamp: Date.now()
    };
  }
}

export const floorControl = new FloorControlManager();
