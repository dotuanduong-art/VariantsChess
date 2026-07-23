import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { getSquareRegion } from '../../region/Region';
import { getAttackedPieces } from '../../combat/AttackDetection';
import { APCostConfig } from '../apCostConfig';

const RESURRECT_AP_MAP: Record<PieceType, number> = {
  [PieceType.Pawn]: APCostConfig.phoenix.phoenix_table.Pawn,
  [PieceType.Knight]: APCostConfig.phoenix.phoenix_table.Knight,
  [PieceType.Bishop]: APCostConfig.phoenix.phoenix_table.Bishop,
  [PieceType.Rook]: APCostConfig.phoenix.phoenix_table.Rook,
  [PieceType.Queen]: APCostConfig.phoenix.phoenix_table.Queen,
  [PieceType.King]: 999, // Cannot resurrect King
};

export const PhoenixVariant: VariantDefinition = {
  id: 'phoenix',
  name: 'Phoenix',
  description: 'Một phượng hoàng kiêu hãnh hồi sinh từ đống tro tàn, thiêu đốt chiến trường và phong tỏa kỹ năng đối phương.',
  effectHandlers: [],

  getInitialState: () => ({
    phoenixRebirthed: {},
    phoenixSkillsDisabled: {},
    supernova: null,
  }),

  passiveHooks: (state, player) => [
    // Supernova timer check at the start of EVERY turn (both White and Black)
    {
      id: `phoenix_supernova_detonation_${player}`,
      eventType: 'OnTurnStart',
      priority: 100,
      source: `variant:phoenix:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnStart') return;

        const supernova = state.variantState.supernova;
        if (supernova && supernova.active) {
          const { turnNumber, activePlayer } = event;
          // Calculate ply stably
          const currentPly = (turnNumber - 1) * 2 + (activePlayer === Color.White ? 0 : 1);

          if (currentPly >= supernova.detonationPly) {
            const center = supernova.center;
            const region = getSquareRegion(center, 7);

            // 1. Destroy all non-King pieces in the 7x7 region
            for (const pos of region) {
              const piece = state.board.getPiece(pos);
              if (piece && piece.type !== PieceType.King) {
                enqueueAction({
                  type: 'DESTROY_PIECE',
                  pieceId: piece.id,
                  position: pos,
                  reason: 'supernova_explosion',
                });
              }
            }

            // 2. Remove all supernova_warning cell effects in the 7x7 region
            for (const pos of region) {
              const cellEffects = state.board.getCellEffects(pos) || [];
              for (const effect of cellEffects) {
                if (effect.type === 'supernova_warning') {
                  enqueueAction({
                    type: 'REMOVE_EFFECT',
                    effectId: effect.id,
                    targetId: `${pos.col},${pos.row}`,
                    targetType: 'cell',
                    reason: 'detonated',
                  });
                }
              }
            }

            // 3. Clear supernova state
            state.variantState.supernova = null;
          }
        }
      },
    },
  ],

  skills: [
    // ── Skill 1: Ashes of Reanimation (Dynamic AP) ──
    {
      id: 'phoenix_ashes',
      name: 'Ashes of Reanimation',
      description: 'Hồi sinh 1 quân đồng minh đã bị tiêu diệt và đặt lên một ô trống hợp lệ ở nửa sân của bạn trong 4 vòng.',
      tier: 'skill1',
      apCost: APCostConfig.phoenix.phoenix_skill_1, // Base apCost evaluated by validator. Extra is spent during execute.
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        if (!state || !player) return [];
        const region: Position[] = [];
        const startRow = player === Color.White ? 0 : 8;
        const endRow = player === Color.White ? 6 : 14;
        for (let r = startRow; r <= endRow; r++) {
          for (let c = 0; c < 15; c++) {
            region.push({ col: c, row: r });
          }
        }

        return [
          {
            type: 'piece',
            filter: 'any',
            description: 'Select a fallen ally from graveyard',
          },
          {
            type: 'cell',
            filter: 'empty',
            region,
            description: 'Select an empty tile on your half',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (state.variantState.phoenixSkillsDisabled?.[player] === true) {
          return 'Skills are permanently disabled after Rebirth';
        }

        if (targets.length !== 2) {
          return 'Must select a fallen ally and an empty destination square';
        }

        const pieceTarget = targets[0];
        const cellTarget = targets[1];

        if (pieceTarget.type !== 'piece' || !pieceTarget.pieceId) {
          return 'First target must be a graveyard piece';
        }
        if (cellTarget.type !== 'cell' || !cellTarget.position) {
          return 'Second target must be a cell';
        }

        // Validate piece is in graveyard, belongs to player, and is not King
        const graveyardEntry = state.graveyard.find(e => e.piece.id === pieceTarget.pieceId);
        if (!graveyardEntry) {
          return 'Selected piece is not in the graveyard';
        }
        if (graveyardEntry.piece.color !== player) {
          return 'Cannot resurrect an enemy piece';
        }
        if (graveyardEntry.piece.type === PieceType.King) {
          return 'Cannot resurrect the King';
        }

        // Validate cell is empty and in player's half
        const occupier = state.board.getPiece(cellTarget.position);
        if (occupier) {
          return 'Destination cell must be empty';
        }

        const row = cellTarget.position.row;
        const isOwnHalf = player === Color.White 
          ? (row >= 0 && row <= 6)
          : (row >= 8 && row <= 14);

        if (!isOwnHalf) {
          return 'Destination cell must be in your own half';
        }

        // Dynamic AP cost check
        const actualCost = RESURRECT_AP_MAP[graveyardEntry.piece.type as PieceType];
        const playerAP = player === Color.White ? state.whiteAP : state.blackAP;
        if (playerAP < actualCost) {
          return `Not enough AP. Resurrecting a ${graveyardEntry.piece.type} requires ${actualCost} AP (you have ${playerAP})`;
        }

        return null;
      },

      execute(state, player, targets): Action[] {
        const pieceTarget = targets[0];
        const cellTarget = targets[1];
        const pos = cellTarget.position!;

        const graveIdx = state.graveyard.findIndex(e => e.piece.id === pieceTarget.pieceId);
        if (graveIdx === -1) return [];

        const entry = state.graveyard[graveIdx];
        state.graveyard.splice(graveIdx, 1);

        const resurrectedPiece = {
          ...entry.piece,
          effects: [], // Clear old effects
        };

        const actualCost = RESURRECT_AP_MAP[resurrectedPiece.type as PieceType];
        const extraCost = actualCost - 3; // Core spends 3 automatically
        const actions: Action[] = [];

        if (extraCost > 0) {
          actions.push({
            type: 'SPEND_AP',
            player,
            amount: extraCost,
            source: 'skill:phoenix_ashes',
          });
        }

        // Spawn piece
        actions.push({
          type: 'SPAWN_PIECE',
          piece: resurrectedPiece,
          position: pos,
        });

        // Apply summon duration (4 rounds)
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `summon_duration_${resurrectedPiece.id}`,
            type: 'summon_duration',
            duration: 4,
            remainingDuration: 4,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: resurrectedPiece.id,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          },
        });

        return actions;
      },
    },

    // ── Skill 2: Solar Flare (5 AP) ──
    {
      id: 'phoenix_solar_flare',
      name: 'Solar Flare',
      description: 'Stun 1 quân địch bị ít nhất 2 quân Tượng đồng minh cùng chiếu trong 2 vòng, đồng thời gây Flame 5x5 quanh mục tiêu trong 4 vòng.',
      tier: 'skill2',
      apCost: APCostConfig.phoenix.phoenix_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'enemy',
            description: 'Select an enemy piece targeted by 2+ ally Bishops',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (state.variantState.phoenixSkillsDisabled?.[player] === true) {
          return 'Skills are permanently disabled after Rebirth';
        }

        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position) {
          return 'Select exactly 1 enemy piece';
        }

        const targetPos = targets[0].position;
        const targetPiece = state.board.getPiece(targetPos);
        if (!targetPiece || targetPiece.color === player) {
          return 'Must target an enemy piece';
        }

        // Check if attacked by at least 2 ally Bishops
        const attacks = getAttackedPieces(state.board, player, state);
        const bishopAttacks = attacks.filter(atk => 
          atk.attacker.type === PieceType.Bishop &&
          atk.targetPos.col === targetPos.col &&
          atk.targetPos.row === targetPos.row
        );

        if (bishopAttacks.length < 2) {
          return 'Target enemy piece must be targeted by at least 2 ally Bishops';
        }

        return null;
      },

      execute(state, player, targets): Action[] {
        const targetPos = targets[0].position!;
        const targetPiece = state.board.getPiece(targetPos)!;

        const actions: Action[] = [];

        // 1. Stun target for 2 rounds
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `stun_${targetPiece.id}_${Date.now()}`,
            type: 'stun',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targetPiece.id,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          },
        });

        // 2. Flame 5x5 zone around target for 4 rounds
        const region = getSquareRegion(targetPos, 5);
        for (const pos of region) {
          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `flame_${pos.col}_${pos.row}_${Date.now()}`,
              type: 'flame',
              duration: 4,
              remainingDuration: 4,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${pos.col},${pos.row}`,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            },
          });
        }

        return actions;
      },
    },

    // ── Ultimate: Supernova (11 AP) ──
    {
      id: 'phoenix_supernova',
      name: 'Supernova',
      description: 'Báo động vùng 7x7 và kích nổ tiêu diệt toàn bộ quân cờ bên trong (trừ Vua) sau 3 vòng đấu.',
      tier: 'ultimate',
      apCost: APCostConfig.phoenix.phoenix_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'cell',
            filter: 'empty',
            description: 'Select center cell of 7x7 region',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (state.variantState.phoenixSkillsDisabled?.[player] === true) {
          return 'Skills are permanently disabled after Rebirth';
        }

        if (state.variantState.supernova && state.variantState.supernova.active) {
          return 'A Supernova warning is already active on the board';
        }

        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 target cell';
        }

        return null;
      },

      execute(state, player, targets): Action[] {
        const center = targets[0].position!;
        const actions: Action[] = [];

        // Detonates exactly 6 turns (3 rounds) later
        const currentPly = (state.turnNumber - 1) * 2 + (player === Color.White ? 0 : 1);
        const detonationPly = currentPly + 6;

        state.variantState.supernova = {
          center: { ...center },
          detonationPly,
          active: true,
          castPlayer: player,
        };

        // Apply visual warning to 7x7 cells (duration: null, cleared manually on detonation)
        const region = getSquareRegion(center, 7);
        for (const pos of region) {
          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `supernova_warning_${pos.col}_${pos.row}_${Date.now()}`,
              type: 'supernova_warning',
              duration: null,
              remainingDuration: null,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${pos.col},${pos.row}`,
              stackingRule: 'ignore',
              isDebuff: false,
              metadata: {},
            },
          });
        }

        return actions;
      },
    },
  ],
};
