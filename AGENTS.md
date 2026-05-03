AGENTS.md - Werewolf Cloudflare Port Project
1. 專案目標 (Project Objective)
本專案致力於將 ref/diam1.3.61.kz_Build0912 的玩法與 UI 完全移植至 Cloudflare 生態系統。
目標是打造一個高效能、即時（Real-time）且 Serverless 的人狼遊戲平台。

2. 核心技術棧 (Target Tech Stack)
所有開發必須嚴格遵守以下技術選型：

Runtime: Cloudflare Workers (TypeScript)

Database (Persistence): Cloudflare D1

Real-time & State: Durable Objects (DO) + WebSockets

Storage (Assets): R2 Bucket

Configuration: Cloudflare KV

3. 參考檔案規範 (Reference Guidelines)
請參考 ref 目錄下的內容，但遵循以下規則：

ref/diam1.3.61.kz_Build0912 (UI/UX & Logic):

視覺標準：最後生成的 UI 必須與此版本的風格高度一致（HTML Table 佈局、配色、選單位置）。

遊戲邏輯：遊戲角色規則、階段轉換邏輯應以此版本為基準。

ref/werewolf-cf_v1 (Pre-alpha):

僅供參考基礎檔案結構。

注意：此版本存在大量缺失與錯誤，請勿直接複製其邏輯，應以重新實作為主。

4. 實作指令 (Implementation Instructions)
A. 通訊與狀態管理 (Durable Objects)
權威來源 (Source of Truth)：每場遊戲（Room）由一個獨立的 DO 實例維護。

即時通訊：必須使用 WebSocket 處理聊天訊息與遊戲指令。

自動化階段控制：利用 DO 的 alarms API 來處理遊戲階段的倒數計時（如：白天討論結束自動轉入黑夜）。

B. 資料持久化 (D1 & R2)
戰績與存檔：玩家資料、遊戲最終對局紀錄應寫入 D1。

靜態資源：玩家上傳的頭像或遊戲素材應存放於 R2。

C. UI/UX 開發
還原度：儘可能還原目標 PHP 版本的復古網頁風格。

組件化：儘管 UI 風格復古，但代碼層面應使用現代化的 TypeScript/Frontend 模組化開發。

5. Agent 協作限制 (Constraints)
禁止修改 ref/ 目錄下任何檔案。

安全性：所有 WebSocket 訊息必須在 DO 內進行權限驗證（例如：非狼人不可接收狼人頻道訊息）。

效能：避免在遊戲進行中的迴圈內頻繁讀寫 D1，優先在 DO 的 Memory 中處理狀態，遊戲結束後再同步至 D1。

6. 優先開發順序 (Priority)
Infrastructure: 初始化 wrangler.toml 並建立 D1/DO/R2 的綁定。

Room Engine: 實作基礎的房間建立、加入與 WebSocket 連線機制。

Game Loop: 實作白天、黑夜、投票、處決等核心狀態機邏輯。

UI Implementation: 根據目標 PHP 版本完成前端頁面渲染。

給 Agent 的小撇步：
當你在分析 PHP 邏輯時，請將其抽象化為 「輸入、狀態、輸出」。我們不搬運 PHP 的代碼，我們搬運的是它的 「遊戲規則與視覺靈魂」。


7. 開發功能時請先切feature fix chore 分支. commit 完後再merge回去(with no-ff), 嚴禁直接在master(main)線上直接commit
