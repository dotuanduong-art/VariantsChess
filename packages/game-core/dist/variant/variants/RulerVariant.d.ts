import { VariantDefinition } from '../Variant';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { GameState } from '../../state/GameState';
import { ActionValidator } from '../../action/ActionPipeline';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare function isInZone(pos: Position): boolean;
export declare function isPathValid(from: Position, to: Position): boolean;
export declare class LawValidator implements ActionValidator {
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare const DomainBoundaryModifier: MoveModifier;
export declare const RulerVariant: VariantDefinition;
//# sourceMappingURL=RulerVariant.d.ts.map