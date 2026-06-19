// ============================================================
// Region Utilities — Reusable geometric shape functions
// ============================================================
//
// Provides shape generators for skill/effect target areas:
//   - NxN square (3×3, 5×5, 7×7, 9×9, 15×15)
//   - Cross (+) pattern
//   - X shape (×) pattern
//   - Directional rectangle (for Thunder Dragon Ult, etc.)
//   - Ring (border of a square)
//
// All results are clamped to the 15×15 board bounds.
// ============================================================

import { Position, isInBounds } from '../board/Position';

export type RegionShape = 'square' | 'cross' | 'x_shape' | 'rect' | 'ring';
export type Direction = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface RegionParams {
  center: Position;
  shape: RegionShape;
  size: number;                  // for 'square': full side length (3, 5, 7, 9, 15)
  width?: number;                // for 'rect': width
  height?: number;               // for 'rect': height
  direction?: Direction;         // for 'rect': orientation
  includeCenter?: boolean;       // default true
}

// ─── Direction vectors ────────────────────────────────────────

const DIRECTION_VECTORS: Record<Direction, { dcol: number; drow: number }> = {
  N:  { dcol: 0,  drow: 1 },
  S:  { dcol: 0,  drow: -1 },
  E:  { dcol: 1,  drow: 0 },
  W:  { dcol: -1, drow: 0 },
  NE: { dcol: 1,  drow: 1 },
  NW: { dcol: -1, drow: 1 },
  SE: { dcol: 1,  drow: -1 },
  SW: { dcol: -1, drow: -1 },
};

// ─── Generic getRegion dispatcher ─────────────────────────────

/**
 * Get all positions in the specified region, clamped to board bounds.
 */
export function getRegion(params: RegionParams): Position[] {
  const includeCenter = params.includeCenter !== false; // default true

  let positions: Position[];
  switch (params.shape) {
    case 'square':
      positions = getSquareRegion(params.center, params.size);
      break;
    case 'cross':
      positions = getCrossRegion(params.center, Math.floor(params.size / 2));
      break;
    case 'x_shape':
      positions = getXRegion(params.center, Math.floor(params.size / 2));
      break;
    case 'rect':
      positions = getDirectionalRect(
        params.center,
        params.direction || 'N',
        params.width || 1,
        params.height || params.size
      );
      break;
    case 'ring':
      positions = getRingRegion(params.center, params.size);
      break;
    default:
      positions = [];
  }

  if (!includeCenter) {
    positions = positions.filter(
      p => !(p.col === params.center.col && p.row === params.center.row)
    );
  }

  return positions;
}

// ─── Shape implementations ────────────────────────────────────

/**
 * NxN square centered on `center`.
 * Example: size=3 → 1 square in each direction from center (3×3 = 9 cells max).
 */
export function getSquareRegion(center: Position, size: number): Position[] {
  const positions: Position[] = [];
  const halfSize = Math.floor(size / 2);

  for (let drow = -halfSize; drow <= halfSize; drow++) {
    for (let dcol = -halfSize; dcol <= halfSize; dcol++) {
      const pos: Position = { col: center.col + dcol, row: center.row + drow };
      if (isInBounds(pos)) {
        positions.push(pos);
      }
    }
  }

  return positions;
}

/**
 * Cross-shaped region (+ pattern) centered on `center`.
 * `armLength` is the number of squares in each arm from center.
 * Example: armLength=2 → extends 2 squares in each of N/S/E/W.
 */
export function getCrossRegion(center: Position, armLength: number): Position[] {
  const positions: Position[] = [];
  const seen = new Set<string>();

  const addPos = (pos: Position) => {
    const key = `${pos.col},${pos.row}`;
    if (isInBounds(pos) && !seen.has(key)) {
      seen.add(key);
      positions.push(pos);
    }
  };

  // Center
  addPos(center);

  // Four arms (N, S, E, W)
  for (let i = 1; i <= armLength; i++) {
    addPos({ col: center.col, row: center.row + i });     // N
    addPos({ col: center.col, row: center.row - i });     // S
    addPos({ col: center.col + i, row: center.row });     // E
    addPos({ col: center.col - i, row: center.row });     // W
  }

  return positions;
}

/**
 * X-shaped region (× pattern) centered on `center`.
 * `armLength` is the number of squares in each diagonal arm from center.
 */
export function getXRegion(center: Position, armLength: number): Position[] {
  const positions: Position[] = [];
  const seen = new Set<string>();

  const addPos = (pos: Position) => {
    const key = `${pos.col},${pos.row}`;
    if (isInBounds(pos) && !seen.has(key)) {
      seen.add(key);
      positions.push(pos);
    }
  };

  // Center
  addPos(center);

  // Four diagonal arms (NE, NW, SE, SW)
  for (let i = 1; i <= armLength; i++) {
    addPos({ col: center.col + i, row: center.row + i });     // NE
    addPos({ col: center.col - i, row: center.row + i });     // NW
    addPos({ col: center.col + i, row: center.row - i });     // SE
    addPos({ col: center.col - i, row: center.row - i });     // SW
  }

  return positions;
}

/**
 * Directional rectangle from a starting position.
 * Generates a rectangle of `width` × `length` extending in `direction` from `start`.
 * Width is perpendicular to direction, centered on the line of extension.
 * Used by Thunder Dragon Ultimate (3×8 from king), Dragon Sentinel Ultimate (15×1), etc.
 */
export function getDirectionalRect(
  start: Position,
  direction: Direction,
  width: number,
  length: number
): Position[] {
  const positions: Position[] = [];
  const seen = new Set<string>();
  const dir = DIRECTION_VECTORS[direction];

  // Determine the perpendicular direction for width
  const perpDcol = -dir.drow;  // rotate 90° counterclockwise
  const perpDrow = dir.dcol;

  const halfWidth = Math.floor(width / 2);

  for (let l = 0; l < length; l++) {
    const basCol = start.col + dir.dcol * l;
    const basRow = start.row + dir.drow * l;

    for (let w = -halfWidth; w <= halfWidth; w++) {
      const pos: Position = {
        col: basCol + perpDcol * w,
        row: basRow + perpDrow * w,
      };
      const key = `${pos.col},${pos.row}`;
      if (isInBounds(pos) && !seen.has(key)) {
        seen.add(key);
        positions.push(pos);
      }
    }
  }

  return positions;
}

/**
 * Ring region — border of an NxN square (excludes interior).
 * Used by some effect AoE that only targets the perimeter.
 */
export function getRingRegion(center: Position, size: number): Position[] {
  const positions: Position[] = [];
  const halfSize = Math.floor(size / 2);

  for (let drow = -halfSize; drow <= halfSize; drow++) {
    for (let dcol = -halfSize; dcol <= halfSize; dcol++) {
      // Only include border cells
      if (Math.abs(drow) === halfSize || Math.abs(dcol) === halfSize) {
        const pos: Position = { col: center.col + dcol, row: center.row + drow };
        if (isInBounds(pos)) {
          positions.push(pos);
        }
      }
    }
  }

  return positions;
}

/**
 * Check if a position is within a region.
 */
export function isInRegion(pos: Position, region: Position[]): boolean {
  return region.some(p => p.col === pos.col && p.row === pos.row);
}
