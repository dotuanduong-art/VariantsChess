// ============================================================
// Match - Game session management
// ============================================================

import { Board } from '../board/Board';
import { Position, toAlgebraic } from '../board/Position';
import { Color, PieceType } from '../pieces/Piece';
import { createInitialBoard } from '../pieces/initialLayout';
import { getLegalMoves } from '../movement/MoveGenerator';
import { GameState } from '../state/GameState';
import { Action } from '../action/Action';
import {
  ActionPipeline,
  BasicMoveValidator,
  TurnPhaseValidator,
  APValidator,
  SkillValidator,
  ActionResult,
} from '../action/ActionPipeline';
import { SnapshotManager } from '../state/Snapshot';
import { EventBus } from '../event/EventBus';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { EffectRegistry } from '../effect/EffectRegistry';
import { StunHandler } from '../effect/handlers/StunHandler';
import { MountainHandler } from '../effect/handlers/MountainHandler';
import { ShieldHandler } from '../effect/handlers/ShieldHandler';
import { SanctuaryHandler } from '../effect/handlers/SanctuaryHandler';
import { VariantRegistry } from '../variant/VariantRegistry';
import { ALL_VARIANTS } from '../variant/allVariants';
import { SkillTarget } from '../variant/Skill';
import { DeterministicRng } from '../rng/DeterministicRng';

export type MatchStatus = 'waiting' | 'playing' | 'finished';

export interface MoveResult {
  success: boolean;
  reason?: string;
  capturedPiece?: { type: PieceType; color: Color };
  isKingCaptured?: boolean;
}

export interface SerializedMatch {
  board: any; // SerializedBoard
  currentTurn: Color;
  status: MatchStatus;
  winner: Color | null;
  moveHistory: { from: string; to: string }[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastMoveTimestamp: number;
}

export class Match {
  private state: GameState;
  private pipeline: ActionPipeline;
  private snapshots: SnapshotManager;
  private eventBus: EventBus;
  private moveModifierChain: MoveModifierChain;
  private effectRegistry: EffectRegistry;
  private variantRegistry: VariantRegistry;
  private moveHistory: { from: string; to: string }[] = [];

  public turnTimeoutOverride: number | null = null;

  constructor() {
    this.state = new GameState();
    this.state.board = createInitialBoard();
    this.state.status = 'waiting';
    this.snapshots = new SnapshotManager();
    this.eventBus = new EventBus();
    
    this.variantRegistry = new VariantRegistry();
    for (const variant of ALL_VARIANTS) {
      this.variantRegistry.register(variant);
    }
    
    this.moveModifierChain = new MoveModifierChain();
    this.pipeline = new ActionPipeline(this.state, this.snapshots, this.eventBus, this.moveModifierChain, this.variantRegistry);

    this.effectRegistry = new EffectRegistry();
    this.effectRegistry.register(new StunHandler());
    this.effectRegistry.register(new MountainHandler());

    // Wire effects
    this.effectRegistry.wireToEventBus(this.eventBus, this.state);
    this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
    this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);

    // Register basic validators
    this.pipeline.addValidator(new BasicMoveValidator(this.moveModifierChain));
    this.pipeline.addValidator(new TurnPhaseValidator());
    this.pipeline.addValidator(new APValidator(this.variantRegistry));
    this.pipeline.addValidator(new SkillValidator(this.variantRegistry));
  }

  getTurnTimeoutMs(): number {
    if (this.turnTimeoutOverride !== null) {
      return this.turnTimeoutOverride;
    }
    if (this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null) {
      return this.state.variantState.turnTimeoutOverride;
    }
    return 15000;
  }

  /**
   * Start the match
   */
  start(): void {
    if (this.state.status !== 'waiting') {
      throw new Error('Match already started');
    }

    const result = this.pipeline.submitAction({
      type: 'START_MATCH',
      rngSeed: this.state.rngSeed,
    });

    if (!result.success) {
      throw new Error(`Failed to start match: ${result.reason}`);
    }
  }

  /**
   * Attempt to make a move. Returns the result.
   */
  makeMove(playerColor: Color, from: Position, to: Position): MoveResult {
    if (this.state.status !== 'playing') {
      return { success: false, reason: 'Match is not in progress' };
    }

    const now = Date.now();
    const elapsed = this.moveHistory.length === 0 ? 0 : now - this.state.lastMoveTimestamp;

    const turnTimeout = this.getTurnTimeoutMs();
    const isOverrideActive = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
    if (isOverrideActive && this.moveHistory.length > 0) {
      if (elapsed >= turnTimeout) {
        return { success: false, reason: 'Turn timeout' };
      }
    }

    // Process time
    if (!isOverrideActive) {
      if (this.state.currentTurn === Color.White) {
        this.state.whiteTimeLeft -= elapsed;
        if (this.state.whiteTimeLeft <= 0) {
          this.pipeline.submitAction({
            type: 'GAME_OVER',
            winner: Color.Black,
            reason: 'Time out',
          });
          return { success: false, reason: 'Time out' };
        }
        // +5 seconds increment only when under 1 minute
        if (this.state.whiteTimeLeft < 60000) {
          this.state.whiteTimeLeft += 5000;
        }
      } else {
        this.state.blackTimeLeft -= elapsed;
        if (this.state.blackTimeLeft <= 0) {
          this.pipeline.submitAction({
            type: 'GAME_OVER',
            winner: Color.White,
            reason: 'Time out',
          });
          return { success: false, reason: 'Time out' };
        }
        // +5 seconds increment only when under 1 minute
        if (this.state.blackTimeLeft < 60000) {
          this.state.blackTimeLeft += 5000;
        }
      }

      this.pipeline.submitAction({
        type: 'TIME_UPDATE',
        whiteTimeLeft: this.state.whiteTimeLeft,
        blackTimeLeft: this.state.blackTimeLeft,
      });
    }

    this.state.lastMoveTimestamp = now;

    // Get piece details before move
    const piece = this.state.board.getPiece(from);
    const target = this.state.board.getPiece(to);

    if (!piece) {
      return { success: false, reason: 'No piece at starting position' };
    }

    // Create action details
    let action: Action;
    if (target) {
      action = {
        type: 'CAPTURE',
        attackerId: piece.id,
        from,
        to,
        capturedPieceId: target.id,
        capturedPieceSnapshot: { ...target },
      };
    } else {
      action = {
        type: 'MOVE_PIECE',
        pieceId: piece.id,
        from,
        to,
      };
    }

    const result = this.pipeline.submitAction(action);
    if (!result.success) {
      return { success: false, reason: result.reason };
    }

    if (target && this.state.board.getPiece(to) === target) {
      return { success: false, reason: 'Captured piece is protected by shield' };
    }

    // Record move
    this.moveHistory.push({ from: toAlgebraic(from), to: toAlgebraic(to) });

    return {
      success: true,
      capturedPiece: target ? { type: target.type, color: target.color } : undefined,
      isKingCaptured: target?.type === PieceType.King,
    };
  }

  /**
   * Submit any action directly (e.g. for skills or pass skill)
   */
  submitAction(action: Action): ActionResult {
    return this.pipeline.submitAction(action);
  }

  /**
   * Get legal moves for a position (used by frontend for highlighting)
   */
  getLegalMovesAt(pos: Position): Position[] {
    return this.moveModifierChain.computeLegalMoves(this.state.board, pos, this.state);
  }

  getMoveModifierChain(): MoveModifierChain {
    return this.moveModifierChain;
  }

  getEffectRegistry(): EffectRegistry {
    return this.effectRegistry;
  }

  getVariantRegistry(): VariantRegistry {
    return this.variantRegistry;
  }

  setVariants(whiteVariantId: string | null, blackVariantId: string | null): void {
    this.state.whiteVariantId = whiteVariantId;
    this.state.blackVariantId = blackVariantId;

    if (whiteVariantId) {
      this.variantRegistry.loadForPlayer(
        whiteVariantId,
        Color.White,
        this.effectRegistry,
        this.eventBus,
        this.moveModifierChain,
        this.state
      );
    }

    if (blackVariantId) {
      this.variantRegistry.loadForPlayer(
        blackVariantId,
        Color.Black,
        this.effectRegistry,
        this.eventBus,
        this.moveModifierChain,
        this.state
      );
    }
    this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
    this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);
  }

  useSkill(playerColor: Color, skillId: string, targets: SkillTarget[]): ActionResult {
    return this.pipeline.submitAction({
      type: 'USE_SKILL',
      player: playerColor,
      skillId,
      targets,
    });
  }

  handleTimeoutSkip(playerColor: Color): ActionResult {
    const actions: Action[] = [];
    const pieces: { piece: any; pos: Position }[] = [];

    // Find all pieces of the player (excluding King)
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const pos = { col: c, row: r };
        const p = this.state.board.getPiece(pos);
        if (p && p.color === playerColor && p.type !== PieceType.King) {
          pieces.push({ piece: p, pos });
        }
      }
    }

    if (pieces.length > 0) {
      const rng = new DeterministicRng(this.state.rngSeed, this.state.rngCounter);
      const idx = rng.nextInt(0, pieces.length - 1);
      this.state.rngCounter = rng.getState().counter;
      const chosen = pieces[idx];

      actions.push({
        type: 'APPLY_EFFECT',
        effect: {
          id: `stun_timeout_${Date.now()}_${chosen.piece.id}`,
          type: 'stun',
          duration: 3,
          remainingDuration: 3,
          tickTiming: 'turnEnd',
          sourcePlayer: playerColor === Color.White ? Color.Black : Color.White,
          targetType: 'piece',
          targetId: chosen.piece.id,
          stackingRule: 'refresh',
          isDebuff: true,
          metadata: {},
        }
      });
    }

    // Force end turn
    actions.push({
      type: 'END_TURN',
      player: playerColor,
    });

    let lastResult: ActionResult = { success: true, actions: [] };
    for (const action of actions) {
      const res = this.pipeline.submitAction(action);
      if (!res.success) {
        return res;
      }
      lastResult.actions.push(...res.actions);
    }
    return lastResult;
  }

  getBoard(): Board {
    return this.state.board;
  }

  getCurrentTurn(): Color {
    return this.state.currentTurn;
  }

  getStatus(): MatchStatus {
    return this.state.status;
  }

  getWinner(): Color | null {
    return this.state.winner;
  }

  getMoveHistory(): { from: string; to: string }[] {
    return [...this.moveHistory];
  }

  getGameState(): GameState {
    return this.state;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getSnapshots(): SnapshotManager {
    return this.snapshots;
  }

  /**
   * Check if the current player has run out of time
   */
  checkTimeout(): Color | null {
    if (this.state.status !== 'playing') return null;
    if (this.moveHistory.length === 0) return null;
    
    const now = Date.now();
    const elapsed = now - this.state.lastMoveTimestamp;
    
    if (this.state.currentTurn === Color.White && this.state.whiteTimeLeft - elapsed <= 0) {
      this.pipeline.submitAction({
        type: 'GAME_OVER',
        winner: Color.Black,
        reason: 'Time out',
      });
      this.state.whiteTimeLeft = 0;
      return Color.Black;
    } else if (this.state.currentTurn === Color.Black && this.state.blackTimeLeft - elapsed <= 0) {
      this.pipeline.submitAction({
        type: 'GAME_OVER',
        winner: Color.White,
        reason: 'Time out',
      });
      this.state.blackTimeLeft = 0;
      return Color.White;
    }
    
    return null;
  }

  /**
   * Serialize the entire match state for network transfer
   */
  toSerializable(): SerializedMatch {
    return {
      board: this.state.board.toSerializable(),
      currentTurn: this.state.currentTurn,
      status: this.state.status,
      winner: this.state.winner,
      moveHistory: [...this.moveHistory],
      whiteTimeLeft: this.state.whiteTimeLeft,
      blackTimeLeft: this.state.blackTimeLeft,
      lastMoveTimestamp: this.state.lastMoveTimestamp,
    };
  }

  private getValidPositionsForRequirement(
    player: Color,
    skill: any,
    reqIndex: number
  ): Position[] {
    const req = skill.getTargetRequirements()[reqIndex];
    if (!req) return [];

    const positions: Position[] = [];
    const board = this.state.board;

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const pos = { col: c, row: r };
        const piece = board.getPiece(pos);

        // Check region constraint if defined
        if (req.region && !req.region.some((p: any) => p.col === c && p.row === r)) {
          continue;
        }

        if (req.excludeKing && piece && piece.type === PieceType.King) {
          continue;
        }

        // 1. Basic Type & Filter Checks
        if (req.type === 'piece') {
          if (!piece) continue;
          if (req.filter === 'ally' && piece.color !== player) continue;
          if (req.filter === 'enemy' && piece.color === player) continue;
        } else if (req.type === 'cell') {
          if (req.filter === 'empty') {
            const cellEffects = board.getCellEffects(pos) || [];
            const hasObstacle = cellEffects.some(e => e.type === 'flame' || e.type === 'mountain');
            if (piece || hasObstacle) continue;
          }
          if (req.filter === 'ally') {
            if (!piece || piece.color !== player) continue;
          }
          if (req.filter === 'enemy') {
            if (!piece || piece.color === player) continue;
          }
        }

        // 2. Extra skill-specific validation (dry-run/helpers)
        if (skill.id === 'lightning_thunder_trap') {
          const existing = board.getCellEffects(pos)
            .find(e => e.type === 'thunder_trap' && e.sourcePlayer === player);
          if (existing) continue;
        }

        if (skill.id === 'dynamite_live_charge') {
          if (piece && piece.effects && piece.effects.some(e => e.type === 'bomb')) {
            continue;
          }
        }

        positions.push(pos);
      }
    }
    return positions;
  }

  serializeForPlayer(player: Color) {
    const serialized = this.state.serializeForPlayer(player);
    
    // Compute available skill targets
    const availableSkillTargets: Record<string, {
      requirements: any[];
      validPositions: Position[][];
    }> = {};

    // Only compute if it's the player's active turn and game is playing
    if (this.state.status === 'playing' && this.state.currentTurn === player) {
      const variantId = player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
      if (variantId) {
        const variant = this.variantRegistry.get(variantId);
        if (variant) {
          const skillsDisabled = this.state.variantState.skillsDisabled === true;
          const maxSkillsPerTurn = 1;
          const skillsUsed = this.state.skillsUsedThisTurn ?? 0;
          const ap = player === Color.White ? this.state.whiteAP : this.state.blackAP;

          if (!skillsDisabled && skillsUsed < maxSkillsPerTurn && !this.state.passSkillSubmitted) {
            for (const skill of variant.skills) {
              const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
              
              // Only expose targets if player has sufficient AP to cast
              if (ap >= cost) {
                const reqs = skill.getTargetRequirements();
                const validPositions: Position[][] = [];
                for (let i = 0; i < reqs.length; i++) {
                  validPositions.push(this.getValidPositionsForRequirement(player, skill, i));
                }
                availableSkillTargets[skill.id] = {
                  requirements: reqs,
                  validPositions,
                };
              } else {
                // Return empty targets if AP is not enough
                const reqs = skill.getTargetRequirements();
                availableSkillTargets[skill.id] = {
                  requirements: reqs,
                  validPositions: reqs.map(() => []),
                };
              }
            }
          }
        }
      }
    }

    return {
      ...serialized,
      availableSkillTargets,
    };
  }
}
