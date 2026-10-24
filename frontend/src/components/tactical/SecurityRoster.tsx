import React, { useState } from 'react';
import { 
  Users, 
  SpeakerHigh, 
  WarningCircle, 
  BatteryHigh, 
  BatteryMedium, 
  BatteryLow, 
  CaretUp, 
  CaretDown,
  PhoneCall,
  ShieldCheck,
  UserCheck
} from '@phosphor-icons/react';
import type { ChannelMember } from '../../hooks/useKitaComEngine';

interface SecurityRosterProps {
  roster: ChannelMember[];
  currentUserId: string;
  onDirectCall?: (member: ChannelMember) => void;
}

export const SecurityRoster: React.FC<SecurityRosterProps> = ({
  roster,
  currentUserId,
  onDirectCall
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const readyCount = roster.filter(m => m.audioCtxState === 'running' && m.dutyMode).length;

  return (
    <div className="w-full max-w-md mx-auto px-4 mt-auto mb-3">
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-lg overflow-hidden transition-all duration-300">
        {/* Header Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/60 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 flex items-center justify-center font-bold">
              <Users size={18} weight="duotone" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Personel
              </span>
              <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 font-bold px-1.5 py-0.5 rounded font-mono-lcd">
                {readyCount}/{roster.length} Siaga
              </span>
            </div>
          </div>

          <div className="text-slate-400">
            {isExpanded ? <CaretDown size={18} weight="bold" /> : <CaretUp size={18} weight="bold" />}
          </div>
        </button>

        {/* Collapsible Roster Content */}
        {isExpanded && (
          <div className="px-4 pb-3 pt-1 border-t border-slate-800 space-y-2 max-h-56 overflow-y-auto">
            {roster.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3 font-mono-lcd">
                Tidak ada unit lain di frekuensi ini.
              </p>
            ) : (
              roster.map((member) => {
                const isMe = member.userId === currentUserId;
                const isReady = member.audioCtxState === 'running' && member.dutyMode;

                return (
                  <div
                    key={member.userId}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isMe 
                        ? 'bg-blue-950/40 border-cyan-500/50' 
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {/* Status Audio Indicator */}
                      <div 
                        title={isReady ? 'Siap Menerima Audio Paksa (Running)' : 'Audio Tidak Siap / App Terkunci'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isReady 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                            : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {isReady ? (
                          <SpeakerHigh size={15} weight="bold" />
                        ) : (
                          <WarningCircle size={15} weight="bold" />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">
                            {member.userName} {isMe && '(Anda)'}
                          </span>
                          {member.role === 'KOORDINATOR_KEAMANAN' && (
                            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40 font-extrabold px-1.5 py-0.2 rounded font-mono-lcd">
                              KOMANDAN
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate font-mono-lcd">
                          {member.posJaga || 'Patroli Lapangan'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono-lcd">
                      {/* Battery Indicator */}
                      {member.batteryLvl !== undefined && (
                        <div className="flex items-center gap-0.5 text-[10px] text-slate-400 font-medium">
                          {member.batteryLvl > 50 ? (
                            <BatteryHigh size={12} weight="duotone" className="text-emerald-400" />
                          ) : member.batteryLvl > 20 ? (
                            <BatteryMedium size={12} weight="duotone" className="text-amber-400" />
                          ) : (
                            <BatteryLow size={12} weight="duotone" className="text-rose-400" />
                          )}
                          <span>{member.batteryLvl}%</span>
                        </div>
                      )}

                      {/* Direct Call Button (if not me) */}
                      {!isMe && onDirectCall && (
                        <button
                          onClick={() => onDirectCall(member)}
                          title={`Panggil Langsung ke ${member.userName}`}
                          className="p-1.5 rounded-lg bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-500/40 transition-colors"
                        >
                          <PhoneCall size={13} weight="bold" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
