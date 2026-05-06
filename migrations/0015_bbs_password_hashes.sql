ALTER TABLE bbs_topics ADD COLUMN password_hash TEXT;
ALTER TABLE bbs_replies ADD COLUMN password_hash TEXT;
