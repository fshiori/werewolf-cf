# 🐺 Werewolf CF

人狼遊戲 Cloudflare Workers 重構版 - 使用現代化架構完全重現經典 PHP 人狼遊戲。

## ✨ 特色

- ⚡ **超低延遲** - WebSocket 即時通訊，延遲 <50ms
- 🌍 **全球邊緣** - Cloudflare Workers 全球部署
- 💾 **Durable Objects** - 房間狀態管理
- 🗄️ **D1 資料庫** - SQLite 持久化
- 🎮 **完整遊戲** - 20+ 角色，完整規則

## 🚀 快速開始

### 本地開發

```bash
# 安裝依賴
npm install

# 建立資料庫
wrangler d1 create werewolf-db
wrangler d1 migrations apply werewolf-db --local

# 啟動開發伺服器
wrangler dev --local --port 8787
```

### 部署到 Cloudflare

```bash
# 登入 Cloudflare
wrangler login

# 建立資料庫
wrangler d1 create werewolf-db

# 更新 wrangler.toml 中的 database_id
# 建立 KV namespace
wrangler kv:namespace create "SESSION"

# 建立 R2 bucket
wrangler r2 bucket create werewolf-uploads

# 執行資料庫遷移
wrangler d1 migrations apply werewolf-db

# 部署
wrangler deploy
```

## 📁 專案結構

```
werewolf-cf/
├── src/
│   ├── index.ts              # 主入口
│   ├── routes/
│   │   └── api.ts            # API 路由
│   ├── room/
│   │   └── complete-room.ts  # Durable Object 房間
│   ├── utils/                # 工具函式
│   │   ├── crypto.ts         # 加密
│   │   ├── validation.ts     # 驗證
│   │   ├── time.ts           # 時間
│   │   ├── time-progression.ts  # 時間流逝
│   │   ├── role-system.ts    # 角色系統
│   │   ├── vote-system.ts    # 投票系統
│   │   ├── night-action.ts   # 夜晚行動
│   │   ├── room-manager.ts   # 房間管理
│   │   └── session-manager.ts # Session
│   └── types/
│       └── index.ts          # 型別定義
├── public/                   # 前端
│   ├── index.html            # 首頁
│   └── game.html             # 遊戲頁面
├── migrations/
│   └── 0001_init.sql         # 資料庫初始化
├── tests/                    # 測試
├── wrangler.toml
├── package.json
└── tsconfig.json
```

## 🎮 遊戲特色

### 角色系統（20+ 角色）

**村民陣營:**
- 村民、預言家、靈媒、獵人
- 共有者、權力者

**狼人陣營:**
- 狼人、狂人、大狼

**妖狐陣營:**
- 妖狐、子狐、背德者

**特殊角色:**
- 戀人、貓又、埋毒者、連結者

### 遊戲流程

1. **等待階段** - 玩家加入房間
2. **遊戲開始** - 隨機分配角色
3. **白天** - 討論 + 投票
4. **夜晚** - 角色行動
5. **循環** - 直到分出勝負

## 🛠️ 技術棧

| 層級 | 技術 |
|------|------|
| Runtime | Cloudflare Workers |
| 框架 | Hono |
| 語言 | TypeScript |
| 即時通訊 | WebSocket |
| 狀態管理 | Durable Objects |
| 資料庫 | D1 (SQLite) |
| 快取 | KV |
| 檔案儲存 | R2 |

## 📊 性能對比

| 指標 | 原版 PHP | Workers 版 | 改進 |
|------|---------|-----------|------|
| 延遲 | 20-30秒 | <50ms | **600x** |
| 通訊 | 輪詢 | WebSocket | **即時** |
| 擴展性 | 單機 | 全球 | **無限** |
| 成本 | $5-10/月 | **免費** | **100%** |

## 🧪 測試

```bash
# 執行測試
npm test

# 測試覆蓋率
npm run test:coverage
```

## 📝 開發規範

- 遵循 Conventional Commits
- 在功能分支開發
- 先寫測試（TDD）
- Code Review

## 📄 授權

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 🙏 致謝

- 原版 Diamanda 人狼遊戲
- Cloudflare Workers
- Hono 框架
