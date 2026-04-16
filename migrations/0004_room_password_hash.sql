-- 新增房間密碼欄位
ALTER TABLE room ADD COLUMN password_hash TEXT DEFAULT NULL;
