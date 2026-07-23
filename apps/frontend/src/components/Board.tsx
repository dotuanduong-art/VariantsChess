// ============================================================
// Board Component - 15x15 chess board
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { BOARD_SIZE, Board as BoardClass, Color, fromAlgebraic } from 'game-core';
import type { Position, Piece as PieceData } from 'game-core';
import { useGameStore } from '../store/gameStore';
import Square from './Square';
import { AnimatePresence } from 'framer-motion';

const COL_LABELS = 'ABCDEFGHIJKLMNO';

// Standard chess point values for display
const PIECE_AP_VALUES: Record<string, { capture: number; loss: number }> = {
  Pawn:   { capture: 2, loss: 1 },
  Knight: { capture: 3, loss: 2 },
  Bishop: { capture: 3, loss: 2 },
  Rook:   { capture: 4, loss: 3 },
  Queen:  { capture: 5, loss: 4 },
  King:   { capture: 0, loss: 0 },
};

interface ContextMenuData {
  x: number;
  y: number;
  piece: PieceData;
  pos: Position;
}

export default function Board() {
  const {
    board: serializedBoard,
    playerColor,
    selectedSquare,
    legalMoves,
    lastMove,
    selectSquare,
    sacrificePiece,
    variantState,
    currentTurn,
    hasMoved,
  } = useGameStore();

  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  // Listen for the custom context menu event
  useEffect(() => {
    const handleShowMenu = (e: Event) => {
      const customEvent = e as CustomEvent<ContextMenuData>;
      if (customEvent.detail) {
        setContextMenu(customEvent.detail);
      }
    };
    window.addEventListener('show-piece-context-menu', handleShowMenu);
    return () => {
      window.removeEventListener('show-piece-context-menu', handleShowMenu);
    };
  }, []);

  // Close context menu on any click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [contextMenu]);

  if (!serializedBoard) return null;

  const board = BoardClass.fromSerializable(serializedBoard);

  // Parse last move positions
  let lastMoveFrom: Position | null = null;
  let lastMoveTo: Position | null = null;
  if (lastMove) {
    try {
      lastMoveFrom = fromAlgebraic(lastMove.from);
      lastMoveTo = fromAlgebraic(lastMove.to);
    } catch {
      // ignore invalid
    }
  }

  // Determine if board should be flipped (Black sees board from their perspective)
  const isFlipped = playerColor === Color.Black;

  // Build rows array (14 down to 0 for White, 0 up to 14 for Black)
  const rows: number[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    rows.push(isFlipped ? r : BOARD_SIZE - 1 - r);
  }

  const cols: number[] = [];
  for (let c = 0; c < BOARD_SIZE; c++) {
    cols.push(isFlipped ? BOARD_SIZE - 1 - c : c);
  }

  const ctxPosLabel = contextMenu ? `${COL_LABELS[contextMenu.pos.col]}${contextMenu.pos.row + 1}` : '';
  const ctxApValues = contextMenu ? PIECE_AP_VALUES[contextMenu.piece.type] : null;

  return (
    <>
      <div className="board-container">
        {/* Column labels - top */}
        <div className="board-col-labels">
          <div className="board-corner" />
          {cols.map(c => (
            <div key={`col-top-${c}`} className="board-label">
              {COL_LABELS[c]}
            </div>
          ))}
          <div className="board-corner" />
        </div>

        {/* Board rows */}
        <AnimatePresence>
          {rows.map(row => (
            <div key={`row-${row}`} className="board-row">
              <div className="board-label row-label">{row + 1}</div>
              {cols.map(col => {
                const pos: Position = { col, row };
                const piece = board.getPiece(pos);
                const isLight = (col + row) % 2 === 1;
                const isSelected =
                  selectedSquare !== null &&
                  selectedSquare.col === col &&
                  selectedSquare.row === row;
                const isLegalMove = legalMoves.some(
                  m => m.col === col && m.row === row
                );
                const isLastMoveFrom =
                  lastMoveFrom !== null &&
                  lastMoveFrom.col === col &&
                  lastMoveFrom.row === row;
                const isLastMoveTo =
                  lastMoveTo !== null &&
                  lastMoveTo.col === col &&
                  lastMoveTo.row === row;

                return (
                  <Square
                    key={`${col}-${row}`}
                    pos={pos}
                    piece={piece}
                    isLight={isLight}
                    isSelected={isSelected}
                    isLegalMove={isLegalMove}
                    isLastMoveFrom={isLastMoveFrom}
                    isLastMoveTo={isLastMoveTo}
                    onClick={selectSquare}
                  />
                );
              })}
              <div className="board-label row-label">{row + 1}</div>
            </div>
          ))}
        </AnimatePresence>

        {/* Column labels - bottom */}
        <div className="board-col-labels">
          <div className="board-corner" />
          {cols.map(c => (
            <div key={`col-bot-${c}`} className="board-label">
              {COL_LABELS[c]}
            </div>
          ))}
          <div className="board-corner" />
        </div>
      </div>

      {/* Single right-click piece info popup (only one at a time) */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[220px] max-w-[280px] rounded-lg border border-[#d8c39e]/60 bg-[#0b0d19]/95 backdrop-blur-md p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col gap-1.5"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
          {/* Header: Piece Type + Color Badge */}
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-0.5">
            <span className="text-xs font-bold text-[#d8c39e] uppercase tracking-wider">{contextMenu.piece.type}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${contextMenu.piece.color === 'White' ? 'bg-gray-200 text-gray-900' : 'bg-gray-900 text-gray-200 border border-gray-600'}`}>
              {contextMenu.piece.color}
            </span>
          </div>

          {/* Position */}
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>Position: <span className="text-slate-200 font-bold">{ctxPosLabel}</span></span>
            <span>ID: <span className="text-slate-500 font-mono text-[9px]">{contextMenu.piece.id.slice(0, 12)}</span></span>
          </div>

          {/* AP Values */}
          {ctxApValues && (
            <div className="flex gap-3 text-[10px] border-t border-slate-700/60 pt-1 mt-0.5">
              <span className="text-green-400">
                <span className="text-slate-500">Capture AP:</span> +{ctxApValues.capture}
              </span>
              <span className="text-red-400">
                <span className="text-slate-500">Loss AP:</span> +{ctxApValues.loss}
              </span>
            </div>
          )}

          {/* Effects */}
          {contextMenu.piece.effects && contextMenu.piece.effects.length > 0 && (
            <div className="border-t border-slate-700 pt-1 mt-0.5">
              <span className="text-[9px] text-yellow-400 font-bold uppercase block mb-1">Active Effects</span>
              {contextMenu.piece.effects.map((effect, i) => {
                let durationText = '∞';
                if (effect.remainingDuration != null) {
                  durationText = `${effect.remainingDuration} round${effect.remainingDuration !== 1 ? 's' : ''}`;
                } else if (effect.type === 'berserk' && effect.metadata && typeof effect.metadata.captureCountdown === 'number') {
                  durationText = `Countdown: ${effect.metadata.captureCountdown}`;
                }
                return (
                  <div key={i} className="text-[10px] text-slate-300 flex justify-between py-0.5">
                    <span className={effect.isDebuff ? 'text-red-400' : 'text-green-400'}>{effect.type}</span>
                    <span className="text-slate-500">{durationText}</span>
                  </div>
                );
              })}
            </div>
          )}
          {(!contextMenu.piece.effects || contextMenu.piece.effects.length === 0) && (
            <div className="text-[9px] text-slate-650 italic">No active effects</div>
          )}

          {/* Sacrifice option under Devil's Toll */}
          {(() => {
            const canSacrifice =
              variantState?.devilTollActive === true &&
              currentTurn === playerColor &&
              !hasMoved &&
              contextMenu.piece.color === playerColor &&
              contextMenu.piece.type !== 'King';
            if (!canSacrifice) return null;
            return (
              <button
                className="mt-2 text-xs font-bold text-red-300 hover:text-white bg-red-950 hover:bg-red-800 border border-red-900/60 rounded-md py-1.5 px-3 transition-all active:scale-95 cursor-pointer shadow-sm text-center leading-none"
                onClick={() => {
                  sacrificePiece(contextMenu.pos, contextMenu.piece.id);
                  setContextMenu(null);
                }}
              >
                Sacrifice Piece (+{ctxApValues?.loss || 0} AP)
              </button>
            );
          })()}
        </div>
      )}
    </>
  );
}
