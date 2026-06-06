// ============================================================
// Board Component - 15x15 chess board
// ============================================================

'use client';

import { BOARD_SIZE, Board as BoardClass, Color, fromAlgebraic } from 'game-core';
import type { Position } from 'game-core';
import { useGameStore } from '../store/gameStore';
import Square from './Square';

const COL_LABELS = 'ABCDEFGHIJKLMNO';

export default function Board() {
  const {
    board: serializedBoard,
    playerColor,
    selectedSquare,
    legalMoves,
    lastMove,
    selectSquare,
  } = useGameStore();

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

  return (
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
  );
}
