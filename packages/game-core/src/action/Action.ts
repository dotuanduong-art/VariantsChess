import { Position } from '../board/Position';
import { Piece, Color } from '../pieces/Piece';
import { Effect } from '../effect/Effect';

export type Action =
  // === Core chess ===
  | MovePieceAction
  | CaptureAction        // move + remove captured piece
  | PawnPromotionAction   // auto-promote to Queen on back rank
  // === Turn management ===
  | StartMatchAction
  | StartTurnAction
  | EndTurnAction
  | SwitchTurnAction
  // === Win condition ===
  | GameOverAction
  // === Time ===
  | TimeUpdateAction
  // === AP ===
  | GainAPAction
  | SpendAPAction
  // === Effect (Step 5) ===
  | ApplyEffectAction
  | RemoveEffectAction
  | TickEffectsAction
  // === Skill (Step 6) ===
  | UseSkillAction
  | PassSkillAction
  // === Graveyard ===
  | AddToGraveyardAction
  // === Piece lifecycle ===
  | SpawnPieceAction       // for resurrection skills
  | DestroyPieceAction     // for skill-based kills (not capture)
  ;

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
  capturedPieceSnapshot: Piece;   // full snapshot for undo/graveyard
}

export interface PawnPromotionAction {
  type: 'PAWN_PROMOTION';
  pieceId: string;
  position: Position;
  promotedTo: string; // e.g. 'Queen'
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
  source: string;   // e.g. 'capture_reward', 'loss_reward', 'promotion', 'passive'
}

export interface SpendAPAction {
  type: 'SPEND_AP';
  player: Color;
  amount: number;
  source: string;   // e.g. 'use_skill'
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
