# Nephalem Variant Implementation Plan

This implementation plan details the engine upgrades, new effects, new components, and testing strategies required to implement the **Nephalem** variant.

## Bối cảnh & Mục tiêu
Implement variant **Nephalem** với các yêu cầu:
1. Engine Upgrade: Hỗ trợ `targetType: 'player'` cho Effect system.
2. 2 Effect mới: `Berserk` (piece-level) và `Silence` (player-level).
3. Passive và các kỹ năng của Nephalem:
   - **Passive – Fallen Grace**: Nhận +4 AP mỗi khi số quân đồng minh chết đạt bội số của 3.
   - **Skill 1 – Judgment Chains (5 AP)**: Stun 1 quân địch (không thể target King) trong 2 rounds (4 turns).
   - **Skill 2 – Berserk Curse (4 AP)**: Áp dụng Berserk lên 1 quân địch. Nếu quân đó không capture trong 2 rounds, bị stun 3 rounds (6 turns).
   - **Ultimate – Divine Silence (8 AP)**: Silence đối thủ trong 3 rounds (6 turns), chặn dùng skill.

---

## Phần 1: Engine Upgrade — `targetType: 'player'`

### 1A. [Modify] [Effect.ts](file:///d:/Variants/packages/game-core/src/effect/Effect.ts)
- Cập nhật union `targetType` trong interface `Effect`:
  ```typescript
  targetType: 'piece' | 'cell' | 'player';
  ```
- Khi `targetType === 'player'`: `targetId` sẽ là `Color` ('white' | 'black') thay vì `pieceId` hoặc position string.

### 1B. [Modify] [GameState.ts](file:///d:/Variants/packages/game-core/src/state/GameState.ts)
- Thêm lưu trữ các player effects vào class `GameState` và interface `SerializedGameState`:
  ```typescript
  whitePlayerEffects: Effect[];
  blackPlayerEffects: Effect[];
  ```
- Khởi tạo hai mảng này là `[]` trong constructor của `GameState`.
- Bổ sung helper methods trên `GameState`:
  ```typescript
  getPlayerEffects(player: Color): Effect[] {
    return player === Color.White ? this.whitePlayerEffects : this.blackPlayerEffects;
  }

  addPlayerEffect(player: Color, effect: Effect): void {
    const effects = this.getPlayerEffects(player);
    const existingIdx = effects.findIndex(e => e.type === effect.type);
    if (existingIdx !== -1) {
      const existing = effects[existingIdx];
      if (effect.stackingRule === 'refresh') {
        existing.remainingDuration = effect.duration;
      } else if (effect.stackingRule === 'stack') {
        existing.stackCount = (existing.stackCount || 1) + 1;
        existing.remainingDuration = effect.duration;
      }
    } else {
      effects.push(effect);
    }
  }

  removePlayerEffect(player: Color, effectId: string): void {
    const effects = player === Color.White ? this.whitePlayerEffects : this.blackPlayerEffects;
    const idx = effects.findIndex(e => e.id === effectId);
    if (idx !== -1) {
      effects.splice(idx, 1);
    }
  }
  ```
- Cập nhật `toSerializable()`, `fromSerializable(data)`, và `serializeForPlayer(player)` để serialize/deserialize `whitePlayerEffects` và `blackPlayerEffects`.
  > [!NOTE]
  > Player effects không nhạy cảm (không ẩn đối với đối thủ), do đó `serializeForPlayer` sẽ truyền nguyên vẹn cả hai mảng player effects sang client.

### 1C. [Modify] [EffectRegistry.ts](file:///d:/Variants/packages/game-core/src/effect/EffectRegistry.ts)
- Cập nhật `getAllActiveEffects(state)` để thu thập thêm player-level effects:
  ```typescript
  effects.push(...state.whitePlayerEffects);
  effects.push(...state.blackPlayerEffects);
  ```
  Điều này giúp cho các player effects có thể tick duration tự động hoặc phản hồi các events qua `EventBus`.

### 1D. [Modify] [ActionPipeline.ts](file:///d:/Variants/packages/game-core/src/action/ActionPipeline.ts)
- **Xử lý TICK_EFFECTS**:
  Trong case `TICK_EFFECTS`, khi duyệt qua các active effects, nếu gặp `effect.targetType === 'player'`:
  ```typescript
  if (effect.targetType === 'player') {
    if (effect.targetId !== action.player) {
      continue; // Chỉ tick khi kết thúc/bắt đầu lượt của player bị dính effect
    }
  }
  ```
- **Xử lý APPLY_EFFECT**:
  Thêm case support `effect.targetType === 'player'`:
  ```typescript
  } else if (effect.targetType === 'player') {
    const targetColor = effect.targetId as Color;
    this.state.addPlayerEffect(targetColor, effect);
  }
  ```
- **Xử lý REMOVE_EFFECT**:
  Bổ sung quét mảng player effects nếu chưa tìm thấy ở piece/cell effects:
  ```typescript
  if (!removed) {
    for (const color of [Color.White, Color.Black]) {
      const effects = this.state.getPlayerEffects(color);
      const idx = effects.findIndex(e => e.id === effectId);
      if (idx !== -1) {
        this.state.removePlayerEffect(color, effectId);
        removed = true;
        break;
      }
    }
  }
  ```
- **Chặn kỹ năng khi bị Silence**:
  Trong `ActionPipeline.submitAction` hoặc `SkillValidator.validate`, chặn action `USE_SKILL` nếu player thực hiện có active effect `silence`:
  ```typescript
  const playerEffects = state.getPlayerEffects(action.player);
  const isSilenced = playerEffects.some(e => e.type === 'silence');
  if (isSilenced) {
    return 'Player is silenced and cannot use skills';
  }
  ```
  *(Vì passive hooks đăng ký trực tiếp trên EventBus thay vì chạy qua USE_SKILL action, nên passive sẽ tự động không bị ảnh hưởng bởi Silence.)*

### 1E. [Modify] [Action.ts](file:///d:/Variants/packages/game-core/src/action/Action.ts)
- Cập nhật union `targetType` trong `RemoveEffectAction` để bao gồm `'player'`:
  ```typescript
  export interface RemoveEffectAction {
    type: 'REMOVE_EFFECT';
    effectId: string;
    targetId: string;
    targetType: 'piece' | 'cell' | 'player';
    reason: string;
  }
  ```

---

## Phần 2: New Effects

### 2A. Berserk Effect (Piece-level)
- **metadata structure**:
  ```typescript
  metadata: {
    captureCountdown: number;     // Bắt đầu bằng 4. Giảm 1 khi bắt đầu lượt tiếp theo của quân đó
    capturedThisWindow: boolean;  // Đánh dấu đã capture thành công
  }
  ```
- **BerserkHandler**:
  - Đăng ký nhận sự kiện `OnTurnStart` và `OnCapture`.
  - **OnTurnStart**:
    Khi bắt đầu lượt của `activePlayer`, tìm các piece thuộc player này có Berserk effect:
    1. Giảm `metadata.captureCountdown -= 1`.
    2. Nếu `captureCountdown <= 0`:
       - Nếu `capturedThisWindow === false`:
         - Enqueue `APPLY_EFFECT(stun, duration: 6, target: piece)` (Stun 3 rounds = 6 turns).
         - Enqueue `REMOVE_EFFECT(berserk, target: piece)`.
       - Nếu `capturedThisWindow === true`:
         - Reset `captureCountdown = 4`.
         - Reset `capturedThisWindow = false`.
  - **OnCapture**:
    Lấy `attackerId` và vị trí `to` từ event payload. Nếu piece tại `to` có Berserk effect:
    1. Đánh dấu `metadata.capturedThisWindow = true`.
    2. Reset `captureCountdown = 4` và `capturedThisWindow = false` để chuẩn bị cho window mới.
    
    > [!NOTE]
    > **Thiết kế Mutation**: Engine hiện tại không có action `UPDATE_EFFECT`. Dựa trên pattern đã có ở `ShieldHandler.ts`, ta sẽ mutate trực tiếp `effect.metadata` ngay trong handler. Điều này giúp code gọn gàng, giảm tải cho pipeline mà vẫn đảm bảo đồng bộ state.

### 2B. Silence Effect (Player-level)
- **SilenceHandler**:
  - Không cần lắng nghe event nào.
  - Được đăng ký vào `EffectRegistry` để pipeline nhận diện và validate action `USE_SKILL` (chặn cast skill).

---

## Phần 3: New Components

### 3A. NephalemPassiveHandler
- Đăng ký nhận sự kiện `OnPieceDestroyed`.
- Lắng nghe xem piece bị destroy có trùng màu với Nephalem Player hay không:
  ```typescript
  const piece = event.payload.pieceSnapshot;
  if (piece.color === nephalemPlayerColor) {
    // Đếm tổng số quân đồng minh đã vào Graveyard của Nephalem player
    const count = state.graveyard.filter(entry => entry.piece.color === nephalemPlayerColor).length;
    // Do quân hiện tại chưa được push vào graveyard (ADD_TO_GRAVEYARD chạy sau OnPieceDestroyed),
    // tổng số quân sau khi chết sẽ là count + 1
    const newCount = count + 1;
    if (newCount % 3 === 0) {
      enqueueAction({
        type: 'GAIN_AP',
        player: nephalemPlayerColor,
        amount: 4,
        source: 'passive',
      });
    }
  }
  ```

### 3B. [NEW] [NephalemVariant.ts](file:///d:/Variants/packages/game-core/src/variant/variants/NephalemVariant.ts)
Định nghĩa `NephalemVariant` chứa:
- `id: 'nephalem'`
- `effectHandlers: [new BerserkHandler(), new SilenceHandler()]`
- `passiveHooks`: Đăng ký `NephalemPassiveHandler` cho player chọn variant này.
- `skills`:
  - **Skill 1 – Judgment Chains (5 AP)**:
    - `getTargetRequirements`: Target `piece`, filter `enemy`, `excludeKing: true`.
    - `canActivate`: Validate target không phải là King và thuộc đối thủ.
    - `execute`: Trả về action `APPLY_EFFECT(stun, duration: 4, target: enemy piece)`.
  - **Skill 2 – Berserk Curse (4 AP)**:
    - `getTargetRequirements`: Target `piece`, filter `enemy`.
    - `execute`: Trả về action `APPLY_EFFECT(berserk, duration: null, metadata: { captureCountdown: 4, capturedThisWindow: false })`.
  - **Ultimate – Divine Silence (8 AP)**:
    - `getTargetRequirements`: Không có (auto-target đối thủ).
    - `execute`: Tìm đối thủ `opponent = oppositeColor(player)` và trả về action `APPLY_EFFECT(silence, targetType: 'player', targetId: opponent, duration: 6)`.

---

## Phần 4: Migration Checklist

```
Engine upgrades:
  □ [Effect.ts](file:///d:/Variants/packages/game-core/src/effect/Effect.ts) — Thêm 'player' vào targetType union
  □ [GameState.ts](file:///d:/Variants/packages/game-core/src/state/GameState.ts) — Thêm whitePlayerEffects, blackPlayerEffects + helpers + update serialization
  □ [EffectRegistry.ts](file:///d:/Variants/packages/game-core/src/effect/EffectRegistry.ts) — Cập nhật getAllActiveEffects bao gồm player effects
  □ [Action.ts](file:///d:/Variants/packages/game-core/src/action/Action.ts) — Cập nhật RemoveEffectAction targetType union
  □ [ActionPipeline.ts](file:///d:/Variants/packages/game-core/src/action/ActionPipeline.ts) — Xử lý player effects trong APPLY_EFFECT, REMOVE_EFFECT, TICK_EFFECTS, chặn USE_SKILL khi Silenced

New files:
  □ [BerserkHandler.ts](file:///d:/Variants/packages/game-core/src/effect/handlers/BerserkHandler.ts) — Logic countdown và trigger stun/remove
  □ [SilenceHandler.ts](file:///d:/Variants/packages/game-core/src/effect/handlers/SilenceHandler.ts) — Empty stub hoặc logic phụ trợ nếu cần
  □ [NephalemVariant.ts](file:///d:/Variants/packages/game-core/src/variant/variants/NephalemVariant.ts) — Skill definitions & passive hook
  □ [allVariants.ts](file:///d:/Variants/packages/game-core/src/variant/allVariants.ts) — Đăng ký NephalemVariant

Frontend integration:
  □ [Piece.tsx](file:///d:/Variants/apps/frontend/src/components/Piece.tsx) — Kiểm tra visual filters cho 'berserk' và 'silence' (đã có sẵn)
  □ [Square.tsx](file:///d:/Variants/apps/frontend/src/components/Square.tsx) — Thêm countdown badge màu đỏ nhỏ góc trên bên phải piece khi bị Berserk
  □ [Board.tsx](file:///d:/Variants/apps/frontend/src/components/Board.tsx) — Hiển thị captureCountdown cho Berserk trong context menu khi right-click
  □ [GameRightPanel.tsx](file:///d:/Variants/apps/frontend/src/components/GameRightPanel.tsx) — Hiển thị tag "SILENCED" màu tím neon lung linh nổi bật tại panel của đối thủ khi họ bị Silence.
```

---

## Phần 5: Test Plan

Viết test suite mới tại `apps/backend/src/game-core-nephalem.spec.ts` sử dụng Jest để đảm bảo các logic hoạt động chính xác trước khi ghép nối frontend.

### Engine Upgrade Tests
- **U1**: `APPLY_EFFECT` với `targetType: 'player'` → effect xuất hiện trong `state.getPlayerEffects(color)`.
- **U2**: Player effect tự động tick giảm duration vào cuối turn của player bị dính effect (`turnEnd`).
- **U3**: Action `USE_SKILL` bị validator từ chối (reject) và trả về lỗi nếu player đang có effect `silence`.
- **U4**: Player bị `silence` vẫn kích hoạt passive bình thường (vì passive chạy qua event bus chứ không phải action pipeline `USE_SKILL`).
- **U5**: `serializeForPlayer` trả về mảng player effects đầy đủ của cả 2 bên.

### Nephalem Variant Tests
- **N1 (Passive)**: Mỗi khi có quân đồng minh bị captured/destroyed đạt bội số của 3 → Nephalem Player nhận +4 AP.
- **N2 (Passive)**: Trực tiếp kiểm tra mốc tích lũy (ví dụ: mất 3 quân → +4 AP, mất 6 quân → nhận tiếp +4 AP).
- **N3 (Passive)**: Quân của đối thủ chết không làm tăng đếm tích lũy của Nephalem.
- **N4 (Skill 1)**: Judgment Chains áp dụng Stun lên enemy piece thành công với duration = 4. King đối thủ không thể bị chọn làm target.
- **N5 (Skill 2 - Berserk Stun)**: Áp dụng Berserk Curse lên enemy piece, nếu piece đó không thực hiện capture nào trong vòng 4 turns của nó → tự động kích hoạt Stun 6 turns và remove Berserk.
- **N6 (Skill 2 - Berserk Keep)**: Nếu enemy piece thực hiện capture thành công → countdown reset về 4 turns và giữ nguyên trạng thái Berserk.
- **N7 (Skill 2 - Berserk + Stun)**: Nếu piece đang bị Berserk và đồng thời bị Stun khác đè lên (không thể capture) → hết stun trước, nếu countdown Berserk hết sau đó mà vẫn chưa capture → kích hoạt Stun mới.
- **N8 (Ultimate)**: Kích hoạt Divine Silence áp dụng Silence thành công lên đối thủ trong 6 turns.
- **N9 (Ultimate)**: Đối thủ bị Silence không thể dùng bất cứ skill nào khác nhưng quân cờ vẫn di chuyển bình thường.
- **N10 (Ultimate)**: Silence không xóa bỏ hoặc làm gián đoạn effect Berserk đang hoạt động trước đó trên quân đối thủ.

---

## Phần 6: Implementation Order

1. **Bước 1**: Thực hiện **Engine Upgrades** (thêm mảng player effects vào state, xử lý lưu trữ, serialization, duration ticks, và validator chặn skills khi Silenced).
2. **Bước 2**: Khai báo các handler mới `BerserkHandler` và `SilenceHandler`.
3. **Bước 3**: Khai báo `NephalemVariant` và đăng ký trong `allVariants.ts`.
4. **Bước 4**: Viết toàn bộ file test suite `game-core-nephalem.spec.ts` (các test U1-U5 và N1-N10) và chạy thử để thấy tất cả đều báo đỏ (TDD).
5. **Bước 5**: Hoàn thiện code logic ở các handler và variant để test chuyển xanh 100%.
6. **Bước 6**: Ghép nối giao diện (frontend) gồm hiển thị badge countdown cho Berserk, visual indicator cho Silence ở panel, và chạy thử liên kết đầy đủ.
