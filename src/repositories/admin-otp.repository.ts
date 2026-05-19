import pool from "../config/database";
import type { AdminOtp } from "../models/admin";

export const AdminOtpRepository = {
  upsert: async (email: string, code: string, expiresAt: Date): Promise<void> => {
    // Delete any existing OTP for this email then insert a fresh one
    await pool.query(`DELETE FROM admin_otps WHERE email = $1`, [email]);
    await pool.query(
      `INSERT INTO admin_otps (email, code, expires_at, created_at) VALUES ($1, $2, $3, NOW())`,
      [email, code, expiresAt],
    );
  },

  findByEmail: async (email: string): Promise<AdminOtp | null> => {
    const result = await pool.query<AdminOtp>(
      `SELECT id, email, code, expires_at, created_at FROM admin_otps WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  },

  deleteByEmail: async (email: string): Promise<void> => {
    await pool.query(`DELETE FROM admin_otps WHERE email = $1`, [email]);
  },
};
