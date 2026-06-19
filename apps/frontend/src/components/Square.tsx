// ============================================================
// Square Component - Individual board square
// ============================================================

'use client';

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
  const { playerColor, board, lightningStrikeTargets, dynamiteExplosionTargets, targetSelectionMode, validTargets } = useGameStore();

  let hasOwnTrap = false;
  let hasOwnLandmine = false;
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

  let className = 'square';
  className += isLight ? ' square-light' : ' square-dark';
  if (isSelected) className += ' square-selected';
  if (isLastMoveFrom || isLastMoveTo) className += ' square-last-move';
  if (isValidTarget) className += ' targetable';
  if (isUntargetable) className += ' untargetable';

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
      {piece && <PieceComponent piece={piece} />}
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
        return null;
      })()}
      {isLegalMove && !piece && <div className="legal-move-dot" />}
      {isLegalMove && piece && <div className="legal-move-capture" />}
      {hasOwnTrap && (
        <div className="lightning-stun-trap" />
      )}
      {hasOwnLandmine && (
        <div className="dynamite-landmine-overlay" />
      )}
      {isStruck && <div className="lightning-ultimate-strike" />}
      {isExploded && <div className="dynamite-explosion-animation" />}
    </div>
  );
}
