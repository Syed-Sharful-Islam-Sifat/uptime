/**
 * Promotes an existing user to admin by email.
 * Usage: npx tsx src/db/seeds/promote-admin.ts user@example.com
 */
import pool from "../../config/database";

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx src/db/seeds/promote-admin.ts <email>");
  process.exit(1);
}

async function run() {
  const result = await pool.query(
    `UPDATE users SET is_admin = true, updated_at = NOW() WHERE email = $1 RETURNING id, email`,
    [email],
  );

  if (result.rowCount === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ Promoted ${result.rows[0].email} (id: ${result.rows[0].id}) to admin`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
