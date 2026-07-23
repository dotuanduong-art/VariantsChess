import { VariantDefinition } from '../Variant';
import { Color, PieceType, Piece } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { BOARD_SIZE } from '../../board/Board';
import { SubterraneanEscapeHandler } from '../../effect/handlers/SubterraneanEscapeHandler';
import { DragonsRoarBeamHandler } from '../../effect/handlers/DragonsRoarBeamHandler';
import { ShieldHandler } from '../../effect/handlers/ShieldHandler';
import { getSquareRegion } from '../../region/Region';
import { APCostConfig } from '../apCostConfig';

function findKing(state: any, player: Color): Position | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const p = state.board.getPiece({ col: c, row: r });
      if (p && p.type === PieceType.King && p.color === player) {
        return { col: c, row: r };
      }
    }
  }
  return null;
}

function getOrthogonalDirection(from: Position, to: Position): 'N' | 'S' | 'E' | 'W' | null {
  const dcol = to.col - from.col;
  const drow = to.row - from.row;
  if (dcol === 0 && drow === 0) return null;
  if (dcol !== 0 && drow !== 0) return null;
  if (dcol > 0) return 'E';
  if (dcol < 0) return 'W';
  if (drow > 0) return 'S';
  return 'N';
}

function fireBeam(state: any, player: Color, enqueueAction: (act: Action) => void) {
  const roar = state.variantState.dragonsRoar;
  if (!roar || roar.beamActive) return;

  const kingPos = roar.kingPosition;
  const direction = roar.direction;

  let dcol = 0;
  let drow = 0;
  if (direction === 'N') drow = -1;
  else if (direction === 'S') drow = 1;
  else if (direction === 'E') dcol = 1;
  else if (direction === 'W') dcol = -1;

  const beamCells: Position[] = [];
  for (let i = 1; i <= 15; i++) {
    const col = kingPos.col + i * dcol;
    const row = kingPos.row + i * drow;
    if (col >= 0 && col < BOARD_SIZE && row >= 0 && row < BOARD_SIZE) {
      beamCells.push({ col, row });
      const p = state.board.getPiece({ col, row });
      if (p && p.color !== player && p.type !== PieceType.King) {
        enqueueAction({
          type: 'DESTROY_PIECE',
          pieceId: p.id,
          position: { col, row },
          reason: 'dragons_roar_beam',
        });
      }
    } else {
      break;
    }
  }

  for (const cell of beamCells) {
    enqueueAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: `dragons_roar_beam_${cell.col}_${cell.row}_${state.turnNumber}`,
        type: 'dragons_roar_beam',
        duration: 5, // 5 rounds
        remainingDuration: 5,
        tickTiming: 'turnEnd',
        sourcePlayer: player,
        targetType: 'cell',
        targetId: `${cell.col},${cell.row}`,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    });
  }

  roar.beamActive = true;
  enqueueAction({
    type: 'APPLY_EFFECT',
    effect: {
      id: `dragons_roar_channeling_${roar.kingId}`,
      type: 'dragons_roar_channeling',
      duration: 5, // 5 rounds during beam phase
      remainingDuration: 5,
      tickTiming: 'turnStart',
      sourcePlayer: player,
      targetType: 'piece',
      targetId: roar.kingId,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    },
  });
}

export const DragonSentinelVariant: VariantDefinition = {
  id: 'dragon_sentinel',
  name: 'Dragon Sentinel',
  description: 'Defensive powerhouse protecting allies and channeling ultimate line-of-destruction.',

  effectHandlers: [
    new SubterraneanEscapeHandler(),
    new DragonsRoarBeamHandler(),
    new ShieldHandler(),
  ],

  onSetup(state, player) {
    if (state.variantState.passiveRoundCounter === undefined) {
      state.variantState.passiveRoundCounter = 0;
    }
    if (!state.variantState.undergroundPieces) {
      state.variantState.undergroundPieces = [];
    }
    if (state.variantState.dragonsRoar === undefined) {
      state.variantState.dragonsRoar = null;
    }
  },

  getInitialState: () => ({
    passiveRoundCounter: 0,
    undergroundPieces: [],
    dragonsRoar: null,
  }),

  passiveHooks: (state, player) => [
    // Passive: Shield closest ally to King every 2 rounds
    {
      id: `dragon_sentinel_passive_shield_${player}`,
      eventType: 'OnTurnEnd',
      priority: 500,
      source: `variant:dragon_sentinel:${player}`,
      handler: (event, enqueueAction) => {
        if (event.activePlayer !== Color.Black) return; // Trigger only at round end

        state.variantState.passiveRoundCounter = (state.variantState.passiveRoundCounter ?? 0) + 1;

        if (state.variantState.passiveRoundCounter % 2 === 0) {
          const kingPos = findKing(state, player);
          if (!kingPos) return;

          let nearestPiece: Piece | null = null;
          let minDistance = Infinity;

          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const p = state.board.getPiece({ col: c, row: r });
              if (p && p.color === player && p.type !== PieceType.King) {
                const dist = Math.abs(c - kingPos.col) + Math.abs(r - kingPos.row);
                if (dist < minDistance) {
                  minDistance = dist;
                  nearestPiece = p;
                }
              }
            }
          }

          if (nearestPiece) {
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `passive_shield_${nearestPiece.id}_${state.turnNumber}`,
                type: 'shield',
                duration: 1, // 1 round = 1 tick on owner's turn end
                remainingDuration: 1,
                tickTiming: 'turnEnd',
                sourcePlayer: player,
                targetType: 'piece',
                targetId: nearestPiece.id,
                stackingRule: 'refresh',
                isDebuff: false,
                metadata: {},
              },
            });
          }
        }
      },
    },

    // Skill 1: Underground Return at Turn Start
    {
      id: `dragon_sentinel_underground_return_${player}`,
      eventType: 'OnTurnStart',
      priority: 100,
      source: `variant:dragon_sentinel:${player}`,
      handler: (event, enqueueAction) => {
        if (event.activePlayer !== player) return;

        const undergroundList = state.variantState.undergroundPieces || [];
        const currentRound = state.turnNumber;

        const remaining: any[] = [];
        for (const item of undergroundList) {
          if (item.ownerColor === player && currentRound >= item.returnRound) {
            const pos = item.position;
            const existing = state.board.getPiece(pos);
            if (existing) {
              enqueueAction({
                type: 'DESTROY_PIECE',
                pieceId: existing.id,
                position: pos,
                reason: 'subterranean_escape',
              });
            }
            enqueueAction({
              type: 'SPAWN_PIECE',
              piece: item.pieceSnapshot,
              position: pos,
            });
          } else {
            remaining.push(item);
          }
        }
        state.variantState.undergroundPieces = remaining;
      },
    },

    // Ultimate: Sacrifice Reduction on Piece Destroyed
    {
      id: `dragon_sentinel_sacrifice_reduce_${player}`,
      eventType: 'OnPieceDestroyed',
      priority: 300,
      source: `variant:dragon_sentinel:${player}`,
      handler: (event, enqueueAction) => {
        const roar = state.variantState.dragonsRoar;
        if (roar && roar.active && !roar.beamActive && roar.casterColor === player) {
          const { pieceSnapshot } = event.payload;
          if (pieceSnapshot && pieceSnapshot.color === player && pieceSnapshot.type !== PieceType.King) {
            roar.channelRoundsRemaining--;
            // Also decrement remainingDuration of King's channeling effect
            const kingPos = findKing(state, player);
            if (kingPos) {
              const kingPiece = state.board.getPiece(kingPos);
              if (kingPiece && kingPiece.effects) {
                const channeling = kingPiece.effects.find(e => e.type === 'dragons_roar_channeling');
                if (channeling && channeling.remainingDuration !== null) {
                  channeling.remainingDuration--;
                  if (channeling.remainingDuration <= 0) {
                    enqueueAction({
                      type: 'REMOVE_EFFECT',
                      effectId: channeling.id,
                      targetId: kingPiece.id,
                      targetType: 'piece',
                      reason: 'expired',
                    });
                  }
                }
              }
            }
          }
        }
      },
    },

    // Ultimate: Transition/Cleanup when King's Channeling Effect Expires
    {
      id: `dragon_sentinel_channeling_expired_${player}`,
      eventType: 'OnEffectExpired',
      priority: 100,
      source: `variant:dragon_sentinel:${player}`,
      handler: (event, enqueueAction) => {
        const snapshot = event.payload.effectSnapshot;
        if (snapshot && snapshot.type === 'dragons_roar_channeling' && snapshot.sourcePlayer === player) {
          const roar = state.variantState.dragonsRoar;
          if (roar && roar.active && !roar.beamActive) {
            // Channeling expired -> fire beam
            fireBeam(state, player, enqueueAction);
          } else {
            // Beam phase expired -> cleanup
            state.variantState.dragonsRoar = null;
          }
        }
      },
    },
  ],

  moveModifiers: [
    {
      id: 'dragon_sentinel_king_lockdown',
      priority: 10,
      source: 'variant:dragon_sentinel',
      modify(moves, context) {
        const { piece } = context;
        if (piece.type === PieceType.King) {
          const hasChanneling = piece.effects?.some(e => e.type === 'dragons_roar_channeling');
          if (hasChanneling) {
            return [];
          }
        }
        return moves;
      },
    },
  ],

  skills: [
    // ── Skill 1: Subterranean Escape (4 AP) ──
    {
      id: 'dragon_sentinel_subterranean_escape',
      name: 'Subterranean Escape',
      description: 'Buff an ally piece. If captured in next 2 rounds, it disappears and returns in 2 rounds, destroying occupiers.',
      tier: 'skill1',
      apCost: APCostConfig.dragon_sentinel.dragon_sentinel_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'ally',
            excludeKing: true,
            description: 'Select an ally piece to buff',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 ally piece';
        }
        const pos = targets[0].position;
        const piece = state.board.getPiece(pos);
        if (!piece || piece.color !== player) {
          return 'Must target an ally piece';
        }
        if (piece.type === PieceType.King) {
          return 'Cannot target the King';
        }
        if (piece.effects?.some(e => e.type === 'subterranean_escape')) {
          return 'Piece already has Subterranean Escape';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const targetPos = targets[0].position!;
        const piece = state.board.getPiece(targetPos)!;
        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `subterranean_escape_${piece.id}_${Date.now()}`,
              type: 'subterranean_escape',
              duration: 2, // 2 rounds = 2 ticks on owner's turn end
              remainingDuration: 2,
              tickTiming: 'turnEnd',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: piece.id,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            },
          },
        ];
      },
    },

    // ── Skill 2: Shockwave (3 AP) ──
    {
      id: 'dragon_sentinel_shockwave',
      name: 'Shockwave',
      description: 'EPICENTER pushes all enemies in a 3x3 area away by 1 square.',
      tier: 'skill2',
      apCost: APCostConfig.dragon_sentinel.dragon_sentinel_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'piece',
            filter: 'ally',
            description: 'Select an ally piece as the epicenter',
          },
        ];
      },

      canActivate(state, player, targets) {
        if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
          return 'Select 1 ally piece';
        }
        const center = targets[0].position;
        const piece = state.board.getPiece(center);
        if (!piece || piece.color !== player) {
          return 'Must target an ally piece';
        }

        let hasEnemy = false;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = center.row + dr;
            const c = center.col + dc;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
              const p = state.board.getPiece({ col: c, row: r });
              if (p && p.color !== player) {
                hasEnemy = true;
                break;
              }
            }
          }
          if (hasEnemy) break;
        }

        if (!hasEnemy) {
          return 'No enemy piece in the 3x3 area';
        }

        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const center = targets[0].position!;
        const actions: Action[] = [];

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = center.row + dr;
            const c = center.col + dc;
            if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;

            const enemy = state.board.getPiece({ col: c, row: r });
            if (enemy && enemy.color !== player) {
              const destCol = c + dc;
              const destRow = r + dr;
              const dest = { col: destCol, row: destRow };

              if (
                destCol >= 0 &&
                destCol < BOARD_SIZE &&
                destRow >= 0 &&
                destRow < BOARD_SIZE &&
                !state.board.getPiece(dest)
              ) {
                actions.push({
                  type: 'PUSH_PIECE',
                  pieceId: enemy.id,
                  from: { col: c, row: r },
                  to: dest,
                  reason: 'shockwave',
                });
              }
            }
          }
        }

        return actions;
      },
    },

    // ── Ultimate: Dragon's Roar (10 AP) ──
    {
      id: 'dragon_sentinel_dragons_roar',
      name: "Dragon's Roar",
      description: "King channels for 5 rounds, firing a 15x1 line of destruction orthogonal to the King.",
      tier: 'ultimate',
      apCost: APCostConfig.dragon_sentinel.dragon_sentinel_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',

      getTargetRequirements(state, player) {
        return [
          {
            type: 'cell',
            filter: 'any',
            description: 'Select an orthogonal cell to target the roar direction',
          },
        ];
      },

      canActivate(state, player, targets) {
        const kingPos = findKing(state, player);
        if (!kingPos) {
          return 'King not found';
        }
        if (state.variantState.dragonsRoar && state.variantState.dragonsRoar.active) {
          return "Dragon's Roar is already active or channeling";
        }
        if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
          return 'Select 1 target cell';
        }
        const targetPos = targets[0].position;
        const dir = getOrthogonalDirection(kingPos, targetPos);
        if (!dir) {
          return 'Target cell must be strictly orthogonal to the King';
        }
        return null;
      },

      execute(state, player, targets, rng): Action[] {
        const kingPos = findKing(state, player)!;
        const kingPiece = state.board.getPiece(kingPos)!;
        const targetPos = targets[0].position!;
        const direction = getOrthogonalDirection(kingPos, targetPos)!;

        state.variantState.dragonsRoar = {
          active: true,
          direction,
          kingPosition: { ...kingPos },
          channelRoundsRemaining: 5,
          beamActive: false,
          kingId: kingPiece.id,
          casterColor: player,
        };

        return [
          {
            type: 'APPLY_EFFECT',
            effect: {
              id: `dragons_roar_channeling_${kingPiece.id}`,
              type: 'dragons_roar_channeling',
              duration: 5, // 5 rounds initial channeling
              remainingDuration: 5,
              tickTiming: 'turnStart',
              sourcePlayer: player,
              targetType: 'piece',
              targetId: kingPiece.id,
              stackingRule: 'refresh',
              isDebuff: false,
              metadata: {},
            },
          },
        ];
      },
    },
  ],
};
