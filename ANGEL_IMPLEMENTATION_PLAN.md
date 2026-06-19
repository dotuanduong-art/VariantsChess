# Angel Variant Implementation Plan

Introduce the new **Angel Variant** into the Chess Variants game. This includes setting up its backend passive and active skills, adding custom effect handlers for Blessing and Divine Judgment, updating the frontend visual representation, and adding comprehensive test coverage.

## Engine Analysis

### A. Blessing instant execute
**Proposed implementation:** We will cast Blessing via a standard `APPLY_EFFECT` action of type `'blessing'` with `duration: 0`.
A dedicated `BlessingHandler` registers for `OnEffectApplied`.
- If the target piece has any active debuffs (`isDebuff === true`), it enqueues `REMOVE_EFFECT` for all of them.
- If it does not, it enqueues `APPLY_EFFECT` for a `shield` (duration = 2, which corresponds to 1 round / 2 turns).
- In both cases, it enqueues `REMOVE_EFFECT` for the `'blessing'` effect itself.
This approach leverages the native duration-less cleanup flow, triggers frontend and event-bus hook callbacks, and encapsulates the logic cleanly within a stateless handler.

### B. Divine Judgment — "Judgment Window" state
**Proposed implementation:** The active state and turns remaining will be tracked in `variantState` using separate keys per player to handle potential mirror match collisions:
- `variantState.judgmentWindowActive_${player}` (boolean, default false)
- `variantState.judgmentWindowRemainingTurns_${player}` (number, default 0)

### C. Divine Judgment — execute "sau khi hết window"
**Proposed implementation:** The `JudgmentHandler` will subscribe to `OnTurnEnd`.
- Decrement `judgmentWindowRemainingTurns_${color}` for any player with active window.
- When it reaches 0, set active to `false` and enqueue `DESTROY_PIECE` actions for all pieces on the board carrying a `judgment_mark` sourced by that player.
Yes, the engine fully supports enqueuing actions from `OnTurnEnd` passive/event hook handlers; they are added to the action queue and drained as part of the normal `submitAction` pipeline.

### D. 'judgment_mark' effect
**Proposed implementation:** `'judgment_mark'` will be a standard piece-level effect with `duration: null` and `isDebuff: false`.
- Because it is placed in `piece.effects`, when the piece is captured or destroyed, it naturally disappears along with the piece.
- Since `isDebuff` is false, it is not cleansed by Blessing.
- Since the reason of destruction at window end is `'judgment'` (which is not `'capture'`), `ShieldHandler` will not intercept/cancel the destruction, satisfying the absolute destruction requirement.

---

## Proposed Changes

### Game Core (Backend Engines)

#### [MODIFY] [Effect.ts](file:///d:/Variants/packages/game-core/src/effect/Effect.ts)
- Add `'judgment_mark'` to the `EffectType` union type.

#### [NEW] [BlessingHandler.ts](file:///d:/Variants/packages/game-core/src/effect/handlers/BlessingHandler.ts)
- Implement `EffectHandler` for the `'blessing'` effect.
- Subscribes to `OnEffectApplied`.
- If the target piece has any effects with `isDebuff === true`, it enqueues `REMOVE_EFFECT` for all of them.
- If it has no debuffs, it enqueues `APPLY_EFFECT` for a `shield` (duration = 2).
- In both cases, enqueues `REMOVE_EFFECT` for the `blessing` effect itself.

#### [NEW] [JudgmentHandler.ts](file:///d:/Variants/packages/game-core/src/effect/handlers/JudgmentHandler.ts)
- Implement `EffectHandler` for `'judgment_mark'`.
- Subscribes to `OnCapture` and `OnTurnEnd`.
- **OnCapture:** If the active player's opponent has `judgmentWindowActive_${opponent}` set to `true` in `variantState`, apply the `'judgment_mark'` effect to the capturing piece (`attackerId`).
- **OnTurnEnd:** Decrement `judgmentWindowRemainingTurns_${color}` for any player that has `judgmentWindowActive_${color}` active. If it reaches 0, set active to false and enqueue `DESTROY_PIECE` actions for all pieces on the board carrying a `judgment_mark` sourced by that player.

#### [NEW] [AngelVariant.ts](file:///d:/Variants/packages/game-core/src/variant/variants/AngelVariant.ts)
- Define `AngelVariant` object implementing `VariantDefinition`.
- `skills`:
  - `Holy Seal` (Tier 1, 6 AP): Stuns target enemy piece (excludeKing: true) for 6 turns (3 rounds).
  - `Blessing` (Tier 2, 4 AP): Targets ally piece, applies `'blessing'` effect.
  - `Divine Judgment` (Ultimate, 14 AP): Targets nothing, sets `judgmentWindowActive_${player} = true` and `judgmentWindowRemainingTurns_${player} = 10` in `variantState`.
- `passiveHooks`:
  - `OnPieceDestroyed`: If an ally piece (excluding King) is destroyed by any cause, grant the player +2 AP.
- `effectHandlers`: Registers `new BlessingHandler()` and `new JudgmentHandler()`.
- `getInitialState`: Initializes `judgmentWindowActive_White`, `judgmentWindowRemainingTurns_White`, `judgmentWindowActive_Black`, `judgmentWindowRemainingTurns_Black`.

#### [MODIFY] [allVariants.ts](file:///d:/Variants/packages/game-core/src/variant/allVariants.ts)
- Import `AngelVariant` and add it to the `ALL_VARIANTS` array.

---

### Frontend

#### [MODIFY] [variantsData.ts](file:///d:/Variants/apps/frontend/src/lib/variantsData.ts)
- Add the `angel` variant details to `VARIANTS_LIST` with appropriate role ('Strategist'), difficulty (3), artwork emoji '👼', descriptions, and costs/durations for its skills.

#### [MODIFY] [Piece.tsx](file:///d:/Variants/apps/frontend/src/components/Piece.tsx)
- Add `'judgment_mark'` to `EffectKey`.
- Define styling for `judgment_mark` in `EFFECTS` (e.g. a golden glow drop-shadow: `drop-shadow(0px 0px 8px rgba(253, 224, 71, 0.95)) brightness(1.2) sepia(10%) saturate(1.4)`).

#### [MODIFY] [ActionBar.tsx](file:///d:/Variants/apps/frontend/src/components/ActionBar.tsx)
- Update `getResourceValue` to return `Jdg ${variantState[`judgmentWindowRemainingTurns_${playerColor}`]}` if your variant is `'angel'` and the judgment window is active.

#### [MODIFY] [GameRightPanel.tsx](file:///d:/Variants/apps/frontend/src/components/GameRightPanel.tsx)
- Update `getOpponentResourceValue` to return `Jdg ${variantState[`judgmentWindowRemainingTurns_${opponentColorColor}`]}` if opponent's variant is `'angel'` and their judgment window is active.

---

### Unit Tests

#### [NEW] [game-core-angel.spec.ts](file:///d:/Variants/apps/backend/src/game-core-angel.spec.ts)
- Write tests A1 through A17 to thoroughly test all features of the Angel Variant:
  - **A1-A3:** Passive Heavenly Grace checks (ally deaths, enemy deaths, exclude King).
  - **A4-A5:** Holy Seal targets and stun duration.
  - **A6-A9:** Blessing cleansing and shielding scenarios.
  - **A10-A17:** Divine Judgment active mark application, turn end ticking, absolute destruction bypassing shields, King death win condition, and window cleanup.

## Verification Plan

### Automated Tests
Run unit tests in the backend to ensure correct logic and no regressions:
```bash
npm -w apps/backend run test src/game-core-angel.spec.ts
```

### Manual Verification
- Start the server (`npm run dev`) and test selecting the Angel variant in a mock draft.
- Cast Holy Seal, Blessing, and Divine Judgment.
- Verify the `Jdg` window countdown appears on the variant portrait in the ActionBar and GameRightPanel.
- Verify pieces receive a golden drop-shadow when marked by Judgment.
