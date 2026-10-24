import { useState, useEffect } from 'react';
import { Microphone, Lightning, LockKey, LockKeyOpen, Power } from '@phosphor-icons/react';
import type { FloorBroadcastState } from '../../hooks/useKitaComEngine';

interface GiantPTTButtonProps {
  floorState: FloorBroadcastState;
  isTransmitting: boolean;
  isReceiving: boolean;
  currentUserId: string;
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
  const isChannelLockedByOther = floorState.status === 'LOCKED' && floorState.speakerId !== currentUserId;

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
    }
    return () => clearInterval(interval);
  }, [isTransmitting]);

  // Handle Pointer Events (Touch, Mouse, Pen) secara seragam & tanpa ghost click
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    if (!isDutyActive) {
      onActivateDutyFirst();
      return;
    }

    if (pttMode === 'HOLD') {
      if (!isTransmitting) {
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

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pttMode === 'HOLD' && isTransmitting) {
      onStopTransmit();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    e.preventDefault();
    if (pttMode === 'HOLD' && isTransmitting) {
      onStopTransmit();
    }
  };

  // Commander Priority Override
  const handlePriorityOverride = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDutyActive) {
      onActivateDutyFirst();
    }
    onStartTransmit();
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center my-auto py-1">
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
            onPointerLeave={() => {
              if (pttMode === 'HOLD' && isTransmitting) {
                onStopTransmit();
              }
            }}
            disabled={isChannelLockedByOther && !isCommander}
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
                ? 'RADIO OFF'
                : isTransmitting
                ? 'BICARA...'
                : isReceiving
                ? 'MENERIMA'
                : isChannelLockedByOther
                ? 'TERISI'
                : 'TEKAN BICARA'}
            </span>

            {/* Sub-label */}
            <span className="text-[10px] text-white/80 font-mono-lcd mt-0.5 uppercase z-10">
              {!isDutyActive
                ? 'Ketuk untuk Siaga'
                : isTransmitting
                ? 'Lepas saat selesai'
                : isChannelLockedByOther
                ? 'Menunggu'
                : pttMode === 'HOLD' ? 'Tahan PTT' : 'Ketuk Kunci'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Commander Priority Override */}
      {isCommander && isChannelLockedByOther && (
        <button
          onClick={handlePriorityOverride}
          type="button"
          className="mt-2 px-4 py-1.5 rounded-xl bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-red-600 active:scale-95 transition-all font-mono-lcd shadow-md"
        >
          <Lightning size={14} weight="fill" className="text-yellow-300" />
          <span>Interupsi Komandan</span>
        </button>
      )}

      {/* 4. Mode Switcher (Hold vs Latch) */}
      <div className="mt-2 flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-mono-lcd">
        <button
          type="button"
          onClick={() => {
            setPttMode('HOLD');
            if (latched) {
              setLatched(false);
              onStopTransmit();
            }
          }}
          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
            pttMode === 'HOLD'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LockKeyOpen size={13} weight="bold" />
          <span>Hold</span>
        </button>

        <button
          type="button"
          onClick={() => setPttMode('LATCH')}
          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
            pttMode === 'LATCH'
              ? 'bg-blue-600 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LockKey size={13} weight="bold" />
          <span>Latch</span>
        </button>
      </div>
    </div>
  );
};
