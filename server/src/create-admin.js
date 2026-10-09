import './env.js';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { migrate } from './migrate.js';

// First super-admin bootstrap. The password is read from the environment so it never appears in shell history
// arguments or logs:
//   ADMIN_PASSWORD='...' npm run create-admin -- you@example.org "Your Name"
// Running it again for an existing email promotes that account to admin and resets nothing else.
const [email, name = 'Administrator'] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('usage: ADMIN_PASSWORD=... npm run create-admin -- <email> [name]');
  await migrate();
  const normalized = email.trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [normalized]);
  if (existing.rowCount) {
    await pool.query("UPDATE users SET role = 'admin', active = true WHERE id = $1", [existing.rows[0].id]);
    console.log(`Promoted existing account ${normalized} to admin.`);
    return;
  }
  if (!password || password.length < 12) throw new Error('Set ADMIN_PASSWORD (12+ characters) to create a new admin account.');
  await pool.query("INSERT INTO users(name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [name, normalized, await bcrypt.hash(password, 12)]);
  await pool.query("INSERT INTO audit_log(actor_name, action, target) VALUES ('system', 'Created first admin', $1)", [normalized]);
  console.log(`Created admin ${normalized}.`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
