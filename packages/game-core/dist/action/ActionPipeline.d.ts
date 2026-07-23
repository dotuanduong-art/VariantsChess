import { GameState } from '../state/GameState';
import { Action } from './Action';
import { PieceType } from '../pieces/Piece';
import { SnapshotManager } from '../state/Snapshot';
import { VariantRegistry } from '../variant/VariantRegistry';
export declare const CAPTURE_AP: Record<string, number>;
export declare const LOSS_AP: Record<string, number>;
export declare const PROMOTION_AP = 3;
export declare function mapReason(actionReason: string): 'capture' | 'skill' | 'effect' | 'explosion';
export interface ActionValidator {
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export interface ActionResult {
    success: boolean;
    reason?: string;
    actions: Action[];
}
import { EventBus } from '../event/EventBus';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
export declare class ActionPipeline {
    private validators;
    private queue;
    private state;
    private snapshots?;
    private eventBus?;
    private moveModifierChain?;
    private variantRegistry?;
    constructor(state: GameState, snapshots?: SnapshotManager, eventBus?: EventBus, moveModifierChain?: MoveModifierChain, variantRegistry?: VariantRegistry);
    private emitEvent;
    private detectAttacksAndChecks;
    private canPlayerUseAnySkill;
    private canSkillBeActivatedAnywhere;
    private getActiveEffects;
    private findPieceById;
    addValidator(validator: ActionValidator): void;
    private drainQueue;
    submitAction(action: Action): ActionResult;
    private applyAction;
    private checkPawnPromotion;
}
export declare class BasicMoveValidator implements ActionValidator {
    private moveModifierChain?;
    constructor(moveModifierChain?: MoveModifierChain);
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare class TurnPhaseValidator implements ActionValidator {
    private variantRegistry?;
    constructor(variantRegistry?: VariantRegistry);
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare class APValidator implements ActionValidator {
    private variantRegistry?;
    constructor(variantRegistry?: VariantRegistry);
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare class SkillValidator implements ActionValidator {
    private variantRegistry?;
    constructor(variantRegistry?: VariantRegistry);
    validate(action: Action, state: Readonly<GameState>): string | null;
}
export declare function getDevilTollAPCost(type: PieceType | string): number;
export declare class DevilTollValidator implements ActionValidator {
    validate(action: Action, state: Readonly<GameState>): string | null;
}
//# sourceMappingURL=ActionPipeline.d.ts.map