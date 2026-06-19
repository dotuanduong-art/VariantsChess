import { EventBus } from '../event/EventBus';
import { GameState } from '../state/GameState';
import { Effect, EffectType } from './Effect';
import { EffectHandler } from './EffectHandler';
import { BOARD_SIZE } from '../board/Board';
import { Action } from '../action/Action';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { ActionPipeline } from '../action/ActionPipeline';

export class EffectRegistry {
  private handlers: Map<EffectType, EffectHandler> = new Map();
  private wiredEventBusTypes: Set<string> = new Set();
  private wiredValidationHandlers: Set<EffectType> = new Set();
  private wiredMoveModifierHandlers: Set<EffectType> = new Set();

  /** Register a handler for an effect type */
  register(handler: EffectHandler): void {
    this.handlers.set(handler.effectType, handler);
  }

  /** Get handler for an effect type */
  getHandler(effectType: EffectType): EffectHandler | undefined {
    return this.handlers.get(effectType);
  }

  /** Get all registered handlers */
  getAllHandlers(): EffectHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Helper: Get all active effects on the board.
   */
  getAllActiveEffects(state: Readonly<GameState>): Effect[] {
    const effects: Effect[] = [];
    
    // 1. Gather piece effects
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = state.board.getPiece({ col: c, row: r });
        if (piece && piece.effects) {
          effects.push(...piece.effects);
        }
      }
    }

    // 2. Gather cell effects
    const allCellEffects = state.board.getAllCellEffects();
    for (const cellEffects of allCellEffects.values()) {
      effects.push(...cellEffects);
    }

    // 3. Gather player effects
    effects.push(...state.whitePlayerEffects);
    effects.push(...state.blackPlayerEffects);

    return effects;
  }

  /**
   * Wire all handlers into the EventBus.
   */
  wireToEventBus(eventBus: EventBus, state: GameState): void {
    for (const handler of this.handlers.values()) {
      for (const eventType of handler.subscribesTo) {
        const key = `${handler.effectType}_${eventType}`;
        if (this.wiredEventBusTypes.has(key)) continue;

        eventBus.on({
          id: `effect_bus_${handler.effectType}_${eventType}`,
          eventType,
          priority: handler.priority ?? 500,
          source: `effect:${handler.effectType}`,
          handler: (event, enqueueAction) => {
            const ev = event as any;
            if (!ev.executedHandlers) {
              ev.executedHandlers = new Set<string>();
            }
            if (ev.executedHandlers.has(handler.effectType)) {
              return;
            }
            ev.executedHandlers.add(handler.effectType);
            handler.handle(event, state, enqueueAction);
          }
        });
        this.wiredEventBusTypes.add(key);
      }
    }
  }

  /**
   * Wire handlers that have validateAction into the validation pipeline.
   */
  wireToValidationPipeline(pipeline: ActionPipeline, state: GameState): void {
    for (const handler of this.handlers.values()) {
      if (handler.validateAction && !this.wiredValidationHandlers.has(handler.effectType)) {
        const localHandler = handler;
        pipeline.addValidator({
          validate: (action, s) => {
            const active = this.getAllActiveEffects(s).filter(
              e => e.type === localHandler.effectType
            );
            if (active.length > 0 && localHandler.validateAction) {
              return localHandler.validateAction(action, active, s);
            }
            return null;
          }
        });
        this.wiredValidationHandlers.add(handler.effectType);
      }
    }
  }

  /**
   * Wire handlers that have getMoveModifier into the modifier chain.
   */
  wireToMoveModifierChain(chain: MoveModifierChain, state: GameState): void {
    for (const handler of this.handlers.values()) {
      if (handler.getMoveModifier && !this.wiredMoveModifierHandlers.has(handler.effectType)) {
        const localHandler = handler;
        chain.register({
          id: `effect_chain_${localHandler.effectType}`,
          priority: 500,
          source: `effect:${localHandler.effectType}`,
          modify: (moves, context) => {
            const active = this.getAllActiveEffects(context.state).filter(
              e => e.type === localHandler.effectType
            );
            if (active.length === 0) return moves;

            let modifiedMoves = moves;
            for (const effect of active) {
              if (localHandler.getMoveModifier) {
                const modifier = localHandler.getMoveModifier(effect, context.state);
                if (modifier) {
                  modifiedMoves = modifier.modify(modifiedMoves, context);
                }
              }
            }
            return modifiedMoves;
          }
        });
        this.wiredMoveModifierHandlers.add(handler.effectType);
      }
    }
  }
}
