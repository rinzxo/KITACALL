import React, { useState } from 'react';
import { X, Users, UserPlus, Trash, ShieldCheck, MapPin, Plus } from '@phosphor-icons/react';
import type { WorkspaceMember, WorkspaceChannel } from '../../services/workspaceApi';

interface ChannelMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: WorkspaceChannel | null;
  workspaceMembers: WorkspaceMember[];
  onAddMember: (memberData: {
    profileId: string;
    tacticalRole: string;
    posJaga: string;
    isPriority?: boolean;
  }) => Promise<void>;
  onRemoveMember: (profileId: string) => Promise<void>;
}

export const ChannelMembersModal: React.FC<ChannelMembersModalProps> = ({
  isOpen,
  onClose,
  channel,
  workspaceMembers,
  onAddMember,
  onRemoveMember
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [tacticalRole, setTacticalRole] = useState('ANGGOTA_KEAMANAN');
  const [posJaga, setPosJaga] = useState('Patroli Lapangan');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !channel) return null;

  // Filter members who are not yet in this channel
  const assignedProfileIds = new Set(channel.assignedMembers.map(m => m.profileId));
  const availableMembers = workspaceMembers.filter(m => !assignedProfileIds.has(m.profileId));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) return;

    try {
      setIsSubmitting(true);
      await onAddMember({
        profileId: selectedProfileId,
        tacticalRole,
        posJaga: posJaga.trim() || 'Patroli Lapangan'
      });
      setSelectedProfileId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl my-8 space-y-4 font-sans backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 flex items-center justify-center">
              <Users size={22} weight="duotone" className="text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-mono-lcd">
                <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-extrabold px-1.5 py-0.2 rounded uppercase">
                  {channel.code}
                </span>
                <h3 className="text-sm font-extrabold text-white truncate max-w-[200px] font-tactical">
                  {channel.name}
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono-lcd">
                Kelola personel yang bertugas di frekuensi ini ({channel.assignedMembers.length} Personel)
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

        {/* Form Tambah Personel ke Saluran Ini */}
        {availableMembers.length > 0 && (
          <form onSubmit={handleAdd} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-2.5 font-mono-lcd">
            <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block">
              + Tambahkan Personel dari Workspace:
            </span>

            <div>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-hidden focus:border-cyan-400 transition-all"
                required
              >
                <option value="" className="text-slate-400">Pilih Anggota ({availableMembers.length} tersedia)...</option>
                {availableMembers.map((m) => (
                  <option key={m.profileId} value={m.profileId} className="bg-slate-900 text-white">
                    {m.fullName} ({m.orgRole} - {m.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={tacticalRole}
                onChange={(e) => setTacticalRole(e.target.value)}
                className="text-xs font-bold p-2 rounded-xl border border-slate-800 bg-slate-900 text-white focus:outline-hidden focus:border-cyan-400 transition-all"
              >
                <option value="ANGGOTA_KEAMANAN">Satgas Keamanan</option>
                <option value="KOORDINATOR_KEAMANAN">Komandan (Priority)</option>
                <option value="KETUA_PELAKSANA">Ketua Panitia</option>
              </select>

              <input
                type="text"
                placeholder="Pos Jaga (mis. Pintu Masuk)"
                value={posJaga}
                onChange={(e) => setPosJaga(e.target.value)}
                className="text-xs font-medium p-2 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedProfileId}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-[#0087FF] to-[#01C4FB] hover:from-[#0077E6] hover:to-[#00B5EA] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,135,255,0.3)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <UserPlus size={15} weight="bold" />
              <span>{isSubmitting ? 'Menambahkan...' : 'Tugaskan ke Saluran Ini'}</span>
            </button>
          </form>
        )}

        {/* Daftar Personel Terdaftar di Channel */}
        <div className="space-y-2 font-mono-lcd">
          <span className="text-xs font-extrabold text-slate-300 block uppercase tracking-wider">
            Personel Bertugas ({channel.assignedMembers.length}):
          </span>

          <div className="border border-slate-800 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-800/80 bg-slate-950/60">
            {channel.assignedMembers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-5">
                Belum ada personel yang dialokasikan ke saluran ini.
              </p>
            ) : (
              channel.assignedMembers.map((member) => (
                <div key={member.profileId} className="p-2.5 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {member.fullName}
                      </span>
                      {member.tacticalRole === 'KOORDINATOR_KEAMANAN' ? (
                        <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800/60 font-extrabold px-1.5 py-0.2 rounded">
                          Komandan
                        </span>
                      ) : (
                        <span className="text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-extrabold px-1.5 py-0.2 rounded">
                          Satgas
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                      <MapPin size={10} weight="bold" className="text-cyan-400" />
                      {member.posJaga}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveMember(member.profileId)}
                    title="Hapus dari saluran"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash size={15} weight="bold" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-colors font-mono-lcd cursor-pointer"
        >
          Selesai
        </button>
      </div>
    </div>
  );
};
