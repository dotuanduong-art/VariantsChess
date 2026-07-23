import { VariantDefinition } from '../Variant';
import { Color, PieceType } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { Position } from '../../board/Position';
import { GameState } from '../../state/GameState';
import { BOARD_SIZE } from '../../board/Board';
import { ActionValidator } from '../../action/ActionPipeline';
import { MoveModifier, MoveModifierContext } from '../../modifier/MoveModifier';
import { APCostConfig } from '../apCostConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Check if a position is within the 9x9 central zone (cols 3-11, rows 3-11)
// ─────────────────────────────────────────────────────────────────────────────
export function isInZone(pos: Position): boolean {
  return pos.col >= 3 && pos.col <= 11 && pos.row >= 3 && pos.row <= 11;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get piece rank for Law 2 and Law 3 comparison
// ─────────────────────────────────────────────────────────────────────────────
function getPieceRank(type: PieceType | string): number {
  switch (type) {
    case PieceType.King: return 6;
    case PieceType.Queen: return 5;
    case PieceType.Rook: return 4;
    case PieceType.Bishop: return 3;
    case PieceType.Knight: return 2;
    case PieceType.Pawn: return 1;
    default: return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Traces path for sliding moves and checks boundary crossing
// ─────────────────────────────────────────────────────────────────────────────
export function isPathValid(from: Position, to: Position): boolean {
  const dcol = Math.abs(to.col - from.col);
  const drow = Math.abs(to.row - from.row);
  const startInside = isInZone(from);
  const destInside = isInZone(to);

  // Check if it's a sliding move: Rook-like, Bishop-like, Queen-like with distance > 1
  const isSliding = (dcol === 0 || drow === 0 || dcol === drow) && (dcol > 1 || drow > 1);

  if (!isSliding) {
    // Non-sliding/jumping moves (like Knight or single steps): simply check if both start and end are on the same side
    return startInside === destInside;
  }

  // Sliding path check:
  const dc = Math.sign(to.col - from.col);
  const dr = Math.sign(to.row - from.row);

  let prev = from;
  let currCol = from.col + dc;
  let currRow = from.row + dr;

  while (true) {
    const curr = { col: currCol, row: currRow };
    if (isInZone(prev) !== isInZone(curr)) {
      return false; // Crossed boundary, path blocked
    }
    if (currCol === to.col && currRow === to.row) {
      break;
    }
    prev = curr;
    currCol += dc;
    currRow += dr;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// LawValidator: Intercepts CAPTURE actions inside the 9x9 zone to enforce laws
// ─────────────────────────────────────────────────────────────────────────────
export class LawValidator implements ActionValidator {
  validate(action: Action, state: Readonly<GameState>): string | null {
    if (action.type !== 'CAPTURE') return null;

    const attackerPos = action.from;
    const targetPos = action.to;

    // Both attacker and target must stand inside the 9x9 zone for the law to apply
    if (isInZone(attackerPos) && isInZone(targetPos)) {
      const currentLaw = state.variantState.currentLaw ?? 1;
      const attacker = state.board.getPiece(attackerPos);
      const target = state.board.getPiece(targetPos);

      if (!attacker || !target) return null;

      if (currentLaw === 1) {
        if (attacker.type !== target.type) {
          return `Law 1 Violation: Only pieces of the same type can capture each other inside the zone.`;
        }
      } else if (currentLaw === 2) {
        const rA = getPieceRank(attacker.type);
        const rT = getPieceRank(target.type);
        if (rA <= rT) {
          return `Law 2 Violation: Only pieces of higher rank can capture lower rank pieces inside the zone.`;
        }
      } else if (currentLaw === 3) {
        const rA = getPieceRank(attacker.type);
        const rT = getPieceRank(target.type);
        if (rA >= rT) {
          return `Law 3 Violation: Only pieces of lower rank can capture higher rank pieces inside the zone.`;
        }
      }
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DomainBoundaryModifier: Blocks moves that cross the 9x9 boundary during Ultimate
// ─────────────────────────────────────────────────────────────────────────────
export const DomainBoundaryModifier: MoveModifier = {
  id: 'ruler_domain_boundary',
  priority: 100,
  source: 'variant:ruler',

  modify(moves: Position[], context: MoveModifierContext): Position[] {
    if (context.state.variantState.domainActive) {
      return moves.filter(dest => isPathValid(context.piecePosition, dest));
    }
    return moves;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RulerVariant Definition
// ─────────────────────────────────────────────────────────────────────────────
export const RulerVariant: VariantDefinition = {
  id: 'ruler',
  name: 'Ruler',
  description: 'Enforce absolute laws on a 9x9 battlefield, controlling the flow of capture and locking down territories.',
  
  effectHandlers: [],

  actionValidators: [
    new LawValidator(),
  ],

  moveModifiers: [
    DomainBoundaryModifier,
  ],

  getInitialState: () => ({
    currentLaw: 1,
    lawActive: 1, // sync with lawActive for UI
    lawRemainingRounds: 0,
    domainActive: false,
    domainRemainingRounds: 0,
    domainWhitePiecesInside: [],
    domainBlackPiecesInside: [],
  }),

  passiveHooks: (state: GameState, player: Color) => [
    {
      id: `ruler_turn_end_tick_${player}`,
      eventType: 'OnTurnEnd',
      priority: 500,
      source: `variant:ruler:${player}`,
      handler: (event) => {
        if (event.type !== 'OnTurnEnd') return;
        if (event.activePlayer !== player) return;

        // Tick law duration
        if (state.variantState.lawRemainingRounds > 0) {
          state.variantState.lawRemainingRounds--;
          if (state.variantState.lawRemainingRounds === 0) {
            state.variantState.currentLaw = 1;
            state.variantState.lawActive = 1;
          }
        }

        // Tick domain duration
        if (state.variantState.domainActive && state.variantState.domainRemainingRounds > 0) {
          state.variantState.domainRemainingRounds--;
          if (state.variantState.domainRemainingRounds === 0) {
            state.variantState.domainActive = false;
            state.variantState.domainWhitePiecesInside = [];
            state.variantState.domainBlackPiecesInside = [];
          }
        }
      }
    },
    {
      id: `ruler_piece_destroyed_${player}`,
      eventType: 'OnPieceDestroyed',
      priority: 500,
      source: `variant:ruler:${player}`,
      handler: (event) => {
        if (event.type !== 'OnPieceDestroyed') return;
        if (!state.variantState.domainActive) return;

        const pieceSnapshot = event.payload.pieceSnapshot;
        if (!pieceSnapshot) return;

        const pieceId = pieceSnapshot.id;
        const color = pieceSnapshot.color;

        let wasRemoved = false;
        if (color === Color.White && state.variantState.domainWhitePiecesInside) {
          const idx = state.variantState.domainWhitePiecesInside.indexOf(pieceId);
          if (idx !== -1) {
            state.variantState.domainWhitePiecesInside.splice(idx, 1);
            wasRemoved = true;
          }
        } else if (color === Color.Black && state.variantState.domainBlackPiecesInside) {
          const idx = state.variantState.domainBlackPiecesInside.indexOf(pieceId);
          if (idx !== -1) {
            state.variantState.domainBlackPiecesInside.splice(idx, 1);
            wasRemoved = true;
          }
        }

        // Early termination: If a previously tracked piece group becomes empty, end domain
        if (wasRemoved) {
          if (color === Color.White && state.variantState.domainWhitePiecesInside.length === 0) {
            state.variantState.domainActive = false;
            state.variantState.domainWhitePiecesInside = [];
            state.variantState.domainBlackPiecesInside = [];
          } else if (color === Color.Black && state.variantState.domainBlackPiecesInside.length === 0) {
            state.variantState.domainActive = false;
            state.variantState.domainWhitePiecesInside = [];
            state.variantState.domainBlackPiecesInside = [];
          }
        }
      }
    }
  ],

  skills: [
    // ── Skill 1: Order of Hierarchy (4 AP) ──
    {
      id: 'ruler_law2',
      name: 'Order of Hierarchy',
      description: 'Set Law inside the territory to Law 2 (higher rank eats lower rank) for 3 rounds. Reject if Law 3 is active.',
      tier: 'skill1',
      apCost: APCostConfig.ruler.ruler_skill_1,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state) {
        if (state.variantState.currentLaw === 3) {
          return 'Cannot activate Order of Hierarchy while Decree of the Weak is active.';
        }
        return null;
      },
      execute(state): Action[] {
        state.variantState.currentLaw = 2;
        state.variantState.lawActive = 2;
        state.variantState.lawRemainingRounds = 3;
        return [];
      }
    },
    // ── Skill 2: Decree of the Weak (4 AP) ──
    {
      id: 'ruler_law3',
      name: 'Decree of the Weak',
      description: 'Set Law inside the territory to Law 3 (lower rank eats higher rank) for 3 rounds. Reject if Law 2 is active.',
      tier: 'skill2',
      apCost: APCostConfig.ruler.ruler_skill_2,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate(state) {
        if (state.variantState.currentLaw === 2) {
          return 'Cannot activate Decree of the Weak while Order of Hierarchy is active.';
        }
        return null;
      },
      execute(state): Action[] {
        state.variantState.currentLaw = 3;
        state.variantState.lawActive = 3;
        state.variantState.lawRemainingRounds = 3;
        return [];
      }
    },
    // ── Ultimate: Absolute Domain (10 AP) ──
    {
      id: 'ruler_close_field',
      name: 'Absolute Domain',
      description: 'Lock down the central territory for 5 rounds: no entering and no leaving. Ends early if all initially snapshotted pieces of either player inside the zone are destroyed.',
      tier: 'ultimate',
      apCost: APCostConfig.ruler.ruler_ultimate,
      cooldown: 0,
      usageRule: 'once_per_turn',
      getTargetRequirements: () => [],
      canActivate() {
        return null;
      },
      execute(state): Action[] {
        state.variantState.domainActive = true;
        state.variantState.domainRemainingRounds = 5;

        // Snapshot all pieces inside the 9x9 zone
        const whiteIds: string[] = [];
        const blackIds: string[] = [];

        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            if (isInZone(pos)) {
              const piece = state.board.getPiece(pos);
              if (piece) {
                if (piece.color === Color.White) {
                  whiteIds.push(piece.id);
                } else {
                  blackIds.push(piece.id);
                }
              }
            }
          }
        }

        state.variantState.domainWhitePiecesInside = whiteIds;
        state.variantState.domainBlackPiecesInside = blackIds;

        return [];
      }
    }
  ]
};
