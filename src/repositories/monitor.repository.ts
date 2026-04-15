import pool from "../config/database";
import { Monitor, CreateMonitorDTO } from "../models/monitor";

export const MonitorRepository = {
create: async (data: CreateMonitorDTO, id:string): Promise<any> => {
  const { name, url} = data;

  const result = await pool.query(
    `INSERT INTO monitors 
     (name, url, user_id, interval, status, telegram_chat_id, created_at, updated_at)
     VALUES ($1, $2, $3, 5, 'pending', $4, NOW(), NOW())
     RETURNING *`,
    [name, url, id]
  );

  return result.rows[0];
},

  findByUrl: async (url: string): Promise<Monitor | null> => {
    const result = await pool.query<Monitor>(
      `SELECT * FROM monitors WHERE url = $1`,
      [url]
    );
    return result.rows[0] ?? null;
  },

  findAll: async (): Promise<Monitor[]> => {
    const result = await pool.query<Monitor>(
      `SELECT * FROM monitors ORDER BY created_at DESC`
    );
    return result.rows;
  },

  findById: async (id: string): Promise<Monitor | null> => {
    const result = await pool.query<Monitor>(
      `SELECT * FROM monitors WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  delete: async (id: string): Promise<boolean> => {
    const result = await pool.query(
      `DELETE FROM monitors WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },
};