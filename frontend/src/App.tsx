import { useState, useEffect, useCallback } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { HeaderBanner } from './components/tactical/HeaderBanner';
import { ChannelSelector } from './components/tactical/ChannelSelector';
import { GiantPTTButton } from './components/tactical/GiantPTTButton';
import { SecurityRoster } from './components/tactical/SecurityRoster';
import { TacticalBlackoutMode } from './components/tactical/TacticalBlackoutMode';
import { EmergencyModal } from './components/tactical/EmergencyModal';
import { WorkspaceSwitcher } from './components/workspace/WorkspaceSwitcher';
import { CreateChannelModal } from './components/workspace/CreateChannelModal';
import { ChannelMembersModal } from './components/workspace/ChannelMembersModal';
import { UserProfileModal } from './components/auth/UserProfileModal';
import { LockscreenPermissionModal } from './components/tactical/LockscreenPermissionModal';
import { useKitaComEngine } from './hooks/useKitaComEngine';
import type { ChannelMember } from './hooks/useKitaComEngine';
import { workspaceApi } from './services/workspaceApi';
import type { 
  WorkspaceItem, 
  WorkspaceMember, 
  WorkspaceChannel 
} from './services/workspaceApi';
import { supabase } from './lib/supabase';
import { Megaphone, X, PhoneCall, WarningCircle, Broadcast } from '@phosphor-icons/react';

interface AuthenticatedUser {
  userId: string;
  userName: string;
  email: string;
  avatarUrl?: string | null;
  role: 'KOORDINATOR_KEAMANAN' | 'KETUA_PELAKSANA' | 'ANGGOTA_KEAMANAN' | 'PENGURUS_INTI' | 'PEMBINA';
  posJaga: string;
}

export function App() {
  // 1. Auth State: WAJIB LOGIN DULU (Null jika belum login)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // 2. Workspace State (HANYA workspace milik user yang sedang login)
  const [userWorkspaces, setUserWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceItem | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);

  // 3. Channels & Members of active workspace
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [channels, setChannels] = useState<WorkspaceChannel[]>([]);
  const [currentChannelId, setCurrentChannelId] = useState<string>('');

  // 4. Modals State
  const [isBlackoutOpen, setIsBlackoutOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLockscreenModalOpen, setIsLockscreenModalOpen] = useState(false);
  const [directCallTarget, setDirectCallTarget] = useState<ChannelMember | null>(null);

  // Otomatis tawarkan izin Lockscreen HP jika belum diaktifkan (khusus Android 13+ & Mobile)
  useEffect(() => {
    if (currentUser) {
      if ('Notification' in window && Notification.permission === 'default') {
        const timer = setTimeout(() => {
          setIsLockscreenModalOpen(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser]);

  // Periksa sesi login yang tersimpan di Supabase
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = session.user;
          let profileName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Pengguna';
          let avatarUrl = u.user_metadata?.avatar_url || null;

          let actualUserId = u.id;
          try {
            const remoteProfile = await workspaceApi.getUserByEmail(u.email || '');
            if (remoteProfile) {
              actualUserId = remoteProfile.id || actualUserId;
              profileName = remoteProfile.full_name || profileName;
              avatarUrl = remoteProfile.avatar_url || avatarUrl;
            }
          } catch (e) {}

          setCurrentUser({
            userId: actualUserId,
            userName: profileName,
            email: u.email || '',
            avatarUrl,
            role: 'ANGGOTA_KEAMANAN',
            posJaga: 'Patroli Lapangan'
          });
        }
      } catch (err) {
        console.error('[KitaCom] Gagal memeriksa sesi login:', err);
      } finally {
        setIsCheckingSession(false);
      }
    }
    checkSession();

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u = session.user;
        let profileName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Pengguna';
        let avatarUrl = u.user_metadata?.avatar_url || null;
        let actualUserId = u.id;

        try {
          const remoteProfile = await workspaceApi.getUserByEmail(u.email || '');
          if (remoteProfile) {
            actualUserId = remoteProfile.id || actualUserId;
            profileName = remoteProfile.full_name || profileName;
            avatarUrl = remoteProfile.avatar_url || avatarUrl;
          }
        } catch (e) {}

        setCurrentUser({
          userId: actualUserId,
          userName: profileName,
          email: u.email || '',
          avatarUrl,
          role: 'ANGGOTA_KEAMANAN',
          posJaga: 'Patroli Lapangan'
        });
      } else {
        setCurrentUser(null);
        setUserWorkspaces([]);
        setActiveWorkspace(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Begitu user login, muat HANYA workspace milik user tersebut!
  useEffect(() => {
    if (!currentUser) return;

    async function loadUserWorkspaces() {
      try {
        setIsLoadingWorkspaces(true);
        const wsList = await workspaceApi.getUserWorkspaces(currentUser.userId);
        setUserWorkspaces(wsList);
        if (wsList.length > 0) {
          setActiveWorkspace(wsList[0]);
        } else {
          setActiveWorkspace(null);
        }
      } catch (err) {
        console.error('[KitaCom] Gagal memuat workspace user:', err);
      } finally {
        setIsLoadingWorkspaces(false);
      }
    }

    loadUserWorkspaces();
  }, [currentUser?.userId]);

  // Muat channels dan members ketika activeWorkspace berganti
  const loadWorkspaceDetails = useCallback(async (orgId: string, currentUserId: string) => {
    try {
      const [membersData, channelsData] = await Promise.all([
        workspaceApi.getWorkspaceMembers(orgId),
        workspaceApi.getWorkspaceChannels(orgId)
      ]);

      setWorkspaceMembers(membersData);
      setChannels(channelsData);

      if (channelsData.length > 0) {
        setCurrentChannelId(channelsData[0].id);
      }

      // Tentukan peran taktis berdasarkan jabatan riil di organisasi
      const myMembership = membersData.find(m => m.profileId === currentUserId);
      if (myMembership) {
        const isHead = myMembership.orgRole === 'head' || myMembership.orgRole === 'vice_head';
        setCurrentUser(prev => prev ? ({
          ...prev,
          userName: myMembership.fullName || prev.userName,
          role: isHead ? 'KOORDINATOR_KEAMANAN' : 'ANGGOTA_KEAMANAN',
          posJaga: isHead ? 'Posko Induk & Komando' : 'Patroli Lapangan'
        }) : null);
      }
    } catch (err) {
      console.error('[KitaCom] Gagal memuat data workspace detail:', err);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspace && currentUser) {
      loadWorkspaceDetails(activeWorkspace.id, currentUser.userId);
    }
  }, [activeWorkspace, currentUser?.userId, loadWorkspaceDetails]);

  // Handler Login Sukses dari LoginPage
  const handleLoginSuccess = (userPayload: {
    userId: string;
    userName: string;
    email: string;
    avatarUrl?: string | null;
  }) => {
    setCurrentUser({
      userId: userPayload.userId,
      userName: userPayload.userName,
      email: userPayload.email,
      avatarUrl: userPayload.avatarUrl,
      role: 'ANGGOTA_KEAMANAN',
      posJaga: 'Patroli Lapangan'
    });
  };

  // Handler Logout
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUserWorkspaces([]);
    setActiveWorkspace(null);
    setChannels([]);
    setWorkspaceMembers([]);
    setIsProfileModalOpen(false);
  };

  // Handler pembuatan channel baru
  const handleCreateChannel = async (channelData: {
    code: string;
    name: string;
    category: string;
    description: string;
    initialMembers: { profileId: string; tacticalRole: string; posJaga: string }[];
  }) => {
    if (!activeWorkspace || !currentUser) return;
    const newChan = await workspaceApi.createChannel(activeWorkspace.id, {
      ...channelData,
      createdBy: currentUser.userId,
      initialMemberIds: channelData.initialMembers
    });

    const updatedChannels = await workspaceApi.getWorkspaceChannels(activeWorkspace.id);
    setChannels(updatedChannels);
    setCurrentChannelId(newChan.id);
  };

  // Handler penugasan anggota ke channel
  const handleAddMemberToChannel = async (payload: {
    profileId: string;
    tacticalRole: string;
    posJaga: string;
  }) => {
    if (!currentChannelId || !activeWorkspace) return;
    await workspaceApi.addMemberToChannel(currentChannelId, payload);
    const updatedChannels = await workspaceApi.getWorkspaceChannels(activeWorkspace.id);
    setChannels(updatedChannels);
  };

  // Handler pencabutan anggota dari channel
  const handleRemoveMemberFromChannel = async (profileId: string) => {
    if (!currentChannelId || !activeWorkspace) return;
    await workspaceApi.removeMemberFromChannel(currentChannelId, profileId);
    const updatedChannels = await workspaceApi.getWorkspaceChannels(activeWorkspace.id);
    setChannels(updatedChannels);
  };

  const activeChannelObj = channels.find(c => c.id === currentChannelId || c.code === currentChannelId) || null;

  // Filter saluran yang berhak diakses user untuk navigasi lockscreen HP (ala Spotify)
  const accessibleChannels = channels.filter(c => {
    if (!currentUser) return false;
    const isPublic = c.code === 'CH-01' || !c.assignedMembers || c.assignedMembers.length === 0;
    const isCommander = currentUser.role === 'KOORDINATOR_KEAMANAN' || currentUser.role === 'KETUA_PELAKSANA';
    return isPublic || isCommander || c.assignedMembers.some(m => m.profileId === currentUser.userId);
  });

  const channelsForLockscreen = accessibleChannels.length > 0 ? accessibleChannels : channels;

  const handleSelectChannelFromLockscreen = (targetId: string) => {
    setCurrentChannelId(targetId);
  };

  // Engine audio & socket (Hanya aktif untuk user terautentikasi)
  const engineProps = currentUser ? {
    workspaceId: activeWorkspace ? activeWorkspace.id : 'ws-unassigned',
    channelId: currentChannelId || 'CH-01',
    channelName: activeChannelObj?.name || 'Saluran Utama',
    channelCode: activeChannelObj?.code || 'CH-01',
    channels: channelsForLockscreen.map(c => ({ id: c.id, code: c.code, name: c.name })),
    onSelectChannel: handleSelectChannelFromLockscreen,
    workspaceName: activeWorkspace?.name || 'KitaCall Network',
    user: currentUser
  } : {
    workspaceId: 'ws-unassigned',
    channelId: 'CH-01',
    channelName: 'Saluran Publik',
    channelCode: 'CH-01',
    channels: [{ id: 'CH-01', code: 'CH-01', name: 'Saluran Publik' }],
    user: {
      userId: 'anonymous',
      userName: 'Tamu',
      role: 'ANGGOTA_KEAMANAN' as const,
      posJaga: 'Lapangan'
    }
  };

  const {
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
    dismissEmergencyAlert,
    triggerEmergencyAlert
  } = useKitaComEngine(engineProps);

  // 1. Tampilkan loading spinner jika sedang memeriksa status sesi
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-[0_0_25px_rgba(0,210,255,0.15)] p-3 flex items-center justify-center mb-4">
          <img src="/KitaCall Transparan.png" alt="KitaCall" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(0,210,255,0.5)] animate-pulse" />
        </div>
        <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-cyan-400/90 font-mono-lcd uppercase tracking-widest">
          MEMERIKSA AUTENTIKASI KITACALL...
        </p>
      </div>
    );
  }

  // 2. WAJIB LOGIN DULU: Tanpa bypass atau backdoor
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. User terautentikasi: Tampilkan antarmuka taktis
  return (
    <div className="h-screen max-h-screen bg-slate-950 flex justify-center font-sans select-none overflow-hidden">
      {/* Handheld Walkie-Talkie Chassis Frame */}
      <div className="w-full max-w-md h-full bg-slate-950 border-x border-slate-800 shadow-2xl flex flex-col justify-between relative overflow-hidden">
        {/* 1. Header & Mode Siaga Banner */}
        <HeaderBanner
          isDutyActive={isDutyActive}
          toggleDutyMode={toggleDutyMode}
          isConnected={isConnected}
          isWakeLocked={isWakeLocked}
          batteryLevel={batteryLevel}
          onOpenBlackout={() => setIsBlackoutOpen(true)}
          onOpenEmergency={() => setIsEmergencyModalOpen(true)}
          onOpenAuth={() => setIsProfileModalOpen(true)}
          onOpenLockscreenModal={() => setIsLockscreenModalOpen(true)}
          userRole={currentUser.role}
          userName={currentUser.userName}
          workspaceName={activeWorkspace?.name}
        />

        {/* Emergency Active Broadcast Bar */}
        {emergencyAlert && (
          <div className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center justify-between text-xs animate-bounce shadow-md z-30 font-tactical">
            <div className="flex items-center gap-2">
              <Megaphone size={18} weight="fill" className="text-yellow-300 animate-pulse" />
              <div>
                <span className="font-extrabold uppercase">DARURAT ({emergencyAlert.commanderName}): </span>
                <span className="font-medium">{emergencyAlert.note}</span>
              </div>
            </div>
            <button
              onClick={dismissEmergencyAlert}
              className="p-1 rounded-lg bg-red-700 hover:bg-red-800 text-white"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        )}

        {/* 2. Workspace Selector */}
        <WorkspaceSwitcher
          workspaces={userWorkspaces}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={setActiveWorkspace}
          isLoading={isLoadingWorkspaces}
        />

        {/* Jika user belum memiliki workspace */}
        {userWorkspaces.length === 0 && !isLoadingWorkspaces && (
          <div className="max-w-md mx-auto px-4 mt-4 w-full">
            <div className="bg-amber-950/80 border border-amber-500/50 p-4 rounded-2xl flex items-start gap-3 text-amber-200 text-xs font-mono-lcd">
              <WarningCircle size={20} weight="fill" className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold mb-1 uppercase font-tactical">Belum Terdaftar di Organisasi</p>
                <p className="leading-relaxed text-amber-300/90">
                  Akun Anda ({currentUser.email}) belum terdaftar pada divisi/workspace apa pun di KitaCall. Silakan hubungi admin untuk menambahkan akun Anda ke organisasi.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Frequency Channel Selector (Saluran Taktis di Workspace Aktif) */}
        <ChannelSelector
          currentChannelId={currentChannelId}
          onSelectChannel={setCurrentChannelId}
          channels={channels}
          userRole={currentUser.role}
          currentUserId={currentUser.userId}
          onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
          onOpenManageMembers={() => setIsManageMembersOpen(true)}
        />

        {/* Direct Call notification banner */}
        {directCallTarget && (
          <div className="max-w-md mx-auto px-4 mt-2 w-full">
            <div className="bg-cyan-950/80 border border-cyan-500/60 rounded-xl p-2.5 flex items-center justify-between text-xs text-cyan-200 font-mono-lcd">
              <div className="flex items-center gap-2">
                <PhoneCall size={16} weight="bold" className="text-cyan-400 animate-pulse" />
                <span>JALUR PANGGIL LANGSUNG: <b>{directCallTarget.userName}</b></span>
              </div>
              <button
                onClick={() => setDirectCallTarget(null)}
                className="text-cyan-300 font-bold hover:underline"
              >
                TUTUP
              </button>
            </div>
          </div>
        )}

      {/* 4. Center Giant PTT Button */}
      <GiantPTTButton
        floorState={floorState}
        isTransmitting={isTransmitting}
        isReceiving={isReceiving}
        currentUserId={currentUser.userId}
        userRole={currentUser.role}
        onStartTransmit={startTransmitting}
        onStopTransmit={stopTransmitting}
        isDutyActive={isDutyActive}
        onActivateDutyFirst={toggleDutyMode}
      />

      {/* 5. Security Roster Drawer (Real-Time Personel di Frekuensi Aktif) */}
      <SecurityRoster
        roster={roster}
        currentUserId={currentUser.userId}
        onDirectCall={(member) => setDirectCallTarget(member)}
      />

      {/* 6. Tactical Blackout Mode Modal (Pure AMOLED #000000) */}
      <TacticalBlackoutMode
        isOpen={isBlackoutOpen}
        onClose={() => setIsBlackoutOpen(false)}
        channelId={activeChannelObj ? activeChannelObj.code : currentChannelId}
        floorState={floorState}
        isReceiving={isReceiving}
        batteryLevel={batteryLevel}
      />

      {/* 7. Emergency Broadcast Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        onConfirm={(note) => triggerEmergencyAlert(note)}
        channelId={activeChannelObj ? activeChannelObj.code : currentChannelId}
      />

      {/* 8. Create Channel Modal */}
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        workspaceMembers={workspaceMembers}
        onCreateChannel={handleCreateChannel}
      />

      {/* 9. Manage Channel Members Modal */}
      <ChannelMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
        channel={activeChannelObj}
        workspaceMembers={workspaceMembers}
        onAddMember={handleAddMemberToChannel}
        onRemoveMember={handleRemoveMemberFromChannel}
      />

      {/* 10. Profil & Keluar Sesi Modal (Tanpa opsi alih identitas) */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        activeWorkspaceName={activeWorkspace?.name}
        onSignOut={handleSignOut}
      />

      {/* 11. Modal Izin Lockscreen HP (Otomatis & 1-Klik) */}
      <LockscreenPermissionModal
        isOpen={isLockscreenModalOpen}
        onClose={() => setIsLockscreenModalOpen(false)}
        onActivate={activateLockscreen}
      />
      </div>
    </div>
  );
}

export default App;
