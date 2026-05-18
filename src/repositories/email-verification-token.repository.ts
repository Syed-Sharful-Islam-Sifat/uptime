import pool from "../config/database";

interface VerificationToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
}

export const EmailVerificationTokenRepository = {
  create: async (userId: number, token: string, expiresAt: Date): Promise<void> => {
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt],
    );
  },

  findByToken: async (token: string): Promise<VerificationToken | null> => {
    const result = await pool.query<VerificationToken>(
      `SELECT id, user_id, token, expires_at
       FROM email_verification_tokens WHERE token = $1`,
      [token],
    );
    return result.rows[0] ?? null;
  },

  // Deletes all tokens for a user — called after successful verification and on resend
  deleteByUserId: async (userId: number): Promise<void> => {
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1`,
      [userId],
    );
  },
};
