import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { GameEvent, GameEventType } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { specialPieceRegistry } from '../../pieces/SpecialPieceRegistry';
import { APCostConfig } from '../apCostConfig';

// Register Totem Special Piece in SpecialPieceRegistry
specialPieceRegistry.register({
  id: 'totem',
  displayName: 'Totem',
  getLegalMoves: () => [],
  captureApReward: 0,
  lossApReward: 0,
  canBeAttacked: true,
});

/**
 * Find a piece on the board by its unique ID.
 */
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

/**
 * Cleanse cell effects and piece effects in a 3x3 area around a Totem.
 */
function cleanseAroundTotem(
  state: GameState,
  totemPos: Position,
  totemColor: Color,
  enqueueAction: (action: Action) => void
): void {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = totemPos.row + dr;
      const c = totemPos.col + dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
        continue;
      }
      const pos = { col: c, row: r };

      // 1. Cleanse board effects on the cell
      const cellEffects = state.board.getCellEffects(pos) || [];
      for (const effect of cellEffects) {
        enqueueAction({
          type: 'REMOVE_EFFECT',
          effectId: effect.id,
          targetId: effect.targetId,
          targetType: 'cell',
          reason: 'cleanse',
        });
      }

      // 2. Cleanse piece effects
      const piece = state.board.getPiece(pos);
      if (piece && piece.effects) {
        for (const effect of piece.effects) {
          if (effect.type === 'ascend') {
            continue; // Exception: never cleanse ascend
          }

          if (piece.color === totemColor) {
            // ALLY: only cleanse debuffs
            if (effect.isDebuff === true) {
              enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: effect.id,
                targetId: piece.id,
                targetType: 'piece',
                reason: 'cleanse',
              });
            }
          } else {
            // ENEMY: cleanse all effects
            enqueueAction({
              type: 'REMOVE_EFFECT',
              effectId: effect.id,
              targetId: piece.id,
              targetType: 'piece',
              reason: 'cleanse',
            });
          }
        }
      }
    }
  }
}

export const CherubimVariant: VariantDefinition = {
  id: 'cherubim',
  name: 'Cherubim',
  description: 'A variant leveraging Dual Casting, Pawns evolution (Ascend), and Fountain of Youth totems.',
  maxSkillsPerTurn: 2,
  preventDuplicateSkillsPerTurn: true,
  effectHandlers: [],

  onSetup(state, player) {
    // Ensure Totem is registered
    if (!specialPieceRegistry.get('totem')) {
      specialPieceRegistry.register({
        id: 'totem',
        displayName: 'Totem',
        getLegalMoves: () => [],
        captureApReward: 0,
        lossApReward: 0,
        canBeAttacked: true,
      });
    }
  },

  passiveHooks: (state, player) => [
    {
      id: `cherubim_ascend_tick_${player}`,
      eventType: 'OnTurnEnd',
      priority: 100,
      source: `variant:cherubim:${player}`,
      handler: (event, enqueueAction) => {
        // Only tick Ascend progress at the end of the player's own turn
        if (event.activePlayer !== player) return;

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.color === player && piece.type === PieceType.Pawn && piece.effects) {
              const ascend = piece.effects.find(e => e.type === 'ascend');
              if (ascend) {
                if (!ascend.metadata) {
                  ascend.metadata = {};
                }
                // Skip the turn it was cast
                if (
                  ascend.metadata.appliedTurn === state.turnNumber &&
                  ascend.metadata.appliedPlayer === player
                ) {
                  continue;
                }

                ascend.metadata.roundsElapsed = (ascend.metadata.roundsElapsed || 0) + 1;
                if (ascend.metadata.roundsElapsed >= 5) {
                  ascend.metadata.completed = true;
                }
              }
            }
          }
        }
      },
    },
    {
      id: `cherubim_totem_expired_${player}`,
      eventType: 'OnEffectExpired',
      priority: 100,
      source: `variant:cherubim:${player}`,
      handler: (event, enqueueAction) => {
        const snapshot = event.payload.effectSnapshot;
        if (snapshot && snapshot.type === 'totem_timer') {
          const totemId = snapshot.targetId;
          const found = findPieceById(state, totemId);
          if (found && found.piece.specialType === 'totem') {
            enqueueAction({
              type: 'DESTROY_PIECE',
              pieceId: totemId,
              position: found.pos,
              reason: 'effect_expired',
            });
          }
        }
      },
    },
    {
      id: `cherubim_totem_cleanse_${player}`,
      eventType: 'OnTurnEnd',
      priority: 200,
      source: `variant:cherubim:${player}`,
      handler: (event, enqueueAction) => {
        // Cleanse happens every turn if there are Totems alive
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.specialType === 'totem') {
              cleanseAroundTotem(state, { col: c, row: r }, piece.color, enqueueAction);
            }
          }
        }
      },
    },
    {
      id: `cherubim_ascend_remove_on_promotion_${player}`,
      eventType: 'OnPawnPromotion',
      priority: 100,
      source: `variant:cherubim:${player}`,
      handler: (event, enqueueAction) => {
        const { pieceId } = event.payload;
        const found = findPieceById(state, pieceId);
        if (found && found.piece.effects) {
          const ascend = found.piece.effects.find(e => e.type === 'ascend');
          if (ascend) {
            enqueueAction({
              type: 'REMOVE_EFFECT',
              effectId: ascend.id,
              targetId: pieceId,
              targetType: 'piece',
              reason: 'promoted',
            });
          }
        }
      },
    },
  ],

  skills: [
    // ── Skill 1: Ascend (2 AP) ──
    {
      id: 'cherubim_ascend',
      name: 'Ascend',
      description: 'Apply Ascend effect on an ally Pawn. It evolves to Queen in 5 rounds.',
      tier: 'skill1',
      apCost: APCostConfig.cherubim.cherubim_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [{
          type: 'piece',
          filter: 'ally',
          pieceType: PieceType.Pawn,
          description: 'Select an ally Pawn to Ascend',
        }];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 ally Pawn';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target an ally piece';
        }
        if (piece.type !== PieceType.Pawn) {
          return 'Only Pawns can be targeted by Ascend';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const targetId = targets[0].pieceId!;
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `ascend_${targetId}_${Date.now()}`,
            type: 'ascend',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: { roundsElapsed: 0, completed: false },
          },
        }];
      },
    },

    // ── Skill 2: Fountain of Youth (5 AP) ──
    {
      id: 'cherubim_fountain_of_youth',
      name: 'Fountain of Youth',
      description: 'Summon a Totem that cleanses the surrounding 3x3 area.',
      tier: 'skill2',
      apCost: APCostConfig.cherubim.cherubim_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [{
          type: 'cell',
          filter: 'empty',
          description: 'Select an empty square to place the Totem',
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
        const totemId = `totem_${player === Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}`;

        return [
          {
            type: 'SPAWN_PIECE',
            piece: {
              id: totemId,
              type: 'totem',
              color: player,
              specialType: 'totem',
              effects: [],
            },
            position: pos,
          },
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `totem_timer_${totemId}`,
              type: 'totem_timer',
              duration: 3,
              remainingDuration: 3,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: totemId,
              stackingRule: 'ignore',
              isDebuff: false,
              metadata: {},
            },
          },
        ];
      },
    },

    // ── Ultimate: Divine Ascension (12 AP) ──
    {
      id: 'cherubim_divine_ascension',
      name: 'Divine Ascension',
      description: 'Evolves all ready Pawns to Queen, or summons a new Pawn in your own half.',
      tier: 'ultimate',
      apCost: APCostConfig.cherubim.cherubim_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        if (!state || !player) return [];

        let hasReadyPawn = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.color === player && piece.type === PieceType.Pawn && piece.effects) {
              const ascend = piece.effects.find(e => e.type === 'ascend');
              if (ascend && ascend.metadata?.completed === true) {
                hasReadyPawn = true;
                break;
              }
            }
          }
          if (hasReadyPawn) break;
        }

        if (hasReadyPawn) {
          return [];
        }

        const region: Position[] = [];
        const startRow = player === Color.White ? 0 : 8;
        const endRow = player === Color.White ? 6 : 14;
        for (let r = startRow; r <= endRow; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            region.push({ col: c, row: r });
          }
        }

        return [{
          type: 'cell',
          filter: 'empty',
          region,
          description: 'Select an empty square in your own half to spawn a Pawn',
        }];
      },

      canActivate(state, player, targets) {
        let hasReadyPawn = false;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.color === player && piece.type === PieceType.Pawn && piece.effects) {
              const ascend = piece.effects.find(e => e.type === 'ascend');
              if (ascend && ascend.metadata?.completed === true) {
                hasReadyPawn = true;
                break;
              }
            }
          }
          if (hasReadyPawn) break;
        }

        if (hasReadyPawn) {
          if (targets.length > 0) {
            return 'Do not select targets when a Pawn is ready to evolve';
          }
        } else {
          if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
            return 'Select 1 empty cell in your own half';
          }
          const pos = targets[0].position;
          const piece = state.board.getPiece(pos);
          if (piece) {
            return 'Target cell must be empty';
          }
          const isOwnHalf = player === Color.White
            ? (pos.row >= 0 && pos.row <= 6)
            : (pos.row >= 8 && pos.row <= 14);
          if (!isOwnHalf) {
            return 'Must target a square in your own half';
          }
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const actions: Action[] = [];
        const pawnsToPromote: { piece: Piece; pos: Position }[] = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === player && piece.type === PieceType.Pawn && piece.effects) {
              const ascend = piece.effects.find(e => e.type === 'ascend');
              if (ascend && ascend.metadata?.completed === true) {
                pawnsToPromote.push({ piece, pos });
              }
            }
          }
        }

        if (pawnsToPromote.length > 0) {
          for (const item of pawnsToPromote) {
            // Permanently change type of the piece to Queen
            item.piece.type = PieceType.Queen;

            // Remove the Ascend effect
            const ascend = item.piece.effects!.find(e => e.type === 'ascend');
            if (ascend) {
              actions.push({
                type: 'REMOVE_EFFECT',
                effectId: ascend.id,
                targetId: item.piece.id,
                targetType: 'piece',
                reason: 'ascend_evolved',
              });
            }

            // Enqueue Pawn promotion action to trigger events
            actions.push({
              type: 'PAWN_PROMOTION',
              pieceId: item.piece.id,
              position: item.pos,
              promotedTo: 'Queen',
            });
          }
        } else {
          const pos = targets[0].position!;
          const pawnId = `w_pawn_cherubim_${rng.nextInt(0, 1000000)}`;
          actions.push({
            type: 'SPAWN_PIECE',
            piece: {
              id: pawnId,
              type: PieceType.Pawn,
              color: player,
              effects: [],
            },
            position: pos,
          });
        }

        return actions;
      },
    },
  ],
};
