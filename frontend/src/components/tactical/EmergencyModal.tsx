import React, { useState } from 'react';
import { Warning, X, Megaphone, Lightning } from '@phosphor-icons/react';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  channelId: string;
}

export const EmergencyModal: React.FC<EmergencyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  channelId
}) => {
  const [note, setNote] = useState('Panggilan Siaga 1 Keamanan: Seluruh Satgas Segera Merapat!');

  if (!isOpen) return null;

  const handleBroadcast = () => {
    onConfirm(note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 font-sans backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-400">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Warning size={20} weight="bold" className="text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white font-tactical">
                Peringatan Darurat (SOS)
              </h3>
              <p className="text-[11px] text-slate-400 font-mono-lcd">Saluran {channelId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Warning Info */}
        <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 text-rose-200 text-xs leading-relaxed">
          <p className="font-bold flex items-center gap-1.5 mb-1 text-rose-400">
            <Lightning size={16} weight="fill" className="text-rose-400" />
            Sirine &amp; Web Push Prioritas Tinggi
          </p>
          Tindakan ini akan memutar nada sirine berulang di semua perangkat aktif serta mengirim notifikasi getar panjang (SOS) ke HP personel.
        </div>

        {/* Input Pesan Darurat */}
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5 font-mono-lcd uppercase tracking-wider">
            Pesan Instruksi Cepat:
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium text-white placeholder-slate-600 transition-all"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 pt-1 font-mono-lcd">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleBroadcast}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Megaphone size={16} weight="bold" />
            <span>SIARKAN SOS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
