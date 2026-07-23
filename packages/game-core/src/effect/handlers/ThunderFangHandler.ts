import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { BOARD_SIZE } from '../../board/Board';

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
export class ThunderFangHandler implements EffectHandler {
  effectType = 'thunder_fang' as EffectType;
  subscribesTo: GameEventType[] = ['OnCapture', 'OnTurnEnd'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnTurnEnd') {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const piece = state.board.getPiece({ col: c, row: r });
          if (piece && piece.color === event.activePlayer) {
            const fangEffect = piece.effects?.find(e => e.type === 'thunder_fang');
            if (fangEffect) {
              enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: fangEffect.id,
                targetId: piece.id,
                targetType: 'piece',
                reason: 'expired',
              });
            }
          }
        }
      }
      return;
    }

    if (event.type !== 'OnCapture') return;

    const { attackerId, to } = event.payload;

    // Find attacker — may be at `to` (normal capture) or still at `from` (stayInPlace)
    let attacker = state.board.getPiece(to);
    if (!attacker || attacker.id !== attackerId) {
      // stayInPlace scenario: search the board
      for (let r = 0; r < BOARD_SIZE && !attacker; r++) {
        for (let c = 0; c < BOARD_SIZE && !attacker; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === attackerId) attacker = p;
        }
      }
    }

    if (!attacker) return;

    // Check if the attacker has thunder_fang
    const hasFang = attacker.effects?.some(
      e => e.type === 'thunder_fang' && e.sourcePlayer === attacker!.color
    );
    if (!hasFang) return;

    // Place a thunder_trap cell-stun on the captured square (reuses ThunderTrapHandler).
    // Duration 4 = 2 rounds (2 turnEnd ticks per player).
    enqueueAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: `thunder_fang_trap_${to.col}_${to.row}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'thunder_trap',
        duration: 2, // 2 rounds
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: attacker.color,
        targetType: 'cell',
        targetId: `${to.col},${to.row}`,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    });
  }

  /**
   * When the piece carrying thunder_fang moves, expand its capture targets to
   * all enemy pieces reachable from its position using Queen-like movement
   * (all 8 directions, any distance). This enables range capture regardless of
   * the piece's own movement type.
   *
   * The modifier only ADDS new capture squares — it never removes existing moves.
   */
  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    if (effect.type !== 'thunder_fang') return null;
    return {
      id: `thunder_fang_range_${effect.id}`,
      priority: 400, // after stun/bind restrictors (priority 200-300) but before final filters
      source: 'effect:thunder_fang',
      modify(moves, context) {
        if (effect.targetType !== 'piece' || context.piece.id !== effect.targetId) {
          return moves;
        }

        const directions = [
          { dc: 0, dr: 1 }, { dc: 0, dr: -1 },
          { dc: 1, dr: 0 }, { dc: -1, dr: 0 },
          { dc: 1, dr: 1 }, { dc: 1, dr: -1 },
          { dc: -1, dr: 1 }, { dc: -1, dr: -1 },
        ];

        const extraCaptures: { col: number; row: number }[] = [];
        const { col: startCol, row: startRow } = context.piecePosition;

        for (const { dc, dr } of directions) {
          for (let dist = 1; dist < BOARD_SIZE; dist++) {
            const col = startCol + dc * dist;
            const row = startRow + dr * dist;
            if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) break;

            const target = state.board.getPiece({ col, row });
            if (target) {
              if (target.color !== context.piece.color) {
                // Enemy — valid capture square
                extraCaptures.push({ col, row });
              }
              // Blocked by any piece (ally or enemy) in this direction
              break;
            }
          }
        }

        // Merge with existing moves (deduplicate)
        const existing = new Set(moves.map(m => `${m.col},${m.row}`));
        for (const pos of extraCaptures) {
          const key = `${pos.col},${pos.row}`;
          if (!existing.has(key)) {
            moves = [...moves, pos];
            existing.add(key);
          }
        }

        return moves;
      },
    };
  }
}
