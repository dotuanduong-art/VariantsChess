import { VariantDefinition } from '../Variant';
import { Color } from '../../pieces/Piece';
import { GameState } from '../../state/GameState';
import { Position } from '../../board/Position';
export interface DimensionPortal {
    id: string;
    position: Position;
    type: 'odd' | 'even';
    owner: Color;
    occupantId: string | null;
    isHidden?: boolean;
}
export interface DimensionPair {
    odd: DimensionPortal;
    even: DimensionPortal;
    owner: Color;
    createdAtRound: number;
}
export declare function syncDimensionPortalCellEffects(state: GameState): void;
export declare const SpaceVariant: VariantDefinition;
//# sourceMappingURL=SpaceVariant.d.ts.map