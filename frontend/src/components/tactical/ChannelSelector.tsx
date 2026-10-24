import React, { useState } from 'react';
import { Radio, CaretDown, Check, ShieldCheck, UsersThree, PhoneCall, Plus, GearSix, Lock } from '@phosphor-icons/react';
import type { WorkspaceChannel } from '../../services/workspaceApi';

interface ChannelSelectorProps {
  currentChannelId: string;
  onSelectChannel: (channelId: string) => void;
  channels: WorkspaceChannel[];
  userRole: string;
  currentUserId?: string;
  onOpenCreateChannel: () => void;
  onOpenManageMembers: () => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  currentChannelId,
  onSelectChannel,
  channels,
  userRole,
  currentUserId,
  onOpenCreateChannel,
  onOpenManageMembers
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeChannel = channels.find(c => c.id === currentChannelId) || channels[0];
  const activeIndex = channels.findIndex(c => c.id === currentChannelId);
  // Realistic tactical VHF frequency (e.g. 142.850 MHz + 25kHz step per channel)
  const simulatedFreq = (142.850 + Math.max(0, activeIndex) * 0.125).toFixed(3);

  const isCommander = userRole === 'KOORDINATOR_KEAMANAN' || userRole === 'KETUA_PELAKSANA' || userRole === 'PEMBINA';

  const checkHasAccess = (ch: WorkspaceChannel): boolean => {
    // 1. Role Komando memiliki izin masuk ke seluruh frekuensi
    if (isCommander) return true;
    // 2. Saluran umum CH-01 terbuka untuk seluruh satgas keamanan
    if (ch.code === 'CH-01') return true;
    // 3. Saluran lain wajib terdaftar di assignedMembers
    if (!ch.assignedMembers || ch.assignedMembers.length === 0) return false;
    return ch.assignedMembers.some(m => m.profileId === currentUserId);
  };

  return (
    <div className="relative w-full max-w-md mx-auto px-4 mt-2">
      <div className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl shadow-sm flex items-center transition-colors group">
        {/* Area Frekuensi Saluran (Klik untuk buka daftar saluran) */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 p-2.5 flex items-center justify-between text-left truncate min-w-0"
        >
          <div className="flex items-center gap-2.5 truncate">
            <span className="text-xs font-bold font-mono-lcd px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-blue-500/30 shrink-0">
              {activeChannel ? activeChannel.code : 'CH-01'}
            </span>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {activeChannel ? activeChannel.name : 'Memuat Frekuensi...'}
                </span>
                <span className="text-[11px] text-cyan-400 font-mono-lcd font-semibold shrink-0">
                  {simulatedFreq} MHz
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono-lcd flex items-center gap-1">
                <UsersThree size={12} weight="bold" /> {activeChannel?.memberCount ?? 0} online
              </span>
            </div>
          </div>

          <div className="flex items-center text-slate-400 group-hover:text-cyan-300 transition-colors font-mono-lcd shrink-0 pl-2">
            <CaretDown
              size={13}
              weight="bold"
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Pemisah Taktis */}
        <div className="h-6 w-px bg-slate-800 shrink-0" />

        {/* Inline Icon Gerigi Pengaturan Personel Saluran */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenManageMembers();
          }}
          title="Kelola Personel Saluran Ini"
          className="p-2.5 px-3 text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-r-xl transition-all flex items-center justify-center shrink-0"
        >
          <GearSix size={17} weight="bold" />
        </button>
      </div>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150 text-slate-200">
          <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between items-center font-mono-lcd">
            <span>DAFTAR SALURAN FREKUENSI KITACALL</span>
            <span>{channels.length} SALURAN</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {channels.map((channel, idx) => {
              const isSelected = channel.id === currentChannelId;
              const chFreq = (142.850 + idx * 0.125).toFixed(3);
              const allowed = checkHasAccess(channel);

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => {
                    if (!allowed) {
                      alert(`Akses Ditolak: Anda belum ditugaskan oleh Koordinator di saluran ${channel.code} (${channel.name}).`);
                      return;
                    }
                    onSelectChannel(channel.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                    !allowed
                      ? 'opacity-40 hover:opacity-60 bg-slate-950/40 border border-slate-800/60 text-slate-500 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600/20 border border-cyan-400/60 text-white'
                      : 'hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      !allowed
                        ? 'bg-slate-900 text-slate-600 border border-slate-800'
                        : isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {!allowed ? (
                        <Lock size={16} weight="bold" />
                      ) : channel.category.includes('Command') ? (
                        <ShieldCheck size={16} weight="duotone" />
                      ) : channel.category.includes('Bridge') ? (
                        <PhoneCall size={16} weight="duotone" />
                      ) : (
                        <Radio size={16} weight="duotone" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-extrabold font-mono-lcd ${!allowed ? 'text-slate-500' : 'text-cyan-400'}`}>
                          {channel.code} // {chFreq} MHz
                        </span>
                        {!allowed && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            TERBATAS
                          </span>
                        )}
                      </div>
                      <h4 className={`text-xs font-bold truncate ${!allowed ? 'text-slate-500' : 'text-slate-200'}`}>
                        {channel.name}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2 font-mono-lcd">
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {channel.memberCount} PERS
                    </span>
                    {isSelected && (
                      <Check size={16} weight="bold" className="text-cyan-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tombol Tambah Channel Baru */}
          <div className="pt-1.5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreateChannel();
              }}
              className="w-full py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors border border-cyan-500/40"
            >
              <Plus size={15} weight="bold" />
              <span>+ Program Frekuensi Saluran Baru</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
