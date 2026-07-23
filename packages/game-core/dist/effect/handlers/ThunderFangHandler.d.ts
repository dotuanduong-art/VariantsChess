import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
/**
 * ThunderFangHandler – handles the `thunder_fang` effect (Thunder Dragon Skill 2).
 *
 * Two behaviours:
 *
 * 1. **Range capture** (getMoveModifier):
 *    The piece can capture enemies that are NOT adjacent — it can reach any
 *    square the piece's normal move pattern covers (including non-adjacent squares).
 *    Mechanically this is already the case for most pieces (Rook, Bishop, Queen).
 *    For pieces with fixed-distance moves (Pawn, Knight, King) the modifier
 *    expands capture squares to ALL enemy squares in range of a Queen starting
 *    from that piece, allowing the "shoot without moving" pattern.
 *    The `stayInPlace: true` flag is set on the submitted CaptureAction so the
 *    attacker never physically moves to the target square.
 *
 *    NOTE: The actual `stayInPlace` flag injection happens in ThunderDragonVariant's
 *    passiveHook (OnBeforeCapture) because the MoveModifier only filters positions,
 *    it cannot mutate the submitted Action. The handler here provides a MoveModifier
 *    that allows FULL-BOARD capture range for the piece so the frontend sees
 *    all valid capture targets.
 *
 * 2. **Stun cell on kill** (handle → OnCapture):
 *    After the attacker destroys an enemy, the cell at `to` receives a `stun`
 *    cell-effect for 2 rounds (4 turnEnd ticks). Any enemy that steps onto
 *    that cell is stunned (handled by the pre-existing ThunderTrapHandler logic
 *    — we reuse type `thunder_trap` for the cell stun so the existing handler
 *    picks it up automatically).
 */
export declare class ThunderFangHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
    /**
     * When the piece carrying thunder_fang moves, expand its capture targets to
     * all enemy pieces reachable from its position using Queen-like movement
     * (all 8 directions, any distance). This enables range capture regardless of
     * the piece's own movement type.
     *
     * The modifier only ADDS new capture squares — it never removes existing moves.
     */
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=ThunderFangHandler.d.ts.map