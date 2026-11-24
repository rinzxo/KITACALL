import { ChannelMember, UserRole } from '../types';

export interface ChannelMeta {
  code: string;
  name: string;
  createdAt: number;
  createdBy?: string;
}

class ChannelStateManager {
  // Map channelId (pairing code) -> Map<socketId, ChannelMember>
  private channels: Map<string, Map<string, ChannelMember>> = new Map();
  // Map socketId -> { channelId, userId }
  private socketLookup: Map<string, { channelId: string; userId: string }> = new Map();
  // Map channelId (pairing code) -> ChannelMeta
  private channelMetas: Map<string, ChannelMeta> = new Map();

  constructor() {
    // Default channels seeded
    this.registerChannel('CH-01', 'Saluran Umum Utama');
    this.registerChannel('CH-02', 'Saluran Komando Lapangan');
  }

  public registerChannel(code: string, name: string, createdBy?: string): ChannelMeta {
    const cleanCode = code.toUpperCase().trim();
    const existing = this.channelMetas.get(cleanCode);
    if (existing) {
      if (name && name.trim()) existing.name = name.trim();
      return existing;
    }
    const meta: ChannelMeta = {
      code: cleanCode,
      name: name && name.trim() ? name.trim() : `Saluran ${cleanCode}`,
      createdAt: Date.now(),
      createdBy
    };
    this.channelMetas.set(cleanCode, meta);
    return meta;
  }

  public getChannelMeta(code: string): ChannelMeta | undefined {
    return this.channelMetas.get(code.toUpperCase().trim());
  }

  public getAllChannels(): Array<{ code: string; name: string; memberCount: number; createdAt: number }> {
    const result: Array<{ code: string; name: string; memberCount: number; createdAt: number }> = [];
    this.channelMetas.forEach((meta, code) => {
      const count = this.channels.get(code)?.size || 0;
      result.push({
        code: meta.code,
        name: meta.name,
        memberCount: count,
        createdAt: meta.createdAt
      });
    });
    return result;
  }

  public addMember(
    channelId: string, 
    socketId: string, 
    user: { userId: string; userName: string; role: UserRole; dutyMode: boolean; posJaga?: string }
  ): void {
    const cleanChannel = channelId.toUpperCase().trim();
    if (!this.channels.has(cleanChannel)) {
      this.channels.set(cleanChannel, new Map());
    }

    // Pastikan channel metadata terdaftar jika belum ada
    if (!this.channelMetas.has(cleanChannel)) {
      this.registerChannel(cleanChannel, `Saluran ${cleanChannel}`);
    }

    const channelMembers = this.channels.get(cleanChannel)!;
    const member: ChannelMember = {
      ...user,
      socketId,
      audioCtxState: 'running',
      wakeLock: true,
      lastHeartbeat: Date.now()
    };

    channelMembers.set(socketId, member);
    this.socketLookup.set(socketId, { channelId: cleanChannel, userId: user.userId });
  }

  public updateHeartbeat(
    channelId: string, 
    socketId: string, 
    data: { audioCtxState: 'running' | 'suspended' | 'closed'; wakeLock: boolean; batteryLvl?: number; dutyMode?: boolean }
  ): boolean {
    const cleanChannel = channelId.toUpperCase().trim();
    const channelMembers = this.channels.get(cleanChannel);
    if (!channelMembers) return false;

    const member = channelMembers.get(socketId);
    if (!member) return false;

    member.audioCtxState = data.audioCtxState;
    member.wakeLock = data.wakeLock;
    if (data.batteryLvl !== undefined) member.batteryLvl = data.batteryLvl;
    if (data.dutyMode !== undefined) member.dutyMode = data.dutyMode;
    member.lastHeartbeat = Date.now();
    return true;
  }

  public removeMember(channelId: string, socketId: string): void {
    const cleanChannel = channelId.toUpperCase().trim();
    const channelMembers = this.channels.get(cleanChannel);
    if (channelMembers) {
      channelMembers.delete(socketId);
      if (channelMembers.size === 0) {
        // Biarkan channel metadata tetap ada, hanya hapus data socket kosong
        this.channels.delete(cleanChannel);
      }
    }
    const lookup = this.socketLookup.get(socketId);
    if (lookup && lookup.channelId === cleanChannel) {
      this.socketLookup.delete(socketId);
    }
  }

  public removeMemberBySocket(socketId: string): { channelId: string; userId: string; userName: string } | null {
    const lookup = this.socketLookup.get(socketId);
    if (!lookup) return null;

    this.socketLookup.delete(socketId);
    const { channelId, userId } = lookup;
    const channelMembers = this.channels.get(channelId);
    if (!channelMembers) return null;

    const member = channelMembers.get(socketId);
    const userName = member ? member.userName : userId;
    channelMembers.delete(socketId);

    if (channelMembers.size === 0) {
      this.channels.delete(channelId);
    }

    return { channelId, userId, userName };
  }

  public getChannelRoster(channelId: string): ChannelMember[] {
    const cleanChannel = channelId.toUpperCase().trim();
    const channelMembers = this.channels.get(cleanChannel);
    if (!channelMembers) return [];
    return Array.from(channelMembers.values());
  }

  public getMember(channelId: string, socketId: string): ChannelMember | undefined {
    const cleanChannel = channelId.toUpperCase().trim();
    return this.channels.get(cleanChannel)?.get(socketId);
  }
}

export const channelState = new ChannelStateManager();
