-- 成就系統

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  UNIQUE(trip, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_trip ON achievements(trip);
