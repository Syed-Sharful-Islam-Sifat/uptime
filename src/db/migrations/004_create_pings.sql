CREATE TABLE IF NOT EXISTS pings (
  id           SERIAL PRIMARY KEY,
  monitor_id   INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status       VARCHAR(10) NOT NULL,   -- 'up' | 'down'
  latency      INTEGER,                -- in milliseconds
  response_code INTEGER,               -- 200, 404, 500 etc. NULL if unreachable
  checked_at   TIMESTAMP NOT NULL DEFAULT NOW()
);