CREATE TABLE IF NOT EXISTS monitors (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  url              VARCHAR(255) NOT NULL,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interval         INTEGER NOT NULL DEFAULT 5,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  telegram_chat_id VARCHAR(255),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, url) 
);