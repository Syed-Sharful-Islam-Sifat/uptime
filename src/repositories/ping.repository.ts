import pool from "../config/database";
import type { Ping } from "../models/ping";

const PING_FIELDS = `id, monitor_id, status, latency, response_code, checked_at`;

export const PingRepository = {
  create: async (data: {
    monitor_id: number;
    status: "up" | "down";
    latency: number | null;
    response_code: number | null;
  }): Promise<Ping> => {
    const { monitor_id, status, latency, response_code } = data;
    const result = await pool.query<Ping>(
      `INSERT INTO pings (monitor_id, status, latency, response_code, checked_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING ${PING_FIELDS}`,
      [monitor_id, status, latency, response_code],
    );
    return result.rows[0]!;
  },

  findLastByMonitorId: async (monitor_id: number): Promise<Ping | null> => {
    const result = await pool.query<Ping>(
      `SELECT ${PING_FIELDS} FROM pings
       WHERE monitor_id = $1
       ORDER BY id DESC LIMIT 1`,
      [monitor_id],
    );
    return result.rows[0] ?? null;
  },

  // Cursor-based pagination — avoids expensive OFFSET sequential scans.
  // Pass cursor = last seen ping id; omit for first page.
  findByMonitorId: async (
    monitor_id: number,
    limit: number,
    cursor?: number,
  ): Promise<Ping[]> => {
    if (cursor !== undefined) {
      const result = await pool.query<Ping>(
        `SELECT ${PING_FIELDS} FROM pings
         WHERE monitor_id = $1 AND id < $2
         ORDER BY id DESC LIMIT $3`,
        [monitor_id, cursor, limit],
      );
      return result.rows;
    }

    const result = await pool.query<Ping>(
      `SELECT ${PING_FIELDS} FROM pings
       WHERE monitor_id = $1
       ORDER BY id DESC LIMIT $2`,
      [monitor_id, limit],
    );
    return result.rows;
  },

  // Calculates uptime over the most recent 100 pings
  getUptimePercentage: async (monitor_id: number): Promise<number> => {
    const result = await pool.query<{ uptime: string }>(
      `SELECT ROUND(
          COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2
        ) AS uptime
       FROM (
         SELECT status FROM pings
         WHERE monitor_id = $1
         ORDER BY id DESC LIMIT 100
       ) recent`,
      [monitor_id],
    );
    return parseFloat(result.rows[0]?.uptime ?? "0");
  },
};
