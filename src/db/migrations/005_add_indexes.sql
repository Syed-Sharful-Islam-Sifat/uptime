-- monitors: fast lookup of all monitors belonging to a user
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);

-- monitors: partial index for the cron job cursor scan (only 'up' rows, ordered by id)
-- Partial indexes only cover rows that match the condition, keeping the index small.
CREATE INDEX IF NOT EXISTS idx_monitors_active_id ON monitors(id) WHERE status = 'up';

-- pings: composite index for cursor-based pagination (filter by monitor, page by id)
-- monitor_id must come first — the DB uses it as the leading prefix for equality filtering.
CREATE INDEX IF NOT EXISTS idx_pings_monitor_id_id ON pings(monitor_id, id DESC);
