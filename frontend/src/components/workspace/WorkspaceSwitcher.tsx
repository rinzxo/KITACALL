import React, { useState } from 'react';
import { Buildings, CaretDown, Check, TreeStructure, Plus } from '@phosphor-icons/react';
import type { WorkspaceItem } from '../../services/workspaceApi';

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceItem[];
  activeWorkspace: WorkspaceItem | null;
  onSelectWorkspace: (ws: WorkspaceItem) => void;
  isLoading?: boolean;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  isLoading
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative w-full max-w-md mx-auto px-4 mt-2">
      {/* Workspace Switcher Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-[10px] text-slate-500 uppercase font-mono-lcd">Divisi:</span>
          <span className="text-xs font-bold text-white truncate">
            {activeWorkspace ? activeWorkspace.name : 'Memuat...'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono-lcd shrink-0">
          <span>Ganti ({workspaces.length})</span>
          <CaretDown
            size={12}
            weight="bold"
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <div className="absolute left-4 right-4 top-full mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 py-1.5 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 text-slate-200 font-mono-lcd">
          <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
            <span>DAFTAR WORKSPACE KITACALL</span>
            <span>{workspaces.length} UNIT</span>
          </div>

          <div className="p-1 space-y-0.5">
            {workspaces.map((ws) => {
              const isSelected = ws.id === activeWorkspace?.id;
              return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(ws);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 border border-cyan-400/60 text-white font-bold'
                      : 'hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {ws.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold block truncate text-slate-100">{ws.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate">/{ws.slug}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={16} weight="bold" className="text-cyan-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
