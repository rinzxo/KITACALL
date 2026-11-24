import React, { useState } from 'react';
import { 
  X, 
  Key, 
  Plus, 
  Broadcast, 
  Trash, 
  Check, 
  Copy, 
  UsersThree, 
  ClockCounterClockwise,
  ArrowRight
} from '@phosphor-icons/react';
import { workspaceApi } from '../../services/workspaceApi';

export interface SavedChannel {
  code: string;
  name: string;
  lastJoined: number;
}

interface PairingChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChannelCode: string;
  currentChannelName: string;
  savedChannels: SavedChannel[];
  onSelectChannel: (channel: { code: string; name: string }) => void;
  onRemoveSavedChannel: (code: string) => void;
  userId?: string;
}

export const PairingChannelModal: React.FC<PairingChannelModalProps> = ({
  isOpen,
  onClose,
  currentChannelCode,
  currentChannelName,
  savedChannels,
  onSelectChannel,
  onRemoveSavedChannel,
  userId
}) => {
  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [joinCode, setJoinCode] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Handle Join by Pairing Code
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!cleanCode) {
      setErrorMsg('Masukkan kode pairing saluran yang valid.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      const channel = await workspaceApi.getPairingChannel(cleanCode);
      onSelectChannel({
        code: channel.code,
        name: channel.name || `Saluran ${channel.code}`
      });
      onClose();
    } catch (err: any) {
      // Fallback: Langsung buat / masuk frekuensi tersebut
      onSelectChannel({
        code: cleanCode,
        name: `Saluran ${cleanCode}`
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Create Channel
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) {
      setErrorMsg('Nama saluran wajib diisi.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      const channel = await workspaceApi.createPairingChannel(
        newChannelName.trim(), 
        customCode.trim() ? customCode.trim() : undefined,
        userId
      );

      onSelectChannel({
        code: channel.code,
        name: channel.name
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat saluran.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCurrentCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentChannelCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col font-sans select-none">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <Key size={20} weight="duotone" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide font-tactical">
                PAIRING SALURAN KITACALL
              </h3>
              <p className="text-[11px] text-slate-400 font-mono-lcd">
                Terhubung antar perangkat via Pairing Code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Current Active Channel Banner */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-mono-lcd block">Saluran Aktif Saat Ini:</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-white">{currentChannelName}</span>
              <span className="text-xs font-black font-mono-lcd px-2 py-0.5 rounded-md bg-blue-500/20 text-cyan-300 border border-cyan-500/40">
                {currentChannelCode}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={copyCurrentCode}
            title="Salin Kode Pairing untuk dibagikan ke teman"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold font-mono-lcd transition-all"
          >
            {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
            <span>{copied ? 'TERSALIN' : 'BAGIKAN'}</span>
          </button>
        </div>

        {/* Tab Buttons: Gabung vs Buat Baru */}
        <div className="px-5 pt-3 flex gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('JOIN'); setErrorMsg(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono-lcd transition-all border flex items-center justify-center gap-1.5 ${
              activeTab === 'JOIN'
                ? 'bg-blue-600/30 border-cyan-400 text-white shadow-sm'
                : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key size={15} weight="bold" />
            <span>GABUNG KODE</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('CREATE'); setErrorMsg(''); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold font-mono-lcd transition-all border flex items-center justify-center gap-1.5 ${
              activeTab === 'CREATE'
                ? 'bg-blue-600/30 border-cyan-400 text-white shadow-sm'
                : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={15} weight="bold" />
            <span>BUAT SALURAN</span>
          </button>
        </div>

        {/* Tab 1: Gabung via Pairing Code */}
        {activeTab === 'JOIN' && (
          <form onSubmit={handleJoin} className="px-5 py-3 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 font-mono-lcd">
                MASUKKAN PAIRING CODE:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Contoh: KT-8492 atau CH-01"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-mono-lcd font-bold text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 uppercase tracking-wider"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono-lcd">
                Minta kode pairing dari rekan Anda yang sudah membuat saluran.
              </p>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 font-medium font-mono-lcd bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !joinCode.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-2 font-tactical shadow-lg cursor-pointer"
            >
              <span>{isLoading ? 'Menghubungkan...' : 'Gabung Saluran'}</span>
              <ArrowRight size={16} weight="bold" />
            </button>
          </form>
        )}

        {/* Tab 2: Buat Saluran Baru */}
        {activeTab === 'CREATE' && (
          <form onSubmit={handleCreate} className="px-5 py-3 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 font-mono-lcd">
                NAMA SALURAN:
              </label>
              <input
                type="text"
                placeholder="Contoh: Tim Patroli Lapangan"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1 font-mono-lcd flex items-center justify-between">
                <span>KODE PAIRING KHUSUS (OPSIONAL):</span>
                <span className="text-[10px] text-slate-500">Otomatis jika dikosongkan</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: KITA-ALFA (atau kosongkan)"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono-lcd font-bold text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 uppercase tracking-wider"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 font-medium font-mono-lcd bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !newChannelName.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-2 font-tactical shadow-lg cursor-pointer"
            >
              <span>{isLoading ? 'Membuat Saluran...' : 'Buat & Dapatkan Kode'}</span>
              <Broadcast size={16} weight="bold" />
            </button>
          </form>
        )}

        {/* Saluran Tersimpan / Riwayat */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono-lcd flex items-center gap-1">
              <ClockCounterClockwise size={13} weight="bold" />
              SALURAN TERSIMPAN / TERAKHIR:
            </span>
            <span className="text-[10px] text-slate-500 font-mono-lcd">
              {savedChannels.length} Saluran
            </span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
            {savedChannels.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-2 font-mono-lcd">
                Belum ada saluran tersimpan.
              </p>
            ) : (
              savedChannels.map((chan) => {
                const isCurrent = chan.code === currentChannelCode;
                return (
                  <div
                    key={chan.code}
                    className={`p-2 rounded-xl border flex items-center justify-between text-left transition-all ${
                      isCurrent
                        ? 'bg-blue-600/20 border-cyan-400/60 text-white'
                        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectChannel({ code: chan.code, name: chan.name });
                        onClose();
                      }}
                      className="flex-1 flex items-center gap-2 truncate text-left"
                    >
                      <span className="text-[11px] font-mono-lcd font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                        {chan.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {chan.name}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isCurrent ? (
                        <span className="text-[10px] font-bold text-cyan-400 font-mono-lcd px-1.5 py-0.5 bg-cyan-950 rounded">
                          AKTIF
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSavedChannel(chan.code);
                          }}
                          title="Hapus dari riwayat"
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

