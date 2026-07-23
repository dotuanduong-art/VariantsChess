import { GameState } from '../state/GameState';
import { Action } from './Action';
import { ActionQueue } from './ActionQueue';
import { Color, oppositeColor, PieceType, Piece, getPieceOwner } from '../pieces/Piece';
import { specialPieceRegistry } from '../pieces/SpecialPieceRegistry';
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
import { syncDimensionPortalCellEffects } from '../variant/variants/SpaceVariant';

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

    const maxSkillsPerTurn = variant.maxSkillsPerTurn ?? 1;
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
    const isPirateDebt = this.state.variantState[`pirateDebtEnabled_${player}`] === true;

    for (const skill of variant.skills) {
      let cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
      if (this.state.getPlayerEffects(player).some(e => e.type === 'emerald_domain')) {
        cost += 1;
      }
      
      let canAfford = false;
      if (isPirateDebt) {
        canAfford = playerAP >= 0 && (playerAP - cost >= -10);
      } else {
        canAfford = playerAP >= cost;
      }

      if (canAfford) {
        if (this.canSkillBeActivatedAnywhere(skill, player)) {
          return true;
        }
      }
    }
    return false;
  }

  private canSkillBeActivatedAnywhere(skill: any, player: Color): boolean {
    const reqs = skill.getTargetRequirements(this.state, player);
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
      const silenceEffect = playerEffects.find(e => e.type === 'silence');
      if (silenceEffect) {
        if (this.variantRegistry) {
          const variantId = action.player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
          if (variantId) {
            const variant = this.variantRegistry.get(variantId);
            const skill = variant?.skills.find(s => s.id === action.skillId);
            if (skill) {
              const blockUltimate = silenceEffect.metadata?.blockUltimate !== false;
              const shouldBlock = skill.tier === 'skill1' || skill.tier === 'skill2' || (skill.tier === 'ultimate' && blockUltimate);
              if (shouldBlock) {
                return { success: false, reason: 'Player is silenced and cannot use this skill', actions: [] };
              }
            }
          }
        }
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
      const finalPendingDeadKings: Color[] = [];
      for (const color of this.state.pendingDeadKings) {
        const variantId = color === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
        const hasRebirthed = this.state.variantState.phoenixRebirthed?.[color] === true;
        if (variantId === 'phoenix' && !hasRebirthed) {
          if (!this.state.variantState.phoenixRebirthed) {
            this.state.variantState.phoenixRebirthed = {};
          }
          this.state.variantState.phoenixRebirthed[color] = true;
          this.queue.enqueue({
            type: 'PHOENIX_REBIRTH' as any,
            player: color,
          });
        } else {
          finalPendingDeadKings.push(color);
        }
      }
      this.state.pendingDeadKings = finalPendingDeadKings;

      if (this.state.pendingDeadKings.length > 0) {
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
      }
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
        // Capture board positions snapshot for Time Variant
        const positionsSnapshotList: { pieceId: string; position: Position }[] = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = this.state.board.getPiece({ col: c, row: r });
            if (p) {
              positionsSnapshotList.push({
                pieceId: p.id,
                position: { col: c, row: r },
              });
            }
          }
        }
        if (!this.state.positionSnapshots) {
          this.state.positionSnapshots = [];
        }
        this.state.positionSnapshots.push({
          turnNumber: this.state.turnNumber,
          player: this.state.currentTurn,
          positions: positionsSnapshotList,
        });
        if (this.state.positionSnapshots.length > 15) {
          this.state.positionSnapshots.shift();
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
        this.state.skillsUsedThisTurnIds = [];
        this.state.passSkillSubmitted = false;
        this.state.turnPhase = 'action';
        this.state.lastMoveTimestamp = Date.now();
        break;
      }

      case 'MOVE_PIECE': {
        const piece = this.state.board.getPiece(action.from);
        if (piece) {
          const path = getMovementPath(action.from, action.to);
          const interception = checkPortalInterception(this.state, path, piece.color);
          if (interception) {
            const destPos = interception.even.position;
            const targetPiece = this.state.board.getPiece(destPos);
            if (targetPiece) {
              this.queue.enqueue({
                type: 'DESTROY_PIECE',
                pieceId: targetPiece.id,
                position: destPos,
                reason: 'dimension_teleport',
              });
            }
            this.queue.enqueue({
              type: 'MOVE_PIECE',
              pieceId: action.pieceId,
              from: action.from,
              to: destPos,
            });
            this.queue.enqueue({
              type: 'REMOVE_PORTALS',
              pairId: interception.odd.id,
            });
            return;
          }
        }

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

        // Deduct AP if Devil's Toll is active
        if (this.state.variantState.devilTollActive) {
          const piece = this.state.board.getPiece(action.from);
          if (piece) {
            const cost = getDevilTollAPCost(piece.type);
            if (cost > 0) {
              this.queue.enqueue({
                type: 'SPEND_AP',
                player: this.state.currentTurn,
                amount: cost,
                source: 'devil_toll',
              });
            }
          }
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
        this.checkPawnPromotion(action.to);

        break;
      }

      case 'CAPTURE': {
        const piece = this.state.board.getPiece(action.from);
        if (piece) {
          const path = getMovementPath(action.from, action.to);
          const interception = checkPortalInterception(this.state, path, piece.color);
          if (interception) {
            const destPos = interception.even.position;
            const targetPiece = this.state.board.getPiece(destPos);
            if (targetPiece) {
              this.queue.enqueue({
                type: 'DESTROY_PIECE',
                pieceId: targetPiece.id,
                position: destPos,
                reason: 'dimension_teleport',
              });
            }
            this.queue.enqueue({
              type: 'MOVE_PIECE',
              pieceId: action.attackerId,
              from: action.from,
              to: destPos,
            });
            this.queue.enqueue({
              type: 'REMOVE_PORTALS',
              pairId: interception.odd.id,
            });
            return;
          }
        }

        const capturedPiece = this.state.board.getPiece(action.to);
        if (!capturedPiece) return;

        // Soul Binding Redirection
        if (capturedPiece.effects?.some(e => e.type === 'main')) {
          let voodooPos: Position | null = null;
          let voodooPiece: Piece | null = null;
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const pos = { col: c, row: r };
              const p = this.state.board.getPiece(pos);
              if (p && p.effects?.some(e => e.type === 'voodoo')) {
                voodooPos = pos;
                voodooPiece = p;
                break;
              }
            }
            if (voodooPos) break;
          }

          if (voodooPos && voodooPiece) {
            const attacker = this.state.board.getPiece(action.from);
            const puppetPlayer = capturedPiece.effects?.find(e => e.type === 'main')?.sourcePlayer;
            if (attacker && puppetPlayer) {
              this.queue.enqueue({
                type: 'APPLY_EFFECT',
                effect: {
                  id: `bind_${attacker.id}_${Date.now()}`,
                  type: 'bind',
                  duration: 2,
                  remainingDuration: 2,
                  tickTiming: 'turnEnd',
                  sourcePlayer: puppetPlayer,
                  targetType: 'piece',
                  targetId: attacker.id,
                  stackingRule: 'refresh',
                  isDebuff: true,
                  metadata: {},
                }
              });
            }

            this.queue.enqueue({
              type: 'CAPTURE',
              attackerId: action.attackerId,
              from: action.from,
              to: voodooPos,
              capturedPieceId: voodooPiece.id,
              capturedPieceSnapshot: { ...voodooPiece, effects: voodooPiece.effects ? voodooPiece.effects.map(e => ({ ...e })) : [] },
              stayInPlace: action.stayInPlace,
            });
            return;
          }
        }

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

        // Thunder Fang range-capture: attacker stays in place, only remove the target
        let captured: Piece | null;
        if (action.stayInPlace) {
          captured = this.state.board.removePiece(action.to);
        } else {
          captured = this.state.board.movePiece(action.from, action.to);
        }
        this.state.hasMoved = true;

        if (captured) {
          this.emitEvent(createOnCaptureEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            action.attackerId,
            action.capturedPieceId,
            action.from,
            action.to,
            { ...captured, effects: captured.effects ? captured.effects.map(e => ({ ...e })) : [] }
          ));

          this.emitEvent(createOnPieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...captured, effects: captured.effects ? captured.effects.map(e => ({ ...e })) : [] },
            action.to,
            action.attackerId
          ));

          // Trigger hook
          if (captured.specialType) {
            const def = specialPieceRegistry.get(captured.specialType);
            if (def && def.onDestroyed) {
              def.onDestroyed(captured, action.to, (act) => this.queue.enqueue(act));
            }
          }

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
          let attackerReward = 0;
          let defenderLoss = 0;

          if (captured.specialType) {
            const def = specialPieceRegistry.get(captured.specialType);
            attackerReward = def?.captureApReward !== undefined ? def.captureApReward : 0;
            defenderLoss = def?.lossApReward !== undefined ? def.lossApReward : 0;
          } else {
            let capturedOriginalType = captured.type;
            const swapEffect = captured.effects?.find(e => e.type === 'moveset_swap');
            if (swapEffect && swapEffect.metadata && swapEffect.metadata.originalType) {
              capturedOriginalType = swapEffect.metadata.originalType;
            }
            attackerReward = CAPTURE_AP[capturedOriginalType] || 0;
            defenderLoss = LOSS_AP[capturedOriginalType] || 0;
          }

          const isSheltered = captured.effects?.some(e => e.type === 'verdant_shelter');
          if (isSheltered) {
            attackerReward = Math.floor(attackerReward / 2);
          }


          const isAllyCapture = captured.color === this.state.currentTurn;
          if (isAllyCapture) {
            const totalReward = attackerReward + defenderLoss;
            if (totalReward > 0) {
              this.queue.enqueue({
                type: 'GAIN_AP',
                player: this.state.currentTurn,
                amount: totalReward,
                source: 'capture_reward',
              });
            }
          } else {
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
          }

          // King capture check
          if (captured.type === PieceType.King) {
            this.state.pendingDeadKings.push(captured.color);
          }
        }

        // Pawn promotion check
        this.checkPawnPromotion(action.to);

        break;
      }

      case 'PASS_SKILL':
        this.state.passSkillSubmitted = true;

        break;

      case 'USE_SKILL': {
        let costSpent = 0;
        if (this.variantRegistry) {
          const variantId = action.player === Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
          if (variantId) {
            const variant = this.variantRegistry.get(variantId);
            if (variant) {
              const skill = variant.skills.find(s => s.id === action.skillId);
              if (skill) {
                // 1. Spend AP
                let cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, action.player) : skill.apCost;
                if (this.state.getPlayerEffects(action.player).some(e => e.type === 'emerald_domain')) {
                  cost += 1;
                }
                costSpent = cost;
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
        if (!this.state.skillsUsedThisTurnIds) {
          this.state.skillsUsedThisTurnIds = [];
        }
        this.state.skillsUsedThisTurnIds.push(action.skillId);
        this.emitEvent(createOnSkillUsedEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.skillId,
          action.targets,
          costSpent
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

      case 'SPEND_AP': {
        const maxDebt = this.state.variantState[`pirateDebtEnabled_${action.player}`] ? -10 : 0;
        if (action.player === Color.White) {
          this.state.whiteAP = Math.max(maxDebt, this.state.whiteAP - action.amount);
        } else {
          this.state.blackAP = Math.max(maxDebt, this.state.blackAP - action.amount);
        }
        this.emitEvent(createOnAPSpentEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.player,
          action.amount,
          action.source
        ));
        break;
      }

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
            // === AEGIS CHECK ===
            const hasAegis = found.piece.effects?.some(e => e.type === 'aegis');
            if (hasAegis && effect.sourcePlayer !== found.piece.color && effect.type !== 'aegis') {
              // Enemy effect blocked by Aegis — skip application
              break;
            }

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
            } else if (effect.targetType === 'cell') {
              if (effect.sourcePlayer !== action.player) {
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
        this.state.board.setPiece(action.position, action.piece);
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
          if (piece.specialType) {
            const def = specialPieceRegistry.get(piece.specialType);
            if (def && def.canBeAttacked === false) {
              const allowedReasons = ['effect_expired', 'earth_burst'];
              if (!allowedReasons.includes(action.reason)) {
                return;
              }
            }
          }
          const isSheltered = piece.effects?.some(e => e.type === 'verdant_shelter');
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

          if (isSheltered) {
            const opposite = oppositeColor(piece.color);
            let originalType = piece.type;
            const swapEffect = piece.effects?.find(e => e.type === 'moveset_swap');
            if (swapEffect && swapEffect.metadata && swapEffect.metadata.originalType) {
              originalType = swapEffect.metadata.originalType;
            }
            const capAp = CAPTURE_AP[originalType] || 0;
            const lossAp = LOSS_AP[originalType] || 0;

            this.queue.enqueue({
              type: 'GAIN_AP',
              player: opposite,
              amount: Math.floor(capAp / 2),
              source: 'verdant_shelter_reward',
            });
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: piece.color,
              amount: lossAp,
              source: 'loss_reward',
            });
          }
          
          this.emitEvent(createOnPieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] },
            action.position,
            action.reason
          ));


          // Trigger hook
          if (piece.specialType) {
            const def = specialPieceRegistry.get(piece.specialType);
            if (def && def.onDestroyed) {
              def.onDestroyed(piece, action.position, (act) => this.queue.enqueue(act));
            }
          }

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

      case 'SACRIFICE_PIECE': {
        const piece = this.state.board.getPiece(action.position);
        if (piece && piece.id === action.pieceId && piece.color === action.player && piece.type !== PieceType.King) {
          if (piece.specialType) {
            const def = specialPieceRegistry.get(piece.specialType);
            if (def && def.canBeAttacked === false) {
              return;
            }
          }
          this.state.board.removePiece(action.position);

          this.emitEvent(createOnPieceDestroyedEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] },
            action.position,
            'sacrifice'
          ));

          // Trigger hook
          if (piece.specialType) {
            const def = specialPieceRegistry.get(piece.specialType);
            if (def && def.onDestroyed) {
              def.onDestroyed(piece, action.position, (act) => this.queue.enqueue(act));
            }
          }

          this.emitEvent(createOnPieceDeathEvent(
            this.state.turnNumber,
            this.state.currentTurn,
            action.pieceId,
            action.position,
            'effect',
            'sacrifice'
          ));

          this.queue.enqueue({
            type: 'ADD_TO_GRAVEYARD',
            piece,
            position: action.position,
            killedBy: 'effect',
            killerId: 'sacrifice',
          });

          let refundAmount = 0;
          if (piece.specialType) {
            const def = specialPieceRegistry.get(piece.specialType);
            refundAmount = def?.lossApReward !== undefined ? def.lossApReward : 0;
          } else {
            refundAmount = LOSS_AP[piece.type] || 0;
          }

          if (refundAmount > 0) {
            this.queue.enqueue({
              type: 'GAIN_AP',
              player: action.player,
              amount: refundAmount,
              source: 'sacrifice',
            });
          }
        }
        break;
      }

      case 'SWAP_POSITIONS': {
        const pieceA = this.state.board.getPiece(action.positionA);
        const pieceB = this.state.board.getPiece(action.positionB);
        if (pieceA && pieceB) {
          this.state.board.setPiece(action.positionA, pieceB);
          this.state.board.setPiece(action.positionB, pieceA);

          this.detectAttacksAndChecks();
        }
        break;
      }

      case 'FOOL_MOVE': {
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
        // Note: we do NOT set this.state.hasMoved = true

        this.emitEvent(createOnMoveEvent(
          this.state.turnNumber,
          this.state.currentTurn,
          action.pieceId,
          action.from,
          action.to
        ));

        this.detectAttacksAndChecks();
        this.checkPawnPromotion(action.to);
        break;
      }

      case 'PUSH_PIECE': {
        const piece = this.state.board.getPiece(action.from);
        if (piece && piece.id === action.pieceId) {
          this.state.board.movePiece(action.from, action.to);
          
          this.emitEvent({
            type: 'OnPiecePushed',
            turnNumber: this.state.turnNumber,
            activePlayer: this.state.currentTurn,
            payload: {
              pieceId: action.pieceId,
              from: action.from,
              to: action.to,
              reason: action.reason,
            }
          });

          this.detectAttacksAndChecks();
          this.checkPawnPromotion(action.to);
        }
        break;
      }

      case 'TRANSFORM_PIECE': {
        const piece = this.state.board.getPiece(action.position);
        if (piece && piece.id === action.pieceId) {
          piece.type = action.newType;
          if (action.newColor) {
            piece.color = action.newColor;
          }
          this.detectAttacksAndChecks();
        }
        break;
      }

      case 'REMOVE_PORTALS': {
        const pairs = this.state.variantState.dimensionPairs || [];
        this.state.variantState.dimensionPairs = pairs.filter(
          (p: any) => p.odd.id !== action.pairId && p.even.id !== action.pairId
        );
        syncDimensionPortalCellEffects(this.state);
        break;
      }

      case 'PHOENIX_REBIRTH': {
        const player = action.player;
        
        // 1. Remove all ally pieces silently
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = this.state.board.getPiece({ col: c, row: r });
            if (p && p.color === player) {
              this.state.board.removePiece({ col: c, row: r });
            }
          }
        }

        // 2. Process enemy pieces: collect, filter, and teleport
        const enemyColor = oppositeColor(player);
        const survivingEnemies: { piece: Piece; currentPos: Position }[] = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const p = this.state.board.getPiece(pos);
            if (p && p.color === enemyColor) {
              survivingEnemies.push({ piece: p, currentPos: pos });
            }
          }
        }

        // Helper to check if piece ID belongs to initial layout
        const isInitialPieceId = (id: string): boolean => {
          const match = id.match(/^(w|b)_([a-z_]+)_(\d+)$/);
          if (!match) return false;
          const [_, colorStr, typeStr, colStr] = match;
          const col = parseInt(colStr, 10);
          if (col < 0 || col > 14) return false;
          if (typeStr === 'pawn') return true;
          const backRankTypes = ['rook', 'knight', 'bishop', 'queen', 'king'];
          return backRankTypes.includes(typeStr);
        };

        // Remove surviving enemies from their current positions
        for (const item of survivingEnemies) {
          this.state.board.removePiece(item.currentPos);
        }

        // Place initial layout enemy pieces at their start positions, destroy non-initial pieces
        for (const item of survivingEnemies) {
          if (isInitialPieceId(item.piece.id)) {
            const match = item.piece.id.match(/^(w|b)_([a-z_]+)_(\d+)$/)!;
            const colorStr = match[1];
            const typeStr = match[2];
            const col = parseInt(match[3], 10);
            
            const startRow = colorStr === 'w' 
              ? (typeStr === 'pawn' ? 1 : 0) 
              : (typeStr === 'pawn' ? 13 : 14);

            this.state.board.setPiece({ col, row: startRow }, item.piece);
          }
        }

        // 3. Spawn Phoenix new army at starting positions
        const row = player === Color.White ? 0 : 14;
        const newArmyConfig = [
          { col: 7, type: PieceType.King, idType: 'king' },
          { col: 0, type: PieceType.Rook, idType: 'rook' },
          { col: 2, type: PieceType.Bishop, idType: 'bishop' },
          { col: 5, type: PieceType.Bishop, idType: 'bishop' },
          { col: 1, type: PieceType.Knight, idType: 'knight' },
        ];

        const colorPrefix = player === Color.White ? 'w' : 'b';

        for (const config of newArmyConfig) {
          const spawnPos = { col: config.col, row };
          const occupier = this.state.board.getPiece(spawnPos);
          if (occupier) {
            this.state.board.removePiece(spawnPos);
          }

          const pieceId = `${colorPrefix}_${config.idType}_${config.col}_rebirth`;
          
          this.queue.enqueue({
            type: 'SPAWN_PIECE',
            piece: {
              id: pieceId,
              type: config.type,
              color: player,
              effects: [],
            },
            position: spawnPos,
          });
        }

        // 4. Lock skills permanently
        if (!this.state.variantState.phoenixSkillsDisabled) {
          this.state.variantState.phoenixSkillsDisabled = {};
        }
        this.state.variantState.phoenixSkillsDisabled[player] = true;

        this.detectAttacksAndChecks();
        break;
      }

      case 'ZOMBIE_BITE': {
        const attacker = this.state.board.getPiece(action.attackerPosition);
        const target = this.state.board.getPiece(action.targetPosition);
        if (attacker && attacker.id === action.attackerId && attacker.effects?.some(e => e.type === 'zombie')) {
          if (target && getPieceOwner(target) !== this.state.currentTurn && !target.effects?.some(e => e.type === 'walker')) {
            // Apply walker effect (Walker type 1: still enemy color, controlled by Zombie player)
            this.queue.enqueue({
              type: 'APPLY_EFFECT',
              effect: {
                id: `walker_${target.id}_${Date.now()}`,
                type: 'walker',
                duration: null,
                remainingDuration: null,
                tickTiming: 'turnEnd',
                sourcePlayer: this.state.currentTurn,
                targetType: 'piece',
                targetId: target.id,
                stackingRule: 'ignore',
                isDebuff: true, // target is infected
                metadata: {
                  controlledBy: this.state.currentTurn,
                },
              }
            });

            this.state.hasMoved = true; // Biting counts as movement

            this.emitEvent({
              type: 'OnZombieBite',
              turnNumber: this.state.turnNumber,
              activePlayer: this.state.currentTurn,
              payload: {
                attackerId: action.attackerId,
                attackerPosition: action.attackerPosition,
                targetPosition: action.targetPosition,
                targetId: target.id,
              }
            } as any);
          }
        }
        break;
      }
      
      // Fallback/No-op for other step actions not yet handled
    }

    const triggersTurnEnd = ['MOVE_PIECE', 'CAPTURE', 'PASS_SKILL', 'USE_SKILL', 'ZOMBIE_BITE'].includes(action.type);
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

  private checkPawnPromotion(position: Position): void {
    const piece = this.state.board.getPiece(position);
    if (!piece) return;

    if (piece.effects?.some(e => e.type === 'evolution' || e.type === 'no_promotion' || e.type === 'puppet_control')) {
      return;
    }

    let originalType = piece.type;
    const swapEffect = piece.effects?.find(e => e.type === 'moveset_swap');
    if (swapEffect && swapEffect.metadata && swapEffect.metadata.originalType) {
      originalType = swapEffect.metadata.originalType;
    }

    if (originalType === PieceType.Pawn) {
      const isPromotionRow = (piece.color === Color.White && position.row === 14) ||
                            (piece.color === Color.Black && position.row === 0);
      if (isPromotionRow) {
        piece.type = PieceType.Queen;

        if (swapEffect) {
          const partnerId = swapEffect.metadata.partnerPieceId;
          this.queue.enqueue({
            type: 'REMOVE_EFFECT',
            effectId: swapEffect.id,
            targetId: piece.id,
            targetType: 'piece',
            reason: 'promoted',
          });
          const partnerPieceInfo = this.findPieceById(partnerId);
          if (partnerPieceInfo) {
            const partnerSwap = partnerPieceInfo.piece.effects?.find(e => e.type === 'moveset_swap');
            if (partnerSwap) {
              this.queue.enqueue({
                type: 'REMOVE_EFFECT',
                effectId: partnerSwap.id,
                targetId: partnerId,
                targetType: 'piece',
                reason: 'partner_promoted',
              });
            }
          }
        }

        this.queue.enqueue({
          type: 'PAWN_PROMOTION',
          pieceId: piece.id,
          position,
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
  }
}

// === Basic Validators ===

export class BasicMoveValidator implements ActionValidator {
  private moveModifierChain?: MoveModifierChain;

  constructor(moveModifierChain?: MoveModifierChain) {
    this.moveModifierChain = moveModifierChain;
  }

  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type === 'ZOMBIE_BITE') {
      const attacker = state.board.getPiece(action.attackerPosition);
      if (!attacker) return 'Attacker piece not found';
      if (!attacker.effects?.some(e => e.type === 'zombie')) {
        return 'Attacker is not a Zombie';
      }

      const target = state.board.getPiece(action.targetPosition);
      if (!target) return 'No target piece found';
      if (getPieceOwner(target) === state.currentTurn) {
        return 'Cannot bite allied piece';
      }
      if (target.effects?.some(e => e.type === 'walker')) {
        return 'Target is already a Walker';
      }

      const validation = validateMove(
        state.board,
        state.currentTurn,
        state.currentTurn,
        action.attackerPosition,
        action.targetPosition,
        state as GameState,
        this.moveModifierChain
      );
      return validation.valid ? null : (validation.reason || 'Invalid bite move');
    }

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
  private variantRegistry?: VariantRegistry;

  constructor(variantRegistry?: VariantRegistry) {
    this.variantRegistry = variantRegistry;
  }

  validate(action: Action, state: Readonly<GameState>): string | null {
    if (
      action.type !== 'MOVE_PIECE' &&
      action.type !== 'CAPTURE' &&
      action.type !== 'USE_SKILL' &&
      action.type !== 'PASS_SKILL' &&
      action.type !== 'END_TURN' &&
      action.type !== 'SACRIFICE_PIECE'
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
      const variantId = action.player === Color.White ? state.whiteVariantId : state.blackVariantId;
      const variant = (variantId && this.variantRegistry) ? this.variantRegistry.get(variantId) : undefined;
      const maxSkillsPerTurn = variant?.maxSkillsPerTurn ?? 1;
      if (state.skillsUsedThisTurn >= maxSkillsPerTurn) {
        return 'Already used maximum skills this turn';
      }
      if (variant?.preventDuplicateSkillsPerTurn && state.skillsUsedThisTurnIds && state.skillsUsedThisTurnIds.includes(action.skillId)) {
        return 'Skill already used this turn';
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

    if (action.type === 'SACRIFICE_PIECE') {
      if (state.currentTurn !== action.player) {
        return 'Not your turn';
      }
      if (state.turnPhase !== 'action') {
        return 'Not in action turn phase';
      }
      if (state.hasMoved) {
        return 'Already moved this turn';
      }
      const piece = state.board.getPiece(action.position);
      if (!piece) {
        return 'No piece at position';
      }
      if (piece.id !== action.pieceId) {
        return 'Piece ID mismatch';
      }
      if (piece.color !== action.player) {
        return 'Cannot sacrifice enemy piece';
      }
      if (piece.type === PieceType.King) {
        return 'Cannot sacrifice the King';
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
      
      let cost = typeof skill.apCost === 'function' ? skill.apCost(state, action.player) : skill.apCost;
      if (state.getPlayerEffects(action.player).some(e => e.type === 'emerald_domain')) {
        cost += 1;
      }
      const ap = action.player === Color.White ? state.whiteAP : state.blackAP;
      
      const isPirateDebt = state.variantState[`pirateDebtEnabled_${action.player}`] === true;
      if (isPirateDebt) {
        if (ap < 0) {
          return 'Bạn còn nợ AP, hãy kiếm đủ AP trước';
        }
        if (ap - cost < -10) {
          return 'Sufficient AP not available';
        }
      } else {
        if (ap < cost) {
          return 'Sufficient AP not available';
        }
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

      // === AEGIS TARGETING CHECK ===
      for (const target of action.targets) {
        if (target.type === 'piece') {
          let targetPiece = target.position ? state.board.getPiece(target.position) : null;
          if (!targetPiece && target.pieceId) {
            for (let r = 0; r < BOARD_SIZE; r++) {
              for (let c = 0; c < BOARD_SIZE; c++) {
                const p = state.board.getPiece({ col: c, row: r });
                if (p && p.id === target.pieceId) {
                  targetPiece = p;
                  break;
                }
              }
              if (targetPiece) break;
            }
          }
          if (targetPiece && targetPiece.color !== action.player) {
            const hasAegis = targetPiece.effects?.some(e => e.type === 'aegis');
            if (hasAegis) {
              return 'Target has Aegis immunity';
            }
          }
        }
      }

      return skill.canActivate(state, action.player, action.targets);
    }
    return null;
  }
}

export function getDevilTollAPCost(type: PieceType | string): number {
  switch (type) {
    case PieceType.Pawn:
      return 0;
    case PieceType.Knight:
      return 2;
    case PieceType.Bishop:
      return 2;
    case PieceType.Rook:
      return 3;
    case PieceType.Queen:
      return 4;
    case PieceType.King:
      return 0;
    default:
      return 0;
  }
}

export class DevilTollValidator implements ActionValidator {
  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type !== 'MOVE_PIECE') {
      return null;
    }
    if (!state.variantState.devilTollActive) {
      return null;
    }

    const piece = state.board.getPiece(action.from);
    if (!piece) {
      return 'No piece at starting position';
    }

    const cost = getDevilTollAPCost(piece.type);
    if (cost > 0) {
      const playerAP = state.currentTurn === Color.White ? state.whiteAP : state.blackAP;
      if (playerAP < cost) {
        return `Insufficient AP under Devil's Toll (requires ${cost} AP, you have ${playerAP} AP). You must sacrifice an ally piece to gain AP first.`;
      }
    }
    return null;
  }
}

function getMovementPath(from: Position, to: Position): Position[] {
  const path: Position[] = [];
  const colDiff = to.col - from.col;
  const rowDiff = to.row - from.row;
  const absColDiff = Math.abs(colDiff);
  const absRowDiff = Math.abs(rowDiff);

  if (colDiff === 0 && rowDiff === 0) {
    return [];
  }

  if (colDiff === 0) {
    const step = rowDiff / absRowDiff;
    for (let r = from.row + step; r !== to.row + step; r += step) {
      path.push({ col: from.col, row: r });
    }
  } else if (rowDiff === 0) {
    const step = colDiff / absColDiff;
    for (let c = from.col + step; c !== to.col + step; c += step) {
      path.push({ col: c, row: from.row });
    }
  } else if (absColDiff === absRowDiff) {
    const colStep = colDiff / absColDiff;
    const rowStep = rowDiff / absRowDiff;
    let c = from.col + colStep;
    let r = from.row + rowStep;
    while (c !== to.col + colStep) {
      path.push({ col: c, row: r });
      c += colStep;
      r += rowStep;
    }
  } else {
    path.push({ ...to });
  }
  return path;
}

function checkPortalInterception(state: GameState, path: Position[], moverColor: Color): any {
  const dimensionPairs = state.variantState.dimensionPairs || [];
  for (const pos of path) {
    for (const pair of dimensionPairs) {
      if (pair.owner !== moverColor && pair.odd) {
        if (pair.odd.position.col === pos.col && pair.odd.position.row === pos.row) {
          return pair;
        }
      }
    }
  }
  return null;
}
