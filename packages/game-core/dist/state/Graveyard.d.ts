import { Piece } from '../pieces/Piece';
import { Position } from '../board/Position';
export interface GraveyardEntry {
    piece: Piece;
    position: Position;
    turnDied: number;
    killedBy: 'capture' | 'effect' | 'skill';
    killerId?: string;
}
//# sourceMappingURL=Graveyard.d.ts.map