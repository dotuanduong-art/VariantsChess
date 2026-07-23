import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { RepelHandler } from '../../effect/handlers/RepelHandler';
import { SoullessCellHandler } from '../../effect/handlers/SoullessCellHandler';
import { SoullessHandler } from '../../effect/handlers/SoullessHandler';
import { APCostConfig } from '../apCostConfig';

export function getCrossCells(center: Position): Position[] {
  return [
    center,
    { col: center.col + 1, row: center.row },
    { col: center.col - 1, row: center.row },
    { col: center.col, row: center.row + 1 },
    { col: center.col, row: center.row - 1 },
  ];
}

export function getXCells(center: Position): Position[] {
  return [
    center,
    { col: center.col + 1, row: center.row + 1 },
    { col: center.col - 1, row: center.row - 1 },
    { col: center.col + 1, row: center.row - 1 },
    { col: center.col - 1, row: center.row + 1 },
  ];
}

export const KazehimeVariant: VariantDefinition = {
  id: 'kaze',
  name: 'Kazehime',
  description: 'Unleash wind-based traps and shrinking storms to control the battlefield.',
  effectHandlers: [
    new RepelHandler(),
    new SoullessCellHandler(),
    new SoullessHandler(),
  ],

  getInitialState: () => ({
    windSigils: 6,
  }),

  passiveHooks: (state, player) => [
    {
      id: `kazehime_storm_tick_${player}`,
      eventType: 'OnTurnEnd',
      priority: 500,
      source: `variant:kaze:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnEnd') return;
        if (event.activePlayer !== player) return;

        const storm = state.variantState.storm;
        if (!storm) return;

        const enemyColor = player === Color.White ? Color.Black : Color.White;

        // Process storm damage for this turn
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === enemyColor && piece.type !== PieceType.King) {
              const dist = Math.max(Math.abs(pos.col - storm.center.col), Math.abs(pos.row - storm.center.row));
              const inStorm = dist <= storm.currentRadius;

              if (inStorm) {
                const count = (storm.activePieceRounds[piece.id] || 0) + 1;
                storm.activePieceRounds[piece.id] = count;
                if (count >= 2) {
                  enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: piece.id,
                    position: pos,
                    reason: 'storm_destroy',
                  });
                }
              } else {
                storm.activePieceRounds[piece.id] = 0;
              }
            }
          }
        }

        // Shrink storm or remove it
        if (storm.currentRadius > 0) {
          storm.currentRadius -= 1;
          storm.roundsElapsed += 1;
        } else {
          delete state.variantState.storm;
        }
      }
    }
  ],

  skills: [
    // ── Skill 1: Wind Reversal (1 AP) ──
    {
      id: 'kaze_repel',
      name: 'Wind Reversal',
      description: 'Set repel effect on a cross-shaped empty area.',
      tier: 'skill1',
      apCost: APCostConfig.kaze.kaze_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'cell',
        filter: 'empty',
        description: 'Select an empty cell as center of cross shape',
      }],
      canActivate(state, player, targets) {
        if ((state.variantState.windSigils ?? 6) === 0) {
          return 'No Wind Sigils remaining';
        }
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 empty cell';
        }

        const center = targets[0].position;
        const cells = getCrossCells(center);

        for (const c of cells) {
          if (c.col < 0 || c.col >= BOARD_SIZE || c.row < 0 || c.row >= BOARD_SIZE) {
            return 'All 5 cells must be within board boundaries';
          }
          if (state.board.getPiece(c)) {
            return 'All 5 target cells must be empty';
          }
          const hasExistingTrap = state.board.getCellEffects(c).some(
            e => e.type === 'repel' || e.type === 'soulless_cell'
          );
          if (hasExistingTrap) {
            return 'Cannot overlap existing traps';
          }
        }

        return null;
      },
      execute(state, player, targets, rng): Action[] {
        const center = targets[0].position!;
        const cells = getCrossCells(center);
        const batchId = `kaze_batch_${player}_${rng.nextInt(0, 1000000)}`;

        // Decrement Wind Sigils
        state.variantState.windSigils = Math.max(0, (state.variantState.windSigils ?? 6) - 1);

        const actions: Action[] = [];
        for (const cell of cells) {
          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `repel_${cell.col}_${cell.row}_${batchId}`,
              type: 'repel',
              duration: null,
              remainingDuration: null,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${cell.col},${cell.row}`,
              stackingRule: 'ignore',
              isDebuff: false,
              isHidden: true,
              metadata: { batchId },
            }
          });
        }

        return actions;
      }
    },

    // ── Skill 2: Illusory Wind (2 AP) ──
    {
      id: 'kaze_soulless',
      name: 'Illusory Wind',
      description: 'Set soulless effect on an X-shaped empty area.',
      tier: 'skill2',
      apCost: APCostConfig.kaze.kaze_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'cell',
        filter: 'empty',
        description: 'Select an empty cell as center of X shape',
      }],
      canActivate(state, player, targets) {
        if ((state.variantState.windSigils ?? 6) === 0) {
          return 'No Wind Sigils remaining';
        }
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 empty cell';
        }

        const center = targets[0].position;
        const cells = getXCells(center);

        for (const c of cells) {
          if (c.col < 0 || c.col >= BOARD_SIZE || c.row < 0 || c.row >= BOARD_SIZE) {
            return 'All 5 cells must be within board boundaries';
          }
          if (state.board.getPiece(c)) {
            return 'All 5 target cells must be empty';
          }
          const hasExistingTrap = state.board.getCellEffects(c).some(
            e => e.type === 'repel' || e.type === 'soulless_cell'
          );
          if (hasExistingTrap) {
            return 'Cannot overlap existing traps';
          }
        }

        return null;
      },
      execute(state, player, targets, rng): Action[] {
        const center = targets[0].position!;
        const cells = getXCells(center);
        const batchId = `kaze_batch_${player}_${rng.nextInt(0, 1000000)}`;

        // Decrement Wind Sigils
        state.variantState.windSigils = Math.max(0, (state.variantState.windSigils ?? 6) - 1);

        const actions: Action[] = [];
        for (const cell of cells) {
          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `soulless_cell_${cell.col}_${cell.row}_${batchId}`,
              type: 'soulless_cell',
              duration: null,
              remainingDuration: null,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${cell.col},${cell.row}`,
              stackingRule: 'ignore',
              isDebuff: false,
              isHidden: true,
              metadata: { batchId },
            }
          });
        }

        return actions;
      }
    },

    // ── Ultimate: Eye of the Divine Storm (11 AP) ──
    {
      id: 'kaze_storm',
      name: 'Eye of the Divine Storm',
      description: 'Summon a 7x7 storm shrinking over time.',
      tier: 'ultimate',
      apCost: APCostConfig.kaze.kaze_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'cell',
        filter: 'any',
        description: 'Select a cell as the center of the storm',
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select a center cell';
        }
        return null;
      },
      execute(state, player, targets, rng): Action[] {
        const center = targets[0].position!;

        // Reset Wind Sigils
        state.variantState.windSigils = 6;

        const actions: Action[] = [];

        // Remove all repel and soulless_cell effects of this player
        const allCellEffects = state.board.getAllCellEffects();
        for (const [key, effects] of allCellEffects.entries()) {
          const matchEffects = effects.filter(
            e => (e.type === 'repel' || e.type === 'soulless_cell') && e.sourcePlayer === player
          );
          for (const m of matchEffects) {
            actions.push({
              type: 'REMOVE_EFFECT',
              effectId: m.id,
              targetId: m.targetId,
              targetType: 'cell',
              reason: 'ultimate_clear',
            });
          }
        }

        // Spawn storm state
        state.variantState.storm = {
          center,
          currentRadius: 3,
          roundsElapsed: 0,
          activePieceRounds: {},
        };

        return actions;
      }
    }
  ]
};
