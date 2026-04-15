import pool from "../config/database";
import { Ping } from "../models/ping";

export const PingRepository = {
  create: async (data: {
    monitor_id: number;
    status: "up" | "down";
    latency: number | null;
    response_code: number | null;
  }): Promise<Ping> => {
    const { monitor_id, status, latency, response_code } = data;

    const result = await pool.query<any>(
      `INSERT INTO pings (monitor_id, status, latency, response_code, checked_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [monitor_id, status, latency, response_code]
    );

    return result.rows[0];
  },

  // get last ping for a monitor — to check if we already alerted
  findLastByMonitorId: async (monitor_id: number): Promise<Ping | null> => {
    const result = await pool.query<Ping>(
      `SELECT * FROM pings
       WHERE monitor_id = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [monitor_id]
    );
    return result.rows[0] ?? null;
  },

  // get all pings for a monitor with pagination
  findAllByMonitorId: async (
    monitor_id: number,
    limit = 20,
    offset = 0
  ): Promise<Ping[]> => {
    const result = await pool.query<Ping>(
      `SELECT * FROM pings
       WHERE monitor_id = $1
       ORDER BY checked_at DESC
       LIMIT $2 OFFSET $3`,
      [monitor_id, limit, offset]
    );
    return result.rows;
  },

  // get uptime percentage for a monitor (last 100 pings)
  getUptimePercentage: async (monitor_id: number): Promise<number> => {
    const result = await pool.query<{ uptime: string }>(
      `SELECT
        ROUND(
          COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS uptime
       FROM (
         SELECT status FROM pings
         WHERE monitor_id = $1
         ORDER BY checked_at DESC
         LIMIT 100
       ) recent`,
      [monitor_id]
    );
    return parseFloat(result.rows[0]?.uptime ?? "0");
  },
};