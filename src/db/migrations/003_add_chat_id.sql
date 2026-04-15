-- 002_add_telegram_chat_id.sql
ALTER TABLE monitors
ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(255);