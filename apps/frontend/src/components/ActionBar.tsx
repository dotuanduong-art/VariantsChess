'use client';

import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { VARIANTS_LIST, SkillInfo } from '../lib/variantsData';
import { Board as BoardClass, Color } from 'game-core';
import { getSocket } from '../lib/socket';

export default function ActionBar() {
  const {
    roomCode,
    playerId,
    playerColor,
    whiteVariantId,
    blackVariantId,
    whiteAP,
    blackAP,
    turnNumber,
    hasMoved,
    skillsUsedThisTurn,
    currentTurn,
    variantState,
    board,
    activeSkillId,
    endTurn,
    keybindings,
    setSkillDetail,
    targetSelectionMode,
    selectSkill,
    cancelSkill,
    availableSkillTargets,
    currentRequirementIndex,
    graveyard,
  } = useGameStore();

  const [hoveredSkill, setHoveredSkill] = useState<SkillInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const skillSectionRef = useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (key: string) => {
    setImgError((prev) => ({ ...prev, [key]: true }));
  };

  // Setup Yours vs Opponent mapping
  const isWhite = playerColor === Color.White;
  const yourVariantId = isWhite ? whiteVariantId : blackVariantId;
  const yourVariant = VARIANTS_LIST.find((v) => v.id === yourVariantId) || VARIANTS_LIST[0];
  const yourAP = isWhite ? whiteAP : blackAP;

  const getSkill1Cost = () => {
    if (yourVariantId === 'guardian') {
      const lostCount = (graveyard || []).filter((e: any) => e.piece.color === playerColor).length;
      return lostCount >= 8 ? 2 : 4;
    }
    return Number(yourVariant.skill1.cost);
  };
  const skill1Cost = getSkill1Cost();

  console.log('ActionBar state check:', { playerColor, isWhite, yourVariantId, yourAP, whiteAP, blackAP, turnNumber, hasMoved, skillsUsedThisTurn, currentTurn });

  // Check if this variant has a real passive (not just a placeholder)
  const hasPassive = yourVariant.passive && yourVariant.passive.cost === 'None' && yourVariant.passive.targetType === 'Passive';

  // Determine Turn Status Indicator
  const isMyTurn = currentTurn === playerColor;
  let turnStatus = 'WAITING FOR OPPONENT';
  let statusColor = 'text-slate-500 bg-slate-950/60 border-slate-900';

  if (isMyTurn) {
    if (!hasMoved) {
      turnStatus = 'MOVE REQUIRED';
      statusColor = 'text-red-400 bg-red-950/20 border-red-900/40 animate-pulse';
    } else if (skillsUsedThisTurn < 1) {
      turnStatus = 'SKILL AVAILABLE';
      statusColor = 'text-yellow-400 bg-yellow-950/20 border-yellow-900/40';
    } else {
      turnStatus = 'READY TO END TURN';
      statusColor = 'text-green-400 bg-green-950/20 border-green-900/40';
    }
  }

  // Dynamic Resource lookup
  const getResourceValue = () => {
    if (!yourVariantId) return null;
    if (yourVariantId === 'zombie') return `${variantState.zombieCount ?? 2}/5`;
    if (yourVariantId === 'kaze') return `${variantState.kunaiCount ?? 4}/6`;
    if (yourVariantId === 'dynamite') return `${variantState.bombCount ?? 0}`;
    if (yourVariantId === 'magician') return `${variantState.domainCount ?? 0}`;
    if (yourVariantId === 'guardian') return `${variantState.shieldCount ?? 0}`;
    if (yourVariantId === 'ruler') return `Law ${variantState.lawActive ?? 1}`;
    if (yourVariantId === 'angel') {
      return variantState[`judgmentWindowActive_${playerColor}`] ? `Jdg ${variantState[`judgmentWindowRemainingTurns_${playerColor}`]}` : null;
    }
    
    if (yourVariantId === 'lightning') {
      if (!board) return '0';
      try {
        const boardClass = BoardClass.fromSerializable(board);
        const cellEffects = boardClass.getAllCellEffects();
        let trapCount = 0;
        for (const list of cellEffects.values()) {
          if (list.some((e: any) => e.type === 'thunder_trap' && e.sourcePlayer === playerColor)) {
            trapCount++;
          }
        }
        return `${trapCount}`;
      } catch (err) {
        return '0';
      }
    }
    return null;
  };

  const resourceValue = getResourceValue();

  // Cooldown tracking variables
  const skill1CooldownTurns = variantState?.cooldowns?.[yourVariant.skill1.id] || 0;
  const isSkill1Cooldown = skill1CooldownTurns > 0;

  const skill2CooldownTurns = variantState?.cooldowns?.[yourVariant.skill2.id] || 0;
  const isSkill2Cooldown = skill2CooldownTurns > 0;

  const ultCooldownTurns = variantState?.cooldowns?.[yourVariant.ultimate.id] || 0;
  const isUltCooldown = ultCooldownTurns > 0;

  const isSkill1Available = isMyTurn && !isSkill1Cooldown && yourAP >= skill1Cost && skillsUsedThisTurn < 1 && (!targetSelectionMode || activeSkillId === yourVariant.skill1.id);
  const isSkill2Available = isMyTurn && !isSkill2Cooldown && yourAP >= Number(yourVariant.skill2.cost) && skillsUsedThisTurn < 1 && (!targetSelectionMode || activeSkillId === yourVariant.skill2.id);
  const isUltAvailable = isMyTurn && !isUltCooldown && yourAP >= Number(yourVariant.ultimate.cost) && skillsUsedThisTurn < 1 && (!targetSelectionMode || activeSkillId === yourVariant.ultimate.id);

  // Handler for skill selection/activation
  const handleSkillClick = (skillId: string, apCost: number) => {
    const isSkill1 = skillId === yourVariant.skill1.id;
    const isSkill2 = skillId === yourVariant.skill2.id;

    const isCooldown = isSkill1 ? isSkill1Cooldown : isSkill2 ? isSkill2Cooldown : isUltCooldown;
    const isAvailable = isMyTurn && !isCooldown && yourAP >= apCost;

    if (!isAvailable || skillsUsedThisTurn >= 1) return;

    if (activeSkillId === skillId) {
      cancelSkill();
    } else {
      selectSkill(skillId);
    }
  };

  // Hover handlers that compute fixed tooltip position
  const handleSkillHover = (skill: SkillInfo, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let skillWithCorrectCost = skill;
    if (skill.id === yourVariant.skill1.id) {
      skillWithCorrectCost = { ...skill, cost: skill1Cost };
    }
    setHoveredSkill(skillWithCorrectCost);
    // Position tooltip centered above the button, using fixed coords with screen boundaries
    const tooltipWidth = 320;
    const padding = 16;
    let x = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (x < padding) {
      x = padding;
    } else if (x + tooltipWidth > window.innerWidth - padding) {
      x = window.innerWidth - tooltipWidth - padding;
    }
    setTooltipPos({
      x,
      y: rect.top - 8, // 8px gap above button
    });
  };

  const handleSkillLeave = () => {
    setHoveredSkill(null);
    setTooltipPos(null);
  };

  const handleEndTurnClick = () => {
    if (!isMyTurn || !hasMoved) return;
    endTurn();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      if (!isMyTurn) return;

      const pressedKey = e.key.toLowerCase();
      
      if (pressedKey === 'escape') {
        e.preventDefault();
        cancelSkill();
        return;
      }
      
      if (pressedKey === keybindings.skill1.toLowerCase()) {
        e.preventDefault();
        if (isSkill1Cooldown) return;
        handleSkillClick(yourVariant.skill1.id, skill1Cost);
      } else if (pressedKey === keybindings.skill2.toLowerCase()) {
        e.preventDefault();
        if (isSkill2Cooldown) return;
        handleSkillClick(yourVariant.skill2.id, Number(yourVariant.skill2.cost));
      } else if (pressedKey === keybindings.ultimate.toLowerCase()) {
        e.preventDefault();
        if (isUltCooldown) return;
        handleSkillClick(yourVariant.ultimate.id, Number(yourVariant.ultimate.cost));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    keybindings,
    isMyTurn,
    yourVariant,
    yourAP,
    skillsUsedThisTurn,
    activeSkillId,
    isSkill1Cooldown,
    isSkill2Cooldown,
    isUltCooldown,
    roomCode,
    playerId,
    targetSelectionMode,
    cancelSkill
  ]);

  return (
    <div className="h-[120px] w-full flex items-center justify-between bg-[#0b0d19]/90 border border-slate-800 rounded-xl px-4 py-2 relative shadow-lg backdrop-blur-md">
      
      {/* Left Section: Variant Card & Current AP */}
      <div className="flex items-center gap-4 w-[35%] shrink-0 h-full">
        {/* 1. YOUR VARIANT CARD */}
        <div className="flex items-center gap-3 bg-[#111326]/60 border border-slate-800 rounded-lg p-2 h-full relative group overflow-hidden flex-1 min-w-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(216,195,158,0.02),transparent_70%)]" />
          
          {/* Portrait with Resource overlay */}
          <div className="w-20 h-20 rounded-md border border-[#d8c39e] shadow-[0_0_10px_rgba(216,195,158,0.25)] flex items-center justify-center overflow-hidden shrink-0 relative bg-[#1b1c31]">
            {!imgError[`variant_${yourVariant.id}`] ? (
              <img
                src={`/assets/variants/${yourVariant.id}.png`}
                alt={yourVariant.name}
                className="w-full h-full object-cover"
                onError={() => handleImgError(`variant_${yourVariant.id}`)}
              />
            ) : (
              <span className="text-5xl select-none">{yourVariant.artwork}</span>
            )}
            {resourceValue !== null && (
              <div className="absolute -bottom-1 -right-1 bg-teal-950 border border-teal-500 rounded px-1 text-[8px] font-mono text-teal-300 font-bold z-10 leading-none shadow-md">
                {resourceValue}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center min-w-0 z-10">
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold block leading-none">Your Variant</span>
            <span className="text-sm font-extrabold text-[#d8c39e] leading-tight block truncate mt-1" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{yourVariant.name}</span>
            <div className="flex items-center mt-1">
              <span className="text-[8px] px-1.5 py-0.5 border border-slate-700 bg-slate-800/40 rounded text-slate-400 uppercase font-bold tracking-wider font-sans shrink-0 leading-none">{yourVariant.role}</span>
            </div>
          </div>
        </div>

        {/* CURRENT AP */}
        <div className="flex flex-col items-center justify-center border-l border-slate-800/80 pl-4 h-[80%] pr-2 shrink-0">
          <span className="text-xl font-black text-blue-400 font-mono leading-none">{yourAP} AP</span>
          <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider mt-1.5 leading-none">Current AP</span>
        </div>
      </div>

      {/* 2. SKILL SLOTS (Center) */}
      <div ref={skillSectionRef} className="w-[43%] flex items-center justify-center gap-3.5 relative">
        {activeSkillId && (() => {
          const skillData = availableSkillTargets[activeSkillId];
          const currentReq = skillData?.requirements?.[currentRequirementIndex];
          const hintText = currentReq?.description || 'Chọn mục tiêu trên bàn cờ';
          return (
            <div className="absolute top-[-32px] text-[10px] text-yellow-400 animate-pulse font-bold bg-[#1a0f0f] border border-yellow-900/60 px-2 py-0.5 rounded" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
              {hintText}
            </div>
          );
        })()}

        {/* Passive Slot */}
        {hasPassive && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className="relative cursor-default"
              onMouseEnter={(e) => handleSkillHover(yourVariant.passive, e)}
              onMouseLeave={handleSkillLeave}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSkillDetail({ skill: yourVariant.passive, variantId: yourVariant.id, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-slate-900 border border-yellow-700/50 rounded flex items-center justify-center text-[8px] font-bold text-yellow-500 font-mono z-20">P</span>
              <div className="w-[52px] h-[52px] rounded-lg border flex items-center justify-center font-bold relative transition-all bg-[#1a1a10] border-yellow-500/60 text-yellow-300/80 shadow-[0_0_8px_rgba(234,179,8,0.15)] overflow-hidden">
                {!imgError[`${yourVariant.id}_passive`] ? (
                  <img src={`/assets/skills/${yourVariant.id}_passive.png`} alt={yourVariant.passive.name} className="w-full h-full object-cover" onError={() => handleImgError(`${yourVariant.id}_passive`)} />
                ) : (
                  <span className="text-[12px] font-black text-[#e8d5a0] font-mono">PSV</span>
                )}
              </div>
            </div>
            <span className="text-[7px] text-slate-500 font-mono font-bold leading-none mt-0.5">PASSIVE</span>
            <span className="text-[8px] text-slate-400 font-sans truncate max-w-[80px] text-center leading-none mt-0.5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{yourVariant.passive.name}</span>
          </div>
        )}

        {hasPassive && <div className="w-px h-[40px] bg-slate-700/50 mx-0.5" />}

        {/* Skill 1 Slot */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div 
            className="relative" 
            onMouseEnter={(e) => handleSkillHover(yourVariant.skill1, e)} 
            onMouseLeave={handleSkillLeave}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSkillDetail({ skill: { ...yourVariant.skill1, cost: skill1Cost }, variantId: yourVariant.id, x: e.clientX, y: e.clientY });
            }}
          >
            <span className="absolute -top-1.5 -left-1.5 px-1 bg-slate-900 border border-slate-700 rounded flex items-center justify-center text-[8px] font-bold text-slate-300 font-mono z-20 uppercase">{keybindings.skill1}</span>
            <span className={`absolute -bottom-1.5 -right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono z-20 border ${yourAP < skill1Cost ? 'bg-red-955 border-red-700 text-red-400' : 'bg-blue-955 border-blue-700 text-blue-400'}`}>
              {skill1Cost}
            </span>
            {isSkill1Cooldown && (
              <div className="absolute inset-0 bg-black/75 z-10 flex items-center justify-center rounded-lg pointer-events-none">
                <span className="text-sm font-black text-white font-mono">{skill1CooldownTurns}</span>
              </div>
            )}
            <button onClick={() => handleSkillClick(yourVariant.skill1.id, skill1Cost)} className={`w-[52px] h-[52px] rounded-lg border flex items-center justify-center font-bold relative transition-all overflow-hidden ${!isSkill1Available ? 'bg-[#0b0c14] border-slate-900 text-slate-650 opacity-55 cursor-not-allowed' : 'bg-[#181a3d] border-blue-500 text-blue-300 hover:bg-[#202352] shadow-[0_0_10px_rgba(59,130,246,0.25)] active:scale-95 cursor-pointer'} ${activeSkillId === yourVariant.skill1.id ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : ''}`}>
              {!imgError[`${yourVariant.id}_skill1`] ? (
                <img src={`/assets/skills/${yourVariant.id}_skill1.png`} alt={yourVariant.skill1.name} className="w-full h-full object-cover" onError={() => handleImgError(`${yourVariant.id}_skill1`)} />
              ) : (
                <span className="text-[12px] text-blue-400 font-bold font-mono">S1</span>
              )}
            </button>
          </div>
          <span className="text-[7px] text-slate-500 font-mono font-bold leading-none mt-0.5">S1</span>
          <span className="text-[8px] text-slate-400 font-sans truncate max-w-[80px] text-center leading-none mt-0.5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{yourVariant.skill1.name}</span>
        </div>

        {/* Skill 2 Slot */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div 
            className="relative" 
            onMouseEnter={(e) => handleSkillHover(yourVariant.skill2, e)} 
            onMouseLeave={handleSkillLeave}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSkillDetail({ skill: yourVariant.skill2, variantId: yourVariant.id, x: e.clientX, y: e.clientY });
            }}
          >
            <span className="absolute -top-1.5 -left-1.5 px-1 bg-slate-900 border border-slate-700 rounded flex items-center justify-center text-[8px] font-bold text-slate-300 font-mono z-20 uppercase">{keybindings.skill2}</span>
            <span className={`absolute -bottom-1.5 -right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono z-20 border ${yourAP < Number(yourVariant.skill2.cost) ? 'bg-red-955 border-red-700 text-red-400' : 'bg-blue-955 border-blue-700 text-blue-400'}`}>
              {yourVariant.skill2.cost}
            </span>
            {isSkill2Cooldown && (
              <div className="absolute inset-0 bg-black/75 z-10 flex items-center justify-center rounded-lg pointer-events-none">
                <span className="text-sm font-black text-white font-mono">{skill2CooldownTurns}</span>
              </div>
            )}
            <button onClick={() => handleSkillClick(yourVariant.skill2.id, Number(yourVariant.skill2.cost))} className={`w-[52px] h-[52px] rounded-lg border flex items-center justify-center font-bold relative transition-all overflow-hidden ${!isSkill2Available ? 'bg-[#0b0c14] border-slate-900 text-slate-650 opacity-55 cursor-not-allowed' : 'bg-[#181a3d] border-blue-500 text-blue-300 hover:bg-[#202352] shadow-[0_0_10px_rgba(59,130,246,0.25)] active:scale-95 cursor-pointer'} ${activeSkillId === yourVariant.skill2.id ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : ''}`}>
              {!imgError[`${yourVariant.id}_skill2`] ? (
                <img src={`/assets/skills/${yourVariant.id}_skill2.png`} alt={yourVariant.skill2.name} className="w-full h-full object-cover" onError={() => handleImgError(`${yourVariant.id}_skill2`)} />
              ) : (
                <span className="text-[12px] text-blue-400 font-bold font-mono">S2</span>
              )}
            </button>
          </div>
          <span className="text-[7px] text-slate-500 font-mono font-bold leading-none mt-0.5">S2</span>
          <span className="text-[8px] text-slate-400 font-sans truncate max-w-[80px] text-center leading-none mt-0.5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{yourVariant.skill2.name}</span>
        </div>

        {/* Ultimate Slot */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div 
            className="relative" 
            onMouseEnter={(e) => handleSkillHover(yourVariant.ultimate, e)} 
            onMouseLeave={handleSkillLeave}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSkillDetail({ skill: yourVariant.ultimate, variantId: yourVariant.id, x: e.clientX, y: e.clientY });
            }}
          >
            <span className="absolute -top-1.5 -left-1.5 px-1 bg-slate-900 border border-purple-700/50 rounded flex items-center justify-center text-[8px] font-bold text-purple-400 font-mono z-20 uppercase">{keybindings.ultimate}</span>
            <span className={`absolute -bottom-1.5 -right-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold font-mono z-20 border ${yourAP < Number(yourVariant.ultimate.cost) ? 'bg-red-955 border-red-700 text-red-400' : 'bg-purple-955 border-purple-700 text-purple-400'}`}>
              {yourVariant.ultimate.cost}
            </span>
            {isUltCooldown && (
              <div className="absolute inset-0 bg-black/75 z-10 flex items-center justify-center rounded-lg pointer-events-none">
                <span className="text-sm font-black text-white font-mono">{ultCooldownTurns}</span>
              </div>
            )}
            <button onClick={() => handleSkillClick(yourVariant.ultimate.id, Number(yourVariant.ultimate.cost))} className={`w-[52px] h-[52px] rounded-lg border-2 flex items-center justify-center font-bold relative transition-all overflow-hidden ${!isUltAvailable ? 'bg-[#0b0c14] border-slate-900 text-slate-650 opacity-55 cursor-not-allowed' : 'bg-[#29133d] border-purple-500 text-purple-300 hover:bg-[#381a54] shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer'} ${activeSkillId === yourVariant.ultimate.id ? 'ring-2 ring-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : ''}`}>
              {!imgError[`${yourVariant.id}_ultimate`] ? (
                <img src={`/assets/skills/${yourVariant.id}_ultimate.png`} alt={yourVariant.ultimate.name} className="w-full h-full object-cover" onError={() => handleImgError(`${yourVariant.id}_ultimate`)} />
              ) : (
                <span className="text-[12px] text-purple-400 font-bold font-mono">ULT</span>
              )}
            </button>
          </div>
          <span className="text-[7px] text-slate-500 font-mono font-bold leading-none mt-0.5">ULT</span>
          <span className="text-[8px] text-slate-400 font-sans truncate max-w-[80px] text-center leading-none mt-0.5" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>{yourVariant.ultimate.name}</span>
        </div>
      </div>

      {hoveredSkill && tooltipPos && (
        <div className="fixed z-[200] w-[320px] bg-[#090b14]/98 border border-[#d8c39e]/50 rounded-lg p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col gap-1.5 pointer-events-none" style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px`, transform: 'translateY(-100%)', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="text-xs font-black text-[#d8c39e] uppercase tracking-wider">{hoveredSkill.name}</span>
            <span className="text-[9px] font-bold text-blue-400">Cost: {hoveredSkill.cost} {typeof hoveredSkill.cost === 'number' ? 'AP' : ''}</span>
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 leading-none">
            <span>Target: <span className="text-slate-400">{hoveredSkill.targetType}</span></span>
            <span>Duration: <span className="text-slate-400">{hoveredSkill.duration}</span></span>
          </div>
          <div className="w-full border-t border-dashed border-slate-800 my-0.5" />
          <p className="text-[11px] text-[#cbd5e1] leading-relaxed">{hoveredSkill.description}</p>

        </div>
      )}

      <div className="w-[22%] flex items-center justify-end gap-3 h-full pr-1">
        <div className="flex flex-col items-end gap-1 font-mono">
          <span className="text-[10px] text-slate-500 leading-none uppercase">Turn Number</span>
          <span className="text-sm font-bold text-[#cbd5e1] leading-none">Turn {turnNumber}</span>
          <span className={`text-[8px] px-2 py-0.5 border rounded-full font-bold uppercase ${statusColor}`}>{turnStatus.replace(/_/g, ' ')}</span>
        </div>
        <button onClick={handleEndTurnClick} className={`h-[56px] px-4 rounded-lg border-2 font-bold transition-all text-xs uppercase ${isMyTurn && hasMoved ? 'bg-[#cbd5e1] text-black border-[#cbd5e1] hover:bg-white hover:border-white shadow-[0_0_12px_rgba(252,245,229,0.2)] active:scale-95 cursor-pointer' : isMyTurn ? 'bg-slate-900 border-slate-800 text-slate-650 cursor-not-allowed opacity-40' : 'bg-[#121422] border-slate-800/80 text-slate-500 cursor-not-allowed select-none font-semibold'}`}>
          {isMyTurn ? 'End Turn' : 'Waiting'}
        </button>
      </div>
    </div>
  );
}
