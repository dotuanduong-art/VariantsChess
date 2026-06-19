'use client';

import { useState } from 'react';
import { VARIANTS_LIST, VariantData } from '../lib/variantsData';
import { motion } from 'framer-motion';

// Helper to get role accent colors
const getRoleColor = (role: string) => {
  switch (role.toLowerCase()) {
    case 'executor': return '#ef4444'; // Red
    case 'strategist': return '#3b82f6'; // Blue
    case 'disruptor': return '#a855f7'; // Purple
    case 'warden': return '#eab308'; // Yellow/Amber
    case 'trickster': return '#ec4899'; // Pink
    default: return '#cbd5e1';
  }
};

// Skill Icon Placeholder Generator
const getSkillIcon = (type: string, roleColor: string) => {
  const glyph = type === 'passive' ? 'P' : type === 's1' ? 'Ⅰ' : type === 's2' ? 'Ⅱ' : '★';
  const bg = `${roleColor}15`;
  const border = `${roleColor}35`;

  return (
    <div
      className="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 font-sans"
      style={{
        backgroundColor: bg,
        borderColor: border,
        color: roleColor,
        boxShadow: type === 'ultimate' ? `0 0 8px ${roleColor}40` : 'none'
      }}
    >
      {glyph}
    </div>
  );
};

// Redesigned Skill Card Component
interface SkillCardProps {
  name: string;
  description: string;
  cost?: number | string;
  type: 'passive' | 's1' | 's2' | 'ultimate';
  roleColor: string;
}

function SkillCard({ name, description, cost, type, roleColor }: SkillCardProps) {
  const isPassive = type === 'passive';
  const isUltimate = type === 'ultimate';
  const [isHovered, setIsHovered] = useState(false);

  // Card background: slightly lighter than page bg (#0b0c16), with custom ultimate tint
  const baseBg = isUltimate ? '#161329' : '#121426';
  
  // 1px border using role accent color at low opacity, brightens on hover
  const borderOpacity = isHovered ? '80' : isUltimate ? '50' : '20';
  const borderColor = `${roleColor}${borderOpacity}`;
  
  // Hover state: subtle glow
  const glowShadow = isUltimate
    ? `0 0 16px ${roleColor}${isHovered ? '35' : '15'}`
    : isHovered
      ? `0 0 10px ${roleColor}20`
      : 'none';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="p-4 rounded-xl flex flex-col gap-3 transition-all duration-300 h-full"
      style={{
        backgroundColor: baseBg,
        border: `1px solid ${borderColor}`,
        boxShadow: glowShadow,
      }}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between w-full">
        {/* Left Side: Icon + Name */}
        <div className="flex items-center gap-3">
          {getSkillIcon(type, roleColor)}
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-100 font-sans">
            {name}
          </span>
        </div>
        
        {/* Right Side: AP badge or Passive tag */}
        {isPassive ? (
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25 uppercase">
            Passive
          </span>
        ) : (
          <span 
            className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border"
            style={{
              backgroundColor: `${roleColor}15`,
              color: roleColor,
              borderColor: `${roleColor}30`
            }}
          >
            AP: {cost}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-[14px] leading-[1.6] text-[#aaa] font-sans">
        {description}
      </p>
    </div>
  );
}

interface VariantsViewerProps {
  onClose: () => void;
}

export default function VariantsViewer({ onClose }: VariantsViewerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedVariant, setSelectedVariant] = useState<VariantData>(VARIANTS_LIST[0]);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (key: string) => {
    setImgError((prev) => ({ ...prev, [key]: true }));
  };

  const filteredVariants = VARIANTS_LIST.filter((v) => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || v.role.toUpperCase() === selectedRole.toUpperCase();
    return matchesSearch && matchesRole;
  });

  const roles = ['ALL', 'EXECUTOR', 'STRATEGIST', 'DISRUPTOR', 'WARDEN', 'TRICKSTER'];
  const activeRoleColor = getRoleColor(selectedVariant.role);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0b0c16] text-[#cbd5e1] flex flex-col font-mono overflow-hidden z-30">
      {/* Background glowing effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#2a2b5e]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#5f3333]/15 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-[60px] border-b border-slate-800/80 px-8 flex items-center justify-between z-10 bg-[#0c0e1a]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-[#d8c39e] text-2xl font-bold tracking-widest uppercase">Variants Catalog</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded font-mono">System Database</span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-slate-700/60 rounded text-xs text-[#cbd5e1] hover:text-white hover:bg-slate-800/80 hover:border-slate-500 transition-colors font-bold uppercase cursor-pointer"
        >
          &lt; Back to Lobby
        </button>
      </header>

      {/* Main Viewer Area */}
      <div className="flex-1 flex min-h-0 z-10">
        
        {/* PANEL LEFT: Catalog (24% Width) */}
        <aside className="w-[24%] border-r border-slate-800/80 flex flex-col bg-[#080911]/80 backdrop-blur-sm p-3 min-w-[240px]">
          {/* Search bar */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search Variant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111322] border border-slate-700/60 rounded px-2.5 py-1.5 text-xs outline-none text-[#fcf5e5] placeholder-slate-600 focus:border-[#d8c39e] transition-colors"
            />
          </div>

          {/* Role Filters */}
          <div className="flex flex-col gap-1 mb-3 max-h-[140px] overflow-y-auto pr-1">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Filter by Role</span>
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`text-[9px] px-1.5 py-0.5 rounded transition-all border cursor-pointer ${
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
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Variants</span>
            {filteredVariants.length === 0 ? (
              <div className="text-center text-xs text-slate-600 italic py-8">No variants found</div>
            ) : (
              filteredVariants.map((v) => {
                const isSelected = selectedVariant.id === v.id;
                const roleColor = getRoleColor(v.role);
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between relative group cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a1c36] border-[#d8c39e]/50 shadow-[0_0_12px_rgba(216,195,158,0.15)]'
                        : 'bg-[#111324]/50 border-slate-800/80 hover:bg-[#151830] hover:border-slate-700'
                    }`}
                  >
                    {/* Active Left Accent Bar */}
                    {isSelected && (
                      <div
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                        style={{ backgroundColor: roleColor }}
                      />
                    )}

                    <div className="flex items-center gap-2.5 pl-1.5">
                      {/* Avatar circle 36px */}
                      <div className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800/40 flex items-center justify-center overflow-hidden shrink-0 relative bg-[#111322]">
                        {!imgError[`catalog_${v.id}`] ? (
                          <img
                            src={`/assets/variants/${v.id}.png`}
                            alt={v.name}
                            className="w-full h-full object-cover"
                            onError={() => handleImgError(`catalog_${v.id}`)}
                          />
                        ) : (
                          <span className="text-lg select-none">{v.artwork}</span>
                        )}
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isSelected ? 'text-[#e8c4a0]' : 'text-slate-300'}`}>
                          {v.name}
                        </div>
                        {/* Role label text is role color */}
                        <div className="text-[9px] font-semibold mt-0.5" style={{ color: roleColor }}>
                          {v.role}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL RIGHT: Showcase (76% Width) */}
        <main
          className="w-[76%] flex flex-col bg-[#0b0c16] relative overflow-hidden"
          style={{ borderTop: `3px solid ${activeRoleColor}` }}
        >
          {/* Custom style to hide scrollbar in the skills section */}
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>

          <motion.div
            key={selectedVariant.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full flex flex-col overflow-hidden"
          >
            {/* 1. Hero Section (Adjusted height to fit screen without scrolling) */}
            <div className="relative w-full h-[36vh] min-h-[250px] max-h-[340px] shrink-0 overflow-hidden select-none bg-[#0d0d14]">
              {/* Variant Image Background */}
              {!imgError[`showcase_${selectedVariant.id}`] ? (
                <img
                  src={`/assets/variants/${selectedVariant.id}.png`}
                  alt={selectedVariant.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: 'center 20%' }}
                  onError={() => handleImgError(`showcase_${selectedVariant.id}`)}
                />
              ) : (
                <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b1c3a]/30 to-[#111224]/30">
                  <span className="text-9xl select-none drop-shadow-[0_0_35px_rgba(216,195,158,0.15)] opacity-20">
                    {selectedVariant.artwork}
                  </span>
                </div>
              )}
              
              {/* Rebalanced Bottom Gradient Overlay */}
              <div 
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 20%, transparent 40%, rgba(13, 13, 20, 0.9) 85%, #0d0d14 100%)'
                }}
              />
              {/* Subtle vignette on the left edge so the image blends into the sidebar */}
              <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0d0d14] to-transparent z-10" />

              {/* Badges (Role + Difficulty) */}
              <div 
                className="absolute bottom-[86px] left-8 max-w-[60%] z-20 flex gap-2.5 items-center"
              >
                <span
                  className="text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold border"
                  style={{
                    borderColor: `${activeRoleColor}50`,
                    backgroundColor: `${activeRoleColor}15`,
                    color: activeRoleColor
                  }}
                >
                  {selectedVariant.role}
                </span>
                <span className="text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700/50 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                  Difficulty: {selectedVariant.difficulty}/5
                </span>
              </div>
              
              {/* Variant Name */}
              <h1 
                className="absolute bottom-[48px] left-8 max-w-[60%] z-20 text-3xl md:text-4xl font-black text-[#d8c39e] tracking-[0.2em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans leading-none"
              >
                {selectedVariant.name}
              </h1>

              {/* Description */}
              <p 
                className="absolute bottom-[12px] left-8 max-w-[60%] z-20 text-xs md:text-sm text-slate-200 leading-normal font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] line-clamp-2"
              >
                {selectedVariant.description}
              </p>
            </div>

            {/* 2. Skills Section (Scrollable, Starts Below Hero) */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-[#0d0d14] p-6 lg:p-8 flex flex-col gap-5 z-20">
              {/* Section Header with horizontal rule */}
              <div className="flex items-center gap-4 w-full">
                <span className="text-xs text-slate-400 uppercase tracking-widest font-bold whitespace-nowrap font-sans">
                  Abilities & Skills
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-700/50 to-transparent" />
              </div>
              
              {/* Balanced 2-Column Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch pb-6">
                {(() => {
                  const skillsList = [];
                  if (selectedVariant.passive) skillsList.push({ ...selectedVariant.passive, type: 'passive' });
                  if (selectedVariant.skill1) skillsList.push({ ...selectedVariant.skill1, type: 's1' });
                  if (selectedVariant.skill2) skillsList.push({ ...selectedVariant.skill2, type: 's2' });
                  if (selectedVariant.ultimate) skillsList.push({ ...selectedVariant.ultimate, type: 'ultimate' });

                  return skillsList.map((skill, idx) => {
                    let colSpan = 'lg:col-span-1';
                    
                    if (skillsList.length === 1) {
                      colSpan = 'lg:col-span-2';
                    } else if (skillsList.length === 3) {
                      if (idx === 0) colSpan = 'lg:col-span-2'; // Passive
                    } else if (skillsList.length === 4) {
                      if (idx === 0 || idx === 3) colSpan = 'lg:col-span-2'; // Passive or Ultimate
                    }

                    return (
                      <div key={skill.id} className={colSpan}>
                        <SkillCard
                          name={skill.name}
                          description={skill.description}
                          cost={skill.type !== 'passive' ? skill.cost : undefined}
                          type={skill.type as 'passive' | 's1' | 's2' | 'ultimate'}
                          roleColor={activeRoleColor}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
