'use client';

import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { VARIANTS_LIST, VariantData, SkillInfo, getVariantImageSrc } from '../lib/variantsData';
import { Board as BoardClass, Color } from 'game-core';

// Unicode fallback for captured piece icons
const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  White: {
    King: '♔', Queen: '♕', Rook: '♖', Bishop: '♗', Knight: '♘', Pawn: '♙',
  },
  Black: {
    King: '♚', Queen: '♛', Rook: '♜', Bishop: '♝', Knight: '♞', Pawn: '♟',
  },
};

export default function GameRightPanel() {
  const {
    capturedPieces,
    playerColor,
    whiteVariantId,
    blackVariantId,
    whiteAP,
    blackAP,
    variantState,
    board,
    moveLog,
    setSkillDetail,
    graveyard,
    whitePlayerEffects,
    blackPlayerEffects,
    targetSelectionMode,
    activeSkillId,
    currentRequirementIndex,
    selectTarget,
    opponentSkillCosts,
  } = useGameStore();

  const [hoveredSkill, setHoveredSkill] = useState<SkillInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const handleImgError = (key: string) => {
    setImgError((prev) => ({ ...prev, [key]: true }));
  };

  // Setup opponent variant mapping
  const isWhite = (playerColor as any) === 'White' || (playerColor as any) === Color.White;
  const opponentColorLabel = isWhite ? 'Black' : 'White';
  const opponentColorColor = isWhite ? Color.Black : Color.White;
  const opponentVariantId = isWhite ? blackVariantId : whiteVariantId;
  const opponentVariant = VARIANTS_LIST.find((v) => v.id === opponentVariantId);
  const opponentAP = isWhite ? blackAP : whiteAP;
  const opponentEffects = opponentColorColor === Color.White ? whitePlayerEffects : blackPlayerEffects;
  const isOpponentSilenced = opponentEffects?.some((e: any) => e.type === 'silence');

  // Dynamic Opponent Resource lookup
  const getOpponentResourceValue = () => {
    if (!opponentVariantId) return null;
    if (opponentVariantId === 'zombie') return `${variantState.zombieCount ?? 2}/5`;
    if (opponentVariantId === 'kaze') return `${variantState.windSigils ?? 6}/6`;
    if (opponentVariantId === 'dynamite') return `${variantState.bombCount ?? 0}`;
    if (opponentVariantId === 'magician') return `${variantState.domainCount ?? 0}`;
    if (opponentVariantId === 'guardian') return `${variantState.shieldCount ?? 0}`;
    if (opponentVariantId === 'ruler') {
      const law = variantState.currentLaw ?? variantState.lawActive ?? 1;
      const rounds = variantState.lawRemainingRounds ?? 0;
      const domain = variantState.domainActive === true;
      const domainRounds = variantState.domainRemainingRounds ?? 0;
      if (domain) {
        return `Domain (${domainRounds}R) | Law ${law}`;
      }
      if (rounds > 0) {
        return `Law ${law} (${rounds}R)`;
      }
      return `Law ${law}`;
    }
    if (opponentVariantId === 'angel') {
      return variantState[`judgmentWindowActive_${opponentColorColor}`] ? `Jdg ${variantState[`judgmentWindowRemainingTurns_${opponentColorColor}`]}` : null;
    }

    if (opponentVariantId === 'lightning') {
      if (!board) return '0';
      try {
        const boardClass = BoardClass.fromSerializable(board);
        const cellEffects = boardClass.getAllCellEffects();
        let trapCount = 0;
        for (const list of cellEffects.values()) {
          if (list.some((e: any) => e.type === 'thunder_trap' && e.sourcePlayer === opponentColorColor)) {
            trapCount++;
          }
        }
        return `${trapCount}`;
      } catch (err) {
        return '0';
      }
    }
    if (opponentVariantId === 'space') {
      const pairs = variantState?.dimensionPairs || [];
      const hasCosmicVoid = opponentEffects?.some((e: any) => e.type === 'cosmic_void');
      if (hasCosmicVoid) {
        return `Portal: ${pairs.length} | Void`;
      }
      return `Portal: ${pairs.length}`;
    }
    return null;
  };

  const opponentResourceValue = getOpponentResourceValue();

  const getOpponentSkill1Cost = () => {
    const skillId = opponentVariant?.skill1?.id;
    if (skillId && opponentSkillCosts[skillId] !== undefined) return opponentSkillCosts[skillId];
    return opponentVariant ? Number(opponentVariant.skill1.cost) : 4;
  };
  const opponentSkill1Cost = getOpponentSkill1Cost();

  const getOpponentSkill2Cost = () => {
    const skillId = opponentVariant?.skill2?.id;
    if (skillId && opponentSkillCosts[skillId] !== undefined) return opponentSkillCosts[skillId];
    return opponentVariant ? Number(opponentVariant.skill2.cost) : 4;
  };
  const opponentSkill2Cost = getOpponentSkill2Cost();

  const getOpponentUltCost = () => {
    const skillId = opponentVariant?.ultimate?.id;
    if (skillId && opponentSkillCosts[skillId] !== undefined) return opponentSkillCosts[skillId];
    return opponentVariant ? Number(opponentVariant.ultimate.cost) : 14;
  };
  const opponentUltCost = getOpponentUltCost();

  // Hover handlers that compute fixed tooltip position below the badge
  const handleSkillHover = (skill: SkillInfo, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let skillWithCorrectCost = skill;
    if (opponentVariant && skill.id === opponentVariant.skill1.id) {
      skillWithCorrectCost = { ...skill, cost: opponentSkill1Cost };
    } else if (opponentVariant && skill.id === opponentVariant.skill2.id) {
      skillWithCorrectCost = { ...skill, cost: opponentSkill2Cost };
    } else if (opponentVariant && skill.id === opponentVariant.ultimate.id) {
      skillWithCorrectCost = { ...skill, cost: opponentUltCost };
    }
    setHoveredSkill(skillWithCorrectCost);
    // Position tooltip centered below the badge with screen boundaries
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
      y: rect.bottom + 8, // 8px gap below the badge
    });
  };

  const handleSkillLeave = () => {
    setHoveredSkill(null);
    setTooltipPos(null);
  };

  // Split graveyard pieces by color
  const whiteLost = (graveyard || []).filter((e: any) => e.piece.color === Color.White).map((e: any) => e.piece);
  const blackLost = (graveyard || []).filter((e: any) => e.piece.color === Color.Black).map((e: any) => e.piece);

  // Opponent's losses on top, our losses on bottom
  const topLabel = isWhite ? 'Black' : 'White';
  const bottomLabel = isWhite ? 'White' : 'Black';
  const topLost = isWhite ? blackLost : whiteLost;
  const bottomLost = isWhite ? whiteLost : blackLost;

  return (
    <div className="right-panel flex flex-col h-full bg-[#0b0d19]/90 border-l border-slate-800 p-4 font-mono select-none relative">

      {/* 1. OPPONENT VARIANT SUMMARY (20% Height) */}
      <div className="h-[20%] border-b border-slate-800/80 pb-3 flex flex-col justify-between relative">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Opponent Variant</span>

        {opponentVariant ? (
          <div className="flex items-center gap-3 bg-[#170e13]/40 border border-slate-850 p-2 rounded-lg flex-1 mt-1 justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded border border-slate-700 bg-slate-800/40 flex items-center justify-center overflow-hidden shrink-0 relative bg-[#1b1c31]">
                {!imgError[`opponent_${opponentVariant.id}`] ? (
                  <img
                    src={getVariantImageSrc(opponentVariant.id)}
                    alt={opponentVariant.name}
                    className="w-full h-full object-cover"
                    onError={() => handleImgError(`opponent_${opponentVariant.id}`)}
                  />
                ) : (
                  <span className="text-2xl select-none">{opponentVariant.artwork}</span>
                )}
                {opponentVariantId === 'kaze' ? (
                  <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 z-10">
                    {Array.from({ length: 6 }).map((_, idx) => {
                      const active = idx < (variantState.windSigils ?? 6);
                      return (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full border transition-all duration-300 ${
                            active
                              ? 'bg-teal-400 border-teal-300 shadow-[0_0_4px_rgba(45,212,191,0.85)]'
                              : 'bg-slate-800 border-slate-700 opacity-30'
                          }`}
                        />
                      );
                    })}
                  </div>
                ) : (() => {
                  const resVal = getOpponentResourceValue();
                  if (resVal === null) return null;
                  return (
                    <div className="absolute bottom-0.5 right-0.5 bg-teal-950 border border-teal-500 rounded px-0.5 text-[6px] font-mono text-teal-300 font-bold z-10 leading-none shadow-md">
                      {resVal}
                    </div>
                  );
                })()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="text-xs font-bold text-red-300">{opponentVariant.name}</div>
                  {isOpponentSilenced && (
                    <span className="silenced-badge">SILENCED</span>
                  )}
                </div>
                <div className="text-[9px] text-slate-500 uppercase">{opponentVariant.role}</div>
                {opponentVariantId === 'ruler' && (() => {
                  const rounds = variantState.lawRemainingRounds ?? 0;
                  const domain = variantState.domainActive === true;
                  const domainRounds = variantState.domainRemainingRounds ?? 0;
                  
                  let statusText = '';
                  if (rounds > 0) statusText += `${rounds} rounds left`;
                  if (domain) {
                    if (statusText) statusText += ' | ';
                    statusText += `Domain: ${domainRounds} rounds left`;
                  }
                  
                  if (!statusText) return null;
                  return (
                    <span className="text-[8px] font-mono text-teal-400 font-bold mt-0.5 block leading-none">
                      {statusText}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Skill Slots with hover tooltip */}
            <div className="flex items-center gap-1.5">
              {/* Passive Badge */}
              <div
                className="relative"
                onMouseEnter={(e) => handleSkillHover(opponentVariant.passive, e)}
                onMouseLeave={handleSkillLeave}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSkillDetail({ skill: opponentVariant.passive, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillDetail({ skill: opponentVariant.passive, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="w-8 h-8 rounded-md border border-yellow-600/50 bg-[#1a1a10] flex items-center justify-center overflow-hidden cursor-pointer hover:border-yellow-400 hover:scale-105 transition-all shadow-md">
                  {!imgError[`opponent_${opponentVariant.id}_passive`] ? (
                    <img
                      src={`/assets/skills/${opponentVariant.id}_passive.png`}
                      alt={opponentVariant.passive.name}
                      className="w-full h-full object-cover"
                      onError={() => handleImgError(`opponent_${opponentVariant.id}_passive`)}
                    />
                  ) : (
                    <span className="text-[10px] font-black text-[#e8d5a0] font-mono">P</span>
                  )}
                </div>
              </div>
              {/* Skill 1 Badge */}
              <div
                className="relative"
                onMouseEnter={(e) => handleSkillHover(opponentVariant.skill1, e)}
                onMouseLeave={handleSkillLeave}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.skill1, cost: opponentSkill1Cost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.skill1, cost: opponentSkill1Cost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="w-8 h-8 rounded-md border border-blue-600/50 bg-[#121429] flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:scale-105 transition-all shadow-md">
                  {!imgError[`opponent_${opponentVariant.id}_skill1`] ? (
                    <img
                      src={`/assets/skills/${opponentVariant.id}_skill1.png`}
                      alt={opponentVariant.skill1.name}
                      className="w-full h-full object-cover"
                      onError={() => handleImgError(`opponent_${opponentVariant.id}_skill1`)}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-blue-400 font-mono">1</span>
                  )}
                </div>
              </div>
              {/* Skill 2 Badge */}
              <div
                className="relative"
                onMouseEnter={(e) => handleSkillHover(opponentVariant.skill2, e)}
                onMouseLeave={handleSkillLeave}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.skill2, cost: opponentSkill2Cost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.skill2, cost: opponentSkill2Cost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="w-8 h-8 rounded-md border border-blue-600/50 bg-[#121429] flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 hover:scale-105 transition-all shadow-md">
                  {!imgError[`opponent_${opponentVariant.id}_skill2`] ? (
                    <img
                      src={`/assets/skills/${opponentVariant.id}_skill2.png`}
                      alt={opponentVariant.skill2.name}
                      className="w-full h-full object-cover"
                      onError={() => handleImgError(`opponent_${opponentVariant.id}_skill2`)}
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-blue-400 font-mono">2</span>
                  )}
                </div>
              </div>
              {/* Ultimate Badge */}
              <div
                className="relative"
                onMouseEnter={(e) => handleSkillHover(opponentVariant.ultimate, e)}
                onMouseLeave={handleSkillLeave}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.ultimate, cost: opponentUltCost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSkillDetail({ skill: { ...opponentVariant.ultimate, cost: opponentUltCost }, variantId: opponentVariant.id, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="w-8 h-8 rounded-md border border-purple-600/50 bg-[#221035] flex items-center justify-center overflow-hidden cursor-pointer hover:border-purple-400 hover:scale-105 transition-all shadow-md">
                  {!imgError[`opponent_${opponentVariant.id}_ultimate`] ? (
                    <img
                      src={`/assets/skills/${opponentVariant.id}_ultimate.png`}
                      alt={opponentVariant.ultimate.name}
                      className="w-full h-full object-cover"
                      onError={() => handleImgError(`opponent_${opponentVariant.id}_ultimate`)}
                    />
                  ) : (
                    <span className="text-[10px] font-black text-purple-400 font-mono">U</span>
                  )}
                </div>
              </div>
            </div>

            {/* Public AP & Resources */}
            <div className="border-l border-slate-800/50 pl-3 text-right">
              <span className="text-[10px] font-bold text-red-400 block font-mono">{opponentAP} AP</span>
              {opponentResourceValue !== null && (
                <span className="text-[8px] text-teal-400 block font-mono font-semibold">{opponentResourceValue}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-600 italic py-2">Loading variant data...</div>
        )}
      </div>

      {/* 2. GAME LOG (55% Height) */}
      <div className="h-[55%] border-b border-slate-800/80 py-3 flex flex-col min-h-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 block">Game Log</span>
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[#07080f]/80 rounded border border-slate-850 p-2 text-xs font-mono text-slate-300 flex flex-col gap-1.5 shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]">
          {moveLog && moveLog.length > 0 ? (
            moveLog.map((log, i) => (
              <div key={i} className="py-0.5 border-b border-slate-900/50 last:border-0 text-slate-400">
                <span className="text-slate-600 mr-2">{i + 1}.</span>
                {log}
              </div>
            ))
          ) : (
            <span className="text-slate-600 italic">Chưa có nước đi nào...</span>
          )}
        </div>
      </div>

      {/* 3. CAPTURED PIECES (25% Height) */}
      <div className="h-[25%] pt-3 flex flex-col justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Captured Pieces</span>

        <div className="flex flex-col gap-2 flex-grow overflow-y-auto pr-1">
          {/* Opponent lost pieces */}
          <div className="bg-[#07080f]/40 border border-slate-850 rounded p-2 flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-red-400/80">{topLabel} Lost</span>
            <div className="flex flex-wrap gap-1 items-center justify-end flex-grow max-w-[70%]">
              {topLost.length === 0 ? (
                <span className="text-[9px] text-slate-600 italic">None</span>
              ) : (
                topLost.map((piece: any, i: number) => {
                  const symbolColor = piece.color === Color.White ? 'White' : 'Black';
                  return (
                    <span key={piece.id || i} className="text-base leading-none text-slate-400 filter drop-shadow" title={`${symbolColor} ${piece.type}`}>
                      {PIECE_SYMBOLS[symbolColor]?.[piece.type] || '?'}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {/* Our lost pieces */}
          <div className="bg-[#07080f]/40 border border-[#2b354d] rounded p-2 flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-blue-400/80">{bottomLabel} Lost</span>
            <div className="flex flex-wrap gap-1.5 items-center justify-end flex-grow max-w-[70%]">
              {bottomLost.length === 0 ? (
                <span className="text-[9px] text-slate-600 italic">None</span>
              ) : (
                bottomLost.map((piece: any, i: number) => {
                  const symbolColor = piece.color === Color.White ? 'White' : 'Black';
                  const isTargetable =
                    targetSelectionMode &&
                    activeSkillId === 'phoenix_ashes' &&
                    currentRequirementIndex === 0 &&
                    piece.color === (isWhite ? Color.White : Color.Black) &&
                    piece.type !== 'King';

                  return (
                    <span
                      key={piece.id || i}
                      onClick={() => {
                        if (isTargetable) {
                          selectTarget({ col: -1, row: -1 }, piece.id);
                        }
                      }}
                      className={`text-base leading-none filter drop-shadow transition-all ${isTargetable
                        ? 'cursor-pointer text-green-400 border border-green-500/85 rounded px-1.5 py-0.5 bg-green-950/60 animate-pulse hover:scale-125 hover:bg-green-900/80 hover:border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.85)]'
                        : 'text-slate-450'
                        }`}
                      title={isTargetable ? `Click to resurrect ${piece.type}` : `${symbolColor} ${piece.type}`}
                    >
                      {PIECE_SYMBOLS[symbolColor]?.[piece.type] || '?'}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Floating Tooltip (FIXED positioning, renders outside panel flow) */}
      {hoveredSkill && tooltipPos && (
        <div
          className="fixed z-[200] w-[320px] bg-[#090b14]/98 border border-[#d8c39e]/50 rounded-lg p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md flex flex-col gap-1.5 pointer-events-none"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="text-xs font-black text-[#d8c39e] uppercase tracking-wider">{hoveredSkill.name}</span>
            <span className="text-[9px] font-bold text-blue-400">
              {hoveredSkill.cost === 'None' || hoveredSkill.cost === 0 ? 'Passive' : `Cost: ${hoveredSkill.cost} AP`}
            </span>
          </div>
          {hoveredSkill.targetType !== 'Passive' && (
            <div className="flex justify-between text-[9px] text-slate-500 leading-none">
              <span>Target: <span className="text-slate-400">{hoveredSkill.targetType}</span></span>
              <span>Duration: <span className="text-slate-400">{hoveredSkill.duration}</span></span>
            </div>
          )}
          <div className="w-full border-t border-dashed border-slate-800 my-0.5" />
          <p className="text-[11px] text-[#cbd5e1] leading-relaxed">{hoveredSkill.description}</p>
        </div>
      )}

    </div>
  );
}
