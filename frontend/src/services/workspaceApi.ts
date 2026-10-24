const envUrl = import.meta.env.VITE_RELAY_SERVER_URL;
const API_BASE = envUrl && !envUrl.includes('localhost') 
  ? `${envUrl}/api` 
  : '/api';

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
}

export interface WorkspaceMember {
  membershipId: string;
  organizationId: string;
  profileId: string;
  orgRole: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface AssignedChannelMember {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  tacticalRole: string;
  posJaga: string;
  isPriority: boolean;
}

export interface WorkspaceChannel {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  category: string;
  description: string;
  memberCount: number;
  assignedMembers: AssignedChannelMember[];
}

export const workspaceApi = {
  async getWorkspaces(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE}/workspaces`);
    const data = await res.json();
    return data.workspaces || [];
  },

  async getUserWorkspaces(profileId: string): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE}/users/${profileId}/workspaces`);
    const data = await res.json();
    return data.workspaces || [];
  },

  async getUserByEmail(email: string): Promise<any> {
    const res = await fetch(`${API_BASE}/users/by-email/${encodeURIComponent(email)}`);
    const data = await res.json();
    return data.profile || null;
  },

  async getWorkspaceMembers(orgId: string): Promise<WorkspaceMember[]> {
    const res = await fetch(`${API_BASE}/workspaces/${orgId}/members`);
    const data = await res.json();
    return data.members || [];
  },

  async getWorkspaceChannels(orgId: string): Promise<WorkspaceChannel[]> {
    const res = await fetch(`${API_BASE}/workspaces/${orgId}/channels`);
    const data = await res.json();
    return data.channels || [];
  },

  async createChannel(orgId: string, payload: {
    code: string;
    name: string;
    category: string;
    description: string;
    createdBy?: string;
    initialMemberIds?: { profileId: string; tacticalRole: string; posJaga: string }[];
  }): Promise<WorkspaceChannel> {
    const res = await fetch(`${API_BASE}/workspaces/${orgId}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal membuat channel');
    return data.channel;
  },

  async addMemberToChannel(channelId: string, payload: {
    profileId: string;
    tacticalRole: string;
    posJaga: string;
    isPriority?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/channels/${channelId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menambahkan anggota ke channel');
    return data.member;
  },

  async removeMemberFromChannel(channelId: string, profileId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/channels/${channelId}/members/${profileId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus anggota dari channel');
  },

  async deleteChannel(channelId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/channels/${channelId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus channel');
  }
};
