'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { VARIANTS_LIST, VariantData } from '../lib/variantsData';
import { motion } from 'framer-motion';

export default function DraftScreen() {
  const {
    playerId,
    playerColor,
    draftEndTime,
    draftConfirmed,
    opponentConfirmed,
    selectVariant: storeSelectVariant,
    confirmVariant: storeConfirmVariant,
  } = useGameStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedVariant, setSelectedVariant] = useState<VariantData>(VARIANTS_LIST[0]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (key: string) => {
    setImgError((prev) => ({ ...prev, [key]: true }));
  };

  // Sync draft timer countdown
  useEffect(() => {
    if (!draftEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((draftEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [draftEndTime]);

  // Handle choosing a variant (only if not confirmed yet)
  const handleSelectVariant = (variant: VariantData) => {
    if (draftConfirmed) return;
    setSelectedVariant(variant);
    storeSelectVariant(variant.id);
  };

  // Handle confirming choice
  const handleConfirm = () => {
    if (draftConfirmed) return;
    storeConfirmVariant();
  };

  const filteredVariants = VARIANTS_LIST.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || v.role.toUpperCase() === selectedRole.toUpperCase();
    return matchesSearch && matchesRole;
  });

  const roles = ['ALL', 'EXECUTOR', 'STRATEGIST', 'DISRUPTOR', 'WARDEN', 'TRICKSTER'];

  const renderStars = (difficulty: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < difficulty ? 'text-yellow-400' : 'text-slate-600'}>
        ★
      </span>
    ));
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0b0c16] text-[#cbd5e1] flex flex-col font-mono overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#2a2b5e]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#5f3333]/15 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-[60px] border-b border-slate-800/80 px-8 flex items-center justify-between z-10 bg-[#0c0e1a]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-[#d8c39e] text-2xl font-bold tracking-widest uppercase">Variant Draft</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded font-mono">1v1 Draft Mode</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-widest">Connected as</div>
            <div className="text-sm font-semibold text-slate-300">{playerColor === 'White' ? 'White Player (Host)' : 'Black Player (Guest)'}</div>
          </div>
        </div>
      </header>

      {/* Main Draft Area */}
      <div className="flex-1 flex min-h-0 z-10">
        
        {/* PANEL LEFT: Catalog (20% Width) */}
        <aside className="w-[20%] border-right border-slate-800/80 flex flex-col bg-[#080911]/80 backdrop-blur-sm p-4 min-w-[240px]">
          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search Variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111322] border border-slate-700/60 rounded px-3 py-2 text-xs outline-none text-[#fcf5e5] placeholder-slate-600 focus:border-[#d8c39e] transition-colors"
            />
          </div>

          {/* Role Filters */}
          <div className="flex flex-col gap-1.5 mb-4 max-h-[160px] overflow-y-auto pr-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Filter by Role</span>
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`text-[10px] px-2 py-1 rounded transition-all border ${
                    selectedRole === role
                      ? 'bg-[#d8c39e] text-black border-[#d8c39e] font-bold'
                      : 'bg-[#121424]/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-[#181b30]'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Variant Grid */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Variants</span>
            {filteredVariants.length === 0 ? (
              <div className="text-center text-xs text-slate-600 italic py-8">No variants found</div>
            ) : (
              filteredVariants.map((v) => {
                const isSelected = selectedVariant.id === v.id;
                return (
                  <button
                    key={v.id}
                    disabled={draftConfirmed}
                    onClick={() => handleSelectVariant(v)}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between relative group ${
                      isSelected
                        ? 'bg-[#1a1c36] border-[#d8c39e] shadow-[0_0_12px_rgba(216,195,158,0.2)]'
                        : 'bg-[#111324]/50 border-slate-800/80 hover:bg-[#151830] hover:border-slate-700'
                    } ${draftConfirmed ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded border border-slate-700 bg-slate-800/40 flex items-center justify-center overflow-hidden shrink-0 relative bg-[#111322]">
                        {!imgError[`catalog_${v.id}`] ? (
                          <img
                            src={`/assets/variants/${v.id}.png`}
                            alt={v.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImgError(`catalog_${v.id}`)}
                          />
                        ) : (
                          <span className="text-xl select-none">{v.artwork}</span>
                        )}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? 'text-[#e8c4a0]' : 'text-slate-300'}`}>
                          {v.name}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{v.role}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-[#d8c39e] font-bold">●</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL CENTER: Showcase (55% Width) */}
        <main className="w-[55%] flex flex-col bg-[#0b0c16]/50 p-6 overflow-y-auto">
          <motion.div
            key={selectedVariant.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Full-bleed Hero Image Banner with responsive heights */}
            <div className="relative w-[calc(100%+48px)] mx-[-24px] mt-[-24px] h-[40vh] lg:h-[55vh] min-h-[350px] lg:min-h-[500px] shadow-2xl group overflow-hidden flex items-end">
              {/* Variant Image Background */}
              {!imgError[`showcase_${selectedVariant.id}`] ? (
                <img
                  src={`/assets/variants/${selectedVariant.id}.png`}
                  alt={selectedVariant.name}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  onError={() => handleImgError(`showcase_${selectedVariant.id}`)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1b1c3a] to-[#111224]">
                  <span className="text-7xl md:text-8xl select-none drop-shadow-[0_0_35px_rgba(216,195,158,0.2)]">{selectedVariant.artwork}</span>
                </div>
              )}
              {/* Dark gradient overlay blending to background */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c16] via-[#0b0c16]/85 to-transparent pointer-events-none z-10" />
              
              {/* Overlay Content: Badges + Title + Description */}
              <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-3.5 z-20">
                <div className="flex gap-2">
                  <span className="text-[10px] bg-slate-900/95 text-[#d8c39e] border border-[#d8c39e]/30 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                    {selectedVariant.role}
                  </span>
                  <span className="text-[10px] bg-slate-900/95 text-slate-300 border border-slate-700/60 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                    Difficulty: {selectedVariant.difficulty}/5
                  </span>
                </div>
                
                <div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-[#d8c39e] mb-2 tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {selectedVariant.name}
                  </h1>
                  <p className="text-xs md:text-sm text-slate-200 leading-relaxed max-w-2xl font-mono line-clamp-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                    {selectedVariant.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Skills Showcase */}
            <div className="flex flex-col gap-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Abilities & Skills</span>
              
              {/* Responsive columns matching center panel width */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Passive */}
                <div className="bg-[#111322]/80 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm hover:border-slate-700 transition-colors h-full">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Passive: {selectedVariant.passive.name}</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Passive</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{selectedVariant.passive.description}</p>
                  </div>
                </div>

                {/* Skill 1 */}
                <div className="bg-[#111322]/80 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm hover:border-slate-700 transition-colors h-full">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <span className="text-xs font-bold text-[#cbd5e1] uppercase tracking-wider">S1: {selectedVariant.skill1.name}</span>
                      <span className="text-[9px] bg-blue-900/60 text-[#8888ff] px-1.5 py-0.5 rounded font-bold">AP: {selectedVariant.skill1.cost}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{selectedVariant.skill1.description}</p>
                  </div>
                </div>

                {/* Skill 2 */}
                <div className="bg-[#111322]/80 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm hover:border-slate-700 transition-colors h-full">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <span className="text-xs font-bold text-[#cbd5e1] uppercase tracking-wider">S2: {selectedVariant.skill2.name}</span>
                      <span className="text-[9px] bg-blue-900/60 text-[#8888ff] px-1.5 py-0.5 rounded font-bold">AP: {selectedVariant.skill2.cost}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{selectedVariant.skill2.description}</p>
                  </div>
                </div>

                {/* Ultimate */}
                <div className="bg-[#1b1222]/80 border border-[#b24acc]/30 p-4 rounded-xl flex flex-col justify-between gap-1.5 shadow-sm hover:border-[#b24acc]/50 transition-colors h-full">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                      <span className="text-xs font-bold text-[#ff88ff] uppercase tracking-wider">ULTIMATE: {selectedVariant.ultimate.name}</span>
                      <span className="text-[9px] bg-purple-900/60 text-[#ff88ff] px-1.5 py-0.5 rounded font-bold">AP: {selectedVariant.ultimate.cost}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{selectedVariant.ultimate.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </main>

        {/* PANEL RIGHT: Draft Info (25% Width) */}
        <aside className="w-[25%] border-l border-slate-800/80 flex flex-col justify-between p-6 bg-[#080911]/80 backdrop-blur-sm min-w-[260px]">
          {/* Top segment: Timer and selection summary */}
          <div className="flex flex-col gap-6">
            {/* Timer circle container */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#111324]/80 border border-slate-800/80 rounded-2xl relative shadow-md">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">DRAFT TIMER</div>
              <div className={`text-5xl font-bold font-mono tracking-wider ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-[#d8c39e]'}`}>
                {timeLeft}s
              </div>
              {/* Radial loading background */}
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-ping" />
            </div>

            {/* Selection Summary */}
            <div className="flex flex-col gap-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Draft Status</span>
              
              {/* You selection status */}
              <div className="bg-[#111322] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">YOUR SELECTION</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{selectedVariant.name}</div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${draftConfirmed ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-yellow-950 text-yellow-500 border border-yellow-800'}`}>
                    {draftConfirmed ? 'LOCKED' : 'SELECTING'}
                  </span>
                </div>
              </div>

              {/* Opponent selection status */}
              <div className="bg-[#111322] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500">OPPONENT STATUS</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">Hidden Variant</div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${opponentConfirmed ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-yellow-950 text-yellow-500 border border-yellow-800'}`}>
                    {opponentConfirmed ? 'LOCKED' : 'SELECTING'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom segment: Confirm Action */}
          <div className="flex flex-col gap-3">
            <div className="text-[10px] text-slate-600 text-center uppercase tracking-wide leading-relaxed">
              Selection will be automatically locked and validated when timer expires.
            </div>
            
            <button
              onClick={handleConfirm}
              disabled={draftConfirmed}
              className={`w-full py-4 rounded-xl border-2 font-bold tracking-widest transition-all text-sm uppercase ${
                draftConfirmed
                  ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed scale-98 shadow-none'
                  : 'bg-[#d8c39e] text-black border-[#d8c39e] hover:bg-[#bda57b] hover:border-[#bda57b] hover:scale-102 active:scale-95 shadow-[0_4px_20px_rgba(216,195,158,0.15)] cursor-pointer'
              }`}
            >
              {draftConfirmed ? 'Choice Locked' : 'Confirm Choice'}
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}
