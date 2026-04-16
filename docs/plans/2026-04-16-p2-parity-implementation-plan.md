# Werewolf-CF P2 Parity Implementation Plan

> **Goal:** 補齊進階規則與管理能力，使行為語義更接近參照組。

**Scope:** 密語權限、勝利條件、GM/村長治理、多語系。

---

## Task 1: 密語權限規則化（替換 TODO）

**Files**
- Modify: `src/utils/whisper-manager.ts`
- Modify: `public/game.html`（只顯示可用對象）
- Test: `src/utils/__tests__/whisper-manager.test.ts`

**Steps**
1. 定義角色×階段權限矩陣。
2. 先寫失敗測試（夜晚/白天、不同角色）。
3. 實作 `canWhisper` 完整規則。
4. 前端同步 gating。
5. commit。

---

## Task 2: 勝利條件與結算訊息擴展

**Files**
- Modify: `src/utils/role-system.ts`
- Modify: `src/room/complete-room.ts`
- Modify: `public/game.html`
- Test: `src/__tests__/role-system.test.ts`, `src/room/__tests__/complete-room.test.ts`

**Steps**
1. 定義 victory matrix（human/wolf/fox/lovers/special）。
2. 寫失敗測試（邊界場景）。
3. 實作勝利判定與 UI 訊息。
4. commit。

---

## Task 3: GM/村長治理流程（最小可用版）

**Files**
- Modify: `src/routes/admin.ts`
- Modify: `src/room/complete-room.ts`
- Modify: `public/manage.html`, `public/game.html`
- Test: `src/routes/__tests__/admin.test.ts`

**Steps**
1. 定義 GM/host 權限（開始/踢人/強制結束）。
2. 先寫失敗測試。
3. 實作後端權限判定。
4. 前端只顯示授權操作。
5. commit。

---

## Task 4: 多語系骨架（lang parity）

**Files**
- Create: `public/i18n/zh-TW.json`, `public/i18n/ja-JP.json`, `public/i18n/en-US.json`
- Modify: `public/index.html`, `public/game.html`（抽字串）
- Optional: `src/routes/i18n.ts`

**Steps**
1. 先抽共用 UI 字串。
2. 寫最小 i18n loader。
3. 支援 query/cookie 語言切換。
4. commit。

---

## Task 5: 規則一致性回歸套件

**Files**
- Create: `src/__tests__/parity-rules-regression.test.ts`

**Steps**
1. 把 P2 關鍵規則轉成 fixture 測試。
2. 加入 CI 路徑（若有）。
3. commit。

---

## Final Check

- [ ] 密語權限不再 TODO
- [ ] 勝利條件可覆蓋主要陣營與特殊角色
- [ ] GM/村長核心治理可用
- [ ] 基礎 i18n 可切換
- [ ] 回歸測試可長期保護規則
