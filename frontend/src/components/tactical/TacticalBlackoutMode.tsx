import React, { useState, useEffect } from 'react';
import { LockKey, SpeakerHigh, Radio, ArrowRight } from '@phosphor-icons/react';
import type { FloorBroadcastState } from '../../hooks/useKitaComEngine';

interface TacticalBlackoutModeProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  floorState: FloorBroadcastState;
  isReceiving: boolean;
  batteryLevel?: number;
}

export const TacticalBlackoutMode: React.FC<TacticalBlackoutModeProps> = ({
  isOpen,
  onClose,
  channelId,
  floorState,
  isReceiving,
  batteryLevel
}) => {
  const [sliderPos, setSliderPos] = useState(0);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderPos(val);
    if (val >= 90) {
      if (navigator.vibrate) navigator.vibrate(50);
      onClose();
      setSliderPos(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-6 select-none animate-in fade-in duration-300">
      {/* Top minimal header */}
      <div className="flex items-center justify-between text-neutral-500 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-emerald-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold">OLED TACTICAL STANDBY</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{channelId}</span>
          {batteryLevel !== undefined && <span>{batteryLevel}%</span>}
        </div>
      </div>

      {/* Center Tactical Clock & Live State */}
      <div className="flex flex-col items-center justify-center my-auto space-y-4 text-center">
        <div className="text-5xl font-mono font-black text-neutral-300 tracking-wider">
          {timeStr}
        </div>

        <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 max-w-xs w-full">
          {isReceiving || (floorState.status === 'LOCKED') ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-rose-500 font-bold text-xs uppercase animate-pulse">
                <SpeakerHigh size={20} weight="fill" />
                <span>SUARA MASUK DARI:</span>
              </div>
              <div className="text-base font-extrabold text-white truncate">
                {floorState.speakerName || 'Petugas Lapangan'}
              </div>
              <p className="text-[10px] text-neutral-400">
                Mode Siaga mengangkat otomatis suara ke speaker
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs uppercase">
                <Radio size={16} weight="duotone" />
                <span>SIAGA MENDENGAR</span>
              </div>
              <p className="text-xs text-neutral-400">
                Layar OLED mati untuk hemat daya di saku rompi
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Slide to Unlock (Pocket Guard Protection) */}
      <div className="w-full max-w-xs mx-auto mb-4">
        <div className="relative bg-neutral-900 border border-neutral-800 rounded-full h-14 flex items-center px-2 overflow-hidden shadow-inner">
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-neutral-400 uppercase tracking-widest pointer-events-none">
            Geser Buka Kunci ➔
          </span>

          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={handleSliderChange}
            onMouseUp={() => setSliderPos(0)}
            onTouchEnd={() => setSliderPos(0)}
            className="w-full opacity-0 absolute inset-0 cursor-ew-resize z-20"
          />

          <div
            style={{ transform: `translateX(${sliderPos * 2.2}px)` }}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md transition-transform duration-75 z-10 pointer-events-none"
          >
            <LockKey size={18} weight="bold" />
          </div>
        </div>
      </div>
    </div>
  );
};
