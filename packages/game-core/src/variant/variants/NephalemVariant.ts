import { VariantDefinition } from '../Variant';
import { Color, PieceType, oppositeColor } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { BerserkHandler } from '../../effect/handlers/BerserkHandler';
import { SilenceHandler } from '../../effect/handlers/SilenceHandler';
import { APCostConfig } from '../apCostConfig';

export const NephalemVariant: VariantDefinition = {
  id: 'nephalem',
  name: 'Nephalem',
  description: 'Unleash judgment, berserk curse, and divine silence on your enemies.',
  effectHandlers: [new BerserkHandler(), new SilenceHandler()],

  passiveHooks: (state, player) => [{
    id: `nephalem_fallen_grace_${player}`,
    eventType: 'OnPieceDestroyed',
    priority: 500,
    source: `variant:nephalem:${player}`,
    handler: (event, enqueueAction) => {
      if (event.type !== 'OnPieceDestroyed') return;
      const deadPiece = event.payload.pieceSnapshot;
      if (deadPiece.color !== player) return;  // chỉ đếm quân đồng minh

      const allyDeaths = state.graveyard.filter(e => e.piece.color === player).length + 1;
      if (allyDeaths % 3 === 0) {
        enqueueAction({ type: 'GAIN_AP', player, amount: 4, source: 'passive:fallen_grace' });
      }
    }
  }],

  skills: [
    {
      id: 'nephalem_judgment_chains',
      name: 'Judgment Chains',
      description: 'Chọn 1 quân địch (trừ King) để Stun trong 2 rounds.',
      tier: 'skill1',
      apCost: APCostConfig.nephalem.nephalem_skill_1,
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
            id: `stun_${targets[0].pieceId}_${Date.now()}`,
            type: 'stun',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targets[0].pieceId!,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          }
        }];
      }
    },
    {
      id: 'nephalem_berserk_curse',
      name: 'Berserk Curse',
      description: 'Chọn 1 quân địch để nguyền rủa bằng Berserk.',
      tier: 'skill2',
      apCost: APCostConfig.nephalem.nephalem_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'enemy',
        description: 'Chọn 1 quân địch'
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 enemy piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color === player) {
          return 'Must target an enemy piece';
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
      id: 'nephalem_divine_silence',
      name: 'Divine Silence',
      description: 'Câm lặng đối thủ trong 3 rounds (6 lượt).',
      tier: 'ultimate',
      apCost: APCostConfig.nephalem.nephalem_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        return null;
      },
      execute(state, player, targets): Action[] {
        const opponent = oppositeColor(player);
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `silence_${opponent}_${Date.now()}`,
            type: 'silence',
            duration: 3,
            remainingDuration: 3,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'player',
            targetId: opponent,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          }
        }];
      }
    }
  ]
};
