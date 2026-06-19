import { Piece } from '../pieces/Piece';
import { Position } from '../board/Position';

export interface GraveyardEntry {
  piece: Piece;               // full snapshot at death
  position: Position;         // where it died
  turnDied: number;
  killedBy: 'capture' | 'effect' | 'skill';   // cause of death
  killerId?: string;          // pieceId or skillId that caused it
}
