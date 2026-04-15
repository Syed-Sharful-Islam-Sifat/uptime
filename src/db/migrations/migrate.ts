import pool from "../../config/database";
import fs from "fs";
import path from "path";

const runMigrations = async () => {
  const migrationsDir = __dirname;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort(); // runs 001_, 002_, 003_ in order

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    try {
      await pool.query(sql);
      console.log(`✅ Ran: ${file}`);
    } catch (error: any) {
      // skip "already exists" errors so re-running is safe
      if (error.code === "42P07") {
        console.log(`⏭️  Skipped (already exists): ${file}`);
      } else {
        console.error(`❌ Failed: ${file}`, error.message);
        process.exit(1);
      }
    }
  }

  console.log("✅ All migrations complete");
  await pool.end();
};

runMigrations();