import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { getBaseMovesForType } from '../../movement/MoveGenerator';
import { ShieldHandler } from '../../effect/handlers/ShieldHandler';
import { APCostConfig } from '../apCostConfig';

export const CannibalVariant: VariantDefinition = {
  id: 'cannibal',
  name: 'Cannibal',
  description: 'A dark, insatiable ruler that devours its own allies to gain their strength and AP.',

  getInitialState: () => ({
    kingCurrentMoveType: null,
    skill2SnapshotMoveType: null,
    ultimateSnapshotMoveType: null,
    ultimateActive: false,
    ultimateCaptureCount: 0,
  }),

  effectHandlers: [
    new ShieldHandler(),
  ],

  skills: [
    // ── Skill 1: Royal Guard (3 AP) ──
    {
      id: 'cannibal_royal_guard',
      name: 'Royal Guard',
      description: 'Apply Shield to King, duration 2 rounds.',
      tier: 'skill1',
      apCost: APCostConfig.cannibal.cannibal_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: (state, player) => [{
        type: 'piece',
        filter: 'ally',
        pieceType: PieceType.King,
        description: 'Select your King to shield',
      }],

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position) {
          return 'Select your King';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.type !== PieceType.King || piece.color !== player) {
          return 'Must target your own King';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const piece = state.board.getPiece(targets[0].position!)!;
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `shield_${piece.id}_${Date.now()}`,
            type: 'shield',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: piece.id,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    },

    // ── Skill 2: Devour (5 AP) ──
    {
      id: 'cannibal_devour',
      name: 'Devour',
      description: 'Apply devour to King for 3 rounds. Stun selected ally for 3 rounds. King will move like the devoured piece.',
      tier: 'skill2',
      apCost: APCostConfig.cannibal.cannibal_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: (state, player) => [{
        type: 'piece',
        filter: 'ally',
        excludeKing: true,
        description: 'Select an ally piece to devour',
      }],

      canActivate(state, player, targets) {
        if (state.variantState.ultimateActive === true) {
          return 'Cannot activate Devour while Apex Predator (Ultimate) is active';
        }
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 ally piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target your own ally piece';
        }
        if (piece.type === PieceType.King) {
          return 'Cannot target your own King';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const targetPos = targets[0].position!;
        const targetPiece = state.board.getPiece(targetPos)!;

        // Find own King piece
        let kingId = '';
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 15; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.type === PieceType.King && p.color === player) {
              kingId = p.id;
              break;
            }
          }
          if (kingId) break;
        }

        // Snapshot current move type
        state.variantState.skill2SnapshotMoveType = state.variantState.kingCurrentMoveType;
        state.variantState.kingCurrentMoveType = targetPiece.type;

        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `devour_${kingId}_${Date.now()}`,
              type: 'devour',
              duration: 3,
              remainingDuration: 3,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: kingId,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {
                targetPieceType: targetPiece.type
              },
            }
          },
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `stun_${targetPiece.id}_${Date.now()}`,
              type: 'stun',
              duration: 3,
              remainingDuration: 3,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: targetPiece.id,
              stackingRule: 'refresh',
              isDebuff: true,
              metadata: {},
            }
          }
        ];
      }
    },

    // ── Ultimate: Apex Predator (8 AP) ──
    {
      id: 'cannibal_apex_predator',
      name: 'Apex Predator',
      description: 'For 10 rounds, King moves like a Queen + Knight combined.',
      tier: 'ultimate',
      apCost: APCostConfig.cannibal.cannibal_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: (state, player) => [],

      canActivate(state, player, targets) {
        // Find if King has devour effect active
        let isDevourActive = false;
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 15; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.type === PieceType.King && p.color === player && p.effects) {
              isDevourActive = p.effects.some(e => e.type === 'devour' && (e.remainingDuration ?? 0) > 0);
              break;
            }
          }
          if (isDevourActive) break;
        }

        if (isDevourActive) {
          return 'Cannot activate Ultimate while Devour (Skill 2) is active';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        // Find own King piece
        let kingId = '';
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 15; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.type === PieceType.King && p.color === player) {
              kingId = p.id;
              break;
            }
          }
          if (kingId) break;
        }

        state.variantState.ultimateSnapshotMoveType = state.variantState.kingCurrentMoveType;
        state.variantState.ultimateActive = true;
        state.variantState.ultimateCaptureCount = 0;

        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `apex_predator_${kingId}_${Date.now()}`,
            type: 'apex_predator',
            duration: 10,
            remainingDuration: 10,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: kingId,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    }
  ],

  passiveHooks: (state, player) => [
    {
      id: 'cannibal_on_capture',
      eventType: 'OnCapture',
      priority: 100,
      source: 'variant:cannibal',
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnCapture') return;
        const { attackerId, capturedPieceSnapshot } = event.payload;
        if (!capturedPieceSnapshot) return;

        // Check if attacker is King of this player
        let piece = state.board.getPiece(event.payload.to);
        if (!piece || piece.id !== attackerId) {
          piece = state.board.getPiece(event.payload.from);
        }

        if (piece && piece.type === PieceType.King && piece.color === player) {
          // Update current move set type
          state.variantState.kingCurrentMoveType = capturedPieceSnapshot.type;

          // If ultimate is active, increment capture count
          if (state.variantState.ultimateActive) {
            state.variantState.ultimateCaptureCount = (state.variantState.ultimateCaptureCount || 0) + 1;
            if (state.variantState.ultimateCaptureCount % 2 === 0) {
              // Apply shield to King, duration 1 round
              enqueueAction({
                type: 'APPLY_EFFECT',
                effect: {
                  id: `cannibal_apex_shield_${Date.now()}_${state.variantState.ultimateCaptureCount}`,
                  type: 'shield',
                  duration: 1,
                  remainingDuration: 1,
                  tickTiming: 'turnEnd',
                  sourcePlayer: player,
                  targetType: 'piece',
                  targetId: piece.id,
                  stackingRule: 'refresh',
                  isDebuff: false,
                  metadata: {},
                }
              });
            }
          }
        }
      }
    },
    {
      id: 'cannibal_effect_expired',
      eventType: 'OnEffectExpired',
      priority: 100,
      source: 'variant:cannibal',
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnEffectExpired') return;
        const { effectSnapshot } = event.payload;
        if (!effectSnapshot || effectSnapshot.sourcePlayer !== player) return;

        if (effectSnapshot.type === 'devour') {
          state.variantState.kingCurrentMoveType = state.variantState.skill2SnapshotMoveType;
        } else if (effectSnapshot.type === 'apex_predator') {
          state.variantState.ultimateActive = false;
          state.variantState.kingCurrentMoveType = state.variantState.ultimateSnapshotMoveType;
        }
      }
    }
  ],

  moveModifiers: [
    {
      id: 'cannibal_king_moves',
      priority: 10,
      source: 'variant:cannibal',
      modify(moves, context) {
        const { piece, board, state } = context;
        if (piece.type !== PieceType.King) return moves;

        const isCannibal = piece.color === Color.White ? state.whiteVariantId === 'cannibal' : state.blackVariantId === 'cannibal';
        if (!isCannibal) return moves;

        const isUltimate = state.variantState.ultimateActive === true;
        if (isUltimate) {
          const queenMoves = getBaseMovesForType(board, context.piecePosition, PieceType.Queen, piece.color, true);
          const knightMoves = getBaseMovesForType(board, context.piecePosition, PieceType.Knight, piece.color, true);
          const combined = [...queenMoves, ...knightMoves];
          const seen = new Set<string>();
          return combined.filter(pos => {
            const key = `${pos.col},${pos.row}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }

        const moveType = state.variantState.kingCurrentMoveType || PieceType.King;
        return getBaseMovesForType(board, context.piecePosition, moveType, piece.color, true);
      }
    }
  ]
};
