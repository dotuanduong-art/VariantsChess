// ============================================================
// game-core - Public API
// ============================================================

// Board
export { Board, BOARD_SIZE } from './board/Board';
export type { SerializedBoard } from './board/Board';
export { toAlgebraic, fromAlgebraic, isInBounds, posEquals } from './board/Position';
export type { Position } from './board/Position';

// Pieces
export { PieceType, Color, oppositeColor } from './pieces/Piece';
export type { Piece } from './pieces/Piece';
export { createInitialBoard } from './pieces/initialLayout';

// Movement
export { getLegalMoves, getBaseLegalMoves } from './movement/MoveGenerator';

// Validation
export { validateMove } from './validation/MoveValidator';
export type { ValidationResult } from './validation/MoveValidator';

// Match
export { Match } from './match/Match';
export type { MatchStatus, MoveResult, SerializedMatch } from './match/Match';

// Effect
export type { EffectType, Effect } from './effect/Effect';
export type { EffectHandler } from './effect/EffectHandler';
export { EffectRegistry } from './effect/EffectRegistry';
export { StunHandler } from './effect/handlers/StunHandler';
export { MountainHandler } from './effect/handlers/MountainHandler';
export { ShieldHandler } from './effect/handlers/ShieldHandler';
export { SanctuaryHandler } from './effect/handlers/SanctuaryHandler';
export { BombHandler } from './effect/handlers/BombHandler';
export { LandmineHandler } from './effect/handlers/LandmineHandler';
export { BerserkHandler } from './effect/handlers/BerserkHandler';
export { SilenceHandler } from './effect/handlers/SilenceHandler';
export { BlessingHandler } from './effect/handlers/BlessingHandler';
export { JudgmentHandler } from './effect/handlers/JudgmentHandler';
export { FateHandler } from './effect/handlers/FateHandler';

// Event
export type { GameEventType, GameEvent } from './event/GameEvent';
export {
  createOnTurnStartEvent,
  createOnTurnEndEvent,
  createOnBeforeMoveEvent,
  createOnMoveEvent,
  createOnBeforeCaptureEvent,
  createOnCaptureEvent,
  createOnPieceDeathEvent,
  createOnBeforePieceDestroyedEvent,
  createOnPieceDestroyedEvent,
  createOnPieceSpawnEvent,
  createOnSkillUsedEvent,
  createOnEffectAppliedEvent,
  createOnEffectExpiredEvent,
  createOnEffectTickEvent,
  createOnAPGainedEvent,
  createOnAPSpentEvent,
  createOnPawnPromotionEvent,
  createOnGameOverEvent,
  createOnCheckEvent,
  createOnPieceAttackedEvent,
} from './event/GameEvent';
export { EventBus } from './event/EventBus';
export type { EventHandler, HandlerRegistration } from './event/EventBus';
export { PRIORITY } from './event/ResolutionOrder';

// Action
export type { Action } from './action/Action';
export { ActionHistory } from './action/ActionHistory';
export type { HistoryEntry } from './action/ActionHistory';

// Graveyard
export type { GraveyardEntry } from './state/Graveyard';

// RNG
export { DeterministicRng } from './rng/DeterministicRng';

// State
export { GameState } from './state/GameState';
export type { TurnPhase, SerializedGameState } from './state/GameState';
export { SnapshotManager } from './state/Snapshot';
export type { GameStateSnapshot } from './state/Snapshot';

// Action Pipeline
export { ActionPipeline, BasicMoveValidator, TurnPhaseValidator, APValidator, SkillValidator } from './action/ActionPipeline';
export type { ActionResult, ActionValidator } from './action/ActionPipeline';

// Combat — Attack Detection [Step 4]
export {
  getAttackedSquares,
  isSquareAttackedBy,
  getAttackedPieces,
  isKingAttacked,
} from './combat/AttackDetection';

// Region Utilities [Step 4]
export {
  getRegion,
  getSquareRegion,
  getCrossRegion,
  getXRegion,
  getDirectionalRect,
  getRingRegion,
  isInRegion,
} from './region/Region';
export type { RegionShape, Direction, RegionParams } from './region/Region';

// Move Modifier Chain [Step 4]
export type { MoveModifier, MoveModifierContext } from './modifier/MoveModifier';
export { MoveModifierChain } from './modifier/MoveModifierChain';

// Variant Plugin System [Step 6]
export type { VariantDefinition } from './variant/Variant';
export type { SkillTarget, SkillTargetRequirement, SkillDefinition } from './variant/Skill';
export { VariantRegistry } from './variant/VariantRegistry';
export { LightningVariant } from './variant/variants/LightningVariant';
export { GuardianVariant } from './variant/variants/GuardianVariant';
export { NephalemVariant } from './variant/variants/NephalemVariant';
export { AngelVariant } from './variant/variants/AngelVariant';
export { RequiemVariant } from './variant/variants/RequiemVariant';

