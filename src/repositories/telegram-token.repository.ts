import pool from "../config/database";

export const TelegramTokenRepository = {
  create: async (userId: number, token: string, expiresAt: Date): Promise<void> => {
    await pool.query(`DELETE FROM telegram_connect_tokens WHERE user_id = $1`, [userId]);
    await pool.query(
      `INSERT INTO telegram_connect_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [userId, token, expiresAt],
    );
  },

  findByToken: async (token: string): Promise<{ user_id: number } | null> => {
    const result = await pool.query<{ user_id: number }>(
      `SELECT user_id FROM telegram_connect_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token],
    );
    return result.rows[0] ?? null;
  },

  deleteByToken: async (token: string): Promise<void> => {
    await pool.query(`DELETE FROM telegram_connect_tokens WHERE token = $1`, [token]);
  },

  deleteByUserId: async (userId: number): Promise<void> => {
    await pool.query(`DELETE FROM telegram_connect_tokens WHERE user_id = $1`, [userId]);
  },
};
