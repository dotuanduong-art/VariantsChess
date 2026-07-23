import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { GameState } from '../../state/GameState';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { PredictionHandler } from '../../effect/handlers/PredictionHandler';
import { TimeFreezeHandler } from '../../effect/handlers/TimeFreezeHandler';
import { APCostConfig } from '../apCostConfig';

function applySnapshot(state: GameState, snapshot: any): Action[] {
  const snapshotPositions = new Map<string, Position>();
  for (const entry of snapshot.positions) {
    snapshotPositions.set(entry.pieceId, entry.position);
  }

  const currentPieces: { piece: Piece; currentPos: Position }[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board.getPiece({ col: c, row: r });
      if (p) {
        currentPieces.push({ piece: p, currentPos: { col: c, row: r } });
      }
    }
  }

  const toMove: { piece: Piece; currentPos: Position; targetPos: Position }[] = [];
  for (const { piece, currentPos } of currentPieces) {
    const targetPos = snapshotPositions.get(piece.id);
    if (targetPos) {
      toMove.push({ piece, currentPos, targetPos });
    }
  }

  // Clear board of all moving pieces
  for (const { currentPos } of toMove) {
    state.board.removePiece(currentPos);
  }

  // Place them back at their snapshot positions
  for (const { piece, targetPos } of toMove) {
    state.board.setPiece(targetPos, piece);
  }

  return [];
}

export const TimeVariant: VariantDefinition = {
  id: 'time',
  name: 'Time',
  description: 'Control the flow of time, predict moves, freeze the opponent, or rewind the board position.',
  effectHandlers: [
    new PredictionHandler(),
    new TimeFreezeHandler(),
  ],

  getInitialState: () => ({
    ultimateUseCount: 0,
  }),

  skills: [
    // ── Skill 1: Rewind (4 AP) ──
    {
      id: 'time_rewind',
      name: 'Rewind',
      description: 'Lấy board position snapshot từ 1 round trước (2 turns trước) và di chuyển các quân về vị trí trong snapshot.',
      tier: 'skill1',
      apCost: APCostConfig.time.time_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [];
      },

      canActivate(state, player, targets) {
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        if (!state.positionSnapshots || state.positionSnapshots.length < 3) {
          if (state.positionSnapshots && state.positionSnapshots.length > 0) {
            return applySnapshot(state, state.positionSnapshots[0]);
          }
          return [];
        }
        const snapshot = state.positionSnapshots[state.positionSnapshots.length - 3];
        return applySnapshot(state, snapshot);
      },
    },

    // ── Skill 2: Future Prediction (5 AP) ──
    {
      id: 'time_prediction',
      name: 'Future Prediction',
      description: 'Dự đoán nước đi của 1 quân địch. Nếu chúng di chuyển/ăn quân tại ô đó, áp dụng Stun 4 rounds.',
      tier: 'skill2',
      apCost: APCostConfig.time.time_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'enemy',
            description: 'Select an enemy piece to predict',
          },
          {
            type: 'cell',
            filter: 'any',
            description: 'Select predicted destination square',
          }
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 2) {
          return 'Select an enemy piece and a predicted position';
        }
        const t1 = targets[0];
        if (t1.type !== 'piece' || !t1.position || !t1.pieceId) {
          return 'Invalid target piece';
        }
        const piece = state.board.getPiece(t1.position);
        if (!piece || piece.color === player) {
          return 'Must target an enemy piece';
        }
        const t2 = targets[1];
        if (t2.type !== 'cell' || !t2.position) {
          return 'Invalid predicted position';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const t1 = targets[0];
        const t2 = targets[1];
        const pieceId = t1.pieceId!;
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `prediction_${pieceId}_${Date.now()}`,
              type: 'prediction',
              duration: 1,
              remainingDuration: 1,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: pieceId,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {
                predictedPosition: { col: t2.position!.col, row: t2.position!.row },
              },
            },
          }
        ];
      },
    },

    // ── Ultimate Option A: Grand Rewind (AP theo Passive) ──
    {
      id: 'time_grand_rewind',
      name: 'Grand Rewind',
      description: 'Khôi phục vị trí các quân cờ từ 5 rounds trước (10 turns trước).',
      tier: 'ultimate',
      apCost: (state, player) => {
        const count = state.variantState.ultimateUseCount || 0;
        return APCostConfig.time.time_ultimate[Math.min(count, 2)];
      },
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [];
      },

      canActivate(state, player, targets) {
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        state.variantState.ultimateUseCount = (state.variantState.ultimateUseCount || 0) + 1;
        if (!state.positionSnapshots || state.positionSnapshots.length < 11) {
          if (state.positionSnapshots && state.positionSnapshots.length > 0) {
            return applySnapshot(state, state.positionSnapshots[0]);
          }
          return [];
        }
        const snapshot = state.positionSnapshots[state.positionSnapshots.length - 11];
        return applySnapshot(state, snapshot);
      },
    },

    // ── Ultimate Option B: Time Freeze (AP theo Passive) ──
    {
      id: 'time_time_freeze',
      name: 'Time Freeze',
      description: 'Lấy lượt đóng băng đối thủ trong 6 rounds: mọi nước đi của địch (trừ King) bị Stun với duration bằng số rounds còn lại.',
      tier: 'ultimate',
      apCost: (state, player) => {
        const count = state.variantState.ultimateUseCount || 0;
        return APCostConfig.time.time_ultimate[Math.min(count, 2)];
      },
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [];
      },

      canActivate(state, player, targets) {
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        state.variantState.ultimateUseCount = (state.variantState.ultimateUseCount || 0) + 1;
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `time_freeze_${player}_${Date.now()}`,
              type: 'time_freeze',
              duration: 6,
              remainingDuration: 6,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'player',
              targetId: player,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            },
          }
        ];
      },
    },
  ],
};
