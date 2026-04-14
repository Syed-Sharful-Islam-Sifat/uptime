import pool from "../config/database";
import { Monitor, CreateMonitorDTO } from "../models/monitor";

export const MonitorRepository = {
    create: async(data:CreateMonitorDTO)=>{
       const {name , url } = data;
       
       const result = await pool.query<Monitor>(
        `INSERT INTO monitors (name,url,interval,status,monitor_type,created_at,updated_at)
         VALUES($1,$2,5,"pending","free",NOW(),NOW())
         RETURNING *`,
         [name,url]
       )

       return result.rows[0];
    },

   findByUrl: async(url: string): Promise<Monitor | null> => {
    const result = await pool.query<Monitor>(
      `SELECT * FROM monitors WHERE url = $1`,
      [url]
    );
    return result.rows[0] ?? null;
  }
}