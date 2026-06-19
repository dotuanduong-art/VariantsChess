"use strict";
// ============================================================
// Move Modifier — Interface for modifying legal move sets
// ============================================================
//
// A MoveModifier receives the current set of legal moves for a
// piece and returns a (possibly filtered/expanded) set.
// Modifiers are registered with MoveModifierChain and executed
// in priority order (lower = earlier).
//
// Examples:
//   - Bind effect: removes moves beyond N squares from current position
//   - Mountain cell: adds/removes squares in mountain terrain
//   - Stun effect: returns empty array (piece can't move)
//   - Walker effect: removes ability to capture King
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=MoveModifier.js.map