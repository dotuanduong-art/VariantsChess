import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { GhostHandler } from '../../effect/handlers/GhostHandler';
import { PossessionHandler } from '../../effect/handlers/PossessionHandler';
import { StealthMaintenanceHandler } from '../../effect/handlers/StealthMaintenanceHandler';
import { BOARD_SIZE } from '../../board/Board';
import { APCostConfig } from '../apCostConfig';

export const PhantomVariant: VariantDefinition = {
  id: 'phantom',
  name: 'Phantom',
  description: 'Traverse obstacles with Ghost effect, possess enemy pieces to transform permanently, and slip into the shadows with Spirit Walk.',
  effectHandlers: [
    new GhostHandler(),
    new PossessionHandler(),
    new StealthMaintenanceHandler(),
  ],

  getInitialState: () => ({}),

  passiveHooks: (state, player) => [
    {
      id: `phantom_ghost_inheritance_${player}`,
      eventType: 'OnBeforePieceDestroyed',
      priority: 500,
      source: `variant:phantom:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnBeforePieceDestroyed') return;

        const { pieceSnapshot, position } = event.payload;
        if (!pieceSnapshot || !position) return;

        // Trigger only if the dying piece is allied and carries the ghost effect
        if (pieceSnapshot.color === player && pieceSnapshot.effects?.some((e: any) => e.type === 'ghost')) {
          let bestPiece: any = null;
          let minDist = Infinity;

          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const pos = { col: c, row: r };
              const p = state.board.getPiece(pos);
              if (p && p.id !== pieceSnapshot.id && p.color === player) {
                if (p.type === PieceType.King || p.type === PieceType.Knight) continue;
                if (p.effects?.some(e => e.type === 'ghost')) continue;

                const dist = Math.max(Math.abs(pos.col - position.col), Math.abs(pos.row - position.row));
                if (dist < minDist) {
                  minDist = dist;
                  bestPiece = p;
                }
              }
            }
          }

          if (bestPiece) {
            const playerEffects = state.getPlayerEffects(player);
            const hasSpiritWalk = playerEffects.some(e => e.type === 'spirit_walk');

            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `ghost_inheritance_${bestPiece.id}_${Date.now()}`,
                type: 'ghost',
                duration: 1,
                remainingDuration: 1,
                tickTiming: 'turnEnd',
                sourcePlayer: player,
                targetType: 'piece',
                targetId: bestPiece.id,
                stackingRule: 'refresh',
                isDebuff: false,
                metadata: hasSpiritWalk ? { stealth: true } : {},
              }
            });
          }
        }
      }
    }
  ],

  skills: [
    {
      id: 'phantom_haunt_skill',
      name: 'Haunt',
      description: 'Apply Ghost effect on an allied piece (excluding King/Knight) for 3 rounds. If Spirit Walk is active, the target also receives stealth.',
      tier: 'skill1',
      apCost: (state, player) => {
        const free = state.variantState[`${player}_freeSkill1Remaining`] ?? 0;
        return free > 0 ? 0 : APCostConfig.phantom.phantom_skill_1;
      },
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'ally',
        excludeKing: true,
        description: 'Choose 1 allied piece (excluding King/Knight)'
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position) {
          return 'Select 1 allied piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target an allied piece';
        }
        if (piece.type === PieceType.King) {
          return 'Cannot target King';
        }
        if (piece.type === PieceType.Knight) {
          return 'Knight cannot receive Ghost';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        const free = state.variantState[`${player}_freeSkill1Remaining`] ?? 0;
        if (free > 0) {
          state.variantState[`${player}_freeSkill1Remaining`] = free - 1;
        }

        const playerEffects = state.getPlayerEffects(player);
        const hasSpiritWalk = playerEffects.some(e => e.type === 'spirit_walk');

        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `ghost_${targets[0].pieceId}_${Date.now()}`,
            type: 'ghost',
            duration: 3,
            remainingDuration: 3,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targets[0].pieceId!,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: hasSpiritWalk ? { stealth: true } : {},
          }
        }];
      }
    },
    {
      id: 'phantom_possession_skill',
      name: 'Possession',
      description: 'Activate Possession for the turn. Allied ghost pieces capturing an enemy piece transform into that piece permanently, removing the Ghost effect.',
      tier: 'skill2',
      apCost: APCostConfig.phantom.phantom_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        return null;
      },
      execute(state, player, targets): Action[] {
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `possession_active_${player}_${Date.now()}`,
            type: 'possession_active',
            duration: 0,
            remainingDuration: 0,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'player',
            targetId: player,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    },
    {
      id: 'phantom_spirit_walk_skill',
      name: 'Spirit Walk',
      description: 'Reset all active allied Ghost durations to 5 rounds and grant them stealth. Grant 3 free Haunt uses. Stealthed pieces are completely hidden from the enemy.',
      tier: 'ultimate',
      apCost: APCostConfig.phantom.phantom_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        return null;
      },
      execute(state, player, targets): Action[] {
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.color === player && piece.effects) {
              const ghost = piece.effects.find(e => e.type === 'ghost');
              if (ghost) {
                ghost.remainingDuration = 5;
                ghost.duration = 5;
                if (!ghost.metadata) ghost.metadata = {};
                ghost.metadata.stealth = true;
              }
            }
          }
        }

        state.variantState[`${player}_freeSkill1Remaining`] = 3;

        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `spirit_walk_${player}_${Date.now()}`,
            type: 'spirit_walk',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'player',
            targetId: player,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    }
  ]
};
