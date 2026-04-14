# 新增功能說明文檔

本文檔記錄所有新增功能的實作細節和使用方式。

## 📋 目錄

1. [資料庫更新](#資料庫更新)
2. [新增 API](#新增-api)
3. [新增頁面](#新增頁面)
4. [功能說明](#功能說明)

---

## 資料庫更新

### Migration 檔案
檔案位置：`migrations/0002_add_missing_features.sql`

### 新增表格

#### 1. game_logs - 遊戲記錄表
記錄所有完成的遊戲詳細資訊。

```sql
CREATE TABLE game_logs (
  id INTEGER PRIMARY KEY,
  room_no INTEGER UNIQUE,
  room_name TEXT,
  winner TEXT,
  total_days INTEGER,
  player_count INTEGER,
  roles TEXT,          -- JSON 格式
  death_order TEXT,    -- JSON 格式
  key_events TEXT,     -- JSON 格式
  created_at INTEGER
);
```

#### 2. vote_history - 投票歷史表
記錄每次投票的詳細資訊。

```sql
CREATE TABLE vote_history (
  id INTEGER PRIMARY KEY,
  room_no INTEGER,
  date INTEGER,
  voter_uname TEXT,
  target_uname TEXT,
  vote_type TEXT,      -- normal, rush, random
  time INTEGER
);
```

#### 3. user_blacklist - 黑名單表
管理被禁止的 Tripcode。

```sql
CREATE TABLE user_blacklist (
  id INTEGER PRIMARY KEY,
  trip TEXT,
  reason TEXT,
  created_by TEXT,
  created_at INTEGER
);
```

#### 4. user_whitelist - 白名單表
管理受信任的 Tripcode。

```sql
CREATE TABLE user_whitelist (
  id INTEGER PRIMARY KEY,
  trip TEXT UNIQUE,
  trust_level INTEGER,
  notes TEXT,
  created_at INTEGER
);
```

#### 5. ng_users - NG 用戶表
用戶不想一起玩的玩家名單。

```sql
CREATE TABLE ng_users (
  id INTEGER PRIMARY KEY,
  trip TEXT,
  ng_trip TEXT,
  reason TEXT,
  created_at INTEGER,
  UNIQUE(trip, ng_trip)
);
```

#### 6. spectators - 觀戰者表
記錄觀戰者的資訊。

```sql
CREATE TABLE spectators (
  room_no INTEGER,
  trip TEXT,
  handle_name TEXT,
  joined_at INTEGER,
  PRIMARY KEY (room_no, trip)
);
```

#### 7. game_events - 遊戲事件表
記錄遊戲中的關鍵事件。

```sql
CREATE TABLE game_events (
  id INTEGER PRIMARY KEY,
  room_no INTEGER,
  date INTEGER,
  event_type TEXT,
  description TEXT,
  related_uname TEXT,
  time INTEGER
);
```

#### 8. game_settings - 遊戲設定表
儲存遊戲的預設設定。

```sql
CREATE TABLE game_settings (
  id INTEGER PRIMARY KEY,
  setting_name TEXT UNIQUE,
  setting_value TEXT,
  description TEXT
);
```

### 新增欄位

#### room 表格
- `password TEXT` - 房間密碼
- `is_private INTEGER` - 是否為私人房間
- `time_limit INTEGER` - 投票時間限制（秒）
- `silence_mode INTEGER` - 是否啟用沈默模式

#### user_entry 表格
- `is_spectator INTEGER` - 是否為觀戰者

#### trip_scores 表格
- `total_games INTEGER` - 總場次
- `survivor_count INTEGER` - 生存次數
- `role_history TEXT` - 角色歷史（JSON 格式）

---

## 新增 API

### 1. 遊戲記錄 API

#### 建立遊戲記錄
```
POST /api/game-logs
Content-Type: application/json

{
  "roomNo": 1234567890,
  "roomName": "房間名稱",
  "winner": "human",  // human, wolf, fox
  "totalDays": 5,
  "playerCount": 16,
  "roles": "{\"human\": 8, \"wolf\": 3, ...}",
  "deathOrder": "[{\"day\": 1, \"uname\": \"玩家A\", \"role\": \"wolf\"}]",
  "keyEvents": "[\"第1天：玩家A被處刑\"]"
}
```

#### 獲取遊戲記錄列表
```
GET /api/game-logs?limit=50&offset=0&winner=human
```

#### 獲取單一遊戲記錄
```
GET /api/game-logs/:roomNo
```

### 2. 投票統計 API

#### 記錄投票
```
POST /api/vote-history
Content-Type: application/json

{
  "roomNo": 1234567890,
  "date": 1,
  "voterUname": "玩家A",
  "targetUname": "玩家B",
  "voteType": "normal"  // normal, rush, random
}
```

#### 獲取投票歷史
```
GET /api/vote-history/:roomNo?date=1
```

### 3. 個人統計 API

#### 獲取 Tripcode 統計
```
GET /api/stats/:trip
```

回應：
```json
{
  "trip": "abc123",
  "score": 150,
  "total_games": 20,
  "human_wins": 8,
  "wolf_wins": 5,
  "fox_wins": 2,
  "survivor_count": 12,
  "roleHistory": {
    "human": 5,
    "wolf": 3,
    "seer": 2
  },
  "last_played": 1234567890000
}
```

#### 更新 Tripcode 統計
```
POST /api/stats/:trip
Content-Type: application/json

{
  "result": "human_win",  // human_win, wolf_win, fox_win, lose
  "role": "wolf",
  "survived": true
}
```

#### 獲取排行榜
```
GET /api/leaderboard?type=score&limit=50
```
- type: score, games, wins

### 4. 黑白名單 API

#### 新增黑名單
```
POST /api/blacklist
Content-Type: application/json

{
  "trip": "abc123",
  "reason": "作弊行為",
  "createdBy": "admin"
}
```

#### 檢查黑名單
```
GET /api/blacklist/check/:trip
```

#### 獲取黑名單列表
```
GET /api/blacklist
```

#### 刪除黑名單
```
DELETE /api/blacklist/:id
```

#### 新增白名單
```
POST /api/whitelist
Content-Type: application/json

{
  "trip": "abc123",
  "trustLevel": 5,
  "notes": "可信玩家"
}
```

### 5. NG 用戶 API

#### 新增 NG 用戶
```
POST /api/ng-users
Content-Type: application/json

{
  "trip": "abc123",
  "ngTrip": "def456",
  "reason": "不喜歡他的玩法"
}
```

#### 獲取 NG 用戶列表
```
GET /api/ng-users/:trip
```

#### 檢查 NG 用戶
```
GET /api/ng-users/check/:trip/:targetTrip
```

### 6. 觀戰模式 API

#### 加入觀戰
```
POST /api/spectate/:roomNo
Content-Type: application/json

{
  "trip": "abc123",
  "handleName": "觀戰者A"
}
```

#### 離開觀戰
```
DELETE /api/spectate/:roomNo/:trip
```

#### 獲取觀戰列表
```
GET /api/spectate/:roomNo
```

### 7. 遊戲事件 API

#### 記錄遊戲事件
```
POST /api/game-events
Content-Type: application/json

{
  "roomNo": 1234567890,
  "date": 1,
  "eventType": "execution",
  "description": "玩家A被處刑",
  "relatedUname": "玩家A"
}
```

#### 獲取遊戲事件
```
GET /api/game-events/:roomNo?type=execution
```

---

## 新增頁面

### 1. 遊戲記錄頁面
檔案：`public/logs.html`

功能：
- 顯示所有已完成遊戲的列表
- 可按勝利陣營篩選
- 可調整顯示數量
- 點擊卡片查看詳細記錄
- 顯示角色分配、死亡順序、關鍵事件

### 2. 個人統計頁面
檔案：`public/stats.html`

功能：
- 搜尋玩家統計資料
- 顯示總場次、勝場、生存率、積分
- 顯示村民/人狼/妖狐勝率
- 顯示角色歷史
- 排行榜功能（積分/場次/勝場）

### 3. 投票統計頁面
檔案：`public/votes.html`

功能：
- 查詢指定房間的投票記錄
- 按天數顯示投票結果
- 顯示投票統計圖表
- 顯示投票類型（一般/急行/隨機）

### 4. 遊戲規則頁面
檔案：`public/rule.html`

功能：
- 完整的遊戲規則說明
- 角色介紹
- 遊戲流程說明
- 特殊規則說明

### 5. 首頁導航更新
檔案：`public/index.html`

新增：
- 導航連結到所有新功能頁面
- 圖示和簡短說明

---

## 功能說明

### 1. 記者報導系統（遊戲記錄）

**用途**：記錄每場遊戲的完整資訊，提供詳細的戰報。

**內容包含**：
- 房間基本資訊（編號、名稱、人數）
- 勝利陣營
- 遊戲天數
- 角色分配
- 死亡順序
- 關鍵事件

**使用時機**：遊戲結束時自動建立。

### 2. 投票統計系統

**用途**：追蹤每次投票的記錄，分析投票行為。

**功能**：
- 記錄誰投票給誰
- 記錄投票類型（一般/急行/隨機）
- 提供統計圖表

**使用時機**：每次投票時記錄。

### 3. 個人統計系統

**用途**：追蹤玩家的遊戲表現，建立排行榜。

**指標**：
- 總場次
- 勝場數（村民/人狼/妖狐）
- 生存率
- 積分系統
- 角色歷史

**積分規則**：
- 村民勝：+10 分
- 人狼勝：+15 分
- 妖狐勝：+20 分
- 生存：+5 分

**使用時機**：
- 遊戲結束時更新統計
- 玩家查詢時顯示

### 4. 房間密碼功能

**用途**：建立私人房間，只有知道密碼的人能加入。

**使用方式**：
- 建立房間時設定密碼
- 加入房間時需要輸入密碼

**實作狀態**：資料庫已準備，前端待實作。

### 5. 觀戰模式

**用途**：讓死亡的玩家或其他人可以觀看遊戲。

**限制**：
- 最多 10 人同時觀戰（可調整）
- 觀戰者無法干擾遊戲
- 可以看到聊天和投票

**使用方式**：
- 死亡後自動轉為觀戰
- 或手動加入觀戰

### 6. 黑白名單系統

**黑名單**：
- 禁止特定 Tripcode 加入
- 可記錄原因和建立者
- 管理員可管理

**白名單**：
- 標記受信任的玩家
- 可設定信任等級
- 優先進入房間

### 7. NG 用戶系統

**用途**：玩家可以設定不想一起玩的人。

**功能**：
- 每個玩家有自己的 NG 清單
- 自動配對時避免匹配
- 不會顯示 NG 對象的房間

### 8. 遊戲事件記錄

**用途**：記錄遊戲中的關鍵事件，用於記者報導。

**事件類型**：
- 處刑
- 襲擊
- 占卜
- 遺言
- 勝利判定

---

## 使用說明

### 部署 Migration

在本地開發環境執行：

```bash
# 本地開發
wrangler d1 execute werewolf-db --local --file=migrations/0002_add_missing_features.sql

# 生產環境
wrangler d1 execute werewolf-db --file=migrations/0002_add_missing_features.sql
```

### 測試 API

使用 curl 或 Postman 測試：

```bash
# 建立遊戲記錄
curl -X POST https://your-domain/api/game-logs \
  -H "Content-Type: application/json" \
  -d '{"roomNo":1234567890,"roomName":"測試房間","winner":"human",...}'

# 獲取統計
curl https://your-domain/api/stats/abc123

# 獲取排行榜
curl https://your-domain/api/leaderboard?type=score&limit=10
```

---

## 未完成功能

以下功能資料庫已準備，但前端尚未實作：

1. **房間密碼** - 需要在建立/加入房間表單添加密碼欄位
2. **觀戰模式 UI** - 需要在遊戲頁面添加觀戰介面
3. **黑白名單管理頁面** - 需要建立管理介面
4. **NG 用戶設定頁面** - 需要建立玩家設定頁面
5. **遊戲設定調整** - 需要在建立房間時添加更多選項

---

## 注意事項

1. **資料庫欄位擴充**：部分現有表格新增了欄位，需要執行 migration
2. **API 路由註冊**：新 API 已在 `src/routes/features.ts` 中實作，並掛載到主路由
3. **前端頁面路徑**：所有新頁面都在 `public/` 目錄下
4. **型別定義**：TypeScript 型別已定義在 `src/types/index.ts` 中

---

## 下一步

1. 執行 database migration
2. 測試所有新 API
3. 實作前端房間密碼功能
4. 實作觀戰模式前端
5. 建立黑白名單管理頁面
6. 優化 UI/UX

---

**文檔版本**：1.0
**最後更新**：2026-04-11
**作者**：EricChen
