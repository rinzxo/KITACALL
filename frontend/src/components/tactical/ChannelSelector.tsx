import React, { useState } from 'react';
import { Key, Copy, Check, UsersThree, ArrowsClockwise } from '@phosphor-icons/react';

interface ChannelSelectorProps {
  currentChannelCode: string;
  currentChannelName: string;
  memberCount: number;
  onOpenPairingModal: () => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  currentChannelCode,
  currentChannelName,
  memberCount,
  onOpenPairingModal
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentChannelCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto px-4 mt-2">
      <div className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-sm flex items-center justify-between p-2.5 transition-colors">
        {/* Left: Channel Info & Click to Open Pairing Modal */}
        <button
          type="button"
          onClick={onOpenPairingModal}
          className="flex-1 flex items-center gap-2.5 truncate text-left cursor-pointer"
        >
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono-lcd px-2 py-0.5 rounded bg-blue-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                {currentChannelCode || 'CH-01'}
              </span>
              <span className="text-xs font-bold text-white truncate">
                {currentChannelName || `Saluran ${currentChannelCode}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono-lcd mt-0.5">
              <span className="flex items-center gap-1">
                <UsersThree size={12} weight="bold" /> {memberCount} Unit Aktif
              </span>
              <span>•</span>
              <span className="text-cyan-400 hover:underline">Ketuk untuk Ganti</span>
            </div>
          </div>
        </button>

        {/* Right Action: Copy Pairing Code & Switch Button */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {/* Bagikan / Salin Kode Button */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Salin Kode Pairing untuk dibagikan ke teman"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold font-mono-lcd flex items-center gap-1 transition-all border ${
              copied
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-cyan-300 hover:text-cyan-200'
            }`}
          >
            {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
            <span>{copied ? 'TERSALIN' : 'SALIN'}</span>
          </button>

          {/* Ganti / Pair Button */}
          <button
            type="button"
            onClick={onOpenPairingModal}
            title="Buka Menu Pairing Saluran"
            className="p-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-400 transition-colors cursor-pointer"
          >
            <Key size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
};
