-- Replay archive tables
-- talk_archive: preserve chat messages after room cleanup for replay
-- game_events_archive: preserve event timeline after room cleanup
-- vote_history_archive: preserve vote records after room cleanup

CREATE TABLE IF NOT EXISTS talk_archive (
  id INTEGER PRIMARY KEY,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  location TEXT NOT NULL,
  uname TEXT NOT NULL,
  handle_name TEXT,
  sentence TEXT NOT NULL,
  font_type TEXT DEFAULT 'normal',
  time INTEGER NOT NULL,
  spend_time INTEGER,
  archived_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_talk_archive_room ON talk_archive(room_no);

CREATE TABLE IF NOT EXISTS game_events_archive (
  id INTEGER PRIMARY KEY,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  actor TEXT,
  target TEXT,
  time INTEGER NOT NULL,
  archived_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_game_events_archive_room ON game_events_archive(room_no);

CREATE TABLE IF NOT EXISTS vote_history_archive (
  id INTEGER PRIMARY KEY,
  room_no INTEGER NOT NULL,
  date INTEGER NOT NULL,
  round INTEGER,
  voter TEXT,
  candidate TEXT,
  time INTEGER NOT NULL,
  archived_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_vote_history_archive_room ON vote_history_archive(room_no);
