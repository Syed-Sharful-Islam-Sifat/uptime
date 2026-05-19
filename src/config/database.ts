import pkg from "pg";
import { env } from "./env";

const { Pool } = pkg;

const pool = new Pool({
  user: env.POSTGRES_USER,
  host: env.HOST,
  database: env.POSTGRES_DB,
  password: env.POSTGRES_PASSWORD,
  port: env.DB_PORT,
});

export const connectDB = async () => {
  const client = await pool.connect();
  
  client.release();
  console.log("DB connected..");
};

export default pool;
