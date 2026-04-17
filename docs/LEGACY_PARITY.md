# Legacy PHP → Cloudflare Workers Parity Map

> Generated from PHP reference: `diam1.3.61.kz_Build0912`  
> CF project: `werewolf-cf` (src/routes/\*, src/room/, src/utils/)  
> Last updated: 2026-04-17

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Full | Feature exists in CF and matches PHP behaviour |
| ⚠️ Partial | Exists but missing some sub-features or edge cases |
| ❌ Missing | No CF implementation yet |
| 📋 Planned | Acknowledged but not yet started |
| 🔄 Redesigned | Replaced by a different (better) approach |

---

## 1. Pages

| PHP File | Description | CF Route / Page | Status |
|----------|-------------|-----------------|--------|
| `index.php` | Lobby / room list with server list sidebar | `public/index.html` (SPA) + `GET /api/rooms` + `GET /api/rooms/federated` | ✅ Full |
| `list.php` | Server-wide room list (federated aggregation) | `GET /api/rooms/federated` | ✅ Full |
| `room_manager.php` | Create room / view room list (`command=CREATE_ROOM`) | `POST /api/rooms` + `GET /api/rooms` | ✅ Full |
| `user_manager.php` | Player registration form + `RegistUser()` | `POST /api/rooms/:roomNo/join` | ✅ Full |
| `login.php` | Login (manual + session-based auto-login) | Session via KV + `Authorization: Bearer` header (WebSocket) | 🔄 Redesigned |
| `game_frame.php` | Game frameset (top bar + play area + optional heaven) | `public/room.html` (SPA single page) + `GET /ws/:roomNo` | 🔄 Redesigned |
| `game_up.php` | Top frame: player list + input form for speech | Part of `public/room.html` (client-side) | 🔄 Redesigned |
| `game_play.php` | Main play frame: talk log, votes, last words, system messages | Part of `public/room.html` (client-side) + WebSocket messages | 🔄 Redesigned |
| `game_vote.php` | Vote submission + game-start logic + role assignment + night actions | `complete-room.ts` (Durable Object) via WebSocket `vote` action | ⚠️ Partial |
| `game_view.php` | Spectator / log viewer (read-only view of past games) | `GET /api/replay/:roomNo?mode=full|reverse|heaven|heaven_only` | ✅ Full |
| `game_log.php` | Past last-words archive viewer | `GET /api/replay/:roomNo?mode=full`（含 wills） | ✅ Full |
| `old_log.php` | Archived game log browser (room_old table) | `GET /api/replay/:roomNo`（主表空時 fallback archive） | ✅ Full |
| `bbs.php` | BBS / discussion board with posts + replies | `GET /api/bbs` + `POST /api/bbs` + `POST /api/bbs/:id/reply` | ✅ Full |
| `trip.php` | Tripcode-based BBS system | `POST /api/trip/register` + `POST /api/trip/verify` + `POST /api/trip` | ✅ Full |
| `admin.php` | Admin panel: force-end rooms (廢村) | `POST /api/admin/login` + `DELETE /api/admin/rooms/:roomNo` + `POST /api/admin/rooms/:roomNo/kick` | ✅ Full |
| `icon_upload.php` | User icon upload form | `POST /api/icons` | ✅ Full |
| `icon_view.php` | User icon gallery | `GET /api/icons` + `GET /icons/:filename` | ✅ Full |
| `upload.php` | Icon upload handler (resize, validate, store) | `POST /api/icons` (R2 storage) | ✅ Full |
| `upload2.php` | Icon upload callback (success/cancel) | Merged into `POST /api/icons` response | 🔄 Redesigned |
| `rule.php` | Rule display page (time calculations) | `GET /api/rule-summary` | ✅ Full |
| `script_info.php` | Server info page (time limits, silence config) | `GET /api/version` + `GET /api/script-info` + `GET /api/rule-summary` | ✅ Full |
| `stats.php` | Win-rate statistics per tripcode (22p/30p breakdown) | `GET /api/stats/:trip`（含 22p/30p breakdown） + `GET /api/leaderboard` | ✅ Full |
| `version.php` | Version changelog display | `GET /api/version` | ✅ Full |
| `api.php` | Room list API for server federation | `GET /api/rooms` (JSON API) | ✅ Full |
| `setting.php` | Server configuration (DB, timezone, options, role lists) | `wrangler.toml` + env vars + `DEFAULT_ROOM_OPTIONS` | 🔄 Redesigned |
| `functions.php` | Shared DB helper + misc functions | Replaced by CF SDK (D1, KV, R2) | 🔄 Redesigned |
| `game_functions.php` | Shared game helper (output, session check, etc.) | Replaced by `complete-room.ts` + `role-system.ts` + `vote-system.ts` | 🔄 Redesigned |
| `dummy.php` | Default last-words array (遺言模板) | `src/utils/role-system.ts` `DEFAULT_DUMMY_LAST_WORDS` + `createDummyBoyPlayer()` | ✅ Full |
| `announcement.txt` | Server announcement text file | `GET /api/announcement`（ENV `ANNOUNCEMENT_TEXT`） | ✅ Full |

---

## 2. API Endpoints

### 2.1 Room Management

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `room_manager.php?command=CREATE_ROOM` | POST | Create room | `POST /api/rooms` | ✅ Full |
| `room_manager.php` (default) | GET | List rooms | `GET /api/rooms` | ✅ Full |
| `api.php` | GET | Room list for federation | `GET /api/rooms` | ✅ Full |
| — | GET | Federated room list | `GET /api/rooms/federated` | ✅ Full (new) |
| — | GET | Room details | `GET /api/rooms/:roomNo` | ✅ Full |
| — | DELETE | Delete room (user) | `DELETE /api/rooms/:roomNo` | ✅ Full |
| — | GET | Popular rooms | `GET /api/rooms/popular` | ✅ Full (new) |

### 2.2 Player Management

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `user_manager.php?command=regist` | POST | Register player | `POST /api/rooms/:roomNo/join` | ✅ Full |
| `login.php?login_type=manually` | POST | Manual login | Session via `POST /api/rooms/:roomNo/join` response | 🔄 Redesigned |
| `login.php` (default) | GET | Session-based auto-login | `Authorization: Bearer` header on WebSocket | 🔄 Redesigned |
| — | POST | Leave room | `POST /api/rooms/:roomNo/leave` | ✅ Full |

### 2.3 Game Play (WebSocket-based in CF)

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `game_play.php?go=SAY` | POST | Submit speech | WS msg `{ type: "say" }` | ✅ Full |
| `game_vote.php?command=VOTE` | POST | Cast vote | WS msg `{ type: "vote" }` | ✅ Full |
| `game_vote.php?command=GAME_START` | POST | Start game (all vote) | WS msg `{ type: "start_game" }` | ✅ Full |
| `game_vote.php?command=WOLF_EAT` | POST | Wolf night kill | WS msg `{ type: "night_action" }` | ✅ Full |
| `game_vote.php?command=MAGE` | POST | Mage fortune tell | WS msg `{ type: "night_action" }` | ✅ Full |
| `game_vote.php?command=GUARD` | POST | Guard protect | WS msg `{ type: "night_action" }` | ✅ Full |
| `game_up.php` (auto-reload) | GET | Poll game state | WebSocket push (no polling needed) | 🔄 Redesigned |
| `game_vote.php?command=OBJECTION` | POST | "Objection!" button | WS msg `{ type: "objection" }` | ✅ Full |

### 2.4 Admin

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `admin.php?go=in` | POST | Admin login | `POST /api/admin/login` | ✅ Full |
| `admin.php?go=out` | POST | Admin logout | `POST /api/admin/logout` | ✅ Full |
| `admin.php?go=del` | GET | Force-end room (廢村) | `DELETE /api/admin/rooms/:roomNo` | ✅ Full |
| — | POST | Kick player from room | `POST /api/admin/rooms/:roomNo/kick` | ✅ Full |
| — | GET | List all rooms (admin) | `GET /api/admin/rooms` | ✅ Full |
| — | POST | Ban IP | `POST /api/admin/bans` | ✅ Full (new) |
| — | DELETE | Unban IP | `DELETE /api/admin/bans/:ip` | ✅ Full (new) |
| — | GET | List bans | `GET /api/admin/bans` | ✅ Full (new) |
| — | GET | Ban stats | `GET /api/admin/bans/stats` | ✅ Full (new) |
| — | GET | Global stats (admin) | `GET /api/admin/stats` | ✅ Full (new) |
| — | POST | Reset stats | `POST /api/admin/stats/reset` | ✅ Full (new) |

### 2.5 BBS

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `bbs.php` (view) | GET | List threads | `GET /api/bbs` | ✅ Full |
| `bbs.php` (post) | POST | Create thread | `POST /api/bbs` | ✅ Full |
| `bbs.php?thread=X` | GET | View thread + replies | `GET /api/bbs/:threadId` | ✅ Full |
| `bbs.php` (reply) | POST | Reply to thread | `POST /api/bbs/:threadId/reply` | ✅ Full |
| — | POST | Lock/unlock thread | `POST /api/bbs/:threadId/lock` | ✅ Full (new) |
| — | POST | Pin/unpin thread | `POST /api/bbs/:threadId/pin` | ✅ Full (new) |
| — | DELETE | Delete thread | `DELETE /api/bbs/:threadId` | ✅ Full (new) |

### 2.6 Tripcode

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| (inline in `trip.php`) | POST | Generate tripcode | `POST /api/trip` | ✅ Full |
| — | POST | Register tripcode | `POST /api/trip/register` | ✅ Full (new) |
| — | POST | Verify tripcode | `POST /api/trip/verify` | ✅ Full (new) |

### 2.7 Icons

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `icon_view.php` | GET | List icons | `GET /api/icons` | ✅ Full |
| `icon_upload.php` → `upload.php` | POST | Upload icon | `POST /api/icons` | ✅ Full |
| `upload2.php?regist=success` | GET | Confirm upload | Merged into `POST /api/icons` | 🔄 Redesigned |
| `upload2.php?regist=cancel` | GET | Cancel upload | `GET /api/icons/upload/cancel` | ✅ Full |
| `icon_view.php` (serve) | GET | Serve icon image | `GET /icons/:filename` | ✅ Full |

### 2.8 Game Logs & Stats

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `game_view.php` | GET | View past game log | `GET /api/replay/:roomNo?mode=full|reverse|heaven|heaven_only` | ✅ Full |
| `game_log.php` | GET | View last-words archive | `GET /api/replay/:roomNo?mode=full` | ✅ Full |
| `old_log.php` | GET | Browse archived games | `GET /api/replay/:roomNo`（fallback archive） | ✅ Full |
| `stats.php` | GET | Win-rate statistics（含 22p/30p breakdown） | `GET /api/stats/:trip` | ✅ Full |
| — | GET | Leaderboard | `GET /api/leaderboard` | ✅ Full (new) |
| — | POST | Update player stats | `POST /api/stats/:trip` | ✅ Full (new) |

### 2.9 Info

| PHP Endpoint | Method | Description | CF Endpoint | Status |
|-------------|--------|-------------|-------------|--------|
| `rule.php` | GET | Rule display | `GET /api/rule-summary` | ✅ Full |
| `script_info.php` | GET | Server info | `GET /api/version` + `GET /api/script-info` | ✅ Full |
| `version.php` | GET | Version / changelog | `GET /api/version` | ✅ Full |

### 2.10 New in CF (no PHP equivalent)

| CF Endpoint | Method | Description | Status |
|-------------|--------|-------------|--------|
| `GET /api/stats` | GET | Public stats overview | ✅ New |
| `GET /api/vote-history/:roomNo` | GET | Room vote history | ✅ New |
| `POST /api/vote-history` | POST | Record vote detail | ✅ New |
| `POST /api/blacklist` | POST | Add user to blacklist | ✅ New |
| `GET /api/blacklist` | GET | List blacklist | ✅ New |
| `GET /api/blacklist/check/:trip` | GET | Check blacklist status | ✅ New |
| `DELETE /api/blacklist/:id` | DELETE | Remove from blacklist | ✅ New |
| `POST /api/whitelist` | POST | Add to whitelist | ✅ New |
| `GET /api/whitelist` | GET | List whitelist | ✅ New |
| `GET /api/whitelist/check/:trip` | GET | Check whitelist status | ✅ New |
| `POST /api/ng-users` | POST | Add NG user | ✅ New |
| `GET /api/ng-users/:trip` | GET | List NG users | ✅ New |
| `GET /api/ng-users/check/:trip/:targetTrip` | GET | Check NG status | ✅ New |
| `DELETE /api/ng-users/:id` | DELETE | Remove NG user | ✅ New |
| `POST /api/spectate/:roomNo` | POST | Join spectator mode | ✅ New |
| `DELETE /api/spectate/:roomNo/:trip` | DELETE | Leave spectator mode | ✅ New |
| `GET /api/spectate/:roomNo` | GET | List spectators | ✅ New |
| `POST /api/debug/session` | POST | Debug session creation | ✅ New (dev) |
| `GET /api/admin/debug/kv` | GET | Debug KV values | ✅ New (dev) |

---

## 3. Room Options (gameOption tokens)

The PHP `game_option` field is a space-delimited string of tokens stored in the `room` table.  
CF replaces this with a typed `RoomOptions` interface (see `src/types/room-options.ts`).

| PHP Token | Description | Parsed in CF? | Consumed? | Status |
|-----------|-------------|:------------:|:---------:|--------|
| `wish_role` | Allow players to wish for a specific role | ✅ | ✅ `wishRole` | ✅ Full (join captures wishRole; start-game assignment prefers valid wishes) |
| `dummy_boy` | Include AI dummy player (替身君) | ✅ | ✅ `dummyBoy` | ⚠️ Partial (dummy player + custom name/last words + 基礎自動發言/白天自動投票 + votedisplay 排除 dummy_boy 已接上；完整 legacy AI 細節仍未完全等價) |
| `open_vote` | Reveal vote tallies to all players | ✅ | ✅ `openVote` | ✅ Full (fallbacks to anonymous vote-count mode when voteDisplay unset) |
| `real_time:D:N` | Use real-time limits (D min day, N min night) | ✅ | ✅ `realTime` + `realTimeDayLimitSec/night` | ✅ Full (supports separate day/night limits and legacy `real_time:D:N` parsing) |
| `comoutl` | 共生者夜晚對話顯示（show lover/common night whisper to others） | ✅ | ✅ `comoutl` | ✅ Full (comoutl=true: others see 「悄悄話...」; comoutl=false: hidden) |
| `vote_me` | Allow self-vote | ✅ | ✅ `voteMe` | ✅ Full (frontend target filtering + backend vote validation) |
| `trip` | Require tripcode to join | ✅ | ✅ `tripRequired` | ✅ Full (join-time enforcement in API) |
| `istrip` | Legacy trip enforcement token | ✅ | ✅ `istrip` | ✅ Full（join-time enforced；legacy token string 路徑可阻擋無 trip 加入） |
| `will` | Enable last-words (遺言) | ✅ | ✅ `will` | ✅ Full |
| `gm:XXXXX` | Designate a specific trip as GM | ✅ | ✅ | ✅ Full（legacy token parsing + runtime 指派 + maxUser+1 GM 加入席次 + join waiting/beforegame 限制 + 夜晚狼刀不可指向 GM + 白天投票完成判定排除 GM + GM 不可作為白天投票者） |
| `as_gm` | Activate GM role | ✅ | ✅ | ✅ Full（需與 `gm:trip` 配對才會實際指派 GM，符合 legacy） |
| `votedisplay` | Show who has already voted (start-game & day) | ✅ | ✅ `votedisplay` | ✅ Full（等待中 start-game 投票與白天投票皆下發 votedUsers） |
| `cust_dummy` | Custom dummy-boy name/last-words | ✅ | ✅ `custDummy` + `dummyCustomName` + `dummyCustomLastWords` | ✅ Full（parser/runtime + create-room UI 控件 + payload 已串接） |

---

## 4. Role Options (optionRole tokens)

The PHP `option_role` field is a space-delimited string of tokens stored in the `room` table.  
These control which special roles appear in the role list at game start.

| PHP Token | Description | Parsed in CF? | Consumed in Role Assignment? | Status |
|-----------|-------------|:------------:|:----------------------------:|--------|
| `decide` | Add 決定者 role (tie-breaker: dies on tie) | ✅ | ✅ `decide` role exists + vote tie logic | ✅ Full (16+ 會注入，並以 vote-system 平手規則生效) |
| `authority` | Add 權力者 role (2× vote weight) | ✅ | ✅ `authority` role exists + vote weight logic | ✅ Full (16+ 會注入，並以加權投票生效) |
| `poison` | Add 埋毒者 role (wolf-team poisoner) | ✅ | ✅ `poison` count injection | ✅ Full（20+ 注入 + 夜晚被咬反噴狼 + 白天被吊反噴流程） |
| `cat` | Poison variant: cat-style (poison = 貓又) | ✅ | ✅ `cat` count injection | ✅ Full（20+ 注入 + 夜晚被咬反噴狼 + CAT_DO 夜間秘術 + 被咬不死機率） |
| `pobe` | Poison variant: wolf-team poisoner (pobe+poison→extra wolf+poison at 20+) | ✅ | ✅ `pobe` | ✅ Full (20+ `foxVariant + poison/cat + pobe` 追加 wolf+毒系配對) |
| `betr` | Add 背德者 role (fox-team, wins if fox dead + wolves dead) | ✅ | ✅ `betr` role + victory condition | ✅ Full（20+ 注入 + 狐線全滅即殉滅，並串接 day/night/sudden-death） |
| `foxs` | Add 雙狐 role (two foxes) | ✅ | ✅ dual-fox count injection | ✅ Full（20+ 雙狐注入 + foxs+pobe+poison(cat) 追加 wolf+毒系分支已覆蓋） |
| `fosi` | Add 子狐 role (fox-team sub-role) | ✅ | ✅ `fosi` role exists | ✅ Full（20+ 注入 + FOSI_DO 夜間占卜 + nofosi 偽裝 + 大狼偽裝分支） |
| `wfbig` | Add 大狼 role (strong wolf) | ✅ | ✅ `wfbig` count injection | ✅ Full（20+ 注入 + 狼陣營判定 + mage/fosi 占卜偽裝分支） |
| `lovers` | Add 戀人 role (paired lovers, die together) | ✅ | ✅ lovers subrole attach + chain-death | ✅ Full（13+ 時 common 轉 human，開局附掛 2 名戀人子職；連帶死亡覆蓋 day/night/sudden-death） |

### PHP Role Assignment Logic (mostly ported)

In PHP, `game_vote.php` lines ~715–790 implement role-list mutation at game start:

1. **20+ players required**: `betr`, `poison`, `foxs`, `wfbig`, `fosi` only activate when `user_count >= 20`
2. **Mutual exclusivity**: Only one of `betr`, `foxs`, `fosi`, or plain `poison` can be active
3. **pobe + poison combo**: When both `pobe` and `poison` (or `cat`) are set, an extra wolf is added
4. **lovers subrole flow**: When `lovers` is set (13+), `common` entries are first normalized to `human`, then two players are randomly tagged with lovers subrole
5. **decide at 16+**: `decide` overwrites a `human` in the role list
6. **authority at 16+**: `authority` overwrites a `human` in the role list
7. **Role list tables**: PHP has per-player-count role lists for 8–30 players (`setting.php` lines 196–219)

CF has ported the core role-list mutation pipeline and token parsing; remaining gaps are the rows still marked ⚠️ Partial above (`dummy_boy` AI-detail equivalence).

---

## 5. Game Systems Parity

| System | PHP Implementation | CF Implementation | Status |
|--------|-------------------|-------------------|--------|
| Session management | PHP sessions (`$_SESSION`) | KV-backed sessions + `Authorization: Bearer` | 🔄 Redesigned |
| Database | MySQL (`room`, `user_entry`, `talk`, `vote`, `system_message`, `user_icon`) | D1 (same tables) + KV (sessions, bans, stats) + R2 (icons) | 🔄 Redesigned |
| Time system (spend_time) | Day: 12h ÷ `$day_limit_time`; Night: 6h ÷ `$night_limit_time` | spend_time 1..4（依發言長度 bytes）+ day/night limit 轉相位 | ✅ Full |
| Silence detection | `$silence_threshhold_time` (60s) → silence → time passes at `$silence_pass_time`× rate | DO tick + silenceThreshold + silenceMultiplier（預設 60s/4x） | ✅ Full |
| Sudden death | `$suddendeath_threshhold_time` (120s after time runs out) | day timeout 記錄 + 120s grace 後處理未投票者 | ✅ Full |
| Auto-reload / polling | HTTP meta-refresh every N seconds | WebSocket push (real-time) | 🔄 Redesigned |
| Federation | `list.php` fetches from `$room_server_list` via HTTP | `GET /api/rooms/federated` with configurable `FEDERATED_SOURCES` env var | ✅ Full |
| Dead-room cleanup | `CheckDieRoom()` after `$die_room_threshhold_time` (600s) | DO alarm + cron stale-room scan + API/admin cleanup | 🔄 Redesigned |
| IP restriction | `$regist_one_ip_address` prevents multi-join from same IP | `POST /api/rooms/:roomNo/join` same-IP guard via env `REGIST_ONE_IP_ADDRESS=1` | ✅ Full |
| Sound notifications | SWF-based sound (morning, revote, objection) | `public/game.html` Web Audio cues（morning / objection / revote） | ✅ Full |
| Objection system | `$maxcount_objection = 2` times per game | WS `objection` + 每人上限 2 次 + 廣播提示 | ✅ Full |
| Revote draw limit | `$revote_draw_times = 10` → draw after N revotes | 連續平手計數達 10 次自動判定 draw | ✅ Full |
| Font types (发言强度) | normal, strong, weak | `fontType` in `Message` interface | ✅ Full |
| Night actions (mage/guard/wolf) | `game_vote.php` command switch | WebSocket `night_action` type | ✅ Full |
| Victory conditions | human / wolf / fox / betr / lovers / draw | `role-system.ts` checkVictory() | ✅ Full |
| GM system | `gm:trip` + `as_gm` tokens, GM can whisper/role-assign | token parsing + runtime GM 指派 + GM whisper/role actions（WebSocket） | ✅ Full |
| Whisper (secret talk) | common / wolf night talk channels | `whisper-manager.ts` + `whispers` D1 table | ✅ Full |
| Heaven (dead player view) | `dead_mode=on` loads separate heaven frame | `getHeavenRecipients()` + `GET /api/replay/:roomNo?mode=heaven|heaven_only` | ✅ Full |

---

## 6. Static Assets

| PHP Asset | Description | CF Equivalent | Status |
|-----------|-------------|---------------|--------|
| `img/*.jpg` / `img/*.gif` | Background images, role icons, status icons | `public/img/` (Cloudflare Assets) | 📋 Planned |
| `swf/*.swf` | Sound notifications | Web Audio API cues in `public/game.html` (legacy SWF replacement) | 🔄 Redesigned |
| `user_icon/` | User-uploaded icon files | R2 bucket `icons/` prefix | 🔄 Redesigned |
| `user_emot/` | Custom emoticons | `POST /api/emoticons` + `GET /api/emoticons` + `DELETE /api/emoticons/:filename` + `GET /emot/:filename` + client token rendering `:name:` | ✅ Full |
| `lang/cht/` / `lang/jpn/` | Language files | `public/i18n.js` + `public/locales/{zh-TW,ja}.json` | ✅ Full |
| `tmp/cache_*.php` | Server-side talk cache | WebSocket push (no server cache needed) | 🔄 Redesigned |
| `announcement.txt` | Server announcement | `GET /api/announcement`（ENV `ANNOUNCEMENT_TEXT`） | ✅ Full |

---

## 7. Summary Counts

> Note: counts below are historical snapshot; row-level statuses above are the source of truth and were partially updated after 2026-04-17 parity fixes.

| Category | Total | ✅ Full | ⚠️ Partial | ❌ Missing | 🔄 Redesigned | 📋 Planned |
|----------|------:|--------:|-----------:|-----------:|-------------:|-----------:|
| Pages | 27 | 11 | 5 | 2 | 8 | 1 |
| API Endpoints (PHP→CF) | 30 | 15 | 6 | 2 | 7 | — |
| API Endpoints (CF new) | 18 | 18 | — | — | — | — |
| gameOption tokens | 12 | 1 | 6 | 5 | — | — |
| optionRole tokens | 10 | 0 | 5 | 1 | — | — |
| **Totals** | **97** | **45** | **22** | **10** | **15** | **1** |

**Overall parity: ~46% full, ~23% partial, ~10% missing, ~16% redesigned.**
