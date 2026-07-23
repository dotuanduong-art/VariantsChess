import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { isSquareAttackedBy } from '../../combat/AttackDetection';
import { SoullessCellHandler } from '../../effect/handlers/SoullessCellHandler';
import { SoullessHandler } from '../../effect/handlers/SoullessHandler';
import { APCostConfig } from '../apCostConfig';

function isAdjacentToEnemy(board: any, pos: Position, playerColor: Color): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const neighbor = { col: pos.col + dc, row: pos.row + dr };
      if (neighbor.col >= 0 && neighbor.col < BOARD_SIZE && neighbor.row >= 0 && neighbor.row < BOARD_SIZE) {
        const piece = board.getPiece(neighbor);
        if (piece && piece.color !== playerColor) {
          return true;
        }
      }
    }
  }
  return false;
}

export const PredatorVariant: VariantDefinition = {
  id: 'predator',
  name: 'Predator',
  description: 'Hunt down your prey, evolve your pawns, and surprise your enemies from the shadows.',
  effectHandlers: [
    new SoullessCellHandler(),
    new SoullessHandler(),
  ],

  getInitialState: () => ({
    revealedPieceIds: []
  }),

  passiveHooks: (state, player) => [
    // 1. Passive – Hunter's Instinct
    {
      id: `predator_hunter_instinct_${player}`,
      eventType: 'OnCapture',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnCapture') return;
        const { capturedPieceSnapshot } = event.payload;
        if (!capturedPieceSnapshot) return;

        // Trigger when an allied piece captures an opponent's Pawn (non-evolved)
        if (event.activePlayer === player && capturedPieceSnapshot.color !== player) {
          if (capturedPieceSnapshot.type === PieceType.Pawn) {
            enqueueAction({
              type: 'GAIN_AP',
              player,
              amount: 2,
              source: 'passive:hunter_instinct',
            });
          }
        }
      }
    },

    // 2. Skill 1 – Evolution Spore Ticks
    {
      id: `predator_evolution_tick_${player}`,
      eventType: 'OnTurnEnd',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnEnd') return;
        // Tick rounds at the end of Predator's turn
        if (event.activePlayer !== player) return;

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece && piece.color === player && piece.effects) {
              const evo = piece.effects.find(e => e.type === 'evolution');
              if (evo) {
                if (!evo.metadata) evo.metadata = {};
                evo.metadata.roundsWithEvolution = (evo.metadata.roundsWithEvolution || 0) + 1;
              }
            }
          }
        }
      }
    },

    // 3. Skill 1 – Evolution Spore Capture Resolution
    {
      id: `predator_evolution_capture_${player}`,
      eventType: 'OnCapture',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnCapture') return;
        const { attackerId, to } = event.payload;
        if (!attackerId || !to) return;

        const piece = state.board.getPiece(to);
        if (piece && piece.color === player && piece.id === attackerId) {
          const evo = piece.effects?.find(e => e.type === 'evolution');
          if (evo) {
            const rounds = evo.metadata?.roundsWithEvolution || 0;

            // Remove evolution effect in all cases
            enqueueAction({
              type: 'REMOVE_EFFECT',
              effectId: evo.id,
              targetId: piece.id,
              targetType: 'piece',
              reason: 'evolution_resolve',
            });

            // Evolve based on rounds elapsed
            let newType: PieceType | null = null;
            if (rounds >= 5) {
              newType = PieceType.Queen;
            } else if (rounds >= 4) {
              newType = PieceType.Rook;
            } else if (rounds >= 3) {
              newType = PieceType.Bishop;
            } else if (rounds >= 2) {
              newType = PieceType.Knight;
            }

            if (newType) {
              enqueueAction({
                type: 'TRANSFORM_PIECE',
                pieceId: piece.id,
                position: to,
                newType,
              });
            }
          }
        }
      }
    },

    // 4. Ultimate – Apex Camouflage Adjacency Reveal Check
    {
      id: `predator_stealth_adjacency_check_${player}`,
      eventType: 'OnTurnEnd',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnEnd') return;

        // Check if Apex Camouflage is active on this player
        const hasApexCamouflage = state.getPlayerEffects(player).some(e => e.type === 'apex_camouflage');
        if (!hasApexCamouflage) return;

        const revealed = state.variantState.revealedPieceIds || [];
        let updated = false;

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === player && piece.type !== PieceType.King) {
              if (!revealed.includes(piece.id)) {
                if (isAdjacentToEnemy(state.board, pos, player)) {
                  revealed.push(piece.id);
                  updated = true;
                }
              }
            }
          }
        }

        if (updated) {
          state.variantState.revealedPieceIds = [...revealed];
        }
      }
    },

    // 5. Ultimate – Apex Camouflage Capture Reveal Check
    {
      id: `predator_apex_camouflage_capture_reveal_${player}`,
      eventType: 'OnCapture',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnCapture') return;
        const { attackerId, to } = event.payload;
        if (!attackerId || !to) return;

        const hasApexCamouflage = state.getPlayerEffects(player).some(e => e.type === 'apex_camouflage');
        if (hasApexCamouflage) {
          const piece = state.board.getPiece(to);
          if (piece && piece.color === player && piece.id === attackerId) {
            const revealed = state.variantState.revealedPieceIds || [];
            if (!revealed.includes(piece.id)) {
              revealed.push(piece.id);
              state.variantState.revealedPieceIds = [...revealed];
            }
          }
        }
      }
    },

    // 6. Ultimate – Apex Camouflage Clean-up
    {
      id: `predator_apex_camouflage_cleanup_${player}`,
      eventType: 'OnEffectExpired',
      priority: 100,
      source: `variant:predator:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnEffectExpired') return;
        const { effectSnapshot } = event.payload;
        if (effectSnapshot && effectSnapshot.type === 'apex_camouflage' && effectSnapshot.sourcePlayer === player) {
          state.variantState.revealedPieceIds = [];
        }
      }
    }
  ],

  skills: [
    // ── Skill 1: Evolution Spore (3 AP) ──
    {
      id: 'predator_evolution_spore',
      name: 'Evolution Spore',
      description: 'Apply Evolution to an allied Pawn. It cannot promote. Capturing after N turns transforms it.',
      tier: 'skill1',
      apCost: APCostConfig.predator.predator_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'piece',
        filter: 'ally',
        pieceType: PieceType.Pawn,
        description: 'Choose 1 allied Pawn'
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position) {
          return 'Select 1 allied Pawn';
        }
        const piece = state.board.getPiece(targets[0].position);
        if (!piece || piece.color !== player || piece.type !== PieceType.Pawn) {
          return 'Target must be an allied Pawn';
        }
        return null;
      },
      execute(state, player, targets): Action[] {
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `evolution_${targets[0].pieceId}_${Date.now()}`,
            type: 'evolution' as any,
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'piece',
            targetId: targets[0].pieceId!,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {
              roundsWithEvolution: 0
            }
          }
        }];
      }
    },

    // ── Skill 2: Shadow Prowl (4 AP) ──
    {
      id: 'predator_shadow_prowl',
      name: 'Shadow Prowl',
      description: 'Apply Soulless trap on an empty cell within attack range of any allied piece.',
      tier: 'skill2',
      apCost: APCostConfig.predator.predator_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [{
        type: 'cell',
        filter: 'empty',
        description: 'Select an empty cell in allied attack range'
      }],
      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 empty cell';
        }
        const pos = targets[0].position;
        const piece = state.board.getPiece(pos);
        const cellEffects = state.board.getCellEffects(pos);
        const hasFlame = cellEffects.some(e => e.type === 'flame');
        if (piece || hasFlame) {
          return 'Target cell must be empty';
        }
        const hasTrap = cellEffects.some(e => e.type === 'repel' || e.type === 'soulless_cell');
        if (hasTrap) {
          return 'Cannot overwrite existing traps';
        }
        if (!isSquareAttackedBy(state.board, pos, player, state)) {
          return 'Target cell must be within attack range of an allied piece';
        }
        return null;
      },
      execute(state, player, targets, rng): Action[] {
        const cell = targets[0].position!;
        const batchId = `predator_soulless_${cell.col}_${cell.row}_${Date.now()}`;
        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `soulless_cell_${cell.col}_${cell.row}_${batchId}`,
            type: 'soulless_cell' as any,
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
        }];
      }
    },

    // ── Ultimate: Apex Camouflage (9 AP) ──
    {
      id: 'predator_apex_camouflage',
      name: 'Apex Camouflage',
      description: 'Make all allied pieces (except King) invisible for 5 turns.',
      tier: 'ultimate',
      apCost: APCostConfig.predator.predator_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state, player, targets) {
        return null;
      },
      execute(state, player, targets): Action[] {
        // Reset revealedPieceIds so all pieces start camo'd again
        state.variantState.revealedPieceIds = [];

        return [{
          type: 'APPLY_EFFECT',
          effect: {
            id: `apex_camouflage_${player}_${Date.now()}`,
            type: 'apex_camouflage' as any,
            duration: 5,
            remainingDuration: 5,
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
