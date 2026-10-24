export type UserRole = 
  | 'KOORDINATOR_KEAMANAN' 
  | 'KETUA_PELAKSANA' 
  | 'ANGGOTA_KEAMANAN' 
  | 'PENGURUS_INTI' 
  | 'PEMBINA';

export type FloorStatus = 'IDLE' | 'LOCKED';

export interface ChannelMember {
  userId: string;
  userName: string;
  role: UserRole;
  socketId: string;
  dutyMode: boolean;
  audioCtxState: 'running' | 'suspended' | 'closed';
  wakeLock: boolean;
  batteryLvl?: number;
  lastHeartbeat: number;
  posJaga?: string;
}

export interface ChannelFloorState {
  channelId: string;
  status: FloorStatus;
  speakerId: string | null;
  speakerSocketId: string | null;
  speakerName: string | null;
  role: UserRole | null;
  startedAt: number | null;
  totTimeout?: NodeJS.Timeout;
}

export interface JoinChannelPayload {
  workspaceId: string;
  channelId: string;
  userId: string;
  userName: string;
  role: UserRole;
  dutyMode: boolean;
  posJaga?: string;
}

export interface HeartbeatPayload {
  userId: string;
  channelId: string;
  audioCtxState: 'running' | 'suspended' | 'closed';
  wakeLock: boolean;
  batteryLvl?: number;
  dutyMode?: boolean;
}

export interface RequestFloorPayload {
  channelId: string;
  userId: string;
  socketId?: string;
  userName: string;
  role: UserRole;
  isPriority: boolean;
}

export interface FloorBroadcastState {
  status: FloorStatus;
  channelId: string;
  speakerId: string | null;
  speakerSocketId: string | null;
  speakerName: string | null;
  role: UserRole | null;
  timestamp: number;
}
