// ============================================================
// Match - Game session management
// ============================================================

import { Board, BOARD_SIZE } from '../board/Board';
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
  DevilTollValidator,
} from '../action/ActionPipeline';
import { SnapshotManager } from '../state/Snapshot';
import { EventBus } from '../event/EventBus';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { EffectRegistry } from '../effect/EffectRegistry';
import { StunHandler } from '../effect/handlers/StunHandler';
import { ShieldHandler } from '../effect/handlers/ShieldHandler';
import { SanctuaryHandler } from '../effect/handlers/SanctuaryHandler';
import { DevilEyeHandler } from '../effect/handlers/DevilEyeHandler';
import { DevilTollHandler } from '../effect/handlers/DevilTollHandler';
import { PredictionHandler } from '../effect/handlers/PredictionHandler';
import { TimeFreezeHandler } from '../effect/handlers/TimeFreezeHandler';
import { DragonGazeHandler } from '../effect/handlers/DragonGazeHandler';
import { SummonDurationHandler } from '../effect/handlers/SummonDurationHandler';
import { CellEffectBlockModifier } from '../modifier/CellEffectBlockModifier';


import { VariantRegistry } from '../variant/VariantRegistry';
import { ALL_VARIANTS } from '../variant/allVariants';
import { SkillTarget } from '../variant/Skill';
import { DeterministicRng } from '../rng/DeterministicRng';
import { getCrossCells, getXCells } from '../variant/variants/KazehimeVariant';
import { isSquareAttackedBy } from '../combat/AttackDetection';

export type MatchStatus = 'waiting' | 'playing' | 'finished';

export interface MoveResult {
  success: boolean;
  reason?: string;
  capturedPiece?: { type: PieceType | string; color: Color };
  isKingCaptured?: boolean;
  isStealthMove?: boolean;
}

export interface SerializedMatch {
  board: any; // SerializedBoard
  currentTurn: Color;
  status: MatchStatus;
  winner: Color | null;
  moveHistory: { from: string; to: string; isStealth?: boolean; moverColor?: Color }[];
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
  private moveHistory: { from: string; to: string; isStealth?: boolean; moverColor?: Color }[] = [];

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
    this.moveModifierChain.register(new CellEffectBlockModifier());
    this.pipeline = new ActionPipeline(this.state, this.snapshots, this.eventBus, this.moveModifierChain, this.variantRegistry);

    this.effectRegistry = new EffectRegistry();
    this.effectRegistry.register(new StunHandler());
    this.effectRegistry.register(new DevilEyeHandler());
    this.effectRegistry.register(new DevilTollHandler());
    this.effectRegistry.register(new PredictionHandler());
    this.effectRegistry.register(new TimeFreezeHandler());
    this.effectRegistry.register(new DragonGazeHandler());
    this.effectRegistry.register(new SummonDurationHandler());




    // Wire effects
    this.effectRegistry.wireToEventBus(this.eventBus, this.state);
    this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
    this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);

    // Register basic validators
    this.pipeline.addValidator(new BasicMoveValidator(this.moveModifierChain));
    this.pipeline.addValidator(new TurnPhaseValidator(this.variantRegistry));
    this.pipeline.addValidator(new APValidator(this.variantRegistry));
    this.pipeline.addValidator(new SkillValidator(this.variantRegistry));
    this.pipeline.addValidator(new DevilTollValidator());
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
  makeMove(playerColor: Color, from: Position, to: Position, moveType?: string): MoveResult {
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
    const hasMainBefore = target?.effects?.some(e => e.type === 'main');
    
    let isPredatorStealth = false;
    if (piece) {
      const ownerEffects = this.state.getPlayerEffects(piece.color);
      const hasApexCamouflage = ownerEffects.some(e => e.type === 'apex_camouflage');
      isPredatorStealth = !!(
        hasApexCamouflage &&
        piece.type !== PieceType.King &&
        !(this.state.variantState.revealedPieceIds || []).includes(piece.id)
      );
    }

    const isStealthMove = !!(piece && (
      piece.effects?.some((e: any) => 
        (e.type === 'ghost' && e.metadata?.stealth === true) || 
        e.type === 'invisible' || 
        e.type === 'stealth' || 
        e.isHidden === true
      ) ||
      isPredatorStealth
    ));

    if (!piece) {
      return { success: false, reason: 'No piece at starting position' };
    }

    // Create action details
    let action: Action;
    if (moveType === 'zombie_bite') {
      action = {
        type: 'ZOMBIE_BITE',
        attackerId: piece.id,
        attackerPosition: from,
        targetPosition: to,
      };
    } else if (target) {
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

    if (action.type === 'CAPTURE' && target && this.state.board.getPiece(to) === target && !hasMainBefore) {
      return { success: false, reason: 'Captured piece is protected by shield' };
    }

    // Record move
    this.moveHistory.push({
      from: toAlgebraic(from),
      to: toAlgebraic(to),
      isStealth: isStealthMove,
      moverColor: playerColor,
    });

    return {
      success: true,
      capturedPiece: target ? { type: target.type, color: target.color } : undefined,
      isKingCaptured: target?.type === PieceType.King,
      isStealthMove,
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
        this.state,
        this.pipeline
      );
    }

    if (blackVariantId) {
      this.variantRegistry.loadForPlayer(
        blackVariantId,
        Color.Black,
        this.effectRegistry,
        this.eventBus,
        this.moveModifierChain,
        this.state,
        this.pipeline
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

  getMoveHistory(): { from: string; to: string; isStealth?: boolean; moverColor?: Color }[] {
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
    const req = skill.getTargetRequirements(this.state, player)[reqIndex];
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
          if (req.pieceType && piece.type !== req.pieceType) continue;
        } else if (req.type === 'cell') {
          if (req.filter === 'empty') {
            const cellEffects = board.getCellEffects(pos) || [];
            const hasObstacle = cellEffects.some(e => e.type === 'flame');
            if (piece || hasObstacle) continue;
          }
          if (req.filter === 'ally') {
            if (!piece || piece.color !== player) continue;
          }
          if (req.filter === 'enemy') {
            if (!piece || piece.color === player) continue;
          }
        }

        // Check single-target validation dynamically
        const reqs = skill.getTargetRequirements(this.state, player);
        if (reqs.length === 1) {
          const testTarget = req.type === 'piece'
            ? { type: 'piece', position: pos, pieceId: piece?.id }
            : { type: 'cell', position: pos };
          if (skill.canActivate(this.state, player, [testTarget]) !== null) {
            continue;
          }
        }

        // 2. Extra skill-specific validation (dry-run/helpers)
        if (skill.id === 'kaze_repel') {
          const cells = getCrossCells(pos);
          let isValid = true;
          for (const c of cells) {
            if (c.col < 0 || c.col >= BOARD_SIZE || c.row < 0 || c.row >= BOARD_SIZE) {
              isValid = false;
              break;
            }
            if (board.getPiece(c)) {
              isValid = false;
              break;
            }
            const hasTrap = board.getCellEffects(c).some(
              e => e.type === 'repel' || e.type === 'soulless_cell'
            );
            if (hasTrap) {
              isValid = false;
              break;
            }
          }
          if (!isValid) continue;
        }

        if (skill.id === 'kaze_soulless') {
          const cells = getXCells(pos);
          let isValid = true;
          for (const c of cells) {
            if (c.col < 0 || c.col >= BOARD_SIZE || c.row < 0 || c.row >= BOARD_SIZE) {
              isValid = false;
              break;
            }
            if (board.getPiece(c)) {
              isValid = false;
              break;
            }
            const hasTrap = board.getCellEffects(c).some(
              e => e.type === 'repel' || e.type === 'soulless_cell'
            );
            if (hasTrap) {
              isValid = false;
              break;
            }
          }
          if (!isValid) continue;
        }

        if (skill.id === 'predator_shadow_prowl') {
          if (!isSquareAttackedBy(board, pos, player, this.state)) {
            continue;
          }
          const hasTrap = board.getCellEffects(pos).some(
            e => e.type === 'repel' || e.type === 'soulless_cell'
          );
          if (hasTrap) continue;
        }

        if (skill.id === 'phoenix_ashes') {
          if (reqIndex === 0) {
            continue;
          }
        }

        if (skill.id === 'earth_shifting_peaks') {
          if (reqIndex === 0) {
            if (!piece || piece.specialType !== 'mountain' || piece.color !== player) {
              continue;
            }
          }
        }

        if (skill.id === 'turtle_transference') {
          if (reqIndex === 0) {
            if (!piece) continue;
            const isEnemy = piece.color !== player;
            const hasValidEffect = piece.effects?.some(e => {
              const isTransferableType = ['stun', 'shield', 'blessing', 'electron', 'ghost'].includes(e.type);
              if (!isTransferableType) return false;
              return isEnemy ? !e.isDebuff : e.isDebuff;
            });
            if (!hasValidEffect) continue;
          }
          if (reqIndex === 1) {
            if (!piece || piece.type === PieceType.King) {
              continue;
            }
          }
        }

        if (skill.id === 'zombie_infection') {
          if (piece && piece.effects && piece.effects.some(e => e.type === 'zombie' || e.type === 'walker')) {
            continue;
          }
        }

        if (skill.id === 'zombie_mutation') {
          if (!piece || !piece.effects || !piece.effects.some(e => e.type === 'walker')) {
            continue;
          }
        }

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

        if (skill.id === 'magician_swap_allies' || skill.id === 'magician_swap_movements') {
          if (piece && piece.effects && piece.effects.some(e => e.type === 'position_swap' || e.type === 'moveset_swap')) {
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
    
    const serializedHistory = this.moveHistory.map(entry => {
      if (entry.isStealth && entry.moverColor !== player) {
        return {
          from: '',
          to: '',
          isStealth: true,
          moverColor: entry.moverColor,
        };
      }
      return entry;
    });

    // Compute available skill targets
    const availableSkillTargets: Record<string, {
      requirements: any[];
      validPositions: Position[][];
      currentCost: number;
    }> = {};

    // Only compute if it's the player's active turn and game is playing
    if (this.state.status === 'playing' && this.state.currentTurn === player) {
      const variantId = player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
      if (variantId) {
        const variant = this.variantRegistry.get(variantId);
        if (variant) {
          const isPhoenixSkillDisabled = variantId === 'phoenix' && this.state.variantState.phoenixSkillsDisabled?.[player] === true;
          const skillsDisabled = this.state.variantState.skillsDisabled === true || isPhoenixSkillDisabled;
          const maxSkillsPerTurn = variant.maxSkillsPerTurn ?? 1;
          const skillsUsed = this.state.skillsUsedThisTurn ?? 0;
          const ap = player === Color.White ? this.state.whiteAP : this.state.blackAP;
          const isPirateDebt = this.state.variantState[`pirateDebtEnabled_${player}`] === true;

          if (!skillsDisabled && skillsUsed < maxSkillsPerTurn && !this.state.passSkillSubmitted) {
            for (const skill of variant.skills) {
              let cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
              if (this.state.getPlayerEffects(player).some(e => e.type === 'emerald_domain')) {
                cost += 1;
              }
              const hasUsedThisSkill = this.state.skillsUsedThisTurnIds?.includes(skill.id);
              
              let canAfford = false;
              if (isPirateDebt) {
                canAfford = ap >= 0 && (ap - cost >= -10);
              } else {
                canAfford = ap >= cost;
              }
              
              if (canAfford && !hasUsedThisSkill) {

                const reqs = skill.getTargetRequirements(this.state, player);
                const validPositions: Position[][] = [];
                for (let i = 0; i < reqs.length; i++) {
                  validPositions.push(this.getValidPositionsForRequirement(player, skill, i));
                }
                availableSkillTargets[skill.id] = {
                  requirements: reqs,
                  validPositions,
                  currentCost: cost,
                };
              } else {
                const reqs = skill.getTargetRequirements(this.state, player);
                availableSkillTargets[skill.id] = {
                  requirements: reqs,
                  validPositions: reqs.map(() => []),
                  currentCost: cost,
                };
              }
            }
          }
        }
      }
    }

    // Compute opponent skill costs (state-dependent, no validPositions needed)
    const opponent = player === Color.White ? Color.Black : Color.White;
    const opponentVariantId = opponent === Color.White
      ? this.state.whiteVariantId : this.state.blackVariantId;
    const opponentSkillCosts: Record<string, number> = {};
    if (opponentVariantId) {
      const opponentVariant = this.variantRegistry.get(opponentVariantId);
      if (opponentVariant) {
        const opponentHasEmeraldDomain = this.state.getPlayerEffects(opponent)
          .some(e => e.type === 'emerald_domain');
        for (const skill of opponentVariant.skills) {
          let skillCost = typeof skill.apCost === 'function'
            ? skill.apCost(this.state, opponent) : skill.apCost;
          if (opponentHasEmeraldDomain) skillCost += 1;
          opponentSkillCosts[skill.id] = skillCost;
        }
      }
    }

    return {
      ...serialized,
      moveHistory: serializedHistory,
      availableSkillTargets,
      opponentSkillCosts,
    };
  }
}
