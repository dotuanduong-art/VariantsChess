import { VariantDefinition } from '../Variant';
import { Color, PieceType, oppositeColor } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { DevilEyeHandler } from '../../effect/handlers/DevilEyeHandler';
import { DevilTollHandler } from '../../effect/handlers/DevilTollHandler';
import { BerserkHandler } from '../../effect/handlers/BerserkHandler';
import { APCostConfig } from '../apCostConfig';

export const DevilVariant: VariantDefinition = {
  id: 'devil',
  name: 'Devil',
  description: 'Unleash infernal pacts, reactive stuns, berserk curses, and toll charges on your enemies.',
  effectHandlers: [
    new DevilEyeHandler(),
    new DevilTollHandler(),
    new BerserkHandler(),
  ],

  getInitialState: () => ({
    devilTollActive: false,
    devilTollRemainingTurns: 0,
  }),

  passiveHooks: (state, player) => [
    {
      id: `devil_infernal_pact_${player}`,
      eventType: 'OnTurnStart',
      priority: 500,
      source: `variant:devil:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnStart') return;
        if (event.activePlayer === player) {
          enqueueAction({
            type: 'GAIN_AP',
            player,
            amount: 1,
            source: 'passive:infernal_pact',
          });
        }
      }
    }
  ],

  skills: [
    {
      id: 'devil_eye_skill',
      name: "Devil's Eye",
      description: "Apply Devil's Eye on an allied piece (excluding King) for 2 rounds. If an enemy attacks it, the enemy is Stunned for 3 rounds (6 turns) and the eye is consumed.",
      tier: 'skill1',
      apCost: APCostConfig.devil.devil_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'ally',
        excludeKing: true,
        description: "Choose 1 allied piece (excluding King)"
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 allied piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target an allied piece';
        }
        if (piece.type === PieceType.King) {
          return 'Cannot target King';
        }

        // Exclusivity check: only 1 devil_eye allowed on board at a time
        for (let r = 0; r < 15; r++) {
          for (let c = 0; c < 15; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.effects && p.effects.some(e => e.type === 'devil_eye')) {
              return 'Another piece already has Devil Eye';
            }
          }
        }

        return null;
      },
      execute(state, player, targets): Action[] {
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `devil_eye_${targets[0].pieceId}_${Date.now()}`,
            type: 'devil_eye',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targets[0].pieceId!,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    },
    {
      id: 'wrath_curse_skill',
      name: 'Wrath Curse',
      description: 'Nguyền rủa 1 quân địch (trừ King) bằng hiệu ứng Berserk. Nếu quân đó không ăn quân trong 4 lượt sẽ bị câm lặng/stun 3 lượt.',
      tier: 'skill2',
      apCost: APCostConfig.devil.devil_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'enemy',
        excludeKing: true,
        description: 'Chọn 1 quân địch (trừ King)'
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 enemy piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color === player) {
          return 'Must target an enemy piece';
        }
        if (piece.type === PieceType.King) {
          return 'Cannot target King';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `berserk_${targets[0].pieceId}_${Date.now()}`,
            type: 'berserk',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targets[0].pieceId!,
            stackingRule: 'ignore',
            isDebuff: true,
            metadata: { captureCountdown: 4, capturedThisWindow: false, isFirstTurnStart: true },
          }
        }];
      }
    },
    {
      id: 'hellish_toll_skill',
      name: 'Hellish Toll',
      description: "Activate Devil's Toll for 6 rounds (12 turns). Every regular move charges AP: Pawn: 0, Knight/Bishop: 2, Rook: 3, Queen: 4. Players must sacrifice units if short on AP.",
      tier: 'ultimate',
      apCost: APCostConfig.devil.devil_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        return null;
      },
      execute(state, player, targets): Action[] {
        state.variantState.devilTollActive = true;
        state.variantState.devilTollRemainingTurns = 12;
        return [];
      }
    }
  ]
};
