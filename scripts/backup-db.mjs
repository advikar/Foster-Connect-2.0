// Consistent copy of the local SQLite database into data/backups/<timestamp>.db.
// Uses sqlite3's online backup so a running server does not produce a torn copy.
// Restore: stop the server, then `cp data/backups/<file>.db data/foster_connect.db`.
// Hosted (Turso) databases are not covered here; see docs/DEPLOY.md.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const source = process.env.FC_DB || path.join(root, "data", "foster_connect.db");
if (!existsSync(source)) { console.error(`No database at ${source}`); process.exit(1); }

const dir = path.join(root, "data", "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dir, `foster_connect-${stamp}.db`);

execFileSync("sqlite3", [source, `.backup '${target}'`], { stdio: "inherit" });
const check = execFileSync("sqlite3", [target, "PRAGMA integrity_check; SELECT COUNT(*) FROM resources;"]).toString().trim().split("\n");
console.log(`Backed up to ${target} (${(statSync(target).size / 1024).toFixed(0)} KB). integrity=${check[0]} resources=${check[1]}`);
