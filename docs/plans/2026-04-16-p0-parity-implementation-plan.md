# Werewolf-CF P0 Parity Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 補齊目前與 `diam1.3.61.kz_Build0912` 相比最關鍵的 P0 落差：房間選項語義、私人房密碼閉環、夜晚行動閉環。

**Architecture:** 保持現有 Hono + Durable Object 架構，避免大改。把「房間建立輸入」做成明確 schema，DO 內轉成 typed options；前端只負責 UI 與顯示，權限/驗證以後端為準。

**Tech Stack:** Cloudflare Workers, Hono, Durable Objects, D1, Vitest。

---

## Scope (P0 only)

1. `gameOption` 真正生效（不再只是字串保存）
2. 私人房密碼：建立/加入/查詢一致
3. 夜晚行動最小可用：`wolf_kill`, `seer_divine`, `guard`（含前端觸發）

---

## Task 1: 建立 RoomOptions 型別與解析器

**Objective:** 讓 API 與 DO 共用一致的房間選項資料結構。

**Files:**
- Create: `src/types/room-options.ts`
- Modify: `src/types/index.ts`（引用型別，避免重複定義）
- Test: `src/__tests__/room-options.test.ts`

**Step 1: Write failing test**
- 測 `parseRoomOptions()` 能處理：
  - 合法 payload
  - 缺漏欄位 fallback
  - 非法數值（timeLimit）

**Step 2: Run test to verify failure**
- Run: `npm test -- --run src/__tests__/room-options.test.ts`
- Expected: FAIL（檔案/函式不存在）

**Step 3: Write minimal implementation**
- `RoomOptions` 先定義：
  - `timeLimit`, `silenceMode`, `allowSpectators`, `maxSpectators`
  - `dummyBoy`, `wishRole`, `openVote`, `dellook`, `will`, `voteMe`, `tripRequired`
- 提供：
  - `DEFAULT_ROOM_OPTIONS`
  - `parseRoomOptions(input: unknown): RoomOptions`

**Step 4: Run test to verify pass**
- Run: `npm test -- --run src/__tests__/room-options.test.ts`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/types/room-options.ts src/types/index.ts src/__tests__/room-options.test.ts
git commit -m "feat: add typed room options parser"
```

---

## Task 2: API 建房輸入改為 typed options 並落 DB 欄位

**Objective:** `/api/rooms` 正確寫入 `is_private/password/time_limit/silence_mode` 並保存 options。

**Files:**
- Modify: `src/routes/api.ts`
- Modify: `src/room/complete-room.ts`（`/init` payload）
- Test: `src/routes/__tests__/api.test.ts`

**Step 1: Write failing test**
- `POST /api/rooms` with `password/options`：
  - response success
  - room list 可見 `is_private/time_limit/silence_mode`

**Step 2: Run test to verify failure**
- Run: `npm test -- --run src/routes/__tests__/api.test.ts`
- Expected: FAIL（目前未處理這些欄位）

**Step 3: Write minimal implementation**
- API 建房時：
  - 接收 `roomPassword`（或統一 `password`）
  - `is_private = password ? 1 : 0`
  - `time_limit/silence_mode` 從 `RoomOptions` 寫入
- DO `/init` payload 增加 `roomOptions`, `isPrivate`, `passwordHash?`
  - 密碼不要明文落 public 回傳

**Step 4: Run test to verify pass**
- Run: `npm test -- --run src/routes/__tests__/api.test.ts`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/routes/api.ts src/room/complete-room.ts src/routes/__tests__/api.test.ts
git commit -m "feat: persist private-room and room option fields on create"
```

---

## Task 3: `/api/rooms/:roomNo/join` 改為後端密碼驗證（權威）

**Objective:** 不能只靠前端檢查，加入房間時由後端驗證密碼。

**Files:**
- Modify: `src/routes/api.ts`
- Test: `src/routes/__tests__/api.test.ts`

**Step 1: Write failing test**
- 私人房：
  - 無密碼 -> 403
  - 密碼錯誤 -> 403
  - 密碼正確 -> success

**Step 2: Run test to verify failure**
- Run: `npm test -- --run src/routes/__tests__/api.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- join route 讀 room 設定與 private flag
- 以 DB/DO 儲存的 hash 比對
- 回傳一致錯誤訊息（避免洩漏過多資訊）

**Step 4: Run test to verify pass**
- Run: `npm test -- --run src/routes/__tests__/api.test.ts`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/routes/api.ts src/routes/__tests__/api.test.ts
git commit -m "feat: enforce server-side private room password verification"
```

---

## Task 4: 調整 room info 回傳模型（不洩漏敏感）

**Objective:** 前端可知道 `is_private`，但不能拿到可直接比對的敏感資料。

**Files:**
- Modify: `src/utils/room-manager.ts`
- Modify: `src/room/complete-room.ts`
- Test: `src/room/__tests__/complete-room.test.ts`

**Step 1: Write failing test**
- `/info` 應包含 `isPrivate` / `timeLimit` 等可公開欄位
- 不應包含 `password` 或 hash

**Step 2: Run test to verify failure**
- Run: `npm test -- --run src/room/__tests__/complete-room.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- 擴充 `getPublicRoomInfo()`
- 僅回公開欄位

**Step 4: Run test to verify pass**
- Run: `npm test -- --run src/room/__tests__/complete-room.test.ts`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/utils/room-manager.ts src/room/complete-room.ts src/room/__tests__/complete-room.test.ts
git commit -m "feat: expose safe room metadata in public room info"
```

---

## Task 5: 夜晚行動前端最小 UI（狼人/預言家/獵人）

**Objective:** 前端可以送出 `night_action`，不再只有投票與發言。

**Files:**
- Modify: `public/game.html`
- Test: `tests/manual-test.ts`（補 smoke 流程）

**Step 1: Write failing test/assertion**
- 在 `manual-test.ts` 或前端最小測試加入：
  - phase=night 時按鈕顯示
  - 點擊送出 websocket payload `{type:'night_action', action, target}`

**Step 2: Verify current behavior fails**
- Run: `npm test -- --run tests/manual-test.ts`
- Expected: FAIL or missing behavior

**Step 3: Write minimal implementation**
- `game.html` 新增夜晚操作區：
  - 狼人：`wolf_kill`
  - 預言家：`seer_divine`
  - 獵人（若死亡觸發）：`guard_shoot`（可先只做 alive guard placeholder）
- `ws.send` 對應 action payload

**Step 4: Run verification**
- Run: `npm test -- --run`
- Expected: PASS（至少既有測試不回歸）

**Step 5: Commit**
```bash
git add public/game.html tests/manual-test.ts
git commit -m "feat: add minimal night action UI and websocket actions"
```

---

## Task 6: 後端補 guard 邏輯 TODO + 行動完成判定

**Objective:** 夜晚結果能正確處理守護，避免 `TODO` 空洞。

**Files:**
- Modify: `src/utils/night-action.ts`
- Modify: `src/room/complete-room.ts`
- Test: `src/utils/__tests__/night-action.test.ts`

**Step 1: Write failing test**
- 守護成功時 `wolf_kill` 目標不死亡
- 守護無效時正常死亡

**Step 2: Run test to verify failure**
- Run: `npm test -- --run src/utils/__tests__/night-action.test.ts`
- Expected: FAIL

**Step 3: Write minimal implementation**
- 在 `NightState` 加 guarded target（或等價結構）
- `wolfKill` 檢查守護名單
- `complete-room.ts` 接 `guard` 類 action

**Step 4: Run test to verify pass**
- Run: `npm test -- --run src/utils/__tests__/night-action.test.ts`
- Expected: PASS

**Step 5: Commit**
```bash
git add src/utils/night-action.ts src/room/complete-room.ts src/utils/__tests__/night-action.test.ts
git commit -m "feat: implement guard protection in night action flow"
```

---

## Task 7: 全測試 + 回歸驗證

**Objective:** 確保 P0 改動不破壞現有功能。

**Files:**
- No new code required (only fixes if regression appears)

**Step 1: Run full test**
```bash
npm test -- --run
```
Expected: all pass

**Step 2: Manual smoke**
- 本地啟動後驗證：
  1. 建私人房（有密碼）
  2. 錯密碼加入被拒
  3. 正確密碼可加入
  4. 夜晚能送出 action

**Step 3: Commit (if any regression fixes)**
```bash
git add .
git commit -m "test: verify p0 parity flows and fix regressions"
```

---

## Final Validation Checklist

- [ ] `gameOption` 不再是無效字串保存
- [ ] 私人房密碼由後端驗證
- [ ] `/info` 不洩漏密碼資訊
- [ ] 夜晚行動可由前端發送並在後端生效
- [ ] `night-action.ts` 守護 TODO 消失
- [ ] `npm test -- --run` 全綠

---

## Notes (non-P0, intentionally deferred)

- `trip.php` 等價流程（Trip 註冊/綁定）
- `list.php`, `script_info.php`, `icon_view.php`, `icon_upload.php` 對應頁
- 完整 GM/村長/權限體系
- 密語權限細則與勝利條件擴展
