import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { ZombieHandler } from '../../effect/handlers/ZombieHandler';
import { WalkerHandler } from '../../effect/handlers/WalkerHandler';
import { GameState } from '../../state/GameState';
import { APCostConfig } from '../apCostConfig';

function countZombiesOnBoard(state: GameState, player: Color): number {
  let count = 0;
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const piece = state.board.getPiece({ col: c, row: r });
      if (piece && piece.color === player && piece.effects?.some(e => e.type === 'zombie')) {
        count++;
      }
    }
  }
  return count;
}

export const ZombieVariant: VariantDefinition = {
  id: 'zombie',
  name: 'Zombie',
  description: 'Infect enemies and raise Walker zombies to overrun the board.',
  effectHandlers: [
    new ZombieHandler(),
    new WalkerHandler(),
  ],

  getInitialState: () => ({
    freeInfectionRemaining: 3,
  }),

  skills: [
    {
      id: 'zombie_infection',
      name: 'Infection',
      description: 'Convert an allied piece into a Zombie. Free for the first 3 uses, then costs 5 AP.',
      tier: 'skill1',
      apCost(state, player) {
        const freeCount = state.variantState.freeInfectionRemaining !== undefined ? state.variantState.freeInfectionRemaining : 3;
        return freeCount > 0 ? 0 : APCostConfig.zombie.zombie_skill_1;
      },
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'ally',
        description: 'Select an allied piece to infect',
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 allied piece';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player) {
          return 'Must target an allied piece';
        }
        const hasZombieOrWalker = piece.effects?.some(e => e.type === 'zombie' || e.type === 'walker');
        if (hasZombieOrWalker) {
          return 'Piece is already a Zombie or a Walker';
        }
        const zombieCount = countZombiesOnBoard(state, player);
        if (zombieCount >= 5) {
          return 'Không thể tạo thêm Zombie (tối đa 5)';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        const target = targets[0];
        const freeCount = state.variantState.freeInfectionRemaining !== undefined ? state.variantState.freeInfectionRemaining : 3;
        if (freeCount > 0) {
          state.variantState.freeInfectionRemaining = freeCount - 1;
        }

        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `zombie_${target.pieceId}_${Date.now()}`,
            type: 'zombie',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: target.pieceId!,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          }
        }];
      }
    },
    {
      id: 'zombie_mutation',
      name: 'Mutation',
      description: 'Convert a Walker into a controllable Zombie.',
      tier: 'skill2',
      apCost: APCostConfig.zombie.zombie_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'any',
        description: 'Select a Walker to mutate',
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 Walker';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece) {
          return 'No piece at target position';
        }
        const hasWalker = piece.effects?.some(e => e.type === 'walker');
        if (!hasWalker) {
          return 'Target must be a Walker';
        }
        const zombieCount = countZombiesOnBoard(state, player);
        if (zombieCount >= 5) {
          return 'Không thể tạo thêm Zombie (tối đa 5)';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        const targetCell = targets[0];
        const piece = state.board.getPiece(targetCell.position!);
        if (!piece) return [];

        const walkerEffect = piece.effects?.find(e => e.type === 'walker');
        const actions: Action[] = [];
        if (walkerEffect) {
          actions.push({
            type: 'REMOVE_EFFECT',
            effectId: walkerEffect.id,
            targetId: piece.id,
            targetType: 'piece',
            reason: 'mutation',
          });
        }

        // Color change if Walker Type 1 (color of enemy)
        if (piece.color !== player) {
          actions.push({
            type: 'TRANSFORM_PIECE',
            pieceId: piece.id,
            position: targetCell.position!,
            newType: piece.type, // keep type
            newColor: player,    // mutate color
          } as any);
        }

        // Apply zombie effect
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `zombie_${piece.id}_${Date.now()}`,
            type: 'zombie',
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: piece.id,
            stackingRule: 'ignore',
            isDebuff: false,
            metadata: {},
          }
        });

        return actions;
      }
    },
    {
      id: 'zombie_outbreak',
      name: 'Outbreak',
      description: 'Resurrect 2 fallen allies as Walkers.',
      tier: 'ultimate',
      apCost: APCostConfig.zombie.zombie_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        const eligibleEntries = state.graveyard.filter(entry => 
          entry.piece.color === player && 
          state.board.getPiece(entry.position) === null
        );
        if (eligibleEntries.length === 0) {
          return 'Không có quân đồng minh nào có thể hồi sinh (cần ít nhất 1 vị trí hợp lệ)';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        // Find friendly pieces in graveyard
        const entries = [...state.graveyard]
          .filter(entry => entry.piece.color === player)
          .sort((a, b) => b.turnDied - a.turnDied); // descending turnDied (most recent first)

        const validEntries: typeof state.graveyard = [];
        for (const entry of entries) {
          if (validEntries.length >= 2) break;
          const currentPiece = state.board.getPiece(entry.position);
          if (!currentPiece) {
            const alreadyChosen = validEntries.some(e => e.position.col === entry.position.col && e.position.row === entry.position.row);
            if (!alreadyChosen) {
              validEntries.push(entry);
            }
          }
        }

        const actions: Action[] = [];
        for (const entry of validEntries) {
          const spawnedPiece = {
            ...entry.piece,
            color: player,
            effects: [], // clear existing effects
          };

          actions.push({
            type: 'SPAWN_PIECE',
            piece: spawnedPiece,
            position: entry.position,
          });

          actions.push({
            type: 'APPLY_EFFECT',
            effect: {
              id: `walker_u_${spawnedPiece.id}_${Date.now()}`,
              type: 'walker',
              duration: null,
              remainingDuration: null,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: spawnedPiece.id,
              stackingRule: 'ignore',
              isDebuff: false, // Type 2 walker
              metadata: {
                controlledBy: player,
              },
            }
          });
        }

        return actions;
      }
    }
  ]
};
