import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { APCostConfig } from '../apCostConfig';
import { SailingHandler } from '../../effect/handlers/SailingHandler';
import { PirateBetHandler } from '../../effect/handlers/PirateBetHandler';
import { oppositeColor } from '../../pieces/Piece';

export const PirateVariant: VariantDefinition = {
  id: 'pirate',
  name: 'Pirate',
  description: 'Thuyền trưởng cướp biển liều lĩnh: sẵn sàng nợ AP để kích hoạt kỹ năng, đánh cược chiến thuật và nã đại bác tiêu diệt kẻ thù.',
  effectHandlers: [
    new SailingHandler(),
    new PirateBetHandler(),
  ],

  getInitialState: () => ({}),

  onSetup(state, player): void {
    state.variantState[`pirateDebtEnabled_${player}`] = true;
  },

  skills: [
    // ── Skill 1: Bet (4 AP) ──
    {
      id: 'pirate_bet',
      name: 'Bet',
      description: 'Đánh cược đối phương sẽ sử dụng kỹ năng (Skill 1/2/Ultimate) trong 2 vòng đấu tiếp theo. Nếu đúng cược sẽ được +8 AP, nếu sai không có gì xảy ra.',
      tier: 'skill1',
      apCost: APCostConfig.pirate.pirate_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        const ap = player === Color.White ? state.whiteAP : state.blackAP;
        if (ap < 0) {
          return 'Bạn còn nợ AP, hãy kiếm đủ AP trước';
        }

        const hasBet = state.getPlayerEffects(player).some(e => e.type === 'pirate_bet');
        if (hasBet) {
          return 'Bạn đã đặt cược ở vòng đấu này rồi';
        }

        return null;
      },
      execute(state, player, targets): Action[] {
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `pirate_bet_${player}_${Date.now()}`,
              type: 'pirate_bet',
              duration: 2, // 2 rounds
              remainingDuration: 2,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'player',
              targetId: player,
              stackingRule: 'ignore',
              isDebuff: false,
              metadata: {},
            },
          },
        ];
      },
    },

    // ── Skill 2: Sailing (7 AP) ──
    {
      id: 'pirate_sailing',
      name: 'Sailing',
      description: 'Trao hiệu ứng Sailing cho 1 quân đồng minh (trừ Vua) và chọn 1 ô trống trên bàn cờ. Quân đó sẽ không thể di chuyển trong 2 vòng đấu, nhưng khi hết hiệu ứng sẽ tiến đến ô được chọn (nếu có địch thì ăn quân, có đồng minh thì đứng yên).',
      tier: 'skill2',
      apCost: APCostConfig.pirate.pirate_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [
        {
          type: 'piece',
          filter: 'ally',
          excludeKing: true,
          description: 'Chọn 1 quân đồng minh làm thủy thủ',
        },
        {
          type: 'cell',
          filter: 'empty',
          description: 'Chọn 1 ô trống làm đích đến',
        },
      ],
      canActivate(state, player, targets) {
        const ap = player === Color.White ? state.whiteAP : state.blackAP;
        if (ap < 0) {
          return 'Bạn còn nợ AP, hãy kiếm đủ AP trước';
        }

        if (targets.length !== 2) {
          return 'Vui lòng chọn 1 quân đồng minh và 1 ô đích trống';
        }

        const pieceTarget = targets[0];
        const cellTarget = targets[1];

        if (pieceTarget.type !== 'piece' || !pieceTarget.position || !pieceTarget.pieceId) {
          return 'Mục tiêu thứ nhất phải là một quân cờ';
        }
        if (cellTarget.type !== 'cell' || !cellTarget.position) {
          return 'Mục tiêu thứ hai phải là một ô trống';
        }

        const piece = state.board.getPiece(pieceTarget.position);
        if (!piece || piece.color !== player) {
          return 'Quân cờ được chọn phải là đồng minh';
        }
        if (piece.type === PieceType.King) {
          return 'Không thể chọn Vua';
        }

        const destPiece = state.board.getPiece(cellTarget.position);
        if (destPiece) {
          return 'Ô đích phải trống lúc kích hoạt';
        }

        // Check if already sailing
        if (piece.effects?.some(e => e.type === 'sailing')) {
          return 'Quân cờ này đã có hiệu ứng Sailing rồi';
        }

        return null;
      },
      execute(state, player, targets): Action[] {
        const pieceId = targets[0].pieceId!;
        const dest = targets[1].position!;

        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `sailing_${pieceId}_${Date.now()}`,
              type: 'sailing',
              duration: 2, // 2 rounds
              remainingDuration: 2,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: pieceId,
              stackingRule: 'ignore',
              isDebuff: false,
              metadata: {
                destCol: dest.col,
                destRow: dest.row,
                targetPieceId: pieceId,
              },
            },
          },
        ];
      },
    },

    // ── Ultimate: Broadside (12 AP) ──
    {
      id: 'pirate_broadside',
      name: 'Broadside',
      description: 'Nã đại pháo: Toàn bộ quân Rook đồng minh trên bàn cờ sẽ bắn hạ quân địch đầu tiên thẳng phía trước cột dọc mà không cần di chuyển. Vị trí quân bị ăn sẽ phát nổ 3x3 tiêu diệt quân địch xung quanh.',
      tier: 'ultimate',
      apCost: APCostConfig.pirate.pirate_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        const ap = player === Color.White ? state.whiteAP : state.blackAP;
        if (ap < 0) {
          return 'Bạn còn nợ AP, hãy kiếm đủ AP trước';
        }

        return null;
      },
      execute(state, player, targets): Action[] {
        const actions: Action[] = [];
        const opponent = oppositeColor(player);
        
        // White: rows increase forward (from row 0/1 towards row 14) -> step +1
        // Black: rows decrease forward (from row 14/13 towards row 0) -> step -1
        const direction = player === Color.White ? 1 : -1;

        // Clone grid for simulation to handle sequential broadsides and deduplication
        const gridCopy: (string | null)[][] = []; // piece ID or null
        const pieceMap = new Map<string, { piece: any; pos: Position }>();

        for (let r = 0; r < BOARD_SIZE; r++) {
          gridCopy[r] = [];
          for (let c = 0; c < BOARD_SIZE; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p) {
              gridCopy[r][c] = p.id;
              pieceMap.set(p.id, { piece: p, pos: { col: c, row: r } });
            } else {
              gridCopy[r][c] = null;
            }
          }
        }

        // Loop through the board to locate allied Rooks
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const initialPieceId = gridCopy[r][c];
            if (!initialPieceId) continue;

            const mapping = pieceMap.get(initialPieceId);
            if (!mapping) continue;

            const rook = mapping.piece;
            if (rook.color !== player || rook.type !== PieceType.Rook) continue;

            // Scan column forward from Rook's position
            for (let targetRow = r + direction; targetRow >= 0 && targetRow < BOARD_SIZE; targetRow += direction) {
              const currentCellId = gridCopy[targetRow][c];
              if (!currentCellId) continue;

              const targetMapping = pieceMap.get(currentCellId);
              if (!targetMapping) break; // Path blocked or invalid

              const target = targetMapping.piece;

              // If it's an allied piece, the line of sight is blocked
              if (target.color === player) {
                break;
              }

              // If it's an enemy piece, fire broadside!
              if (target.type === PieceType.King) {
                break; // King cannot be captured or destroyed this way
              }

              const targetPos = { col: c, row: targetRow };

              // 1. Capture target (stayInPlace = true)
              actions.push({
                type: 'CAPTURE',
                attackerId: rook.id,
                from: { col: c, row: r },
                to: targetPos,
                capturedPieceId: target.id,
                capturedPieceSnapshot: { ...target, effects: target.effects ? target.effects.map((e: any) => ({ ...e })) : [] },
                stayInPlace: true,
              });

              // Remove captured piece from simulation grid
              gridCopy[targetRow][c] = null;

              // 2. Explode 3x3 centered at targetPos (destroying enemy pieces only, excluding Kings)
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const blastPos = { col: targetPos.col + dc, row: targetPos.row + dr };
                  if (blastPos.col < 0 || blastPos.col >= BOARD_SIZE || blastPos.row < 0 || blastPos.row >= BOARD_SIZE) continue;

                  const blastPieceId = gridCopy[blastPos.row][blastPos.col];
                  if (!blastPieceId) continue;

                  const blastMapping = pieceMap.get(blastPieceId);
                  if (blastMapping) {
                    const blastPiece = blastMapping.piece;
                    if (blastPiece.color === opponent && blastPiece.type !== PieceType.King) {
                      actions.push({
                        type: 'DESTROY_PIECE',
                        pieceId: blastPiece.id,
                        position: blastPos,
                        reason: 'pirate_broadside_explosion',
                      });
                      // Remove destroyed piece from simulation grid
                      gridCopy[blastPos.row][blastPos.col] = null;
                    }
                  }
                }
              }

              // Fire resolved for this Rook, stop scanning column
              break;
            }
          }
        }

        return actions;
      },
    },
  ],
};
