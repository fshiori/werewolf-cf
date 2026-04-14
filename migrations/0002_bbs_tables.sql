-- BBS 討論板系統

-- 討論串主表
CREATE TABLE IF NOT EXISTS bbs_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author_trip TEXT,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 回覆表
CREATE TABLE IF NOT EXISTS bbs_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  author_trip TEXT,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES bbs_threads(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bbs_threads_pinned ON bbs_threads(is_pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbs_threads_updated ON bbs_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bbs_replies_thread ON bbs_replies(thread_id, created_at ASC);
