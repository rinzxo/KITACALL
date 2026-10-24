import React, { useState } from 'react';
import { X, Plus, Radio, Users, ShieldCheck, CheckSquare, Square } from '@phosphor-icons/react';
import type { WorkspaceMember } from '../../services/workspaceApi';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceMembers: WorkspaceMember[];
  onCreateChannel: (channelData: {
    code: string;
    name: string;
    category: string;
    description: string;
    initialMembers: { profileId: string; tacticalRole: string; posJaga: string }[];
  }) => Promise<void>;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  workspaceMembers,
  onCreateChannel
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Security Tactical Channel');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Record<string, { tacticalRole: string; posJaga: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const toggleMember = (profileId: string) => {
    setSelectedMembers(prev => {
      const next = { ...prev };
      if (next[profileId]) {
        delete next[profileId];
      } else {
        next[profileId] = {
          tacticalRole: 'ANGGOTA_KEAMANAN',
          posJaga: 'Patroli Lapangan'
        };
      }
      return next;
    });
  };

  const updateMemberRole = (profileId: string, role: string) => {
    setSelectedMembers(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        tacticalRole: role
      }
    }));
  };

  const updateMemberPos = (profileId: string, pos: string) => {
    setSelectedMembers(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        posJaga: pos
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMsg('Kode Frekuensi dan Nama Saluran wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const initialMembers = Object.entries(selectedMembers).map(([profileId, data]) => ({
        profileId,
        tacticalRole: data.tacticalRole,
        posJaga: data.posJaga
      }));

      await onCreateChannel({
        code: code.trim(),
        name: name.trim(),
        category,
        description: description.trim(),
        initialMembers
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat frekuensi baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl my-8 space-y-4 font-sans backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 text-cyan-400 flex items-center justify-center">
              <Radio size={22} weight="duotone" className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white font-tactical">
                Buat Saluran HT Baru
              </h3>
              <p className="text-xs text-slate-400 font-mono-lcd">
                Alokasikan frekuensi taktis untuk divisi atau kegiatan tertentu
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

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold font-mono-lcd">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-mono-lcd">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-extrabold text-slate-300 block mb-1 uppercase tracking-wider">
                Kode Saluran:
              </label>
              <input
                type="text"
                placeholder="mis. CH-04"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-cyan-400 uppercase tracking-wider transition-all"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-extrabold text-slate-300 block mb-1 uppercase tracking-wider">
                Nama Saluran:
              </label>
              <input
                type="text"
                placeholder="mis. Pos Gerbang Barat & Parkir"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs font-bold p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-cyan-400 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-300 block mb-1 uppercase tracking-wider">
              Kategori Saluran:
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-cyan-400 transition-all"
            >
              <option value="Security Tactical Channel" className="bg-slate-900 text-white">Security Tactical (Satgas Keamanan)</option>
              <option value="Command Bridge" className="bg-slate-900 text-white">Command Bridge (Pimpinan & Komando)</option>
              <option value="Medis / PMR" className="bg-slate-900 text-white">Medis & Pertolongan Pertama (PMR)</option>
              <option value="Logistik & Lapangan" className="bg-slate-900 text-white">Logistik & Konsumsi</option>
              <option value="Direct HT Bridge" className="bg-slate-900 text-white">Direct HT Bridge (Point-to-Point)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-300 block mb-1 uppercase tracking-wider">
              Deskripsi Tugas:
            </label>
            <input
              type="text"
              placeholder="mis. Koordinasi pengaturan arus lalu lintas dan kendaraan tamu"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-cyan-400 transition-all"
            />
          </div>

          {/* Member Assignment Section */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Users size={16} weight="duotone" className="text-cyan-400" />
                <span>Pilih Anggota Berkepentingan ({Object.keys(selectedMembers).length} dipilih):</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {workspaceMembers.length} anggota di workspace
              </span>
            </div>

            <div className="border border-slate-800 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-800/80 bg-slate-950/60">
              {workspaceMembers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Tidak ada anggota di workspace ini.
                </p>
              ) : (
                workspaceMembers.map((m) => {
                  const isChecked = !!selectedMembers[m.profileId];
                  return (
                    <div key={m.profileId} className="p-2.5 hover:bg-slate-900/60 transition-colors">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleMember(m.profileId)}
                          className="flex items-center gap-2 text-left truncate flex-1 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare size={18} weight="fill" className="text-cyan-400 shrink-0" />
                          ) : (
                            <Square size={18} weight="regular" className="text-slate-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate">
                              {m.fullName}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {m.email} • {m.orgRole}
                            </span>
                          </div>
                        </button>

                        {isChecked && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <select
                              value={selectedMembers[m.profileId].tacticalRole}
                              onChange={(e) => updateMemberRole(m.profileId, e.target.value)}
                              className="text-[10px] font-bold p-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-200"
                            >
                              <option value="ANGGOTA_KEAMANAN">Satgas</option>
                              <option value="KOORDINATOR_KEAMANAN">Komandan</option>
                              <option value="KETUA_PELAKSANA">Ketua Panitia</option>
                            </select>

                            <input
                              type="text"
                              placeholder="Pos Jaga"
                              value={selectedMembers[m.profileId].posJaga}
                              onChange={(e) => updateMemberPos(m.profileId, e.target.value)}
                              className="w-24 text-[10px] p-1 rounded-lg border border-slate-700 bg-slate-900 text-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0087FF] to-[#01C4FB] hover:from-[#0077E6] hover:to-[#00B5EA] text-white font-extrabold text-xs shadow-[0_0_20px_rgba(0,135,255,0.35)] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus size={16} weight="bold" />
              <span>{isSubmitting ? 'Membuat Saluran...' : 'Buat Saluran Taktis'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
