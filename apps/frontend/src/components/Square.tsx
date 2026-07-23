// ============================================================
// Square Component - Individual board square
// ============================================================

'use client';

import { Color } from 'game-core';
import type { Piece as PieceData, Position } from 'game-core';
import PieceComponent from './Piece';
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

interface SquareProps {
  pos: Position;
  piece: PieceData | null;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  onClick: (pos: Position) => void;
}

export default function Square({
  pos,
  piece,
  isLight,
  isSelected,
  isLegalMove,
  isLastMoveFrom,
  isLastMoveTo,
  onClick,
}: SquareProps) {
  const { 
    playerColor, 
    board, 
    lightningStrikeTargets, 
    dynamiteExplosionTargets, 
    targetSelectionMode, 
    validTargets, 
    selectedSquare, 
    variantState, 
    legalMoves,
    pendingTargets,
    activeSkillId,
    availableSkillTargets,
    currentRequirementIndex,
    whiteVariantId,
    blackVariantId,
  } = useGameStore();

  const isDevilTollActive = variantState?.devilTollActive === true;
  let moveAPCost: number | null = null;
  if (isDevilTollActive && isLegalMove && !piece && selectedSquare && board) {
    try {
      const selectedPiece = board.grid[selectedSquare.row]?.[selectedSquare.col];
      if (selectedPiece) {
        const type = selectedPiece.type;
        if (type === 'Bishop' || type === 'Knight') moveAPCost = 2;
        else if (type === 'Rook') moveAPCost = 3;
        else if (type === 'Queen') moveAPCost = 4;
      }
    } catch {
      // ignore
    }
  }

  let hasOwnTrap = false;
  let hasOwnLandmine = false;
  let hasRepel = false;
  let hasSoullessCell = false;
  let hasFlame = false;
  let hasSupernovaWarning = false;
  let hasDimension = false;
  let hasOutworld = false;
  let hasPuppetTrap = false;
  let dimensionPortalType: 'odd' | 'even' | null = null;
  let dimensionOwner: string | null = null;
  if (board && board.cellEffects) {
    const key = `${pos.col},${pos.row}`;
    const effects = board.cellEffects[key];
    if (effects) {
      hasOwnTrap = effects.some(
        e => e.type === 'thunder_trap' && e.sourcePlayer === playerColor
      );
      hasOwnLandmine = effects.some(
        e => e.type === 'landmine' && e.sourcePlayer === playerColor
      );
      hasRepel = effects.some(
        e => e.type === 'repel'
      );
      hasSoullessCell = effects.some(
        e => e.type === 'soulless_cell'
      );
      hasFlame = effects.some(
        e => e.type === 'flame'
      );
      hasSupernovaWarning = effects.some(
        e => e.type === 'supernova_warning'
      );
      hasDimension = effects.some(
        e => e.type === 'dimension'
      );
      const dimEffect = effects.find(e => e.type === 'dimension');
      if (dimEffect && dimEffect.metadata) {
        dimensionPortalType = dimEffect.metadata.portalType;
        dimensionOwner = dimEffect.metadata.owner;
      }
      hasOutworld = effects.some(
        e => e.type === 'outworld'
      );
      hasPuppetTrap = effects.some(
        e => e.type === 'puppet_trap' && e.sourcePlayer === playerColor
      );
    }
  }

  // Check if this square is within the storm zone
  const storm = variantState?.storm;
  let isInStormZone = false;
  if (storm && storm.center) {
    const dist = Math.max(Math.abs(pos.col - storm.center.col), Math.abs(pos.row - storm.center.row));
    isInStormZone = dist <= storm.currentRadius;
  }

  // Check if this square is within the 5x5 bind zone of the selected bound piece
  let isSquareInBindZone = false;
  if (selectedSquare && board && board.grid) {
    const selectedPiece = board.grid[selectedSquare.row]?.[selectedSquare.col];
    if (selectedPiece && selectedPiece.effects) {
      const hasBind = selectedPiece.effects.some(e => e.type === 'bind');
      if (hasBind) {
        const colDiff = Math.abs(pos.col - selectedSquare.col);
        const rowDiff = Math.abs(pos.row - selectedSquare.row);
        if (colDiff <= 2 && rowDiff <= 2) {
          isSquareInBindZone = true;
        }
      }
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (piece) {
      const customEvent = new CustomEvent('show-piece-context-menu', {
        detail: {
          x: e.clientX,
          y: e.clientY,
          piece,
          pos,
        }
      });
      window.dispatchEvent(customEvent);
    }
  }, [piece, pos]);

  const isValidTarget = targetSelectionMode && validTargets.some(t => t.col === pos.col && t.row === pos.row);
  const isUntargetable = targetSelectionMode && !isValidTarget;

  const targetMove = legalMoves.find(m => m.col === pos.col && m.row === pos.row) as any;
  const isBiteTarget = isLegalMove && targetMove?.moveType === 'zombie_bite';

  const isPosEquals = (p1?: Position, p2?: Position) => !!(p1 && p2 && p1.col === p2.col && p1.row === p2.row);
  const isPendingMain = pendingTargets && isPosEquals(pendingTargets[0]?.position, pos);
  const isPendingVoodoo = pendingTargets && isPosEquals(pendingTargets[1]?.position, pos);

  let skillAPCost: number | null = null;
  if (targetSelectionMode && activeSkillId === 'puppet_master' && piece && isValidTarget) {
    const skillData = availableSkillTargets['puppet_master'];
    const currentReq = skillData?.requirements?.[currentRequirementIndex];
    const costMap = currentReq?.dynamicCostByPieceType;
    if (costMap) {
      skillAPCost = costMap[piece.type] ?? null;
    }
  }

  let className = 'square';
  className += isLight ? ' square-light' : ' square-dark';
  if (isSelected) className += ' square-selected';
  if (isLastMoveFrom || isLastMoveTo) className += ' square-last-move';
  if (isValidTarget) className += ' targetable';
  if (isUntargetable) className += ' untargetable';
  if (isSquareInBindZone) className += ' square-bind-zone';
  if (isInStormZone) className += ' square-storm-zone';
  if (isPendingMain) className += ' main-pending-target';
  if (isPendingVoodoo) className += ' voodoo-pending-target';

  // Ruler Active check
  const isRulerActive = whiteVariantId === 'ruler' || blackVariantId === 'ruler';
  const isInRulerZone = isRulerActive && pos.col >= 3 && pos.col <= 11 && pos.row >= 3 && pos.row <= 11;
  const isDomainActive = variantState?.domainActive === true;
  if (isInRulerZone) {
    className += ' square-ruler-zone';
    
    // Check boundaries according to perspective (flipped for Black)
    const isFlipped = playerColor === Color.Black;
    const isTopEdge = isFlipped ? (pos.row === 3) : (pos.row === 11);
    const isBottomEdge = isFlipped ? (pos.row === 11) : (pos.row === 3);
    const isLeftEdge = isFlipped ? (pos.col === 11) : (pos.col === 3);
    const isRightEdge = isFlipped ? (pos.col === 3) : (pos.col === 11);
    
    if (isTopEdge) className += ' ruler-border-top';
    if (isBottomEdge) className += ' ruler-border-bottom';
    if (isLeftEdge) className += ' ruler-border-left';
    if (isRightEdge) className += ' ruler-border-right';

    if (isDomainActive) {
      className += ' domain-active';
    } else {
      const activeLaw = variantState?.currentLaw ?? 1;
      className += ` ruler-law-${activeLaw}`;
    }
  }

  const isStruck = lightningStrikeTargets.includes(`${pos.col},${pos.row}`);
  const isExploded = dynamiteExplosionTargets?.includes(`${pos.col},${pos.row}`);

  return (
    <div
      className={className}
      onClick={() => onClick(pos)}
      onContextMenu={handleContextMenu}
      data-col={pos.col}
      data-row={pos.row}
    >
      {piece && piece.specialType !== 'earth_reservation' && (
        <PieceComponent piece={piece} />
      )}
      {piece && piece.specialType === 'earth_reservation' && (
        <div className="earth-reservation-glow" />
      )}
      {piece && piece.effects && (() => {
        const resTimer = piece.effects.find(e => e.type === 'reservation_timer');
        if (resTimer && resTimer.remainingDuration !== null) {
          return (
            <div className="reservation-timer-badge" style={{
              position: 'absolute',
              bottom: '4px',
              right: '4px',
              background: '#22c55e',
              color: 'white',
              borderRadius: '9999px',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(34, 197, 94, 0.9)',
              zIndex: 20
            }}>
              ⏳{resTimer.remainingDuration}
            </div>
          );
        }
        const deathCounter = piece.effects.find(e => e.type === 'death_counter');
        if (deathCounter && deathCounter.metadata && typeof deathCounter.metadata.count === 'number') {
          return (
            <div className="death-counter-badge" style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '9999px',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
              gap: '2px',
              zIndex: 20
            }}>
              💀{deathCounter.metadata.count}
            </div>
          );
        }
        return null;
      })()}
      {piece && piece.effects && (() => {
        const berserk = piece.effects.find(e => e.type === 'berserk');
        if (berserk && berserk.metadata && typeof berserk.metadata.captureCountdown === 'number') {
          return (
            <div className="berserk-badge">
              {berserk.metadata.captureCountdown}
            </div>
          );
        }
        const fate = piece.effects.find(e => e.type === 'fate');
        if (fate) {
          return (
            <div className="fate-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#9333ea',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 4px rgba(147, 51, 234, 0.8)',
              zIndex: 20
            }}>
              🔗
            </div>
          );
        }
        const fool = piece.effects.find(e => e.type === 'fool');
        if (fool) {
          return (
            <div className="fool-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#db2777',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(219, 39, 119, 0.9)',
              zIndex: 20
            }}>
              🤡
            </div>
          );
        }
        const devilEye = piece.effects.find(e => e.type === 'devil_eye');
        if (devilEye) {
          return (
            <div className="devil-eye-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#dc2626',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(220, 38, 38, 0.9)',
              zIndex: 20
            }}>
              👁️
            </div>
          );
        }
        const ascend = piece.effects.find(e => e.type === 'ascend');
        if (ascend) {
          const completed = ascend.metadata?.completed === true;
          return (
            <div className="ascend-badge" style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: completed ? '#eab308' : '#3b82f6',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: completed ? '0 0 8px rgba(234, 179, 8, 0.9)' : '0 0 6px rgba(59, 130, 246, 0.7)',
              zIndex: 20
            }}>
              {completed ? '✨' : '🪽'}
            </div>
          );
        }
        const soulless = piece.effects.find(e => e.type === 'soulless');
        if (soulless) {
          return (
            <div className="soulless-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#475569',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(71, 85, 105, 0.9)',
              zIndex: 20,
              border: '1px solid #94a3b8'
            }}>
              🌀
            </div>
          );
        }
        const zombie = piece.effects.find(e => e.type === 'zombie');
        if (zombie) {
          return (
            <div className="zombie-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#15803d',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(21, 128, 61, 0.9)',
              zIndex: 20,
              border: '1px solid #4ade80'
            }}>
              🧟
            </div>
          );
        }
        const walker = piece.effects.find(e => e.type === 'walker');
        if (walker) {
          return (
            <div className="walker-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#0f766e',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(15, 118, 110, 0.9)',
              zIndex: 20,
              border: '1px solid #2dd4bf'
            }}>
              💀
            </div>
          );
        }
        const evolution = piece.effects.find(e => e.type === 'evolution');
        if (evolution) {
          const rounds = evolution.metadata?.roundsWithEvolution ?? 0;
          let stageIcon = '♟';
          if (rounds >= 5) stageIcon = '♛';
          else if (rounds >= 4) stageIcon = '♜';
          else if (rounds >= 3) stageIcon = '♝';
          else if (rounds >= 2) stageIcon = '♞';
          
          return (
            <div className="evolution-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)',
              zIndex: 20,
              border: '1px solid #f59e0b'
            }} title={`Evolution Spore: ${rounds} rounds`}>
              {stageIcon}
            </div>
          );
        }
        const main = piece.effects.find(e => e.type === 'main');
        if (main) {
          return (
            <div className="main-badge" style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: '#eab308',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(234, 179, 8, 0.9)',
              zIndex: 20
            }}>
              🧵
            </div>
          );
        }
        const voodoo = piece.effects.find(e => e.type === 'voodoo');
        if (voodoo) {
          return (
            <div className="voodoo-badge" style={{
              position: 'absolute',
              top: '4px',
              left: '4px',
              background: '#6366f1',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(99, 102, 241, 0.9)',
              zIndex: 20
            }}>
              🎎
            </div>
          );
        }
        const noCap = piece.effects.find(e => e.type === 'puppet_no_capture');
        if (noCap) {
          return (
            <div className="no-capture-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)',
              zIndex: 20
            }}>
              🚫
            </div>
          );
        }
        const control = piece.effects.find(e => e.type === 'puppet_control');
        if (control) {
          return (
            <div className="control-badge" style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#a855f7',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              boxShadow: '0 0 6px rgba(168, 85, 247, 0.9)',
              zIndex: 20
            }}>
              🪡
            </div>
          );
        }
        return null;
      })()}
      {isLegalMove && !piece && (
        moveAPCost ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 text-[9px] font-bold text-red-400 bg-red-950/20 rounded">
            -{moveAPCost} AP
          </div>
        ) : (
          <div className="legal-move-dot" />
        )
      )}
      {isLegalMove && piece && (
        isBiteTarget ? (
          <div className="legal-move-bite" />
        ) : (
          <div className="legal-move-capture" />
        )
      )}
      {hasOwnTrap && (
        <div className="lightning-stun-trap" />
      )}
      {hasOwnLandmine && (
        <div className="dynamite-landmine-overlay" />
      )}
      {hasRepel && (
        <div className="kaze-repel-overlay" />
      )}
      {hasSoullessCell && (
        <div className="kaze-soulless-cell-overlay" />
      )}
      {isInStormZone && (
        <div className="kaze-storm-zone-overlay" />
      )}
      {hasFlame && (
        <div className="flame-overlay" />
      )}
      {hasSupernovaWarning && (
        <div className="supernova-warning-overlay" />
      )}
      {hasDimension && (
        <div className={`dimension-portal-overlay portal-${dimensionPortalType} owner-${dimensionOwner?.toLowerCase()}`} />
      )}
      {hasOutworld && (
        <div className="outworld-overlay" />
      )}
      {hasPuppetTrap && (
        <div className="puppet-trap-overlay" />
      )}
      {skillAPCost !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 text-[10px] font-black text-yellow-400 bg-yellow-955/40 rounded border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]">
          {skillAPCost} AP
        </div>
      )}
      {isStruck && <div className="lightning-ultimate-strike" />}
      {isExploded && <div className="dynamite-explosion-animation" />}
    </div>
  );
}
