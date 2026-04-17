-- 初始化資料庫（完整版）
-- 包含所有表格和索引

-- ==================== 房間表 ====================
CREATE TABLE IF NOT EXISTS room (
  room_no INTEGER PRIMARY KEY AUTOINCREMENT,
  room_name TEXT NOT NULL,
  room_comment TEXT,
  max_user INTEGER DEFAULT 16,
  game_option TEXT,
  option_role TEXT,
  status TEXT DEFAULT 'waiting',
  date INTEGER DEFAULT 1,
  day_night TEXT DEFAULT 'beforegame',
  victory_role TEXT,
  dellook INTEGER DEFAULT 0,
  uptime INTEGER,
  last_updated INTEGER,
  -- 新增欄位
  password TEXT,
  is_private INTEGER DEFAULT 0,
  time_limit INTEGER DEFAULT 300,
  silence_mode INTEGER DEFAULT 1
);

-- ==================== 玩家表 ====================
CREATE TABLE IF NOT EXISTS user_entry (
  room_no INTEGER,
  user_no INTEGER,
  uname TEXT NOT NULL,
  handle_name TEXT,
  trip TEXT,
  icon_no INTEGER,
  sex TEXT,
  password TEXT,
  role TEXT,
  role_desc TEXT,
  g_color TEXT,
  live TEXT DEFAULT 'live',
  session_id TEXT,
  last_words TEXT,
  ip_address TEXT,
  last_load_day_night TEXT,
  score INTEGER DEFAULT 0,
  death INTEGER DEFAULT 0,
  marked INTEGER DEFAULT 0,
  -- 新增欄位
  is_spectator INTEGER DEFAULT 0,
  PRIMARY KEY (room_no, user_no)
);

-- ==================== 聊天記錄表 ====================
CREATE TABLE IF NOT EXISTS talk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  location TEXT NOT NULL,
  uname TEXT NOT NULL,
  handle_name TEXT,
  sentence TEXT NOT NULL,
  font_type TEXT DEFAULT 'normal',
  time INTEGER NOT NULL,
  spend_time INTEGER
);

-- ==================== 投票表 ====================
CREATE TABLE IF NOT EXISTS vote (
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  uname TEXT NOT NULL,
  target_uname TEXT,
  vote_number INTEGER,
  vote_times INTEGER,
  situation TEXT
);

-- ==================== 投票歷史表（詳細版）====================
CREATE TABLE IF NOT EXISTS vote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  voter_uname TEXT NOT NULL,
  target_uname TEXT NOT NULL,
  vote_type TEXT DEFAULT 'normal',
  time INTEGER NOT NULL,
  FOREIGN KEY (room_no) REFERENCES room(room_no)
);

-- ==================== Tripcode 註冊表 ====================
CREATE TABLE IF NOT EXISTS user_trip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- ==================== Tripcode 評分表 ====================
CREATE TABLE IF NOT EXISTS trip_score (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  room INTEGER NOT NULL,
  trip TEXT NOT NULL,
  mess TEXT,
  score INTEGER DEFAULT 0
);

-- ==================== Tripcode 統計表（擴展版）====================
CREATE TABLE IF NOT EXISTS trip_scores (
  trip TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  human_wins INTEGER NOT NULL DEFAULT 0,
  wolf_wins INTEGER NOT NULL DEFAULT 0,
  fox_wins INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  survivor_count INTEGER DEFAULT 0,
  games_22p INTEGER NOT NULL DEFAULT 0,
  wins_22p INTEGER NOT NULL DEFAULT 0,
  games_30p INTEGER NOT NULL DEFAULT 0,
  wins_30p INTEGER NOT NULL DEFAULT 0,
  role_history TEXT,
  last_played INTEGER NOT NULL
);

-- ==================== 頭像表 ====================
CREATE TABLE IF NOT EXISTS user_icon (
  icon_no INTEGER PRIMARY KEY AUTOINCREMENT,
  icon_name TEXT,
  icon_filename TEXT,
  icon_width INTEGER,
  icon_height INTEGER,
  color TEXT,
  session_id TEXT,
  look INTEGER DEFAULT 1
);

-- ==================== 系統訊息表 ====================
CREATE TABLE IF NOT EXISTS system_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER,
  message TEXT,
  type TEXT,
  date INTEGER
);

-- ==================== 管理員 Session 表 ====================
CREATE TABLE IF NOT EXISTS admin_manage (
  session_id TEXT PRIMARY KEY
);

-- ==================== 遺書表 ====================
CREATE TABLE IF NOT EXISTS wills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  uname TEXT NOT NULL,
  handle_name TEXT NOT NULL,
  will TEXT NOT NULL,
  time INTEGER NOT NULL
);

-- ==================== 密語表 ====================
CREATE TABLE IF NOT EXISTS whispers (
  id TEXT PRIMARY KEY,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  from_uname TEXT NOT NULL,
  to_uname TEXT NOT NULL,
  message TEXT NOT NULL,
  time INTEGER NOT NULL
);

-- ==================== 遊戲記錄表 ====================
CREATE TABLE IF NOT EXISTS game_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  winner TEXT NOT NULL,
  total_days INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  roles TEXT NOT NULL,
  death_order TEXT,
  key_events TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_no) REFERENCES room(room_no)
);

-- ==================== 黑名單表 ====================
CREATE TABLE IF NOT EXISTS user_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL
);

-- ==================== 白名單表 ====================
CREATE TABLE IF NOT EXISTS user_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL UNIQUE,
  trust_level INTEGER DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);

-- ==================== NG 用戶表 ====================
CREATE TABLE IF NOT EXISTS ng_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL,
  ng_trip TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(trip, ng_trip)
);

-- ==================== 觀戰者表 ====================
CREATE TABLE IF NOT EXISTS spectators (
  room_no INTEGER NOT NULL,
  trip TEXT NOT NULL,
  handle_name TEXT,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_no, trip),
  FOREIGN KEY (room_no) REFERENCES room(room_no)
);

-- ==================== 遊戲事件表 ====================
CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  related_uname TEXT,
  time INTEGER NOT NULL,
  FOREIGN KEY (room_no) REFERENCES room(room_no)
);

-- ==================== 遊戲設定表 ====================
CREATE TABLE IF NOT EXISTS game_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_name TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT
);

-- ==================== 索引 ====================
CREATE INDEX IF NOT EXISTS idx_talk_room ON talk(room_no, date);
CREATE INDEX IF NOT EXISTS idx_talk_location ON talk(room_no, location);
CREATE INDEX IF NOT EXISTS idx_vote_room ON vote(room_no, date);
CREATE INDEX IF NOT EXISTS idx_vote_history_room ON vote_history(room_no, date);
CREATE INDEX IF NOT EXISTS idx_user_entry_room ON user_entry(room_no);
CREATE INDEX IF NOT EXISTS idx_user_entry_uname ON user_entry(uname);
CREATE INDEX IF NOT EXISTS idx_system_message_room ON system_message(room_no, date);
CREATE INDEX IF NOT EXISTS idx_wills_room ON wills(room_no);
CREATE INDEX IF NOT EXISTS idx_whispers_room ON whispers(room_no);
CREATE INDEX IF NOT EXISTS idx_whisper_from ON whispers(from_uname);
CREATE INDEX IF NOT EXISTS idx_whisper_to ON whispers(to_uname);
CREATE INDEX IF NOT EXISTS idx_game_logs_winner ON game_logs(winner);
CREATE INDEX IF NOT EXISTS idx_game_logs_created ON game_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_blacklist_trip ON user_blacklist(trip);
CREATE INDEX IF NOT EXISTS idx_user_whitelist_trip ON user_whitelist(trip);
CREATE INDEX IF NOT EXISTS idx_ng_users_trip ON ng_users(trip);
CREATE INDEX IF NOT EXISTS idx_spectators_room ON spectators(room_no);
CREATE INDEX IF NOT EXISTS idx_game_events_room ON game_events(room_no, date);
CREATE INDEX IF NOT EXISTS idx_game_events_type ON game_events(event_type);

-- ==================== 預設資料 ====================

-- 插入預設頭像
INSERT INTO user_icon (icon_no, icon_name, icon_filename, icon_width, icon_height, color, look)
VALUES
  (0, '身代わり君用', 'dummy_boy_user_icon.gif', 45, 45, '#000000', 1),
  (1, '明灰', '001.gif', 45, 45, '#DDDDDD', 1),
  (2, '暗灰', '002.gif', 45, 45, '#999999', 1),
  (3, '黄色', '003.gif', 45, 45, '#FFD700', 1),
  (4, '橘色', '004.gif', 45, 45, '#FF9900', 1),
  (5, '紅色', '005.gif', 45, 45, '#FF0000', 1),
  (6, '水色', '006.gif', 45, 45, '#99CCFF', 1),
  (7, '青', '007.gif', 45, 45, '#0066FF', 1),
  (8, '緑', '008.gif', 45, 45, '#00EE00', 1),
  (9, '紫', '009.gif', 45, 45, '#CC00CC', 1),
  (10, '櫻花色', '010.gif', 45, 45, '#FF9999', 1)
ON CONFLICT(icon_no) DO NOTHING;

-- 插入預設遊戲設定
INSERT INTO game_settings (setting_name, setting_value, description)
VALUES
  ('default_time_limit', '300', '預設投票時間限制（秒）'),
  ('silence_mode_enabled', '1', '是否啟用沈默模式'),
  ('silence_mode_timeout', '60', '沈默模式觸發時間（秒）'),
  ('allow_spectators', '1', '是否允許觀戰'),
  ('max_spectators', '10', '最大觀戰人數')
ON CONFLICT(setting_name) DO NOTHING;
