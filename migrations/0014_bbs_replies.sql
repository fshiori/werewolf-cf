CREATE TABLE IF NOT EXISTS bbs_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  trip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES bbs_topics(id)
);

CREATE INDEX IF NOT EXISTS idx_bbs_replies_topic_id ON bbs_replies(topic_id);
