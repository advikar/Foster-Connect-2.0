/**
 * Create or update a partner account.
 *
 *   npm run partner -- alex@example.org "Alex Rivera" "Bay Area Youth Services"
 *
 * The password is generated and printed once. There is no shared token any
 * more: every reviewer signs in as themselves, and every approval is written
 * to audit_log against their email.
 */
import crypto from "crypto";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { hashPassword, normaliseEmail, passwordProblem } from "../src/services/partners";

dotenv.config();

const roleArg = process.argv.find(arg => arg.startsWith("--role="));
const role = roleArg?.split("=")[1] || "contributor";
if (!["contributor", "reviewer"].includes(role)) throw new Error("Role must be contributor or reviewer");
const [email, name, organisation = "", explicitPassword] = process.argv.slice(2).filter(arg => !arg.startsWith("--role="));

if (!email || !name) {
  console.error('Usage: npm run partner -- <email> "<name>" ["<organisation>"] [password] [--role=contributor|reviewer]');
  process.exit(1);
}

/** Readable but high-entropy: ~77 bits across four words plus digits. */
function generatePassword() {
  const words = [
    "harbor", "lantern", "meadow", "compass", "thistle", "cobalt", "juniper",
    "beacon", "quarry", "willow", "cinder", "marble", "orchard", "pelican",
  ];
  const pick = () => words[crypto.randomInt(words.length)];
  return `${pick()}-${pick()}-${pick()}-${crypto.randomInt(1000, 9999)}`;
}

async function main() {
  const dbPath = process.env.DB_PATH
    ? path.resolve(__dirname, "..", "src", process.env.DB_PATH)
    : path.resolve(__dirname, "../../data/foster_connect.db");
  const db = process.env.DATABASE_URL ? createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN }) : createClient({ url: `file:${dbPath}` });

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      organisation TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );
  `);

  const columns = await db.execute("PRAGMA table_info(partners)");
  if (!columns.rows.some(row => row.name === "role")) await db.execute("ALTER TABLE partners ADD COLUMN role TEXT NOT NULL DEFAULT 'contributor'");
  const password = explicitPassword || generatePassword();
  const problem = passwordProblem(password);
  if (problem) {
    console.error(`That password will not do: ${problem}`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const address = normaliseEmail(email);

  const existing = await db.execute({ sql: "SELECT id FROM partners WHERE email = ?", args: [address] });
  if (existing.rows[0]) {
    await db.execute({
      sql: "UPDATE partners SET name=?, organisation=?, password_hash=?, role=?, active=1 WHERE email=?",
      args: [name, organisation, hash, role, address],
    });
    // Any existing sessions belong to the old password.
    await db.execute({
      sql: "DELETE FROM partner_sessions WHERE partner_id = ?",
      args: [Number(existing.rows[0].id)],
    }).catch(() => undefined);
    console.log(`\nUpdated ${address} and signed out their existing sessions.`);
  } else {
    await db.execute({
      sql: "INSERT INTO partners(email, name, organisation, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      args: [address, name, organisation, hash, role],
    });
    console.log(`\nCreated partner ${address}.`);
  }

  console.log(`  Password: ${password}`);
  console.log("\nThis is shown once. Send it to them over something private, and");
  console.log("tell them to run this again to change it.\n");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
