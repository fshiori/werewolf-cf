# 🐺 Werewolf CF - 人狼遊戲 Cloudflare Workers 重構版

## 專案目標

使用現代化架構（Cloudflare Workers + Durable Objects）完全重構 [Diamanda 1.3.61](https://github.com/) 人狼遊戲系統。

## 架構對比

| 功能 | 原版 (2009 PHP) | 新版 (Workers) |
|------|----------------|---------------|
| 通訊 | Meta Refresh (20-30s) | WebSocket (<50ms) |
| 路由 | PHP 直接請求 | Hono Framework |
| 資料庫 | MySQL MyISAM | D1 (SQLite) |
| Session | PHP Session | JWT + KV |
| 狀態管理 | 資料庫查詢 | Durable Objects |
| 部署 | VPS | 全球邊緣節點 |

## 技術棧

- **Runtime**: Cloudflare Workers
- **框架**: Hono
- **語言**: TypeScript
- **資料庫**: D1 (SQLite)
- **狀態管理**: Durable Objects
- **快取**: KV
- **儲存**: R2 (頭像上傳)

## 開發

```bash
# 安裝依賴
pnpm install

# 本地開發
pnpm dev

# 資料庫遷移
pnpm d1:migrate

# 部署
pnpm deploy
```

## 功能清單

### 核心功能
- [x] 專案架構設定
- [ ] Durable Object 房間系統
- [ ] WebSocket 連線管理
- [ ] 玩家進入/退出
- [ ] 角色分配系統

### 遊戲系統
- [ ] 時間流逝系統
- [ ] 白天討論階段
- [ ] 夜晚行動階段
- [ ] 投票系統
- [ ] 勝負判定

### 角色系統
- [ ] 村民
- [ ] 狼人
- [ ] 預言家
- [ ] 靈媒
- [ ] 獵人
- [ ] 狂人
- [ ] 共有者
- [ ] 妖狐
- [ ] 背德者
- [ ] 連結者

### 管理功能
- [ ] 管理員登入
- [ ] 房間管理
- [ ] 用戶管理
- [ ] Tripcode 評分
- [ ] 頭像上傳

### 進階功能
- [ ] 音效通知
- [ ] 異議按鈕
- [ ] 遺書系統
- [ ] 密語功能
- [ ] 靈界模式
- [ ] 歷史記錄查看

## 授權

MIT License
