import { GameState } from '../state/GameState';
import { Action } from './Action';
import { ActionQueue } from './ActionQueue';
import { Color, oppositeColor, PieceType, Piece } from '../pieces/Piece';
import { validateMove } from '../validation/MoveValidator';
import { SnapshotManager } from '../state/Snapshot';
import { Position } from '../board/Position';
import { BOARD_SIZE } from '../board/Board';
import { Effect } from '../effect/Effect';
import { VariantRegistry } from '../variant/VariantRegistry';
import { DeterministicRng } from '../rng/DeterministicRng';

export const CAPTURE_AP: Record<string, number> = {
  Pawn: 2,
  Knight: 3,
  Bishop: 3,
  Rook: 4,
  Queen: 5,
  King: 0,
};

export const LOSS_AP: Record<string, number> = {
  Pawn: 1,
  Knight: 2,
  Bishop: 2,
  Rook: 3,
  Queen: 4,
  King: 0,
};

export const PROMOTION_AP = 3;

export function mapReason(actionReason: string): 'capture' | 'skill' | 'effect' | 'explosion' {
  if (actionReason === 'capture') return 'capture';
  if (actionReason === 'explosion') return 'explosion';
  if (actionReason === 'raigeki' || actionReason === 'detonation') return 'skill';
  return 'effect';
}

export interface ActionValidator {
  validate(action: Action, state: Readonly<GameState>): string | null;
}

export interface ActionResult {
  success: boolean;
  reason?: string;
  actions: Action[];
}

import { EventBus } from '../event/EventBus';
import {
  GameEvent,
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
} from '../event/GameEvent';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { getAttackedPieces, isKingAttacked } from '../combat/AttackDetection';

export class ActionPipeline {
  private validators: ActionValidator[] = [];
  private queue: ActionQueue;
  private state: GameState;
  private snapshots?: SnapshotManager;
  private eventBus?: EventBus;
  private moveModifierChain?: MoveModifierChain;
  private variantRegistry?: VariantRegistry;

  constructor(
    state: GameState,
    snapshots?: SnapshotManager,
    eventBus?: EventBus,
    moveModifierChain?: MoveModifierChain,
    variantRegistry?: VariantRegistry
  ) {
    this.state = state;
    this.queue = new ActionQueue();
    this.snapshots = snapshots;
    this.eventBus = eventBus;
    this.moveModifierChain = moveModifierChain;
    this.variantRegistry = variantRegistry;
  }

  private emitEvent(event: GameEvent): void {
    if (this.eventBus) {
      this.eventBus.emit(event, (action) => this.queue.enqueue(action));
    }
  }

  private detectAttacksAndChecks(): void {
    const opponentColor = this.state.currentTurn === Color.White ? Color.Black : Color.White;
    
    // Get all pieces under attack by the active player
    const attacks = getAttackedPieces(this.state.board, this.state.currentTurn, this.state);
    for (const atk of attacks) {
      this.emitEvent(createOnPieceAttackedEvent(
        this.state.turnNumber,
        this.state.currentTurn,
        atk.attacker,
        atk.target,
        atk.attackerPos,
        atk.targetPos
      ));
    }

    // Check if opponent King is under check
    if (isKingAttacked(this.state.board, opponentColor, this.state)) {
      const kingAttacks = attacks.filter(atk => atk.target.type === PieceType.King);
      
      // Find King position and piece details
      let kingPos = { col: -1, row: -1 };
      let kingPiece: any = null;
      
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const p = this.state.board.getPiece({ col: c, row: r });
          if (p && p.type === PieceType.King && p.color === opponentColor) {
            kingPos = { col: c, row: r };
            kingPiece = p;
            break;
          }
        }
      }

      if (kingPiece) {
        this.emitEvent(createOnCheckEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          kingAttacks.map(atk => ({ piece: atk.attacker, position: atk.attackerPos })),
          kingPiece,
          kingPos
        ));
      }
    }
  }

  private canPlayerUseAnySkill(player: Color): boolean {
    if (!this.variantRegistry) return true;
    const variantId = player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
    if (!variantId) return true;

    const variant = this.variantRegistry.get(variantId);
    if (!variant) return true;

    const maxSkillsPerTurn = 1;
    if (this.state.skillsUsedThisTurn >= maxSkillsPerTurn) {
      return false;
    }

    if (this.state.passSkillSubmitted) {
      return false;
    }

    if (this.state.variantState.skillsDisabled) {
      return false;
    }

    const playerAP = player === Color.White ? this.state.whiteAP : this.state.blackAP;

    for (const skill of variant.skills) {
      const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
      if (playerAP >= cost) {
        if (this.canSkillBeActivatedAnywhere(skill, player)) {
          return true;
        }
      }
    }
    return false;
  }

  private canSkillBeActivatedAnywhere(skill: any, player: Color): boolean {
    const reqs = skill.getTargetRequirements();
    if (reqs.length === 0) {
      return skill.canActivate(this.state, player, []) === null;
    }

    if (reqs.length === 1) {
      const req = reqs[0];
      if (req.type === 'cell') {
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            if (skill.canActivate(this.state, player, [{ type: 'cell', position: pos }]) === null) {
              return true;
            }
          }
        }
      } else if (req.type === 'piece') {
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = this.state.board.getPiece(pos);
            if (piece) {
              if (skill.canActivate(this.state, player, [{ type: 'piece', position: pos, pieceId: piece.id }]) === null) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    return true;
  }

  private getActiveEffects(): Effect[] {
    const effects: Effect[] = [];
    
    // Pieces
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.state.board.getPiece({ col: c, row: r });
        if (p && p.effects) {
          effects.push(...p.effects);
        }
      }
    }

    // Cells
    const allCellEffects = this.state.board.getAllCellEffects();
    for (const cellEffects of allCellEffects.values()) {
      effects.push(...cellEffects);
    }

    // Players
    effects.push(...this.state.whitePlayerEffects);
    effects.push(...this.state.blackPlayerEffects);

    return effects;
  }

  private findPieceById(id: string): { piece: Piece; pos: Position } | null {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = this.state.board.getPiece({ col: c, row: r });
        if (p && p.id === id) {
          return { piece: p, pos: { col: c, row: r } };
        }
      }
    }
    return null;
  }

  addValidator(validator: ActionValidator): void {
    this.validators.push(validator);
  }

  private drainQueue(appliedActions: Action[], safetyLimit: number, iterationsRef: { val: number }): void {
    while (!this.queue.isEmpty() && iterationsRef.val < safetyLimit) {
      const nextAction = this.queue.dequeue()!;
      this.applyAction(nextAction);
      appliedActions.push(nextAction);
      iterationsRef.val++;
      if (iterationsRef.val === 200) {
        console.warn('Action pipeline queue exceeded 200 iterations - possible infinite loop');
      }
    }
  }

  submitAction(action: Action): ActionResult {
    if (action.type === 'USE_SKILL') {
      const playerEffects = this.state.getPlayerEffects(action.player);
      const isSilenced = playerEffects.some(e => e.type === 'silence');
      if (isSilenced) {
        return { success: false, reason: 'Player is silenced and cannot use skills', actions: [] };
      }
    }

    // 1. Validate action
    for (const validator of this.validators) {
      const error = validator.validate(action, this.state);
      if (error) {
        return { success: false, reason: error, actions: [] };
      }
    }

    // 2. Enqueue root action and drain
    const appliedActions: Action[] = [];
    this.queue.enqueue(action);

    const safetyLimit = 500;
    const iterationsRef = { val: 0 };

    this.drainQueue(appliedActions, safetyLimit, iterationsRef);

    // SAU KHI drainQueue() xong — resolve pendingDeadKings 1 lần duy nhất
    if (this.state.pendingDeadKings && this.state.pendingDeadKings.length > 0) {
      if (this.state.pendingDeadKings.length === 1) {
        this.queue.enqueue({
          type: 'GAME_OVER',
          winner: oppositeColor(this.state.pendingDeadKings[0]),
          reason: 'King captured/destroyed',
        });
      } else if (this.state.pendingDeadKings.length >= 2) {
        // >= 2 kings dead simultaneously → active player wins
        this.queue.enqueue({
          type: 'GAME_OVER',
          winner: this.state.currentTurn,
          reason: 'Simultaneous King deaths',
        });
      }
      this.state.pendingDeadKings = [];
      this.drainQueue(appliedActions, safetyLimit, iterationsRef);
    }

    if (iterationsRef.val >= safetyLimit) {
      console.warn('Action pipeline queue limit reached - possible infinite loop');
    }

    return {
      success: true,
      actions: appliedActions,
    };
  }

  private applyAction(action: Action): void {
    const maxSkillsPerTurn = 1; // Default - can be modified by variant definition

    switch (action.type) {
      case 'START_MATCH':
        this.state.status = 'playing';
        this.state.lastMoveTimestamp = Date.now();
        this.queue.enqueue({ type: 'START_TURN', player: Color.White });
        break;

      case 'START_TURN': {
        if (this.snapshots) {
          this.snapshots.capture(this.state);
        }
        this.emitEvent(createOnTurnStartEvent(this.state.turnNumber, this.state.currentTurn));
        this.queue.enqueue({
          type: 'TICK_EFFECTS',
          timing: 'turnStart',
          player: this.state.currentTurn,
        });
        this.state.turnPhase = 'start';
        this.state.hasMoved = false;
        this.state.skillsUsedThisTurn = 0;
        this.state.passSkillSubmitted = false;
        this.state.turnPhase = 'action';
        this.state.lastMoveTimestamp = Date.now();
        break;
      }

      case 'MOVE_PIECE': {
        const beforeEvent = createOnBeforeMoveEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.pieceId,
          action.from,
          action.to
        );
        this.emitEvent(beforeEvent);
        if (beforeEvent.cancelled) {
          return;
        }

        this.state.board.movePiece(action.from, action.to);
        this.state.hasMoved = true;

        this.emitEvent(createOnMoveEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.pieceId,
          action.from,
          action.to
        ));

        // Attack & Check detection
        this.detectAttacksAndChecks();

        // Pawn promotion check
        const piece = this.state.board.getPiece(action.to);
        if (piece && piece.type === PieceType.Pawn) {
          const isPromotionRow = (piece.color === Color.White && action.to.row === 14) ||
                                (piece.color === Color.Black && action.to.row === 0);
          if (isPromotionRow) {
            piece.type = PieceType.Queen;
            this.queue.enqueue({
              type: 'PAWN_PROMOTION',
              pieceId: piece.id,
              position: action.to,
              promotedTo: 'Queen',
            });
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: piece.color,
              amount: PROMOTION_AP,
              source: 'promotion',
            });
          }
        }

        break;
      }

      case 'CAPTURE': {
        const capturedPiece = this.state.board.getPiece(action.to);
        if (!capturedPiece) return;

        const beforeDestroyEvent = createOnBeforePieceDestroyedEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          { ...capturedPiece, effects: capturedPiece.effects ? capturedPiece.effects.map(e => ({ ...e })) : [] },
          action.to,
          'capture'
        );
        this.emitEvent(beforeDestroyEvent);
        if (beforeDestroyEvent.cancelled) {
          return;
        }

        const beforeEvent = createOnBeforeCaptureEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.attackerId,
          action.capturedPieceId,
          action.from,
          action.to
        );
        this.emitEvent(beforeEvent);
        if (beforeEvent.cancelled) {
          return;
        }

        const captured = this.state.board.movePiece(action.from, action.to);
        this.state.hasMoved = true;

        if (captured) {
          this.emitEvent(createOnCaptureEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            action.attackerId,
            action.capturedPieceId,
            action.from,
            action.to
          ));

          this.emitEvent(createOnPieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...captured, effects: captured.effects ? captured.effects.map(e => ({ ...e })) : [] },
            action.to,
            action.attackerId
          ));

          this.emitEvent(createOnPieceDeathEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            action.capturedPieceId,
            action.to,
            'capture',
            action.attackerId
          ));

          // Attack & Check detection
          this.detectAttacksAndChecks();

          // Enqueue graveyard
          this.queue.enqueue({
            type: 'ADD_TO_GRAVEYARD',
            piece: captured,
            position: action.to,
            killedBy: 'capture',
            killerId: action.attackerId,
          });

          // AP rewards
          const attackerReward = CAPTURE_AP[captured.type] || 0;
          const defenderLoss = LOSS_AP[captured.type] || 0;

          if (attackerReward > 0) {
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: this.state.currentTurn,
              amount: attackerReward,
              source: 'capture_reward',
            });
          }
          if (defenderLoss > 0) {
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: oppositeColor(this.state.currentTurn),
              amount: defenderLoss,
              source: 'loss_reward',
            });
          }

          // King capture check
          if (captured.type === PieceType.King) {
            this.state.pendingDeadKings.push(captured.color);
          }
        }

        // Pawn promotion check
        const piece = this.state.board.getPiece(action.to);
        if (piece && piece.type === PieceType.Pawn) {
          const isPromotionRow = (piece.color === Color.White && action.to.row === 14) ||
                                (piece.color === Color.Black && action.to.row === 0);
          if (isPromotionRow) {
            piece.type = PieceType.Queen;
            this.queue.enqueue({
              type: 'PAWN_PROMOTION',
              pieceId: piece.id,
              position: action.to,
              promotedTo: 'Queen',
            });
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: piece.color,
              amount: PROMOTION_AP,
              source: 'promotion',
            });
          }
        }

        break;
      }

      case 'PASS_SKILL':
        this.state.passSkillSubmitted = true;

        break;

      case 'USE_SKILL': {
        if (this.variantRegistry) {
          const variantId = action.player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
          if (variantId) {
            const variant = this.variantRegistry.get(variantId);
            if (variant) {
              const skill = variant.skills.find(s => s.id === action.skillId);
              if (skill) {
                // 1. Spend AP
                const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, action.player) : skill.apCost;
                this.queue.enqueue({
                  type: 'SPEND_AP',
                  player: action.player,
                  amount: cost,
                  source: `skill:${action.skillId}`,
                });

                // 2. Execute skill with DeterministicRng
                const rng = new DeterministicRng(this.state.rngSeed, this.state.rngCounter);
                const subActions = skill.execute(this.state, action.player, action.targets, rng);
                this.state.rngCounter = rng.getState().counter;

                // 3. Enqueue all sub-actions
                for (const sub of subActions) {
                  this.queue.enqueue(sub);
                }
              }
            }
          }
        }

        this.state.skillsUsedThisTurn++;
        this.emitEvent(createOnSkillUsedEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.skillId,
          action.targets
        ));

        break;
      }

      case 'GAIN_AP':
        if (action.player === Color.White) {
          this.state.whiteAP += action.amount;
        } else {
          this.state.blackAP += action.amount;
        }
        this.emitEvent(createOnAPGainedEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.player,
          action.amount,
          action.source
        ));
        break;

      case 'SPEND_AP':
        if (action.player === Color.White) {
          this.state.whiteAP = Math.max(0, this.state.whiteAP - action.amount);
        } else {
          this.state.blackAP = Math.max(0, this.state.blackAP - action.amount);
        }
        this.emitEvent(createOnAPSpentEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.player,
          action.amount,
          action.source
        ));
        break;

      case 'ADD_TO_GRAVEYARD':
        this.state.graveyard.push({
          piece: action.piece,
          position: action.position,
          turnDied: this.state.turnNumber,
          killedBy: action.killedBy,
          killerId: action.killerId,
        });
        break;

      case 'GAME_OVER':
        this.state.status = 'finished';
        this.state.winner = action.winner;
        this.emitEvent(createOnGameOverEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.winner,
          action.reason
        ));
        break;

      case 'END_TURN': {
        if (this.state.status === 'playing' && this.state.actionHistory.getAll().length > 0) {
          const now = Date.now();
          const elapsed = now - this.state.lastMoveTimestamp;
          const isTimerPaused = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
          if (!isTimerPaused) {
            if (this.state.currentTurn === Color.White) {
              this.state.whiteTimeLeft = Math.max(0, this.state.whiteTimeLeft - elapsed);
            } else {
              this.state.blackTimeLeft = Math.max(0, this.state.blackTimeLeft - elapsed);
            }
          }
          this.state.lastMoveTimestamp = now;
        }
        this.emitEvent(createOnTurnEndEvent(this.state.turnNumber, this.state.currentTurn));
        this.queue.enqueue({
          type: 'TICK_EFFECTS',
          timing: 'turnEnd',
          player: this.state.currentTurn,
        });
        this.state.turnPhase = 'end';
        this.state.turnPhase = 'cleanup';
        this.queue.enqueue({
          type: 'SWITCH_TURN',
          fromPlayer: this.state.currentTurn,
          toPlayer: oppositeColor(this.state.currentTurn),
        });
        break;
      }

      case 'SWITCH_TURN':
        this.state.currentTurn = action.toPlayer;
        if (action.toPlayer === Color.White) {
          this.state.turnNumber++;
        }
        this.queue.enqueue({ type: 'START_TURN', player: action.toPlayer });
        break;

      case 'TIME_UPDATE':
        this.state.whiteTimeLeft = action.whiteTimeLeft;
        this.state.blackTimeLeft = action.blackTimeLeft;
        break;

      case 'APPLY_EFFECT': {
        const effect = action.effect;
        if (!effect.metadata) {
          effect.metadata = {};
        }
        effect.metadata.appliedTurn = this.state.turnNumber;
        effect.metadata.appliedPlayer = this.state.currentTurn;
        if (effect.targetType === 'piece') {
          const found = this.findPieceById(effect.targetId);
          if (found) {
            if (!found.piece.effects) found.piece.effects = [];
            const existingIdx = found.piece.effects.findIndex(e => e.type === effect.type);
            if (existingIdx !== -1) {
              const existing = found.piece.effects[existingIdx];
              if (effect.stackingRule === 'refresh') {
                existing.remainingDuration = effect.duration;
              } else if (effect.stackingRule === 'stack') {
                existing.stackCount = (existing.stackCount || 1) + 1;
                existing.remainingDuration = effect.duration;
              }
            } else {
              found.piece.effects.push(effect);
            }
          }
        } else if (effect.targetType === 'cell') {
          const [col, row] = effect.targetId.split(',').map(Number);
          const pos = { col, row };
          const cellEffects = this.state.board.getCellEffects(pos);
          const existingIdx = cellEffects.findIndex(e => e.type === effect.type);
          if (existingIdx !== -1) {
            const existing = cellEffects[existingIdx];
            if (effect.stackingRule === 'refresh') {
              existing.remainingDuration = effect.duration;
            } else if (effect.stackingRule === 'stack') {
              existing.stackCount = (existing.stackCount || 1) + 1;
              existing.remainingDuration = effect.duration;
            }
          } else {
            this.state.board.addCellEffect(pos, effect);
          }
        } else if (effect.targetType === 'player') {
          const targetColor = effect.targetId as Color;
          this.state.addPlayerEffect(targetColor, effect);
        }
        this.emitEvent(createOnEffectAppliedEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          effect
        ));
        break;
      }

      case 'REMOVE_EFFECT': {
        const effectId = action.effectId;
        let removed = false;
        let effectSnapshot: any = null;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = this.state.board.getPiece({ col: c, row: r });
            if (p && p.effects) {
              const idx = p.effects.findIndex(e => e.id === effectId);
              if (idx !== -1) {
                effectSnapshot = { ...p.effects[idx], metadata: { ...p.effects[idx].metadata } };
                p.effects.splice(idx, 1);
                removed = true;
                break;
              }
            }
          }
          if (removed) break;
        }

        if (!removed) {
          const allCellEffects = this.state.board.getAllCellEffects();
          for (const [key, cellEffects] of allCellEffects.entries()) {
            const idx = cellEffects.findIndex(e => e.id === effectId);
            if (idx !== -1) {
              effectSnapshot = { ...cellEffects[idx], metadata: { ...cellEffects[idx].metadata } };
              const [col, row] = key.split(',').map(Number);
              this.state.board.removeCellEffect({ col, row }, effectId);
              break;
            }
          }
        }

        if (!removed) {
          for (const color of [Color.White, Color.Black]) {
            const effects = this.state.getPlayerEffects(color);
            const idx = effects.findIndex(e => e.id === effectId);
            if (idx !== -1) {
              effectSnapshot = { ...effects[idx], metadata: { ...effects[idx].metadata } };
              this.state.removePlayerEffect(color, effectId);
              removed = true;
              break;
            }
          }
        }

        this.emitEvent(createOnEffectExpiredEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          effectId,
          action.reason,
          effectSnapshot
        ));
        break;
      }

      case 'TICK_EFFECTS': {
        const timing = action.timing;
        const allEffects = this.getActiveEffects();
        for (const effect of allEffects) {
          if (effect.tickTiming === timing && effect.remainingDuration !== null) {
            if (effect.metadata && effect.metadata.appliedTurn === this.state.turnNumber && effect.metadata.appliedPlayer === this.state.currentTurn) {
              continue;
            }
            if (effect.targetType === 'piece') {
              const found = this.findPieceById(effect.targetId);
              if (found) {
                if (found.piece.color !== action.player) {
                  continue;
                }
              }
            } else if (effect.targetType === 'player') {
              if (effect.targetId !== action.player) {
                continue;
              }
            }
            effect.remainingDuration--;
            this.emitEvent(createOnEffectTickEvent(
              this.state.turnNumber,
              this.state.currentTurn,
              effect
            ));
            
            if (effect.remainingDuration <= 0) {
              this.queue.enqueue({
                type: 'REMOVE_EFFECT',
                effectId: effect.id,
                targetId: effect.targetId,
                targetType: effect.targetType,
                reason: 'expired',
              });
            }
          }
        }
        break;
      }

      case 'PAWN_PROMOTION':
        this.emitEvent(createOnPawnPromotionEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.pieceId,
          action.position,
          action.promotedTo
        ));
        break;

      case 'SPAWN_PIECE':
        this.emitEvent(createOnPieceSpawnEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.piece.id,
          action.position
        ));
        break;

      case 'DESTROY_PIECE': {
        const piece = this.state.board.getPiece(action.position);
        if (piece && piece.id === action.pieceId) {
          const mappedReason = mapReason(action.reason);
          const beforeDestroyEvent = createOnBeforePieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] },
            action.position,
            mappedReason
          );
          this.emitEvent(beforeDestroyEvent);
          if (beforeDestroyEvent.cancelled) {
            return;
          }

          this.state.board.removePiece(action.position);
          
          this.emitEvent(createOnPieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] },
            action.position,
            action.reason
          ));

          this.emitEvent(createOnPieceDeathEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            action.pieceId,
            action.position,
            'effect',
            action.reason
          ));

          this.queue.enqueue({
            type: 'ADD_TO_GRAVEYARD',
            piece,
            position: action.position,
            killedBy: 'effect',
            killerId: action.reason,
          });

          if (piece.type === PieceType.King) {
            this.state.pendingDeadKings.push(piece.color);
          }
        }
        break;
      }
      
      // Fallback/No-op for other step actions not yet handled
    }

    const triggersTurnEnd = ['MOVE_PIECE', 'CAPTURE', 'PASS_SKILL', 'USE_SKILL'].includes(action.type);
    if (triggersTurnEnd && this.state.status === 'playing') {
      const isTimerPaused = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
      const canUseSkill = this.canPlayerUseAnySkill(this.state.currentTurn);
      if (this.state.hasMoved && (isTimerPaused || this.state.skillsUsedThisTurn > 0 || this.state.passSkillSubmitted || !canUseSkill)) {
        this.queue.enqueue({ type: 'END_TURN', player: this.state.currentTurn });
      }
    }

    // Always push the applied action to history
    this.state.actionHistory.push(this.state.turnNumber, action);
  }
}

// === Basic Validators ===

export class BasicMoveValidator implements ActionValidator {
  private moveModifierChain?: MoveModifierChain;

  constructor(moveModifierChain?: MoveModifierChain) {
    this.moveModifierChain = moveModifierChain;
  }

  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type !== 'MOVE_PIECE' && action.type !== 'CAPTURE') {
      return null;
    }

    const validation = validateMove(
      state.board,
      state.currentTurn,
      state.currentTurn, // Attacking player matches currentTurn
      action.from,
      action.to,
      state as GameState,
      this.moveModifierChain
    );

    return validation.valid ? null : (validation.reason || 'Invalid move');
  }
}

export class TurnPhaseValidator implements ActionValidator {
  validate(action: Action, state: Readonly<GameState>): string | null {
    if (
      action.type !== 'MOVE_PIECE' &&
      action.type !== 'CAPTURE' &&
      action.type !== 'USE_SKILL' &&
      action.type !== 'PASS_SKILL' &&
      action.type !== 'END_TURN'
    ) {
      return null;
    }

    if (state.status !== 'playing') {
      return 'Match is not in progress';
    }

    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
      if (state.turnPhase !== 'action') {
        return 'Not in action turn phase';
      }
      if (state.hasMoved) {
        return 'Already moved this turn';
      }
    }

    if (action.type === 'USE_SKILL') {
      if (state.turnPhase !== 'action') {
        return 'Not in action turn phase';
      }
      const maxSkillsPerTurn = 1;
      if (state.skillsUsedThisTurn >= maxSkillsPerTurn) {
        return 'Already used maximum skills this turn';
      }
      if (state.passSkillSubmitted) {
        return 'Cannot use skill after passing skill selection';
      }
    }

    if (action.type === 'PASS_SKILL') {
      if (state.turnPhase !== 'action') {
        return 'Not in action turn phase';
      }
      if (state.skillsUsedThisTurn > 0) {
        return 'Cannot pass skill after using a skill';
      }
      if (state.passSkillSubmitted) {
        return 'Already passed skill this turn';
      }
    }

    if (action.type === 'END_TURN') {
      if (state.currentTurn !== action.player) {
        return 'Not your turn';
      }
    }

    return null;
  }
}

export class APValidator implements ActionValidator {
  private variantRegistry?: VariantRegistry;

  constructor(variantRegistry?: VariantRegistry) {
    this.variantRegistry = variantRegistry;
  }

  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type === 'USE_SKILL') {
      if (!this.variantRegistry) return null;
      const variantId = action.player === Color.White ? state.whiteVariantId : state.blackVariantId;
      if (!variantId) return 'No variant selected';
      const variant = this.variantRegistry.get(variantId);
      if (!variant) return 'Variant not found';
      const skill = variant.skills.find(s => s.id === action.skillId);
      if (!skill) return 'Skill not found';
      
      const cost = typeof skill.apCost === 'function' ? skill.apCost(state, action.player) : skill.apCost;
      const ap = action.player === Color.White ? state.whiteAP : state.blackAP;
      if (ap < cost) {
        return 'Sufficient AP not available';
      }
    }
    return null;
  }
}

export class SkillValidator implements ActionValidator {
  private variantRegistry?: VariantRegistry;

  constructor(variantRegistry?: VariantRegistry) {
    this.variantRegistry = variantRegistry;
  }

  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type === 'USE_SKILL') {
      if (state.variantState.skillsDisabled) {
        return 'Cannot use skills while skills are disabled';
      }

      if (!this.variantRegistry) return null;
      const variantId = action.player === Color.White ? state.whiteVariantId : state.blackVariantId;
      if (!variantId) return 'No variant selected';
      const variant = this.variantRegistry.get(variantId);
      if (!variant) return 'Variant not found';
      const skill = variant.skills.find(s => s.id === action.skillId);
      if (!skill) return 'Skill not found';

      return skill.canActivate(state, action.player, action.targets);
    }
    return null;
  }
}
