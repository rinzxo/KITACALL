import { useState, useEffect } from 'react';
import { LoginPage } from './components/auth/LoginPage';
import { HeaderBanner } from './components/tactical/HeaderBanner';
import { ChannelSelector } from './components/tactical/ChannelSelector';
import { GiantPTTButton } from './components/tactical/GiantPTTButton';
import { SecurityRoster } from './components/tactical/SecurityRoster';
import { TacticalBlackoutMode } from './components/tactical/TacticalBlackoutMode';
import { EmergencyModal } from './components/tactical/EmergencyModal';
import { PairingChannelModal, type SavedChannel } from './components/tactical/PairingChannelModal';
import { UserProfileModal } from './components/auth/UserProfileModal';
import { LockscreenPermissionModal } from './components/tactical/LockscreenPermissionModal';
import { useKitaComEngine } from './hooks/useKitaComEngine';
import type { ChannelMember } from './hooks/useKitaComEngine';
import { workspaceApi } from './services/workspaceApi';
import { supabase } from './lib/supabase';
import { Megaphone, X, PhoneCall } from '@phosphor-icons/react';

interface AuthenticatedUser {
  userId: string;
  userName: string;
  email: string;
  avatarUrl?: string | null;
  role: 'KOORDINATOR_KEAMANAN' | 'KETUA_PELAKSANA' | 'ANGGOTA_KEAMANAN' | 'PENGURUS_INTI' | 'PEMBINA';
  posJaga: string;
}

const DEFAULT_SAVED_CHANNELS: SavedChannel[] = [
  { code: 'CH-01', name: 'Saluran Umum Utama', lastJoined: Date.now() },
  { code: 'CH-02', name: 'Saluran Komando Lapangan', lastJoined: Date.now() }
];

export function App() {
  // 1. Auth State: WAJIB LOGIN DULU (Null jika belum login)
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // 2. Channel & Pairing State (Berbasis Pairing Code, bukan Workspace)
  const [currentChannelCode, setCurrentChannelCode] = useState<string>(() => {
    return localStorage.getItem('kitacall_active_channel_code') || 'CH-01';
  });
  const [currentChannelName, setCurrentChannelName] = useState<string>(() => {
    return localStorage.getItem('kitacall_active_channel_name') || 'Saluran Umum Utama';
  });
  const [savedChannels, setSavedChannels] = useState<SavedChannel[]>(() => {
    try {
      const stored = localStorage.getItem('kitacall_saved_channels');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_SAVED_CHANNELS;
  });

  // 3. Modals State
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isBlackoutOpen, setIsBlackoutOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLockscreenModalOpen, setIsLockscreenModalOpen] = useState(false);
  const [directCallTarget, setDirectCallTarget] = useState<ChannelMember | null>(null);

  // Simpan riwayat saluran ke localStorage setiap kali ada pembaruan
  const persistSavedChannels = (updated: SavedChannel[]) => {
    setSavedChannels(updated);
    try {
      localStorage.setItem('kitacall_saved_channels', JSON.stringify(updated));
    } catch (e) {}
  };

  // Handler memilih / pairing ke saluran baru
  const handleSelectChannel = (channel: { code: string; name: string }) => {
    const cleanCode = channel.code.toUpperCase().trim();
    setCurrentChannelCode(cleanCode);
    setCurrentChannelName(channel.name);
    try {
      localStorage.setItem('kitacall_active_channel_code', cleanCode);
      localStorage.setItem('kitacall_active_channel_name', channel.name);
    } catch (e) {}

    // Tambahkan atau perbarui di daftar saluran tersimpan
    const existingIndex = savedChannels.findIndex(c => c.code === cleanCode);
    let updated: SavedChannel[];
    if (existingIndex >= 0) {
      updated = savedChannels.map((c, i) => i === existingIndex ? { ...c, name: channel.name, lastJoined: Date.now() } : c);
    } else {
      updated = [{ code: cleanCode, name: channel.name, lastJoined: Date.now() }, ...savedChannels];
    }
    persistSavedChannels(updated);
  };

  // Handler menghapus saluran dari riwayat
  const handleRemoveSavedChannel = (code: string) => {
    const updated = savedChannels.filter(c => c.code !== code);
    persistSavedChannels(updated);
  };

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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    setIsProfileModalOpen(false);
  };

  // Engine audio & socket
  const engineProps = currentUser ? {
    workspaceId: 'pairing-network',
    channelId: currentChannelCode,
    channelName: currentChannelName,
    channelCode: currentChannelCode,
    channels: savedChannels.map(c => ({ id: c.code, code: c.code, name: c.name })),
    onSelectChannel: (targetCode: string) => {
      const found = savedChannels.find(c => c.code === targetCode);
      handleSelectChannel({
        code: targetCode,
        name: found ? found.name : `Saluran ${targetCode}`
      });
    },
    workspaceName: currentChannelName,
    user: currentUser
  } : {
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
    currentSocketId,
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

  // 2. WAJIB LOGIN DULU
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. User terautentikasi: Tampilkan antarmuka transceiver taktis
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
          workspaceName={currentChannelName}
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

        {/* 2. Channel Selector via Pairing Code */}
        <ChannelSelector
          currentChannelCode={currentChannelCode}
          currentChannelName={currentChannelName}
          memberCount={roster.length}
          onOpenPairingModal={() => setIsPairingModalOpen(true)}
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

        {/* 3. Center Giant PTT Button */}
        <GiantPTTButton
          floorState={floorState}
          isTransmitting={isTransmitting}
          isReceiving={isReceiving}
          currentUserId={currentUser.userId}
          currentSocketId={currentSocketId}
          userRole={currentUser.role}
          onStartTransmit={startTransmitting}
          onStopTransmit={stopTransmitting}
          isDutyActive={isDutyActive}
          onActivateDutyFirst={toggleDutyMode}
        />

        {/* 4. Security Roster Drawer (Real-Time Personel di Frekuensi Aktif) */}
        <SecurityRoster
          roster={roster}
          currentUserId={currentUser.userId}
          onDirectCall={(member) => setDirectCallTarget(member)}
        />

        {/* 5. Tactical Blackout Mode Modal (Pure AMOLED #000000) */}
        <TacticalBlackoutMode
          isOpen={isBlackoutOpen}
          onClose={() => setIsBlackoutOpen(false)}
          channelId={currentChannelCode}
          floorState={floorState}
          isReceiving={isReceiving}
          batteryLevel={batteryLevel}
        />

        {/* 6. Emergency Broadcast Modal */}
        <EmergencyModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onConfirm={(note) => triggerEmergencyAlert(note)}
          channelId={currentChannelCode}
        />

        {/* 7. Pairing Channel Modal (Gabung, Buat Saluran & Riwayat) */}
        <PairingChannelModal
          isOpen={isPairingModalOpen}
          onClose={() => setIsPairingModalOpen(false)}
          currentChannelCode={currentChannelCode}
          currentChannelName={currentChannelName}
          savedChannels={savedChannels}
          onSelectChannel={handleSelectChannel}
          onRemoveSavedChannel={handleRemoveSavedChannel}
          userId={currentUser.userId}
        />

        {/* 8. Profil & Keluar Sesi Modal */}
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          activeWorkspaceName={currentChannelName}
          onSignOut={handleSignOut}
        />

        {/* 9. Modal Izin Lockscreen HP (Otomatis & 1-Klik) */}
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
