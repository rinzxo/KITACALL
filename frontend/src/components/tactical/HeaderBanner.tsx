import React from 'react';
import { 
  Broadcast, 
  ShieldCheck, 
  Moon, 
  Warning, 
  SpeakerHigh, 
  BatteryHigh,
  BatteryMedium,
  BatteryLow,
  WifiHigh,
  WifiSlash,
  UserCircle,
  BellRinging
} from '@phosphor-icons/react';

interface HeaderBannerProps {
  isDutyActive: boolean;
  toggleDutyMode: () => void;
  isConnected: boolean;
  isWakeLocked: boolean;
  batteryLevel?: number;
  onOpenBlackout: () => void;
  onOpenEmergency: () => void;
  onOpenAuth: () => void;
  onOpenLockscreenModal?: () => void;
  userRole: string;
  userName: string;
  workspaceName?: string;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  isDutyActive,
  toggleDutyMode,
  isConnected,
  isWakeLocked,
  batteryLevel,
  onOpenBlackout,
  onOpenEmergency,
  onOpenAuth,
  onOpenLockscreenModal,
  userRole,
  userName,
  workspaceName
}) => {
  const isCommander = userRole === 'KOORDINATOR_KEAMANAN' || userRole === 'KETUA_PELAKSANA';

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-2 select-none shrink-0 z-30">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Brand & Workspace */}
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0">
            <img src="/KitaCall%20Transparan.png" alt="KitaCall" className="w-8 h-8 object-contain" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white font-tactical">
                Kita<span className="text-cyan-400">Call</span>
              </span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-ping'}`} title={isConnected ? 'Online' : 'Offline'} />
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate max-w-[130px] leading-tight">
              {workspaceName || 'Organisasi'}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Siaga Compact Toggle */}
          <button
            onClick={toggleDutyMode}
            title={isDutyActive ? 'Siaga Aktif (Audio Tembus)' : 'Siaga Mati'}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isDutyActive
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isDutyActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isDutyActive ? 'SIAGA' : 'OFF'}</span>
          </button>

          {/* Tombol Cepat Izin Lockscreen HP */}
          {onOpenLockscreenModal && (
            <button
              onClick={onOpenLockscreenModal}
              title="Aktifkan Kendali Lockscreen HP (ala Spotify)"
              className="p-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 text-cyan-400 border border-cyan-700/60 transition-colors cursor-pointer"
            >
              <BellRinging size={16} weight="bold" />
            </button>
          )}

          {/* Commander Emergency */}
          {isCommander && (
            <button
              onClick={onOpenEmergency}
              title="Sinyal Bahaya"
              className="p-2 rounded-xl bg-red-950/80 text-red-400 hover:bg-red-900 border border-red-700/80 transition-colors"
            >
              <Warning size={16} weight="bold" />
            </button>
          )}

          {/* Blackout */}
          <button
            onClick={onOpenBlackout}
            title="Hemat Baterai (OLED)"
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-colors"
          >
            <Moon size={16} weight="duotone" />
          </button>

          {/* Profile */}
          <button
            onClick={onOpenAuth}
            title={userName}
            className="p-2 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700/80 hover:bg-slate-700 transition-colors flex items-center gap-1"
          >
            <UserCircle size={18} weight="duotone" />
            <span className="text-xs font-bold text-slate-200 max-w-[50px] truncate hidden xs:inline-block">
              {userName.split(' ')[0]}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
