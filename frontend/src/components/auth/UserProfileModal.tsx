import { X, UserCircle, SignOut, SpeakerHigh } from '@phosphor-icons/react';
import { TacticalAudioSynthesizer } from '../../lib/audioTones';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    userId: string;
    userName: string;
    email: string;
    role: string;
    posJaga: string;
    avatarUrl?: string | null;
  };
  activeWorkspaceName?: string;
  onSignOut: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeWorkspaceName,
  onSignOut
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl my-8 space-y-5 font-sans backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-cyan-400 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.userName} className="w-full h-full object-cover" />
              ) : (
                <UserCircle size={28} weight="duotone" className="text-cyan-400" />
              )}
            </div>
            <div className="truncate">
              <h3 className="text-sm font-extrabold text-white truncate max-w-[190px]">
                {currentUser.userName}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono-lcd truncate max-w-[190px]">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {/* User Workspace Status Info */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5 text-xs font-mono-lcd">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Workspace Aktif:</span>
            <span className="font-extrabold text-white truncate max-w-[160px]">
              {activeWorkspaceName || 'Organisasi Aktif'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Hak Taktis HT:</span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
              currentUser.role === 'KOORDINATOR_KEAMANAN'
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
            }`}>
              {currentUser.role === 'KOORDINATOR_KEAMANAN' ? 'Komandan (Priority)' : 'Satgas Keamanan'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Pos Penugasan:</span>
            <span className="font-bold text-slate-300">
              {currentUser.posJaga}
            </span>
          </div>
        </div>

        {/* Audio Speaker & Synthesizer Test */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5 font-mono-lcd">
          <button
            type="button"
            onClick={async () => {
              const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioCtxClass();
              await ctx.resume();
              await TacticalAudioSynthesizer.playPreflightGuard(ctx);
              setTimeout(() => {
                TacticalAudioSynthesizer.playTalkPermitChirp(ctx);
              }, 250);
            }}
            className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 text-cyan-400 border border-cyan-500/30 font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <SpeakerHigh size={16} weight="bold" />
            <span>Uji Speaker &amp; Nada HT</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-3 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60 font-extrabold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            <SignOut size={16} weight="bold" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
