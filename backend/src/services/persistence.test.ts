import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { publishSubmission, persistRoadmap, type PublishDetail } from "./persistence";

/**
 * FC-04: multi-table writes are atomic and publishing is exactly-once.
 * Every test gets its own temporary SQLite file. Fixtures are synthetic.
 */

const SCHEMA = `
  CREATE TABLE resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, organization TEXT NOT NULL, description TEXT NOT NULL,
    category TEXT NOT NULL, county TEXT NOT NULL, service_area TEXT NOT NULL,
    eligibility TEXT NOT NULL, age_min INTEGER, age_max INTEGER, cost TEXT NOT NULL,
    application_steps TEXT NOT NULL, what_to_bring TEXT NOT NULL, website TEXT, phone TEXT,
    address TEXT, hours TEXT, languages TEXT, accessibility TEXT, delivery_mode TEXT NOT NULL,
    urgency_level TEXT NOT NULL, is_crisis INTEGER NOT NULL DEFAULT 0, source_url TEXT NOT NULL,
    verified_at TEXT NOT NULL, verified_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'verified',
    tags TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    kind TEXT NOT NULL DEFAULT 'service'
  );
  CREATE VIRTUAL TABLE resources_fts USING fts5(
    title, organization, description, category, county, service_area,
    eligibility, application_steps, tags, content='resources', content_rowid='id'
  );
  CREATE TABLE resource_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL, organization TEXT NOT NULL, description TEXT NOT NULL,
    category TEXT NOT NULL, county TEXT NOT NULL, website TEXT NOT NULL,
    contact TEXT, source_url TEXT NOT NULL, relationship TEXT NOT NULL,
    submitter_name TEXT NOT NULL DEFAULT 'Anonymous', status TEXT NOT NULL DEFAULT 'pending',
    moderator_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT,
    partner_id INTEGER, resource_id INTEGER, reviewed_by TEXT,
    kind TEXT NOT NULL DEFAULT 'service'
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, partner_id INTEGER, partner_email TEXT NOT NULL,
    action TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER,
    detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, title TEXT NOT NULL,
    goal_summary TEXT NOT NULL, greeting TEXT NOT NULL, closing TEXT NOT NULL, county TEXT NOT NULL,
    youth_name TEXT NOT NULL DEFAULT 'Friend', intake_json TEXT, status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE roadmap_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, task_text TEXT NOT NULL, task_category TEXT NOT NULL,
    timeframe TEXT NOT NULL, why_it_matters TEXT NOT NULL, motivation_note TEXT,
    status TEXT NOT NULL DEFAULT 'not_started', due_date TEXT, blocker_reason TEXT, private_note TEXT,
    resource_id INTEGER REFERENCES resources(id), task_order INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

async function freshDb(): Promise<{ db: Client; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(path.join(tmpdir(), "fc-persist-"));
  const db = createClient({ url: `file:${path.join(directory, "t.db")}` });
  await db.execute("PRAGMA foreign_keys = ON");
  await db.executeMultiple(SCHEMA);
  return { db, cleanup: async () => { db.close(); await rm(directory, { recursive: true, force: true }); } };
}

async function seedSubmission(db: Client) {
  const r = await db.execute(
    `INSERT INTO resource_submissions(title, organization, description, category, county, website, source_url, relationship, partner_id)
     VALUES ('Test service', 'Test org', 'Fictional, for tests.', 'Housing', 'Alameda', 'https://example.org', 'https://example.org', 'staff', 1)`,
  );
  return Number(r.lastInsertRowid);
}

const count = async (db: Client, table: string) => Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);

const ACTOR = { id: 3, email: "reviewer@example.org" };
const DETAIL: PublishDetail = {
  eligibility: "Foster youth 16-24", cost: "Free", applicationSteps: "Call and ask",
  whatToBring: "ID", serviceArea: "", phone: "510-555-0100", address: "", hours: "", languages: "",
  accessibility: "", deliveryMode: "In person", urgencyLevel: "Standard", isCrisis: false,
};

const PLAN = {
  title: "Plan", goalSummary: "Summary", greeting: "Hi", closing: "Bye", county: "Alameda",
  youthName: "Friend", intake: { needs: ["Housing"] },
  tasks: [1, 2, 3, 4].map(n => ({
    taskText: `Task ${n}`, taskCategory: "General", timeframe: "This Week",
    whyItMatters: "why", motivationNote: "note", resourceId: null as number | null,
  })),
};

// ─── Publishing ─────────────────────────────────────────────────────────────

test("publishing writes resource, search index, submission link, and audit together", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    const result = await publishSubmission(db, id, ACTOR, DETAIL, "looks good", "2026-09-08");
    assert.ok(result.ok);
    assert.equal(await count(db, "resources"), 1);
    const fts = await db.execute("SELECT rowid FROM resources_fts WHERE resources_fts MATCH 'Test'");
    assert.equal(fts.rows.length, 1);
    const sub = (await db.execute({ sql: "SELECT * FROM resource_submissions WHERE id=?", args: [id] })).rows[0];
    assert.equal(sub.status, "approved");
    assert.equal(Number(sub.resource_id), result.resourceId);
    assert.equal(sub.reviewed_by, ACTOR.email);
    assert.equal(await count(db, "audit_log"), 2);
  } finally { await cleanup(); }
});

test("a failure after the resource insert leaves no partial publish behind", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    // Injected failure: the search index is gone, so step two of four throws.
    await db.execute("DROP TABLE resources_fts");
    await assert.rejects(publishSubmission(db, id, ACTOR, DETAIL, ""));
    assert.equal(await count(db, "resources"), 0, "resource row rolled back");
    assert.equal(await count(db, "audit_log"), 0, "no audit of a publish that did not happen");
    const sub = (await db.execute({ sql: "SELECT status, resource_id FROM resource_submissions WHERE id=?", args: [id] })).rows[0];
    assert.equal(sub.status, "pending");
    assert.equal(sub.resource_id, null);
  } finally { await cleanup(); }
});

test("a failure on the audit write also rolls back the resource", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    await db.execute("DROP TABLE audit_log");
    await assert.rejects(publishSubmission(db, id, ACTOR, DETAIL, ""));
    assert.equal(await count(db, "resources"), 0);
    const sub = (await db.execute({ sql: "SELECT status, resource_id FROM resource_submissions WHERE id=?", args: [id] })).rows[0];
    assert.equal(sub.status, "pending");
    assert.equal(sub.resource_id, null);
  } finally { await cleanup(); }
});

test("ten simultaneous approvals publish exactly one resource", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => publishSubmission(db, id, { id: i, email: `r${i}@example.org` }, DETAIL, `note ${i}`)),
    );
    const wins = results.filter(r => r.ok);
    assert.equal(wins.length, 1);
    assert.ok(results.filter(r => !r.ok).every(r => r.reason === "already_published"));
    assert.equal(await count(db, "resources"), 1);
    assert.equal(await count(db, "audit_log"), 2);
    assert.equal(Number((await db.execute("SELECT COUNT(*) AS n FROM resources_fts WHERE resources_fts MATCH 'Test'")).rows[0].n), 1);
  } finally { await cleanup(); }
});

test("a second approval after the first is refused, not duplicated", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    assert.ok((await publishSubmission(db, id, ACTOR, DETAIL, "")).ok);
    const again = await publishSubmission(db, id, ACTOR, DETAIL, "");
    assert.deepEqual(again, { ok: false, reason: "already_published" });
    assert.equal(await count(db, "resources"), 1);
  } finally { await cleanup(); }
});

test("a submission that was already claimed by another instance is not re-published", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const id = await seedSubmission(db);
    // Simulate another server instance having published between reads.
    await db.execute({ sql: "UPDATE resource_submissions SET resource_id = 4242 WHERE id = ?", args: [id] });
    const result = await publishSubmission(db, id, ACTOR, DETAIL, "");
    assert.deepEqual(result, { ok: false, reason: "already_published" });
    assert.equal(await count(db, "resources"), 0);
  } finally { await cleanup(); }
});

test("publishing a missing submission reports not_found", async () => {
  const { db, cleanup } = await freshDb();
  try {
    assert.deepEqual(await publishSubmission(db, 999, ACTOR, DETAIL, ""), { ok: false, reason: "not_found" });
  } finally { await cleanup(); }
});

// ─── Plans ──────────────────────────────────────────────────────────────────

test("a plan is stored with every task", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const roadmapId = await persistRoadmap(db, "session-a", PLAN);
    assert.ok(roadmapId > 0);
    assert.equal(await count(db, "roadmaps"), 1);
    const tasks = await db.execute({ sql: "SELECT task_order FROM roadmap_tasks WHERE roadmap_id=? ORDER BY task_order", args: [roadmapId] });
    assert.deepEqual(tasks.rows.map(r => Number(r.task_order)), [0, 1, 2, 3]);
  } finally { await cleanup(); }
});

test("a failing task insert leaves no headless plan", async () => {
  const { db, cleanup } = await freshDb();
  try {
    // Third task points at a resource that does not exist; FK is on.
    const plan = { ...PLAN, tasks: PLAN.tasks.map((t, i) => (i === 2 ? { ...t, resourceId: 123456 } : t)) };
    await assert.rejects(persistRoadmap(db, "session-b", plan));
    assert.equal(await count(db, "roadmaps"), 0, "plan row rolled back");
    assert.equal(await count(db, "roadmap_tasks"), 0);
  } finally { await cleanup(); }
});

test("concurrent plan creation for different sessions does not interleave ids", async () => {
  const { db, cleanup } = await freshDb();
  try {
    const ids = await Promise.all(["s1", "s2", "s3", "s4"].map(s => persistRoadmap(db, s, PLAN)));
    assert.equal(new Set(ids).size, 4);
    for (const id of ids) {
      const rows = await db.execute({ sql: "SELECT DISTINCT session_id FROM roadmap_tasks WHERE roadmap_id=?", args: [id] });
      assert.equal(rows.rows.length, 1, "each plan's tasks belong to exactly one session");
    }
    assert.equal(await count(db, "roadmap_tasks"), 16);
  } finally { await cleanup(); }
});
