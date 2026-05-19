import HttpError from "../lib/helper/HttpError";
import pool from "../config/database";
import type { Monitor } from "../models/monitor";
import type { CreateMonitorInput } from "../schemas/monitor.schema";

const MONITOR_FIELDS = `id, user_id, name, url, interval, status, telegram_chat_id, created_at, updated_at`;

export const MonitorRepository = {
  create: async (data: CreateMonitorInput, userId: number, interval = 5): Promise<Monitor> => {
    const { name, url, telegram_chat_id } = data;
    try {
      const result = await pool.query<Monitor>(
        `INSERT INTO monitors (name, url, user_id, interval, status, telegram_chat_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())
         RETURNING ${MONITOR_FIELDS}`,
        [name, url, userId, interval, telegram_chat_id ?? null],
      );
      return result.rows[0]!;
    } catch (err: unknown) {
      // Unique constraint (user_id, url) violation — same user can't monitor same URL twice
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505") {
        throw new HttpError({ statusCode: 409, message: "You are already monitoring this URL" });
      }
      throw err;
    }
  },

  findAllByUserId: async (userId: number): Promise<Monitor[]> => {
    const result = await pool.query<Monitor>(
      `SELECT ${MONITOR_FIELDS} FROM monitors WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  // Used by cron job — cursor-based batch to avoid loading full table into memory
  findActiveBatch: async (afterId: number, limit: number): Promise<Monitor[]> => {
    const result = await pool.query<Monitor>(
      `SELECT ${MONITOR_FIELDS} FROM monitors
       WHERE id > $1
       ORDER BY id ASC LIMIT $2`,
      [afterId, limit],
    );
    return result.rows;
  },

  findById: async (id: string): Promise<Monitor | null> => {
    const result = await pool.query<Monitor>(
      `SELECT ${MONITOR_FIELDS} FROM monitors WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  countByUserId: async (userId: number): Promise<number> => {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM monitors WHERE user_id = $1`,
      [userId],
    );
    return parseInt(result.rows[0]!.count, 10);
  },

  updateStatus: async (id: number, status: "up" | "down" | "pending"): Promise<void> => {
    await pool.query(
      `UPDATE monitors SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id],
    );
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query(`DELETE FROM monitors WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
