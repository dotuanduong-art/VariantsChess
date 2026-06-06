// ============================================================
// Square Component - Individual board square
// ============================================================

import type { Piece as PieceData, Position } from 'game-core';
import PieceComponent from './Piece';

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
  let className = 'square';
  className += isLight ? ' square-light' : ' square-dark';
  if (isSelected) className += ' square-selected';
  if (isLastMoveFrom || isLastMoveTo) className += ' square-last-move';

  return (
    <div
      className={className}
      onClick={() => onClick(pos)}
      data-col={pos.col}
      data-row={pos.row}
    >
      {piece && <PieceComponent piece={piece} />}
      {isLegalMove && !piece && <div className="legal-move-dot" />}
      {isLegalMove && piece && <div className="legal-move-capture" />}
    </div>
  );
}
