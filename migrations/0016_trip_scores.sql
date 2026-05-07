CREATE TABLE IF NOT EXISTS trip_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_trip TEXT NOT NULL,
  room_id TEXT NOT NULL,
  target_trip TEXT NOT NULL,
  message TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_scores_target_trip ON trip_scores(target_trip, id);
CREATE INDEX IF NOT EXISTS idx_trip_scores_room_id ON trip_scores(room_id);
