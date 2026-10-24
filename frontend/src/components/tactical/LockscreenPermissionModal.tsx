import React, { useState } from 'react';
import { Microphone, BellRinging, ShieldCheck, CheckCircle, Warning, PlayCircle, X } from '@phosphor-icons/react';

interface LockscreenPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivate: () => Promise<void>;
}

export const LockscreenPermissionModal: React.FC<LockscreenPermissionModalProps> = ({
  isOpen,
  onClose,
  onActivate
}) => {
  const [isActivating, setIsActivating] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  if (!isOpen) return null;

  const isNotificationGranted = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';

  const handleGrant = async () => {
    // ⚡ KUNCI UTAMA MOBILE GESTURE: Jalankan play() anchor audio di baris PERTAMA klik sebelum await apa pun!
    const domAnchor = document.getElementById('kitacall-lockscreen-anchor') as HTMLAudioElement;
    if (domAnchor) {
      domAnchor.volume = 0.5;
      domAnchor.play().catch(e => console.warn('[KitaCall] Immediate anchor play error:', e));
    }

    setIsActivating(true);
    setStatusText('Mengaktifkan kendali lockscreen & transceiver...');

    try {
      // 1. Minta Izin Notifikasi jika belum
      if ('Notification' in window && Notification.permission !== 'granted') {
        setStatusText('Menunggu persetujuan Notifikasi...');
        await Notification.requestPermission();
      }

      // 2. Jalankan aktivasi engine (Microphone + Audio Anchor + MediaSession)
      setStatusText('Menghubungkan transceiver & widget lockscreen...');
      await onActivate();

      setStatusText('Berhasil! Kunci layar HP Anda untuk menguji.');
      setTimeout(() => {
        setIsActivating(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.warn('[Lockscreen Permission Error]:', err);
      setStatusText('Gagal mengaktifkan. Pastikan memilih "Izinkan" pada popup browser.');
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-sm w-full p-6 shadow-[0_0_40px_rgba(0,210,255,0.2)] text-white space-y-4 font-sans relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <BellRinging size={22} weight="duotone" className="text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-white font-tactical">
                Kendali Layar Kunci HP
              </h3>
              <p className="text-[11px] text-cyan-400 font-mono-lcd">
                Transceiver Ala Spotify
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Status Izin Badge */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono-lcd">
          <span className="text-slate-400">Status Izin Browser:</span>
          <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 ${
            isNotificationGranted 
              ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-300' 
              : 'bg-amber-950 border border-amber-500/50 text-amber-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isNotificationGranted ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            {isNotificationGranted ? 'SUDAH DIIZINKAN' : 'BELUM DIIZINKAN'}
          </span>
        </div>

        {/* Petunjuk Penggunaan */}
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-cyan-900/40 space-y-2 text-xs font-mono-lcd text-slate-300 leading-relaxed">
          <p>
            Setelah aktif, widget radio <b>KitaCall</b> akan muncul di <b>Lockscreen &amp; Notifikasi HP</b> dengan tombol:
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 flex items-center gap-1.5 font-bold">
              <span>🎙️</span>
              <span>Buka/Tutup Mic</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-300 flex items-center gap-1.5 font-bold">
              <span>⏭️</span>
              <span>Ganti Saluran</span>
            </div>
          </div>
        </div>

        {/* Panduan Spesifik Android */}
        <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[10.5px] font-mono-lcd text-slate-400 space-y-1">
          <p className="text-slate-300 font-bold flex items-center gap-1">
            <ShieldCheck size={13} weight="fill" className="text-cyan-400" />
            Tips jika belum tampil di Layar Kunci HP:
          </p>
          <p className="leading-snug">
            Buka <b>Pengaturan HP &gt; Aplikasi &gt; Chrome &gt; Notifikasi</b>, pastikan opsi <b>"Tampilkan di Layar Kunci"</b> aktif.
          </p>
        </div>

        {statusText && (
          <p className="text-[11px] text-center font-bold text-amber-300 font-mono-lcd animate-pulse">
            {statusText}
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleGrant}
          disabled={isActivating}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0087FF] to-[#01C4FB] hover:from-[#0077E6] hover:to-[#00B5EA] text-white font-extrabold text-xs shadow-[0_0_25px_rgba(0,135,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 font-tactical tracking-wider"
        >
          <BellRinging size={18} weight="bold" />
          <span>
            {isActivating 
              ? 'MENGAKTIFKAN...' 
              : isNotificationGranted 
                ? 'AKTIFKAN & UJI DI LOCKSCREEN' 
                : 'IZINKAN & AKTIFKAN SEKARANG'}
          </span>
        </button>
      </div>
    </div>
  );
};
