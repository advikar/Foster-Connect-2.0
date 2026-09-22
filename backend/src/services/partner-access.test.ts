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
  // The columns the partner analytics endpoint reads; the real table comes from the import script.
  await db.execute(`CREATE TABLE resources(id INTEGER PRIMARY KEY, title TEXT, organization TEXT, category TEXT, county TEXT,
    service_area TEXT DEFAULT '', description TEXT DEFAULT '', eligibility TEXT DEFAULT '', application_steps TEXT DEFAULT '', what_to_bring TEXT DEFAULT '',
    cost TEXT DEFAULT '', phone TEXT, website TEXT, hours TEXT, address TEXT, languages TEXT, accessibility TEXT, delivery_mode TEXT DEFAULT '', urgency_level TEXT DEFAULT 'Standard',
    source_url TEXT, age_min INTEGER, age_max INTEGER, is_crisis INTEGER DEFAULT 0, verified_at TEXT, verified_by TEXT DEFAULT '', status TEXT DEFAULT 'verified', tags TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE VIRTUAL TABLE resources_fts USING fts5(title, organization, description, category, county, service_area, eligibility, application_steps, tags, content='resources', content_rowid='id')`);
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
    assert.equal((await request("/analytics")).status, 401);
    const analytics = await request("/analytics", 1);
    assert.equal(analytics.status, 200);
    const stats = await analytics.json() as { totals: { verified: number }; pipeline: { pending: number; rejected: number }; byCategory: unknown[]; freshness: unknown; completeness: unknown; reports: unknown[] };
    assert.equal(Number(stats.pipeline.rejected), 1);
    assert.equal(Number(stats.pipeline.pending), 0);
    assert.ok(Array.isArray(stats.byCategory) && Array.isArray(stats.reports));
    assert.ok(stats.freshness && stats.completeness);
    // Round 4: youth reports can be resolved by a reviewer only, and disappear from analytics once resolved.
    await db.execute("INSERT INTO resources(id,title,organization,category,county,verified_at) VALUES (900,'Duffel bag program','Test org','Basic Needs','Alameda','2026-09-01')");
    // External-content FTS must be told about the row, as the import script does; a 'delete' for an unindexed row corrupts the index.
    await db.execute("INSERT INTO resources_fts(rowid,title,organization,description,category,county,service_area,eligibility,application_steps,tags) SELECT id,title,organization,description,category,county,service_area,eligibility,application_steps,tags FROM resources WHERE id=900");
    await db.execute("INSERT INTO resource_reports(resource_id,session_id,reason) VALUES (900,'test-session','Phone number is wrong')");
    const withReport = await (await request("/analytics", 3)).json() as { reports: { id: number }[] };
    assert.equal(withReport.reports.length, 1);
    assert.equal((await request(`/reports/${withReport.reports[0].id}/resolve`, 1, "POST")).status, 403);
    assert.equal((await request(`/reports/${withReport.reports[0].id}/resolve`, 3, "POST")).status, 204);
    assert.equal((await request(`/reports/${withReport.reports[0].id}/resolve`, 3, "POST")).status, 404);
    const afterResolve = await (await request("/analytics", 3)).json() as { reports: unknown[] };
    assert.equal(afterResolve.reports.length, 0);
    // Partner directory search matches category text and ids, not only titles.
    const byCategory = await (await request("/resources?q=basic%20needs", 1)).json() as { id: number }[];
    assert.ok(byCategory.some(item => item.id === 900));
    const byId = await (await request("/resources?q=900", 1)).json() as { id: number }[];
    assert.ok(byId.some(item => item.id === 900));
    // Round 5: reviewers can change name, category and one or more regions; the region list is normalised and searchable per county.
    assert.equal((await request("/resources/900/changes", 3, "POST", { changes: { county: "Mars" } })).status, 400);
    const edit = await request("/resources/900/changes", 3, "POST", { changes: { title: "Duffel bags for placements", category: "Community Support", county: "contra costa, Alameda" } });
    assert.equal(edit.status, 200);
    const edited = await (await request("/resources/900", 3)).json() as { title: string; category: string; county: string };
    assert.deepEqual([edited.title, edited.category, edited.county], ["Duffel bags for placements", "Community Support", "Alameda, Contra Costa"]);
    assert.equal(edited && (await (await request("/resources/900", 3)).json() as { verifiedAt: string }).verifiedAt, "2026-09-01", "name/category/region edits are not a re-check (A03)");
    assert.equal((await request("/resources/900/changes", 3, "POST", { changes: { phone: "510-555-0100" } })).status, 200);
    assert.notEqual((await (await request("/resources/900", 3)).json() as { verifiedAt: string }).verifiedAt, "2026-09-01", "a contact edit records today's check");
    // Audit A09: a contributor proposal approved by two reviewers at once applies exactly once.
    const proposal = await (await request("/resources/900/changes", 1, "POST", { changes: { cost: "Free" } })).json() as { id: number };
    const approvals = await Promise.all([0, 1].map(() => request(`/changes/${proposal.id}`, 3, "PATCH", { status: "approved" })));
    assert.deepEqual(approvals.map(r => r.status).sort(), [200, 409]);
    assert.equal((await (await request("/resources/900", 3)).json() as { cost: string }).cost, "Free");
    // Audit A06: an age band keeps a program whose maximum sits inside the band.
    await db.execute("UPDATE resources SET age_min=16, age_max=21 WHERE id=900");
    await db.execute("INSERT INTO resources_fts(resources_fts) VALUES ('rebuild')");
    const band = await (await fetch("http://127.0.0.1:4497/api/resources?age=21&ageTo=24&limit=100")).json() as { items: { id: number }[] };
    assert.ok(band.items.some(item => item.id === 900), "21–24 band still shows a program ending at 21");
    const above = await (await fetch("http://127.0.0.1:4497/api/resources?age=25&ageTo=99&limit=100")).json() as { items: { id: number }[] };
    assert.ok(!above.items.some(item => item.id === 900), "25+ excludes a program ending at 21");
    // Audit A05: a one-chip "Food" plan passes validation (schema only; the LLM is off in tests).
    const food = await fetch("http://127.0.0.1:4497/api/roadmaps", { method: "POST", headers: { "Content-Type": "application/json", "x-session-id": "audit-food-only-session-0001" }, body: JSON.stringify({ county: "Alameda", currentNeeds: "Food", futurePlan: "I'm not sure yet", needs: ["Food"] }) });
    assert.notEqual(food.status, 400, `Food-only intake must not fail validation: ${await food.text()}`);
    const inAlameda = await (await request("/resources?county=Alameda", 1)).json() as { id: number }[];
    const inContraCosta = await (await request("/resources?county=Contra%20Costa", 1)).json() as { id: number }[];
    assert.ok(inAlameda.some(item => item.id === 900) && inContraCosta.some(item => item.id === 900));
    const publicAlameda = await (await fetch("http://127.0.0.1:4497/api/resources?county=Alameda&limit=100")).json() as { items?: { id: number }[] } | { id: number }[];
    const publicItems = Array.isArray(publicAlameda) ? publicAlameda : publicAlameda.items ?? [];
    assert.ok(publicItems.some(item => item.id === 900), "youth county search finds a two-county listing");
    // Reviewers remove access (not their own); the removed partner's session stops working; access can be restored.
    assert.equal((await request("/accounts/2/access", 1, "POST", { active: false })).status, 403);
    assert.equal((await request("/accounts/3/access", 3, "POST", { active: false })).status, 400);
    assert.equal((await request("/accounts/2/access", 3, "POST", { active: false })).status, 204);
    assert.equal((await request("/my-submissions", 2)).status, 401);
    const removed = await (await request("/accounts", 3)).json() as { id: number; active: boolean }[];
    assert.equal(removed.find(account => account.id === 2)?.active, false);
    assert.equal((await request("/accounts/2/access", 3, "POST", { active: true })).status, 204);
    // Accounts and password reset (A1/A2)
    assert.equal((await request("/accounts", 1)).status, 403);
    const accounts = await request("/accounts", 3);
    assert.equal(accounts.status, 200);
    const list = await accounts.json() as { id: number; email: string; resetRequested: boolean; submissions: number }[];
    assert.equal(list.length, 3);
    assert.equal(list.find(a => a.id === 1)?.submissions, 1);
    assert.equal((await request("/reset-request", undefined, "POST", { email: "test2@example.org" })).status, 202);
    assert.equal((await request("/reset-request", undefined, "POST", { email: "nobody@example.org" })).status, 202);
    const afterRequest = await (await request("/accounts", 3)).json() as { id: number; resetRequested: boolean }[];
    assert.equal(afterRequest.find(a => a.id === 2)?.resetRequested, true);
    assert.equal((await request("/accounts/2/reset-link", 1, "POST")).status, 403);
    const issued = await request("/accounts/2/reset-link", 3, "POST");
    assert.equal(issued.status, 200);
    const { token } = await issued.json() as { token: string };
    assert.ok(token.length > 20);
    assert.equal((await request("/reset", undefined, "POST", { token, password: "short" })).status, 400);
    assert.equal((await request("/reset", undefined, "POST", { token: "not-a-real-token-at-all", password: "blue-bicycle-harbor-2026" })).status, 400);
    // Audit A11: two simultaneous resets with one token — exactly one succeeds.
    const race = await Promise.all([0, 1].map(() => request("/reset", undefined, "POST", { token, password: "blue-bicycle-harbor-2026" })));
    assert.deepEqual(race.map(r => r.status).sort(), [204, 400], "one reset consumes the token, the other is refused");
    assert.equal((await request("/reset", undefined, "POST", { token, password: "blue-bicycle-harbor-2026" })).status, 400, "a link works once");
    assert.equal((await request("/my-submissions", 2)).status, 401, "reset signs every device out");
    const login = await request("/login", undefined, "POST", { email: "test2@example.org", password: "blue-bicycle-harbor-2026" });
    assert.equal(login.status, 200);
    assert.equal((await request("/logout", 1, "POST")).status, 204);
    assert.equal((await request("/my-submissions", 1)).status, 401);
  } finally {
    child.kill();
    await new Promise<void>(resolve => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once("exit", () => resolve()); });
    db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
