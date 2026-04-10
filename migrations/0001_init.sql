-- 初始化資料庫

-- 房間表
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
  last_updated INTEGER
);

-- 玩家表
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
  PRIMARY KEY (room_no, user_no)
);

-- 聊天記錄表
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

-- 投票表
CREATE TABLE IF NOT EXISTS vote (
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  uname TEXT NOT NULL,
  target_uname TEXT,
  vote_number INTEGER,
  vote_times INTEGER,
  situation TEXT
);

-- Tripcode 註冊表
CREATE TABLE IF NOT EXISTS user_trip (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- Tripcode 評分表
CREATE TABLE IF NOT EXISTS trip_score (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  room INTEGER NOT NULL,
  trip TEXT NOT NULL,
  mess TEXT,
  score INTEGER DEFAULT 0
);

-- 頭像表
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

-- 系統訊息表
CREATE TABLE IF NOT EXISTS system_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER,
  message TEXT,
  type TEXT,
  date INTEGER
);

-- 管理員 Session 表
CREATE TABLE IF NOT EXISTS admin_manage (
  session_id TEXT PRIMARY KEY
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_talk_room ON talk(room_no, date);
CREATE INDEX IF NOT EXISTS idx_talk_location ON talk(room_no, location);
CREATE INDEX IF NOT EXISTS idx_vote_room ON vote(room_no, date);
CREATE INDEX IF NOT EXISTS idx_user_entry_room ON user_entry(room_no);
CREATE INDEX IF NOT EXISTS idx_user_entry_uname ON user_entry(uname);
CREATE INDEX IF NOT EXISTS idx_system_message_room ON system_message(room_no, date);

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


-- Tripcode 評分表
CREATE TABLE IF NOT EXISTS trip_scores (
  trip TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  human_wins INTEGER NOT NULL DEFAULT 0,
  wolf_wins INTEGER NOT NULL DEFAULT 0,
  fox_wins INTEGER NOT NULL DEFAULT 0,
  last_played INTEGER NOT NULL
);

-- 遺書表
CREATE TABLE IF NOT EXISTS wills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  uname TEXT NOT NULL,
  handle_name TEXT NOT NULL,
  will TEXT NOT NULL,
  time INTEGER NOT NULL
);

-- 密語表
CREATE TABLE IF NOT EXISTS whispers (
  id TEXT PRIMARY KEY,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  from_uname TEXT NOT NULL,
  to_uname TEXT NOT NULL,
  message TEXT NOT NULL,
  time INTEGER NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_wills_room ON wills(room_no);
CREATE INDEX IF NOT EXISTS idx_whispers_room ON whispers(room_no);
CREATE INDEX IF NOT EXISTS idx_whisper_from ON whispers(from_uname);
CREATE INDEX IF NOT EXISTS idx_whisper_to ON whispers(to_uname);
