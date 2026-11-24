import { useState, useEffect } from 'react';
import { Microphone, Power } from '@phosphor-icons/react';
import type { FloorBroadcastState } from '../../hooks/useKitaComEngine';

interface GiantPTTButtonProps {
  floorState: FloorBroadcastState;
  isTransmitting: boolean;
  isReceiving: boolean;
  currentUserId: string;
  currentSocketId?: string;
  userRole: string;
  onStartTransmit: () => void;
  onStopTransmit: () => void;
  isDutyActive: boolean;
  onActivateDutyFirst: () => void;
}

export const GiantPTTButton: React.FC<GiantPTTButtonProps> = ({
  floorState,
  isTransmitting,
  isReceiving,
  currentUserId,
  currentSocketId,
  userRole,
  onStartTransmit,
  onStopTransmit,
  isDutyActive,
  onActivateDutyFirst
}) => {
  // PTT Mode: 'HOLD' (Tahan untuk bicara) vs 'LATCH' (Ketuk kunci bicara)
  const [pttMode, setPttMode] = useState<'HOLD' | 'LATCH'>('HOLD');
  const [latched, setLatched] = useState(false);
  const [totSecondsRemaining, setTotSecondsRemaining] = useState(60);

  const isCommander = userRole === 'KOORDINATOR_KEAMANAN' || userRole === 'KETUA_PELAKSANA';

  // Periksa apakah floor sedang dikunci perangkat lain (cocokkan socketId dan userId)
  const isChannelLockedByOther = floorState.status === 'LOCKED' && (
    floorState.speakerSocketId ? floorState.speakerSocketId !== currentSocketId : floorState.speakerId !== currentUserId
  );

  // Countdown timer saat transmisi aktif (TOT max 60s)
  useEffect(() => {
    let interval: any = null;
    if (isTransmitting) {
      setTotSecondsRemaining(60);
      interval = setInterval(() => {
        setTotSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTotSecondsRemaining(60);
      setLatched(false);
    }
    return () => clearInterval(interval);
  }, [isTransmitting]);

  // Safeguard: Bila window blur atau tab switch saat bicara, lepas transmisi
  useEffect(() => {
    const handleBlur = () => {
      if (isTransmitting) {
        onStopTransmit();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isTransmitting, onStopTransmit]);

  // Handle Pointer Events (Touch, Mouse, Pen) dengan PointerCapture anti slip
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    if (!isDutyActive) {
      onActivateDutyFirst();
      return;
    }

    if (pttMode === 'HOLD') {
      if (!isTransmitting && !isChannelLockedByOther) {
        onStartTransmit();
      }
    } else {
      // LATCH mode
      if (!latched) {
        setLatched(true);
        onStartTransmit();
      } else {
        setLatched(false);
        onStopTransmit();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (pttMode === 'HOLD' && isTransmitting) {
      onStopTransmit();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (pttMode === 'HOLD' && isTransmitting) {
      onStopTransmit();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center my-auto py-1 select-none">
      {/* 1. Status Pill Minimal */}
      <div className="mb-2 text-center">
        {isChannelLockedByOther ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/60 text-emerald-400 text-xs font-bold font-mono-lcd animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Menerima: {floorState.speakerName || 'Rekan'}</span>
          </div>
        ) : isTransmitting ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-500 text-rose-300 text-xs font-bold font-mono-lcd">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Mengudara ({totSecondsRemaining}s)</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono-lcd">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Frekuensi Bebas</span>
          </div>
        )}
      </div>

      {/* 2. Compact Ergonomic PTT Button */}
      <div className="relative flex items-center justify-center p-1">
        {/* Animated Expanding Radar Rings */}
        {isTransmitting && (
          <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-radar-ping pointer-events-none scale-105" />
        )}
        {isReceiving && (
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-radar-ping pointer-events-none scale-105" />
        )}

        {/* Outer Ring */}
        <div
          className={`w-52 h-52 sm:w-60 sm:h-60 rounded-full p-2.5 flex items-center justify-center transition-all duration-200 ${
            !isDutyActive
              ? 'bg-slate-900 border border-slate-800'
              : isTransmitting
              ? 'bg-slate-950 border-2 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.35)]'
              : isReceiving
              ? 'bg-slate-950 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
              : 'bg-slate-950 border-2 border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
          }`}
        >
          {/* Main Interactive Button Core */}
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            disabled={isChannelLockedByOther && !isCommander}
            style={{ touchAction: 'none' }}
            className={`w-full h-full rounded-full flex flex-col items-center justify-center p-4 text-white font-extrabold select-none transition-all duration-150 transform active:scale-95 cursor-pointer relative overflow-hidden border shadow-xl ${
              !isDutyActive
                ? 'bg-gradient-to-b from-slate-800 to-slate-950 border-slate-700'
                : isTransmitting
                ? 'bg-gradient-to-b from-red-600 to-rose-900 border-rose-400'
                : isReceiving
                ? 'bg-gradient-to-b from-emerald-600 to-emerald-950 border-emerald-400 cursor-not-allowed'
                : isChannelLockedByOther
                ? 'bg-slate-800 border-slate-700 cursor-not-allowed opacity-80'
                : 'bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 border-cyan-400/50 shadow-brand'
            }`}
          >
            {/* Audio Wave Visualizer Bars */}
            {isDutyActive && (isTransmitting || isReceiving) && (
              <div className="flex items-center gap-1.5 mb-2 h-6 z-10">
                <span className="w-1.5 bg-white rounded-full animate-audio-bar-1" />
                <span className="w-1.5 bg-white rounded-full animate-audio-bar-2" />
                <span className="w-1.5 bg-white rounded-full animate-audio-bar-3" />
                <span className="w-1.5 bg-white rounded-full animate-audio-bar-4" />
                <span className="w-1.5 bg-white rounded-full animate-audio-bar-5" />
              </div>
            )}

            {/* Central Icon */}
            {(!isTransmitting && !isReceiving) && (
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 z-10 ${
                !isDutyActive 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                  : 'bg-white/15 text-white'
              }`}>
                {!isDutyActive ? (
                  <Power size={30} weight="bold" />
                ) : (
                  <Microphone size={30} weight="duotone" className="text-cyan-300" />
                )}
              </div>
            )}

            {/* Button Label */}
            <span className="text-base sm:text-lg font-black tracking-wider uppercase text-center px-2 z-10 font-tactical">
              {!isDutyActive
                ? 'NYALAKAN SIAGA'
                : isTransmitting
                ? 'SEDANG BICARA'
                : isReceiving
                ? 'JALUR DIPAKAI'
                : isChannelLockedByOther
                ? 'MENUNGGU GILIRAN'
                : pttMode === 'HOLD'
                ? 'TAHAN BICARA'
                : latched
                ? 'KETUK SELESAI'
                : 'KETUK BICARA'}
            </span>

            <span className="text-[11px] font-mono-lcd text-cyan-200/80 mt-0.5 tracking-tight uppercase z-10">
              {!isDutyActive
                ? 'Klik Tombol SIAGA di Atas'
                : isTransmitting
                ? 'Lepas untuk Mengakhiri'
                : isReceiving
                ? (floorState.speakerName ? `${floorState.speakerName} Bicara` : 'Audio Masuk...')
                : isChannelLockedByOther
                ? 'Jalur Sedang Digunakan'
                : pttMode === 'HOLD'
                ? 'Push-to-Talk (PTT)'
                : 'Mode Kunci Transmisi'}
            </span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Footer: Hold vs Latch */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (isTransmitting) onStopTransmit();
            setPttMode('HOLD');
          }}
          className={`px-3 py-1 rounded-lg text-[11px] font-mono-lcd font-bold transition-all border ${
            pttMode === 'HOLD'
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-sm'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          TAHAN (HOLD)
        </button>
        <button
          type="button"
          onClick={() => {
            if (isTransmitting) onStopTransmit();
            setPttMode('LATCH');
          }}
          className={`px-3 py-1 rounded-lg text-[11px] font-mono-lcd font-bold transition-all border ${
            pttMode === 'LATCH'
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500/60 shadow-sm'
              : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          KUNCI (LATCH)
        </button>
      </div>
    </div>
  );
};
