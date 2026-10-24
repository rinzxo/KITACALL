import { ChannelMember, UserRole } from '../types';

class ChannelStateManager {
  // Map channelId -> Map<socketId, ChannelMember> (mendukung multi-device login akun yang sama)
  private channels: Map<string, Map<string, ChannelMember>> = new Map();
  // Map socketId -> { channelId, userId }
  private socketLookup: Map<string, { channelId: string; userId: string }> = new Map();

  public addMember(
    channelId: string, 
    socketId: string, 
    user: { userId: string; userName: string; role: UserRole; dutyMode: boolean; posJaga?: string }
  ): void {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Map());
    }

    const channelMembers = this.channels.get(channelId)!;
    const member: ChannelMember = {
      ...user,
      socketId,
      audioCtxState: 'running',
      wakeLock: true,
      lastHeartbeat: Date.now()
    };

    channelMembers.set(socketId, member);
    this.socketLookup.set(socketId, { channelId, userId: user.userId });
  }

  public updateHeartbeat(
    channelId: string, 
    socketId: string, 
    data: { audioCtxState: 'running' | 'suspended' | 'closed'; wakeLock: boolean; batteryLvl?: number; dutyMode?: boolean }
  ): boolean {
    const channelMembers = this.channels.get(channelId);
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
    const channelMembers = this.channels.get(channelId);
    if (!channelMembers) return [];
    return Array.from(channelMembers.values());
  }

  public getMember(channelId: string, socketId: string): ChannelMember | undefined {
    return this.channels.get(channelId)?.get(socketId);
  }
}

export const channelState = new ChannelStateManager();
