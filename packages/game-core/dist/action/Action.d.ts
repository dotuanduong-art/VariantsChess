import { Position } from '../board/Position';
import { Piece, Color } from '../pieces/Piece';
import { Effect } from '../effect/Effect';
export type Action = MovePieceAction | CaptureAction | PawnPromotionAction | StartMatchAction | StartTurnAction | EndTurnAction | SwitchTurnAction | GameOverAction | TimeUpdateAction | GainAPAction | SpendAPAction | ApplyEffectAction | RemoveEffectAction | TickEffectsAction | UseSkillAction | PassSkillAction | AddToGraveyardAction | SpawnPieceAction | DestroyPieceAction | SwapPositionsAction | FoolMoveAction | SacrificePieceAction | PushPieceAction | TransformPieceAction | ZombieBiteAction | PhoenixRebirthAction | RemovePortalsAction;
export interface RemovePortalsAction {
    type: 'REMOVE_PORTALS';
    pairId: string;
}
export interface PhoenixRebirthAction {
    type: 'PHOENIX_REBIRTH';
    player: Color;
}
export interface ZombieBiteAction {
    type: 'ZOMBIE_BITE';
    attackerId: string;
    attackerPosition: Position;
    targetPosition: Position;
}
export interface TransformPieceAction {
    type: 'TRANSFORM_PIECE';
    pieceId: string;
    position: Position;
    newType: string;
    newColor?: Color;
}
export interface PushPieceAction {
    type: 'PUSH_PIECE';
    pieceId: string;
    from: Position;
    to: Position;
    reason: string;
}
export interface SwapPositionsAction {
    type: 'SWAP_POSITIONS';
    pieceAId: string;
    positionA: Position;
    pieceBId: string;
    positionB: Position;
    reason: string;
}
export interface FoolMoveAction {
    type: 'FOOL_MOVE';
    pieceId: string;
    from: Position;
    to: Position;
}
export interface MovePieceAction {
    type: 'MOVE_PIECE';
    pieceId: string;
    from: Position;
    to: Position;
}
export interface PassSkillAction {
    type: 'PASS_SKILL';
    player: Color;
}
export interface CaptureAction {
    type: 'CAPTURE';
    attackerId: string;
    from: Position;
    to: Position;
    capturedPieceId: string;
    capturedPieceSnapshot: Piece;
    /** If true, attacker stays at `from` instead of moving to `to` (Thunder Fang range-capture) */
    stayInPlace?: boolean;
}
export interface PawnPromotionAction {
    type: 'PAWN_PROMOTION';
    pieceId: string;
    position: Position;
    promotedTo: string;
}
export interface StartMatchAction {
    type: 'START_MATCH';
    rngSeed: number;
}
export interface StartTurnAction {
    type: 'START_TURN';
    player: Color;
}
export interface EndTurnAction {
    type: 'END_TURN';
    player: Color;
}
export interface SwitchTurnAction {
    type: 'SWITCH_TURN';
    fromPlayer: Color;
    toPlayer: Color;
}
export interface GameOverAction {
    type: 'GAME_OVER';
    winner: Color | null;
    reason: string;
}
export interface TimeUpdateAction {
    type: 'TIME_UPDATE';
    whiteTimeLeft: number;
    blackTimeLeft: number;
}
export interface GainAPAction {
    type: 'GAIN_AP';
    player: Color;
    amount: number;
    source: string;
}
export interface SpendAPAction {
    type: 'SPEND_AP';
    player: Color;
    amount: number;
    source: string;
}
export interface ApplyEffectAction {
    type: 'APPLY_EFFECT';
    effect: Effect;
}
export interface RemoveEffectAction {
    type: 'REMOVE_EFFECT';
    effectId: string;
    targetId: string;
    targetType: 'piece' | 'cell' | 'player';
    reason: string;
}
export interface TickEffectsAction {
    type: 'TICK_EFFECTS';
    timing: 'turnStart' | 'turnEnd';
    player: Color;
}
export interface UseSkillAction {
    type: 'USE_SKILL';
    player: Color;
    skillId: string;
    targets: any[];
}
export interface AddToGraveyardAction {
    type: 'ADD_TO_GRAVEYARD';
    piece: Piece;
    position: Position;
    killedBy: 'capture' | 'effect' | 'skill';
    killerId?: string;
}
export interface SpawnPieceAction {
    type: 'SPAWN_PIECE';
    piece: Piece;
    position: Position;
}
export interface DestroyPieceAction {
    type: 'DESTROY_PIECE';
    pieceId: string;
    position: Position;
    reason: string;
}
export interface SacrificePieceAction {
    type: 'SACRIFICE_PIECE';
    pieceId: string;
    position: Position;
    player: Color;
}
//# sourceMappingURL=Action.d.ts.map