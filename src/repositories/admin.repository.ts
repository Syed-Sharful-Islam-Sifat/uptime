import pool from "../config/database";
import type { Admin } from "../models/admin";

export const AdminRepository = {
  findByEmail: async (email: string): Promise<Admin | null> => {
    const result = await pool.query<Admin>(
      `SELECT id, email, created_at FROM admins WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  },
};
