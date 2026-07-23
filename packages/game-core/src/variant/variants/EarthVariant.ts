import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { GameEvent, GameEventType } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { specialPieceRegistry, countSpecialPieces } from '../../pieces/SpecialPieceRegistry';
import { APCostConfig } from '../apCostConfig';

// Register special pieces at top level
specialPieceRegistry.register({
  id: 'mountain',
  displayName: 'Mountain',
  getLegalMoves: () => [],
  captureApReward: 0,
  lossApReward: 0,
  canBeAttacked: false,
});

specialPieceRegistry.register({
  id: 'earth_reservation',
  displayName: 'Earth Reservation',
  getLegalMoves: () => [],
  captureApReward: 0,
  lossApReward: 0,
  canBeAttacked: false,
});

function findPieceById(state: GameState, id: string): { piece: Piece; pos: Position } | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board.getPiece({ col: c, row: r });
      if (p && p.id === id) {
        return { piece: p, pos: { col: c, row: r } };
      }
    }
  }
  return null;
}

interface SimulateResult {
  valid: boolean;
  reason?: string;
  pushes?: { pieceId: string; from: Position; to: Position }[];
}

function simulateShiftingPeaks(
  state: Readonly<GameState>,
  player: Color,
  from: Position,
  to: Position
): SimulateResult {
  const dcol = to.col - from.col;
  const drow = to.row - from.row;
  const absCol = Math.abs(dcol);
  const absRow = Math.abs(drow);

  if (dcol === 0 && drow === 0) {
    return { valid: false, reason: 'Cannot move to the same position' };
  }

  const isOrthogonal = dcol === 0 || drow === 0;
  const isDiagonal = absCol === absRow;
  if (!isOrthogonal && !isDiagonal) {
    return { valid: false, reason: 'Must move along a straight or diagonal path' };
  }

  const stepCol = Math.sign(dcol);
  const stepRow = Math.sign(drow);
  const steps = Math.max(absCol, absRow);

  // Build path cells (excluding 'from', including 'to')
  const path: Position[] = [];
  for (let k = 1; k <= steps; k++) {
    path.push({ col: from.col + k * stepCol, row: from.row + k * stepRow });
  }

  // Check path blockers (ally pieces and any mountains)
  for (const cell of path) {
    const piece = state.board.getPiece(cell);
    if (piece) {
      if (piece.color === player) {
        return { valid: false, reason: 'Path is blocked by an ally piece' };
      }
      if (piece.specialType === 'mountain') {
        return { valid: false, reason: 'Path is blocked by another Mountain' };
      }
    }
  }

  // Find enemy pieces on path (excluding destination 'to' because 'to' is empty)
  const enemyPiecesOnPath: { piece: Piece; startPos: Position; dist: number }[] = [];
  for (let k = 1; k < steps; k++) {
    const cell = path[k - 1];
    const piece = state.board.getPiece(cell);
    if (piece) {
      enemyPiecesOnPath.push({ piece, startPos: cell, dist: k });
    }
  }

  // Sort by distance descending (furthest first)
  enemyPiecesOnPath.sort((a, b) => b.dist - a.dist);

  const occupiedKeys = new Set<string>();

  // Add all static obstacles (all pieces not on the path, plus target Mountain at 'from' since it is moving)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = { col: c, row: r };
      const p = state.board.getPiece(cell);
      if (p && p.id !== state.board.getPiece(from)?.id) {
        const isPushed = enemyPiecesOnPath.some(item => item.piece.id === p.id);
        if (!isPushed) {
          occupiedKeys.add(`${c},${r}`);
        }
      }
    }
  }

  const pushes: { pieceId: string; from: Position; to: Position }[] = [];

  // Simulate pushing from furthest to closest
  for (const item of enemyPiecesOnPath) {
    let curr = { ...item.startPos };
    let stepsPushed = 0;
    while (stepsPushed < 3) {
      const next = { col: curr.col + stepCol, row: curr.row + stepRow };
      if (next.col < 0 || next.col >= BOARD_SIZE || next.row < 0 || next.row >= BOARD_SIZE) {
        break; // hit edge of board
      }
      const nextKey = `${next.col},${next.row}`;
      if (occupiedKeys.has(nextKey)) {
        break; // hit obstacle
      }
      curr = next;
      stepsPushed++;
    }

    occupiedKeys.add(`${curr.col},${curr.row}`);
    pushes.push({ pieceId: item.piece.id, from: item.startPos, to: curr });
  }

  // If any pushed piece ends up on the path (including 'to'), it is invalid
  for (const push of pushes) {
    const isOnPath = path.some(cell => cell.col === push.to.col && cell.row === push.to.row);
    if (isOnPath) {
      return { valid: false, reason: 'Destination or path is blocked by a pushed piece that cannot move further' };
    }
  }

  return { valid: true, pushes };
}

export const EarthVariant: VariantDefinition = {
  id: 'earth',
  name: 'Earth',
  description: 'Vũ trụ kiên cố của Đất: Kiến tạo những ngọn núi hùng vĩ chắn tầm nhìn, dịch chuyển địa hình dồn ép quân địch và lưu đày mục tiêu xuống lòng đất.',

  effectHandlers: [],

  onSetup(state, player) {
    if (!specialPieceRegistry.get('mountain')) {
      specialPieceRegistry.register({
        id: 'mountain',
        displayName: 'Mountain',
        getLegalMoves: () => [],
        captureApReward: 0,
        lossApReward: 0,
        canBeAttacked: false,
      });
    }
    if (!specialPieceRegistry.get('earth_reservation')) {
      specialPieceRegistry.register({
        id: 'earth_reservation',
        displayName: 'Earth Reservation',
        getLegalMoves: () => [],
        captureApReward: 0,
        lossApReward: 0,
        canBeAttacked: false,
      });
    }
    if (state.variantState.skill2CostThisTurn === undefined) {
      state.variantState.skill2CostThisTurn = APCostConfig.earth.earth_skill_2;
    }
    if (!state.variantState.shadowedPieces) {
      state.variantState.shadowedPieces = [];
    }
  },

  getInitialState: () => ({
    skill2CostThisTurn: APCostConfig.earth.earth_skill_2,
    shadowedPieces: [],
  }),

  passiveHooks: (state, player) => [
    {
      id: `earth_turn_start_${player}`,
      eventType: 'OnTurnStart',
      priority: 100,
      source: `variant:earth:${player}`,
      handler: (event) => {
        if (event.activePlayer !== player) return;
        const count = countSpecialPieces(state.board, player, 'mountain');
        state.variantState.skill2CostThisTurn = Math.max(3, APCostConfig.earth.earth_skill_2 - count);
      },
    },
    {
      id: `earth_effect_expired_${player}`,
      eventType: 'OnEffectExpired',
      priority: 100,
      source: `variant:earth:${player}`,
      handler: (event, enqueueAction) => {
        const snapshot = event.payload.effectSnapshot;
        if (!snapshot) return;

        if (snapshot.type === 'mountain_timer') {
          const mountainId = snapshot.targetId;
          const found = findPieceById(state, mountainId);
          if (found && found.piece.specialType === 'mountain') {
            enqueueAction({
              type: 'DESTROY_PIECE',
              pieceId: mountainId,
              position: found.pos,
              reason: 'effect_expired',
            });
          }
        } else if (snapshot.type === 'reservation_timer') {
          const reservationId = snapshot.targetId;
          const found = findPieceById(state, reservationId);
          if (found && found.piece.specialType === 'earth_reservation') {
            enqueueAction({
              type: 'DESTROY_PIECE',
              pieceId: reservationId,
              position: found.pos,
              reason: 'effect_expired',
            });

            const shadowed = state.variantState.shadowedPieces || [];
            const idx = shadowed.findIndex((p: any) => p.reservationPieceId === reservationId);
            if (idx !== -1) {
              const shadow = shadowed[idx];
              enqueueAction({
                type: 'SPAWN_PIECE',
                piece: shadow.pieceSnapshot,
                position: shadow.originalPosition,
              });
              shadowed.splice(idx, 1);
            }
          }
        }
      },
    },
  ],

  skills: [
    // ── Skill 1: Raise the Mountain (3 AP) ──
    {
      id: 'earth_raise_mountain',
      name: 'Raise the Mountain',
      description: 'Kiến tạo 1 ngọn núi tại ô trống tồn tại trong 5 vòng đấu.',
      tier: 'skill1',
      apCost: APCostConfig.earth.earth_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [{
          type: 'cell',
          filter: 'empty',
          description: 'Select an empty square to place the Mountain',
        }];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 empty cell';
        }
        const pos = targets[0].position;
        const piece = state.board.getPiece(pos);
        if (piece) {
          return 'Target cell must be empty';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const pos = targets[0].position!;
        const mountainId = `mountain_${player === Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}`;

        return [
          {
            type: 'SPAWN_PIECE',
            piece: {
              id: mountainId,
              type: 'mountain',
              color: player,
              specialType: 'mountain',
              effects: [],
            },
            position: pos,
          },
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `mountain_timer_${mountainId}`,
              type: 'mountain_timer',
              duration: 5,
              remainingDuration: 5,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: mountainId,
              stackingRule: 'ignore',
              isDebuff: false,
              metadata: {},
            },
          },
        ];
      },
    },

    // ── Skill 2: Shifting Peaks (6 AP base, min 3 AP) ──
    {
      id: 'earth_shifting_peaks',
      name: 'Shifting Peaks',
      description: 'Dịch chuyển một ngọn núi theo đường đi của Hậu, dồn ép quân địch trên đường đi.',
      tier: 'skill2',
      apCost: (state, player) => state.variantState.skill2CostThisTurn ?? APCostConfig.earth.earth_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'ally',
            description: 'Select a Mountain piece to move',
          },
          {
            type: 'cell',
            filter: 'empty',
            description: 'Select an empty destination cell',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 2) {
          return 'Select exactly a Mountain piece and an empty destination cell';
        }
        const fromTarget = targets[0];
        const toTarget = targets[1];

        if (fromTarget.type !== 'piece' || !fromTarget.position) {
          return 'First target must be a Mountain piece';
        }
        if (toTarget.type !== 'cell' || !toTarget.position) {
          return 'Second target must be a cell';
        }

        const piece = state.board.getPiece(fromTarget.position);
        if (!piece || piece.specialType !== 'mountain' || piece.color !== player) {
          return 'Must select an ally Mountain piece';
        }

        const destPiece = state.board.getPiece(toTarget.position);
        if (destPiece) {
          return 'Destination cell must be empty';
        }

        const sim = simulateShiftingPeaks(state, player, fromTarget.position, toTarget.position);
        if (!sim.valid) {
          return sim.reason || 'Invalid Shifting Peaks move';
        }

        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const from = targets[0].position!;
        const to = targets[1].position!;
        const mountainPiece = state.board.getPiece(from);
        if (!mountainPiece) return [];

        const timerEffect = mountainPiece.effects?.find(e => e.type === 'mountain_timer');
        const remaining = timerEffect ? timerEffect.remainingDuration : 5;

        const simResult = simulateShiftingPeaks(state, player, from, to);
        if (!simResult.valid) return [];

        const actions: Action[] = [];

        // 1. Pushes
        if (simResult.pushes) {
          for (const push of simResult.pushes) {
            actions.push({
              type: 'PUSH_PIECE',
              pieceId: push.pieceId,
              from: push.from,
              to: push.to,
              reason: 'shifting_peaks',
            });
          }
        }

        // 2. Destroy old mountain
        actions.push({
          type: 'DESTROY_PIECE',
          pieceId: mountainPiece.id,
          position: from,
          reason: 'earth_burst',
        });

        // 3. Spawn new Mountain at B
        const mountainBId = `mountain_${player === Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}`;
        actions.push({
          type: 'SPAWN_PIECE',
          piece: {
            id: mountainBId,
            type: 'mountain',
            color: player,
            specialType: 'mountain',
            effects: [],
          },
          position: to,
        });

        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `mountain_timer_${mountainBId}`,
            type: 'mountain_timer',
            duration: remaining,
            remainingDuration: remaining,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: mountainBId,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        // 4. Spawn new Mountain at A
        const mountainAId = `mountain_${player === Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}`;
        actions.push({
          type: 'SPAWN_PIECE',
          piece: {
            id: mountainAId,
            type: 'mountain',
            color: player,
            specialType: 'mountain',
            effects: [],
          },
          position: from,
        });

        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `mountain_timer_${mountainAId}`,
            type: 'mountain_timer',
            duration: remaining,
            remainingDuration: remaining,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: mountainAId,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        return actions;
      },
    },

    // ── Ultimate: Earth-Burst Heavenly Star (10 AP) ──
    {
      id: 'earth_earth_burst',
      name: 'Earth-Burst Heavenly Star',
      description: 'Lưu đày một quân địch xuống lòng đất trong N vòng đấu (N là số núi hiện tại).',
      tier: 'ultimate',
      apCost: APCostConfig.earth.earth_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [{
          type: 'piece',
          filter: 'enemy',
          excludeKing: true,
          description: 'Select an enemy piece (excluding King) to exile',
        }];
      },

      canActivate(state, player, targets) {
        const count = countSpecialPieces(state.board, player, 'mountain');
        if (count < 3) {
          return 'Requires at least 3 Mountain pieces on the board';
        }

        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select exactly 1 enemy piece';
        }

        const targetPos = targets[0].position;
        const targetPiece = state.board.getPiece(targetPos);
        if (!targetPiece) {
          return 'Piece not found';
        }
        if (targetPiece.color === player) {
          return 'Cannot target ally piece';
        }
        if (targetPiece.type === PieceType.King) {
          return 'Cannot target the King';
        }

        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const targetPos = targets[0].position!;
        const enemyPiece = state.board.getPiece(targetPos);
        if (!enemyPiece) return [];

        const count = countSpecialPieces(state.board, player, 'mountain');
        const actions: Action[] = [];

        // 1. Destroy all mountains
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = { col: c, row: r };
            const p = state.board.getPiece(cell);
            if (p && p.color === player && p.specialType === 'mountain') {
              actions.push({
                type: 'DESTROY_PIECE',
                pieceId: p.id,
                position: cell,
                reason: 'earth_burst',
              });
            }
          }
        }

        // 2. Exiled target
        state.board.removePiece(targetPos);

        // 3. Spawn earth_reservation
        const reservationPieceId = `reservation_${player === Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}`;
        actions.push({
          type: 'SPAWN_PIECE',
          piece: {
            id: reservationPieceId,
            type: 'earth_reservation',
            color: player,
            specialType: 'earth_reservation',
            effects: [],
          },
          position: targetPos,
        });

        // 4. Apply reservation timer
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `reservation_timer_${reservationPieceId}`,
            type: 'reservation_timer',
            duration: count,
            remainingDuration: count,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: reservationPieceId,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        // Save shadow state
        if (!state.variantState.shadowedPieces) {
          state.variantState.shadowedPieces = [];
        }
        state.variantState.shadowedPieces.push({
          pieceSnapshot: enemyPiece,
          originalPosition: targetPos,
          reservationPieceId,
        });

        return actions;
      },
    },
  ],
};
