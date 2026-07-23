import { VariantDefinition } from '../Variant';
import { Color } from '../../pieces/Piece';
import { Effect, EffectType } from '../../effect/Effect';
import { Action } from '../../action/Action';
import { ShieldHandler } from '../../effect/handlers/ShieldHandler';
import { SanctuaryHandler } from '../../effect/handlers/SanctuaryHandler';
import { getSquareRegion } from '../../region/Region';
import { APCostConfig } from '../apCostConfig';

export const GuardianVariant: VariantDefinition = {
  id: 'guardian',
  name: 'Guardian',
  description: 'Protect allies with shields and create defensive stun zones.',
  
  effectHandlers: [
    new ShieldHandler(),
    new SanctuaryHandler(),
  ],

  getInitialState: () => ({ shieldCount: 0 }),

  skills: [
    // ── Skill 1: Holy Shield (4 AP) ──
    {
      id: 'guardian_shield',
      name: 'Holy Shield',
      description: 'Apply a shield to an ally piece for 2 turns (4 turns duration).',
      tier: 'skill1',
      apCost(state, player) {
        const lostCount = state.graveyard.filter(entry => entry.piece.color === player).length;
        return lostCount >= 8 ? APCostConfig.guardian.guardian_skill_1_discount : APCostConfig.guardian.guardian_skill_1;
      },
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'ally',
        description: 'Chọn 1 quân của phe bạn',
      }],

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 ally piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target an ally piece';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const target = targets[0];
        const piece = state.board.getPiece(target.position!);
        if (!piece) return [];
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `shield_${piece.id}_${Date.now()}`,
            type: 'shield' as any,
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: piece.id,
            stackingRule: 'refresh',
            isDebuff: false,
            isHidden: false,
            metadata: {},
          }
        }];
      }
    },

    // ── Skill 2: Sanctuary (5 AP) ──
    {
      id: 'guardian_sanctuary',
      name: 'Sanctuary',
      description: 'Create a 3x3 zone; enemies capturing inside are stunned.',
      tier: 'skill2',
      apCost: APCostConfig.guardian.guardian_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: () => [{
        type: 'cell',
        filter: 'empty',
        description: 'Chọn 1 ô trống làm trung tâm vùng 3x3',
      }],

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 cell as center';
        }
        return null;
      },

      execute(state, player, targets): Action[] {
        const center = targets[0].position!;
        const cells = getSquareRegion(center, 3);
        const actions: Action[] = [];
        for (const cell of cells) {
          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `sanctuary_${cell.col}_${cell.row}_${Date.now()}`,
              type: 'sanctuary' as any,
              duration: 4,
              remainingDuration: 4,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${cell.col},${cell.row}`,
              stackingRule: 'refresh',
              isDebuff: false,
              isHidden: false,
              metadata: {},
            }
          });
        }
        return actions;
      }
    },

    // ── Ultimate: Divine Shield (8 AP) ──
    {
      id: 'guardian_ultimate',
      name: 'Divine Shield',
      description: 'Give shields to all allies for 5 turns (10 turns duration).',
      tier: 'ultimate',
      apCost: APCostConfig.guardian.guardian_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements: () => [],

      canActivate(state, player, targets) {
        return null;
      },

      execute(state, player, targets): Action[] {
        const actions: Action[] = [];
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 15; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === player) {
              actions.push({
                type: 'APPLY_EFFECT',
                effect: {
                  id: `shield_${piece.id}_${Date.now()}_${c}_${r}`,
                  type: 'shield' as any,
                  duration: 5,
                  remainingDuration: 5,
                  tickTiming: 'turnEnd',
                  sourcePlayer: player,
                  targetType: 'piece',
                  targetId: piece.id,
                  stackingRule: 'refresh',
                  isDebuff: false,
                  isHidden: false,
                  metadata: {},
                }
              });
            }
          }
        }
        return actions;
      }
    }
  ]
};
