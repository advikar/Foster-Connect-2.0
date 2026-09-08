import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@libsql/client";
import { hashToken } from "./partners";

test("partner endpoints enforce authentication, ownership, review roles, and logout", { timeout: 20000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fc-partner-test-"));
  const dbPath = path.join(directory, "test.db");
  const db = createClient({ url: `file:${dbPath}` });
  await db.execute("CREATE TABLE resources(id INTEGER PRIMARY KEY)");
  const child = spawn(process.execPath, [path.resolve(__dirname, "../server.js")], {
    env: { ...process.env, PORT: "4497", HOST: "127.0.0.1", NODE_ENV: "test", DB_PATH: dbPath, DATABASE_URL: "", DATABASE_AUTH_TOKEN: "", LLM_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", data => { stderr += String(data); });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${stderr}`)), 5000);
      child.once("exit", () => { clearTimeout(timer); reject(new Error(`Server exited: ${stderr}`)); });
      child.stdout.on("data", data => { if (String(data).includes("API running")) { clearTimeout(timer); resolve(); } });
    });
    for (const [id, role] of [[1, "contributor"], [2, "contributor"], [3, "reviewer"]] as const) {
      await db.execute({ sql: "INSERT INTO partners(id,email,name,organisation,password_hash,role) VALUES (?,?,?,?,?,?)", args: [id, `test${id}@example.org`, `Test ${id}`, "Test organization", "unused", role] });
      await db.execute({ sql: "INSERT INTO partner_sessions(token_hash,partner_id,expires_at) VALUES (?,?,?)", args: [hashToken(`test-token-${id}`), id, "2099-01-01T00:00:00Z"] });
    }
    const request = (route: string, id?: number, method = "GET", body?: unknown) => fetch(`http://127.0.0.1:4497/api/partner${route}`, { method, headers: { "Content-Type": "application/json", ...(id ? { Authorization: `Bearer test-token-${id}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    assert.equal((await request("/my-submissions")).status, 401);
    assert.equal((await request("/guide", undefined, "POST", {message:"Help draft a service"})).status, 401);
    assert.equal((await request("/submissions", 1)).status, 403);
    assert.equal((await request("/submissions/1", 1, "PATCH", {status:"approved"})).status, 403);
    const create = await request("/my-submissions", 1, "POST", { title:"Test service", organization:"Test organization", description:"A fictional service for integration testing only.", category:"Housing", county:"Alameda", website:"https://example.org", sourceUrl:"https://example.org", relationship:"I work at this organization", submitterName:"Forged name" });
    assert.equal(create.status, 202);
    const mine = await (await request("/my-submissions", 1)).json() as {id: number; submitter_name: string}[];
    assert.equal(mine.length, 1);
    assert.equal(mine[0].submitter_name, "Test 1");
    assert.deepEqual(await (await request("/my-submissions", 2)).json(), []);
    assert.equal((await request("/submissions", 3)).status, 200);
    assert.equal((await request(`/submissions/${mine[0].id}`, 3, "PATCH", {status:"rejected",moderatorNote:"Test review"})).status, 200);
    const reviewed = await (await request("/my-submissions", 1)).json() as {status: string}[];
    assert.equal(reviewed[0].status, "rejected");
    assert.equal((await request("/logout", 1, "POST")).status, 204);
    assert.equal((await request("/my-submissions", 1)).status, 401);
  } finally {
    child.kill();
    await new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("exit", () => resolve()); });
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
