import pool from "../config/database";
import type { User } from "../models/user";

export type SafeUser = Omit<User, "password_hash">;

export const UserRepository = {
  create: async (data: {
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string;
  }): Promise<SafeUser> => {
    const { email, first_name, last_name, password_hash } = data;
    const result = await pool.query<SafeUser>(
      `INSERT INTO users (email, first_name, last_name, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, first_name, last_name, is_email_verified`,
      [email, first_name, last_name, password_hash],
    );
    return result.rows[0]!;
  },

  // Returns password_hash for authentication — callers must never expose this field
  findByEmailWithPassword: async (email: string): Promise<User | null> => {
    const result = await pool.query<User>(
      `SELECT id, email, first_name, last_name, password_hash, is_email_verified
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  },

  findById: async (id: number): Promise<SafeUser | null> => {
    const result = await pool.query<SafeUser>(
      `SELECT id, email, first_name, last_name, is_email_verified FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },

  markEmailVerified: async (userId: number): Promise<void> => {
    await pool.query(
      `UPDATE users SET is_email_verified = true, updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  },
};
