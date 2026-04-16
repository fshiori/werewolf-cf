# Werewolf-CF Parity Master Roadmap

**Date:** 2026-04-16  
**Reference:** `~/workspaces/ref/diam1.3.61.kz_Build0912`  
**Target:** `~/workspaces/werewolf-cf`

---

## 1. 目標

把 Werewolf-CF 與參照組在「實際可用功能」上拉齊，分成 P0/P1/P2 三階段推進，優先保證：

1) 遊戲主流程可用且語義一致  
2) 房間/權限/密碼安全閉環  
3) UI 與 API 對齊，避免只做半套

---

## 2. 階段與交付

## P0（核心可玩性 + 安全閉環）
- 房間選項語義落地（非僅儲存字串）
- 私人房建立/加入/查詢一致，後端權威驗證
- 夜晚行動最小閉環（wolf/seer/guard）

**詳細計畫：** `docs/plans/2026-04-16-p0-parity-implementation-plan.md`

## P1（主要功能 parity）
- Trip 註冊/驗證流程（對齊 `trip.php` 使用情境）
- 缺頁面補齊（list/script-info/icon-view/icon-upload）
- 刪房 API 真實實作（非 stub）
- 規則/版本/統計頁串接到真實資料源

**詳細計畫：** `docs/plans/2026-04-16-p1-parity-implementation-plan.md`

## P2（進階規則與產品完整度）
- 密語權限細則（非目前寬鬆條件）
- 勝利條件與結算訊息擴展（妖狐/戀人/特殊角色）
- GM/村長治理流程
- 多語系（lang parity）

**詳細計畫：** `docs/plans/2026-04-16-p2-parity-implementation-plan.md`

---

## 3. 里程碑檢核

### Milestone A（P0 完成）
- 私人房不能繞過密碼
- 夜晚 action 可操作且能結算
- 全測試綠燈

### Milestone B（P1 完成）
- 主要參照頁面有等價入口
- Trip 流程可獨立使用
- 房間生命週期 API 完整

### Milestone C（P2 完成）
- 進階規則語義接近參照組
- 權限/管理功能可運維
- i18n 可擴充

---

## 4. 實施原則

- 一律 TDD（先失敗測試，再最小實作）
- 單一 task 小步快跑（2–5 分鐘）
- 每 task 可獨立 commit
- 不在同一 PR 混 P0/P1/P2
- 對外行為改動必補 UT + route integration test

---

## 5. 風險與緩解

1) **前後端語義漂移**：以 typed contract + fixture test 固定
2) **DO 與 D1 同步錯位**：關鍵流程加一致性斷言
3) **夜晚規則回歸**：補齊夜晚 action matrix tests
4) **密碼邏輯漏洞**：避免前端驗證作為權威；後端統一驗證

---

## 6. 交接建議（給實作者）

- 先完整做完 P0，再評估上 P1
- 每個 task 完成後跑最小測試，再跑全測
- 每個 phase 完成都附 changed-files impact summary
