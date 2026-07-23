import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece, getPieceOwner } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { GameState } from '../../state/GameState';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { Effect } from '../../effect/Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { APCostConfig } from '../apCostConfig';

export interface DimensionPortal {
  id: string;
  position: Position;
  type: 'odd' | 'even';
  owner: Color;
  occupantId: string | null;
  isHidden?: boolean;
}

export interface DimensionPair {
  odd: DimensionPortal;
  even: DimensionPortal;
  owner: Color;
  createdAtRound: number;
}

export function syncDimensionPortalCellEffects(state: GameState): void {
  const board = state.board;
  // 1. Find and remove all existing 'dimension' cell effects
  const allCellEffects = board.getAllCellEffects();
  for (const [key, effects] of allCellEffects.entries()) {
    const kept = effects.filter(e => e.type !== 'dimension');
    const [col, row] = key.split(',').map(Number);
    board.setCellEffects({ col, row }, kept);
  }

  // 2. Add 'dimension' cell effects based on active dimensionPairs
  const pairs = state.variantState.dimensionPairs || [];
  for (const pair of pairs) {
    if (pair.odd) {
      const pos = pair.odd.position;
      const effect: Effect = {
        id: pair.odd.id,
        type: 'dimension',
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: pair.owner,
        targetType: 'cell',
        targetId: `${pos.col},${pos.row}`,
        stackingRule: 'ignore',
        isDebuff: false,
        isHidden: pair.odd.isHidden ?? false,
        metadata: {
          portalId: pair.odd.id,
          portalType: 'odd',
          owner: pair.owner,
        },
      };
      board.addCellEffect(pos, effect);
    }
    if (pair.even) {
      const pos = pair.even.position;
      const effect: Effect = {
        id: pair.even.id,
        type: 'dimension',
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: pair.owner,
        targetType: 'cell',
        targetId: `${pos.col},${pos.row}`,
        stackingRule: 'ignore',
        isDebuff: false,
        isHidden: pair.even.isHidden ?? false,
        metadata: {
          portalId: pair.even.id,
          portalType: 'even',
          owner: pair.owner,
        },
      };
      board.addCellEffect(pos, effect);
    }
  }
}

function cleanupPortalOccupants(state: GameState, player: Color): void {
  const pairs = state.variantState.dimensionPairs || [];
  for (const pair of pairs) {
    if (pair.owner === player && pair.odd && pair.odd.occupantId) {
      const piece = state.board.getPiece(pair.odd.position);
      if (!piece || piece.id !== pair.odd.occupantId) {
        pair.odd.occupantId = null;
      }
    }
  }
}

export const SpaceVariant: VariantDefinition = {
  id: 'space',
  name: 'Space',
  description: 'Control space, link dimensions, swap portals, and summon outworld barriers.',
  effectHandlers: [],

  getInitialState: () => ({
    dimensionPairs: [],
    cosmicVoidExpiryRound: 0,
  }),

  skills: [
    // ── Skill 1: Dimension Link (3 AP) ──
    {
      id: 'space_dimension_link',
      name: 'Dimension Link',
      description: 'Place odd portal (n) on your half, and even portal (n+1) on opponent half. Enemy passing odd portal gets teleported to even portal.',
      tier: 'skill1',
      apCost: APCostConfig.space.space_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        const ownHalfRegion: Position[] = [];
        const opponentHalfRegion: Position[] = [];
        const isWhite = player === Color.White;
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const isOwn = isWhite ? (r >= 0 && r <= 6) : (r >= 8 && r <= 14);
            const isOpp = isWhite ? (r >= 8 && r <= 14) : (r >= 0 && r <= 6);
            if (isOwn) ownHalfRegion.push(pos);
            if (isOpp) opponentHalfRegion.push(pos);
          }
        }
        return [
          {
            type: 'cell',
            filter: 'empty',
            region: ownHalfRegion,
            description: 'Select empty square on your half (odd portal)',
          },
          {
            type: 'cell',
            filter: 'empty',
            region: opponentHalfRegion,
            description: 'Select empty square on opponent\'s half (even portal)',
          }
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 2) {
          return 'Select exactly 2 target cells';
        }
        const t0 = targets[0];
        const t1 = targets[1];
        if (t0.type !== 'cell' || !t0.position || t1.type !== 'cell' || !t1.position) {
          return 'Invalid targets';
        }
        if (state.board.getPiece(t0.position) || state.board.getPiece(t1.position)) {
          return 'Both target cells must be empty';
        }
        const isWhite = player === Color.White;
        const r0 = t0.position.row;
        const r1 = t1.position.row;
        const isT0Own = isWhite ? (r0 >= 0 && r0 <= 6) : (r0 >= 8 && r0 <= 14);
        const isT1Opp = isWhite ? (r1 >= 8 && r1 <= 14) : (r1 >= 0 && r1 <= 6);
        if (!isT0Own) {
          return 'Odd portal must be in your own half';
        }
        if (!isT1Opp) {
          return 'Even portal must be in opponent\'s half';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const t0 = targets[0];
        const t1 = targets[1];
        const actions: Action[] = [];
        const pairId = `pair_${Date.now()}_${Math.floor(rng.next() * 1000)}`;

        const newPair: DimensionPair = {
          odd: {
            id: `odd_${pairId}`,
            position: { ...t0.position! },
            type: 'odd',
            owner: player,
            occupantId: null,
            isHidden: true,
          },
          even: {
            id: `even_${pairId}`,
            position: { ...t1.position! },
            type: 'even',
            owner: player,
            occupantId: null,
            isHidden: true,
          },
          owner: player,
          createdAtRound: state.turnNumber,
        };

        if (!state.variantState.dimensionPairs) {
          state.variantState.dimensionPairs = [];
        }
        state.variantState.dimensionPairs.push(newPair);

        syncDimensionPortalCellEffects(state);

        // Apply Outworld at both portal locations (passive trigger, duration: 2 rounds)
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `outworld_${newPair.odd.id}_${Date.now()}`,
            type: 'outworld',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'cell',
            targetId: `${newPair.odd.position.col},${newPair.odd.position.row}`,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          },
        });
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `outworld_${newPair.even.id}_${Date.now()}`,
            type: 'outworld',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'cell',
            targetId: `${newPair.even.position.col},${newPair.even.position.row}`,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          },
        });

        return actions;
      },
    },

    // ── Skill 2: Spatial Shift (4 AP) ──
    {
      id: 'space_spatial_shift',
      name: 'Spatial Shift',
      description: 'Swap locations of portals in a pair by swapping their columns. Destroys any enemy piece at destination.',
      tier: 'skill2',
      apCost: APCostConfig.space.space_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [{
          type: 'cell',
          filter: 'any',
          description: 'Select an active portal of yours to swap',
        }];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select exactly 1 target cell containing your portal';
        }
        const pos = targets[0].position;
        const pairs = state.variantState.dimensionPairs || [];
        const matchedPair = pairs.find((p: any) =>
          p.owner === player && (
            (p.odd.position.col === pos.col && p.odd.position.row === pos.row) ||
            (p.even.position.col === pos.col && p.even.position.row === pos.row)
          )
        );
        if (!matchedPair) {
          return 'Selected square does not contain an active portal of yours';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const pos = targets[0].position!;
        const pairs = state.variantState.dimensionPairs || [];
        const pair = pairs.find((p: any) =>
          p.owner === player && (
            (p.odd.position.col === pos.col && p.odd.position.row === pos.row) ||
            (p.even.position.col === pos.col && p.even.position.row === pos.row)
          )
        );
        if (!pair) return [];

        const actions: Action[] = [];
        const opponentColor = player === Color.White ? Color.Black : Color.White;

        const oddDest = { col: pair.even.position.col, row: pair.odd.position.row };
        const evenDest = { col: pair.odd.position.col, row: pair.even.position.row };

        // Check and destroy opponent piece at oddDest
        const oddOccupant = state.board.getPiece(oddDest);
        if (oddOccupant && getPieceOwner(oddOccupant) === opponentColor) {
          actions.push({
            type: 'DESTROY_PIECE',
            pieceId: oddOccupant.id,
            position: oddDest,
            reason: 'spatial_shift',
          });
        }

        // Check and destroy opponent piece at evenDest
        const evenOccupant = state.board.getPiece(evenDest);
        if (evenOccupant && getPieceOwner(evenOccupant) === opponentColor) {
          actions.push({
            type: 'DESTROY_PIECE',
            pieceId: evenOccupant.id,
            position: evenDest,
            reason: 'spatial_shift',
          });
        }

        // Update positions
        pair.odd.position = oddDest;
        pair.even.position = evenDest;
        pair.odd.isHidden = false;
        pair.even.isHidden = false;

        syncDimensionPortalCellEffects(state);

        // Apply Outworld at both new portal locations (passive trigger, duration: 2 rounds)
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `outworld_${pair.odd.id}_${Date.now()}`,
            type: 'outworld',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'cell',
            targetId: `${pair.odd.position.col},${pair.odd.position.row}`,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          },
        });
        actions.push({
          type: 'APPLY_EFFECT',
          effect: {
            id: `outworld_${pair.even.id}_${Date.now()}`,
            type: 'outworld',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: player,
            targetType: 'cell',
            targetId: `${pair.even.position.col},${pair.even.position.row}`,
            stackingRule: 'refresh',
            isDebuff: false,
            metadata: {},
          },
        });

        return actions;
      },
    },

    // ── Ultimate: Cosmic Void (9 AP) ──
    {
      id: 'space_cosmic_void',
      name: 'Cosmic Void',
      description: 'For 10 rounds: capturing an enemy creates an Outworld block. All created blocks expire together.',
      tier: 'ultimate',
      apCost: APCostConfig.space.space_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [];
      },

      canActivate(state, player, targets) {
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        state.variantState.cosmicVoidExpiryRound = state.turnNumber + 10;
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `cosmic_void_${player}_${Date.now()}`,
              type: 'cosmic_void',
              duration: 10,
              remainingDuration: 10,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'player',
              targetId: player,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            },
          }
        ];
      },
    },
  ],

  passiveHooks: (state, player) => [
    {
      id: `space_standing_still_check_${player}`,
      eventType: 'OnTurnStart',
      priority: 100,
      source: `variant:space:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnTurnStart') return;
        if (state.currentTurn !== player) return;

        const pairs = state.variantState.dimensionPairs || [];
        for (const pair of pairs) {
          if (pair.owner === player && pair.odd) {
            const piece = state.board.getPiece(pair.odd.position);
            if (piece && piece.color === player) {
              if (pair.odd.occupantId === piece.id) {
                // Stood still for 1 round! Teleport now.
                const destPos = pair.even.position;
                const targetPiece = state.board.getPiece(destPos);
                if (targetPiece) {
                  enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: targetPiece.id,
                    position: destPos,
                    reason: 'dimension_teleport',
                  });
                }
                enqueueAction({
                  type: 'FOOL_MOVE',
                  pieceId: piece.id,
                  from: pair.odd.position,
                  to: destPos,
                });
                enqueueAction({
                  type: 'REMOVE_PORTALS',
                  pairId: pair.odd.id,
                });
              } else {
                pair.odd.occupantId = piece.id;
              }
            } else {
              pair.odd.occupantId = null;
            }
          }
        }
      }
    },
    {
      id: `space_portal_occupant_cleanup_start_${player}`,
      eventType: 'OnTurnStart',
      priority: 10,
      source: `variant:space:${player}`,
      handler: (event) => {
        cleanupPortalOccupants(state, player);
      }
    },
    {
      id: `space_portal_occupant_cleanup_end_${player}`,
      eventType: 'OnTurnEnd',
      priority: 10,
      source: `variant:space:${player}`,
      handler: (event) => {
        cleanupPortalOccupants(state, player);
      }
    },
    {
      id: `space_cosmic_void_capture_${player}`,
      eventType: 'OnCapture',
      priority: 100,
      source: `variant:space:${player}`,
      handler: (event, enqueueAction) => {
        if (event.type !== 'OnCapture') return;
        const hasCosmicVoid = state.getPlayerEffects(player).some(e => e.type === 'cosmic_void');
        if (!hasCosmicVoid) return;

        // Verify it was our capture of an opponent's piece
        const { to, capturedPieceSnapshot } = event.payload;
        if (!capturedPieceSnapshot || capturedPieceSnapshot.color === player) return;

        const expiry = state.variantState.cosmicVoidExpiryRound || (state.turnNumber + 10);
        const remaining = expiry - state.turnNumber;
        if (remaining > 0) {
          enqueueAction({
            type: 'APPLY_EFFECT',
            effect: {
              id: `outworld_ultimate_${to.col}_${to.row}_${Date.now()}`,
              type: 'outworld',
              duration: remaining,
              remainingDuration: remaining,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'cell',
              targetId: `${to.col},${to.row}`,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            }
          });
        }
      }
    }
  ],
};
