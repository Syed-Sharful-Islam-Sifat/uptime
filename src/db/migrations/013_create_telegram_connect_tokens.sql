CREATE TABLE IF NOT EXISTS telegram_connect_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_connect_tokens_token   ON telegram_connect_tokens(token);
CREATE INDEX IF NOT EXISTS idx_telegram_connect_tokens_user_id ON telegram_connect_tokens(user_id);
