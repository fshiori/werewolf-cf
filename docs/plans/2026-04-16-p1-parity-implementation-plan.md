# Werewolf-CF P1 Parity Implementation Plan

> **Goal:** 補齊參照組主功能頁與主要流程落差，讓功能面接近可替代。

**Scope:** Trip 流程、缺頁面、刪房 API、頁面資料串接。

---

## Task 1: Trip 註冊/驗證 API（對齊 trip.php 使用情境）

**Files**
- Create: `src/routes/trip.ts`
- Modify: `src/routes/api.ts`（route mount）
- Modify: `src/utils/crypto.ts`（統一 trip hash/verify）
- Test: `src/routes/__tests__/trip.test.ts`

**Steps**
1. 先寫失敗測試：註冊 trip、重複註冊、驗證成功/失敗。
2. 實作 `POST /api/trip/register`、`POST /api/trip/verify`。
3. 正規化錯誤碼（400/409/401）。
4. 測試全綠後 commit。

---

## Task 2: `list.php` 等價頁（聯合列表）

**Files**
- Create: `public/list.html`
- Modify: `public/index.html`（導航）
- Modify: `src/routes/api.ts`（補列表查詢參數/排序）
- Test: `src/routes/__tests__/api.test.ts`

**Steps**
1. 先測 API 排序與狀態篩選。
2. 建 list.html（顯示等待/進行中房間）。
3. 加入房間入口與簡單篩選。
4. commit。

---

## Task 3: `script_info.php` 等價頁

**Files**
- Create: `public/script-info.html`
- Modify: `public/index.html`

**Steps**
1. 先上靜態資訊頁（版本、技術棧、已知限制）。
2. 若有 API metadata，補 `GET /api/meta` 並串接。
3. commit。

---

## Task 4: `icon_view.php` / `icon_upload.php` 等價頁

**Files**
- Create: `public/icon-view.html`
- Create: `public/icon-upload.html`
- Modify: `public/index.html`
- Verify existing API: `/api/icons`, `/icons/:filename`
- Test: `src/routes/__tests__/api.test.ts`

**Steps**
1. 寫 API 測試（列出 icon、取 icon、上傳限制）。
2. 完成 icon-view（gallery）。
3. 完成 icon-upload（檔案型別/大小前端驗證 + 後端回應處理）。
4. commit。

---

## Task 5: 刪房 API 實作（移除 TODO）

**Files**
- Modify: `src/routes/api.ts`（`DELETE /api/rooms/:roomNo`）
- Modify: `src/room/complete-room.ts`（cleanup endpoint 行為）
- Test: `src/routes/__tests__/api.test.ts`, `src/room/__tests__/complete-room.test.ts`

**Steps**
1. 寫失敗測試（刪房後 room/user/vote 關聯資料期望）。
2. 實作 route + DO cleanup 協作。
3. 回歸測試全綠。
4. commit。

---

## Task 6: 規則/版本/統計頁資料一致性

**Files**
- Modify: `public/rule.html`, `public/version.html`, `public/stats.html`
- Optional API: `GET /api/version`, `GET /api/rule-summary`
- Test: `src/routes/__tests__/api.test.ts`

**Steps**
1. 補齊靜態/動態欄位來源，不再硬編。
2. 測試 API 合約。
3. commit。

---

## Final Check

- [ ] Trip 註冊/驗證可獨立使用
- [ ] list/script-info/icon-view/icon-upload 可用
- [ ] 刪房 API 非 stub
- [ ] 全測試綠燈
