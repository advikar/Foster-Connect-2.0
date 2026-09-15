import crypto from "crypto";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createClient, type Row } from "@libsql/client";
import { z } from "zod";
import {
  generateGroundedRoadmap,
  getPartnerGuideResponse,
  getNavigatorResponse,
  ProviderError,
  type GroundedResource,
  type HistoryMessage,
} from "./services/ai.service";
import { assessSafety, assessFields, type SafetyAssessment } from "./services/safety";
import { buildAllowList, sanitiseReply, signHistory, verifyHistory, type SignedMessage } from "./services/grounding";
import { canReview, hashPassword, hashToken, newSessionToken, normaliseEmail, passwordProblem, verifyPassword, type Partner } from "./services/partners";
import { contactsFor, CRISIS_CONTACTS, CRISIS_REPLIES, CONCERN_NOTE, type CrisisCategory } from "./config/crisis";
import { audit, executeSerialised, persistRoadmap, publishSubmission } from "./services/persistence";

dotenv.config();

const app = express();
// Hosts put a proxy in front of the app; without this every visitor shares one
// rate-limit bucket and real youth start getting blocked (audit B-05).
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 4000);
/**
 * Database connection.
 *
 * Local development uses a SQLite file. Production must not: most hosts give a
 * fresh filesystem on every deploy, so a file-backed database silently loses
 * every plan, saved resource, and pending submission with no error at all.
 *
 * DATABASE_URL points at hosted libSQL (Turso). @libsql/client speaks to both,
 * so no query in this file changes.
 */
const remoteUrl = process.env.DATABASE_URL;
const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.resolve(__dirname, "../../data/foster_connect.db");

if (!remoteUrl && process.env.NODE_ENV === "production") {
  console.error(
    "DATABASE_URL is not set. A file-backed database in production loses all " +
    "user data on every deploy. Refusing to start.",
  );
  process.exit(1);
}

const db = remoteUrl
  ? createClient({ url: remoteUrl, authToken: process.env.DATABASE_AUTH_TOKEN })
  : createClient({ url: `file:${dbPath}` });

console.log(remoteUrl ? "Database: hosted libSQL" : `Database: local file ${dbPath}`);

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(origin => origin.trim());

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "40kb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/chat", rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/roadmaps", rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }));

type SessionRequest = Request & { sessionId?: string };

function asyncRoute(handler: (req: SessionRequest, res: Response) => Promise<void>) {
  return (req: SessionRequest, res: Response, next: NextFunction) => handler(req, res).catch(next);
}

function requireSession(req: SessionRequest, res: Response, next: NextFunction) {
  const sessionId = req.header("x-session-id");
  if (!sessionId || !/^[a-zA-Z0-9-]{20,80}$/.test(sessionId)) {
    res.status(400).json({ error: "A valid anonymous session is required" });
    return;
  }
  req.sessionId = sessionId;
  next();
}

type PartnerRequest = Request & { partner?: Partner };

/**
 * Real partner authentication.
 *
 * The previous version compared against one shared token from the environment,
 * so every reviewer was the same anonymous actor and revoking one person meant
 * changing it for everyone. Sessions are now per-account, expiring, and
 * revocable, and every moderation action is written to audit_log.
 */
async function requirePartner(req: PartnerRequest, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "Sign in to review submissions" });
      return;
    }
    const result = await db.execute({
      sql: `SELECT p.id, p.email, p.name, p.organisation, p.active, p.role, s.expires_at
            FROM partner_sessions s JOIN partners p ON p.id = s.partner_id
            WHERE s.token_hash = ?`,
      args: [hashToken(token)],
    });
    const row = result.rows[0];
    if (!row) {
      res.status(401).json({ error: "Your session has expired. Sign in again." });
      return;
    }
    if (new Date(String(row.expires_at)) < new Date()) {
      await db.execute({ sql: "DELETE FROM partner_sessions WHERE token_hash = ?", args: [hashToken(token)] });
      res.status(401).json({ error: "Your session has expired. Sign in again." });
      return;
    }
    if (!Number(row.active)) {
      res.status(403).json({ error: "This account has been deactivated." });
      return;
    }
    req.partner = {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      organisation: String(row.organisation || ""),
      active: true,
      role: row.role === "reviewer" ? "reviewer" : "contributor",
    };
    next();
  } catch (error) {
    next(error);
  }
}

function requireReviewer(req: PartnerRequest, res: Response, next: NextFunction) {
  if (!req.partner || !canReview(req.partner)) {
    res.status(403).json({ error: "Reviewer access is required to publish resources." });
    return;
  }
  next();
}

async function recordAudit(
  partner: Partner,
  action: string,
  targetType: string,
  targetId: number | null,
  detail = "",
) {
  await executeSerialised(db, audit(partner, action, targetType, targetId, detail));
}

function rowString(row: Row, key: string) {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

function mapResource(row: Row): GroundedResource {
  return {
    id: Number(row.id),
    title: rowString(row, "title"),
    organization: rowString(row, "organization"),
    description: rowString(row, "description"),
    category: rowString(row, "category"),
    county: rowString(row, "county"),
    serviceArea: rowString(row, "service_area"),
    eligibility: rowString(row, "eligibility"),
    ageMin: row.age_min === null ? null : Number(row.age_min),
    ageMax: row.age_max === null ? null : Number(row.age_max),
    cost: rowString(row, "cost"),
    applicationSteps: rowString(row, "application_steps"),
    whatToBring: rowString(row, "what_to_bring"),
    website: rowString(row, "website"),
    phone: rowString(row, "phone"),
    address: rowString(row, "address"),
    hours: rowString(row, "hours"),
    languages: rowString(row, "languages"),
    accessibility: rowString(row, "accessibility"),
    deliveryMode: rowString(row, "delivery_mode"),
    urgencyLevel: rowString(row, "urgency_level"),
    isCrisis: Boolean(row.is_crisis),
    sourceUrl: rowString(row, "source_url"),
    verifiedAt: rowString(row, "verified_at"),
    /** How the listing was checked: "phone" when a reviewer confirmed it by calling, otherwise "online". */
    checkedHow: /phone|line confirmed|called/i.test(rowString(row, "verified_by")) ? "phone" : "online",
    tags: rowString(row, "tags"),
  };
}

function mapTask(row: Row) {
  return {
    id: Number(row.id),
    roadmapId: Number(row.roadmap_id),
    taskText: rowString(row, "task_text"),
    taskCategory: rowString(row, "task_category"),
    timeframe: rowString(row, "timeframe"),
    whyItMatters: rowString(row, "why_it_matters"),
    motivationNote: rowString(row, "motivation_note"),
    status: rowString(row, "status") || "not_started",
    dueDate: row.due_date ? String(row.due_date) : null,
    blockerReason: row.blocker_reason ? String(row.blocker_reason) : null,
    privateNote: row.private_note ? String(row.private_note) : null,
    resourceId: row.resource_id === null ? null : Number(row.resource_id),
    taskOrder: Number(row.task_order || 0),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: rowString(row, "created_at"),
  };
}

function mapRoadmap(row: Row) {
  return {
    id: Number(row.id),
    title: rowString(row, "title"),
    goalSummary: rowString(row, "goal_summary"),
    greeting: rowString(row, "greeting"),
    closing: rowString(row, "closing"),
    county: rowString(row, "county"),
    youthName: rowString(row, "youth_name"),
    status: rowString(row, "status"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

const synonyms: Record<string, string[]> = {
  housing: ["shelter", "rent", "apartment", "transitional", "homeless"],
  employment: ["job", "work", "career", "resume", "interview"],
  education: ["college", "school", "class", "scholarship", "tuition"],
  transportation: ["ride", "bus", "transit", "car"],
  food: ["hungry", "groceries", "meal", "pantry"],
  healthcare: ["doctor", "clinic", "medical", "health"],
  documents: ["identification", "id", "birth", "social security"],
};

function searchTerms(query: string) {
  const base = query.toLowerCase().match(/[a-z0-9]+/g)?.filter(term => term.length > 2) || [];
  const expanded = new Set(base);
  for (const [concept, words] of Object.entries(synonyms)) {
    if (base.some(term => term === concept || words.includes(term))) {
      expanded.add(concept);
      words.forEach(word => expanded.add(word));
    }
  }
  return [...expanded].slice(0, 18);
}

/** One place that decides which resources a query may return, so the list
 *  query and the count query can never drift apart. */
function buildResourceFilters(options: {
  county?: string; category?: string; urgency?: string; age?: number;
}) {
  const filters = ["r.status = 'verified'"];
  const args: (string | number)[] = [];
  if (options.county && options.county !== "All") {
    // Regional records ("Bay Area") and statewide/national records must surface
    // for a county search, or they become unreachable entirely (audit D-02).
    filters.push("(r.county = ? OR r.county IN ('California', 'National', 'Bay Area'))");
    args.push(options.county);
  }
  if (options.category && options.category !== "All") {
    filters.push("r.category = ?");
    args.push(options.category);
  }
  if (options.urgency && options.urgency !== "All") {
    filters.push("r.urgency_level = ?");
    args.push(options.urgency);
  }
  if (options.age !== undefined) {
    filters.push("(r.age_min IS NULL OR r.age_min <= ?) AND (r.age_max IS NULL OR r.age_max >= ?)");
    args.push(options.age, options.age);
  }
  return { filters, args };
}

async function listVerifiedResources(options: {
  query?: string;
  county?: string;
  category?: string;
  urgency?: string;
  age?: number;
  limit?: number;
  offset?: number;
  /** "relevance" (default with a query), "checked" (most recently checked first) or "name". */
  sort?: "relevance" | "checked" | "name";
}) {
  const { filters, args } = buildResourceFilters(options);

  const terms = options.query ? searchTerms(options.query) : [];
  const explicitOrder = options.sort === "checked" ? "r.verified_at DESC, r.title ASC" : options.sort === "name" ? "r.title ASC" : null;
  let sql: string;
  if (terms.length) {
    // Column weights: a word in the title or category says far more about a
    // listing than the same word buried in its description. Without these a
    // crisis text line whose blurb mentions "a safe place to stay" outranked
    // every actual housing programme for "housing".
    // Columns: title, organization, description, category, county, service_area,
    // eligibility, application_steps, tags.
    // bm25 is negative (more negative = better). Crisis lines are always one
    // tap away in the crisis bar, so a plain search ranks them after programmes.
    sql = `SELECT r.*, bm25(resources_fts, 12.0, 4.0, 1.0, 10.0, 1.0, 1.0, 2.0, 1.0, 6.0) + (r.is_crisis * 4.0) AS relevance
           FROM resources_fts JOIN resources r ON r.id = resources_fts.rowid
           WHERE resources_fts MATCH ? AND ${filters.join(" AND ")}
           ORDER BY ${explicitOrder ?? "relevance ASC, r.verified_at DESC"} LIMIT ?`;
    args.unshift(terms.map(term => `"${term}"`).join(" OR "));
  } else {
    sql = `SELECT r.* FROM resources r WHERE ${filters.join(" AND ")}
           ORDER BY ${explicitOrder ?? "r.is_crisis DESC, r.verified_at DESC, r.title ASC"} LIMIT ?`;
  }
  const limit = Math.min(Math.max(options.limit || 60, 1), 200);
  const offset = Math.max(options.offset || 0, 0);
  args.push(limit, offset);
  sql += " OFFSET ?";
  const result = await db.execute({ sql, args });
  return result.rows.map(mapResource);
}

/**
 * Total matching rows, ignoring paging.
 *
 * This used to fetch up to 200 rows and count them, which meant every filter
 * reported "200" once the catalogue passed that size — so with 401 real
 * resources, Alameda, Contra Costa and Bay Area all claimed the same total.
 * It is a COUNT query now.
 */
async function countVerifiedResources(options: {
  query?: string; county?: string; category?: string; urgency?: string; age?: number;
}) {
  const { filters, args } = buildResourceFilters(options);
  const terms = options.query ? searchTerms(options.query) : [];
  let sql: string;
  const countArgs = [...args];
  if (terms.length) {
    sql = `SELECT COUNT(*) AS total
           FROM resources_fts JOIN resources r ON r.id = resources_fts.rowid
           WHERE resources_fts MATCH ? AND ${filters.join(" AND ")}`;
    countArgs.unshift(terms.map(term => `"${term}"`).join(" OR "));
  } else {
    sql = `SELECT COUNT(*) AS total FROM resources r WHERE ${filters.join(" AND ")}`;
  }
  const result = await db.execute({ sql, args: countArgs });
  return Number(result.rows[0]?.total || 0);
}

async function resourcesByIds(ids: number[]) {
  const unique = [...new Set(ids)].filter(Number.isInteger);
  if (!unique.length) return [];
  const result = await db.execute({
    sql: `SELECT * FROM resources WHERE status = 'verified' AND id IN (${unique.map(() => "?").join(",")})`,
    args: unique,
  });
  const map = new Map(result.rows.map(row => [Number(row.id), mapResource(row)]));
  return unique.map(id => map.get(id)).filter(Boolean) as GroundedResource[];
}

/**
 * Build the crisis payload for a message that triage flagged.
 *
 * This function must never throw and must never depend on the AI provider.
 * The hardcoded contacts are returned first and unconditionally; verified
 * database resources are a best-effort addition on top. If the database is
 * unreachable, the young person still gets phone numbers.
 */
async function buildCrisisResponse(
  assessment: SafetyAssessment,
  options: { county?: string; age?: number },
) {
  const primary: CrisisCategory = assessment.categories[0] || "general";
  const contacts = contactsFor(assessment.categories);

  /**
   * Which local crisis resources to show alongside the hardcoded lines.
   *
   * These used to be "the first three crisis-flagged rows", which meant someone
   * disclosing abuse and someone with nowhere to sleep got the same three
   * results. Now the disclosure picks the categories, so a suicide disclosure
   * surfaces mental-health lines and "nowhere to sleep tonight" surfaces
   * shelter — matching what the deterministic reply already says.
   */
  const CATEGORY_PREFERENCE: Record<CrisisCategory, string[]> = {
    suicide: ["Mental Health", "Healthcare"],
    abuse: ["Community Support", "Legal Support", "Mental Health"],
    trafficking: ["Legal Support", "Community Support", "Housing"],
    homeless_tonight: ["Housing", "Community Support"],
    violence: ["Legal Support", "Community Support", "Housing"],
    general: ["Mental Health", "Community Support", "Housing"],
  };

  let resources: GroundedResource[] = [];
  try {
    const pool = await listVerifiedResources({ county: options.county, age: options.age, limit: 120 });
    const crisisOnly = pool.filter(
      resource => resource.isCrisis || resource.urgencyLevel === "Emergency",
    );
    const preferred = assessment.categories.flatMap(category => CATEGORY_PREFERENCE[category] || []);
    const score = (resource: GroundedResource) => {
      const index = preferred.indexOf(resource.category);
      return index === -1 ? preferred.length + 1 : index;
    };
    resources = [...crisisOnly].sort((a, b) => score(a) - score(b)).slice(0, 3);
  } catch (error) {
    // Deliberately swallowed. Crisis contacts above do not need the database,
    // and a failed lookup must not turn into an error page.
    console.error("Crisis resource lookup failed (contacts still returned)", error);
  }

  return {
    reply: CRISIS_REPLIES[primary] || CRISIS_REPLIES.general,
    crisisContacts: contacts,
    resources,
    safetyMode: true,
    safetyCategories: assessment.categories,
    needsClarification: false,
    suggestedTasks: [],
  };
}

/**
 * What a young person can tell us, and what the model gets.
 *
 * The old intake was three sentences. That is not enough information to build
 * anything specific, which is why every generated plan read the same. The
 * structured fields below are the ones that actually change what the answer
 * should be: whether they have an ID, where they slept last night, and what
 * has a date attached to it.
 */
export const DOCUMENT_IDS = [
  "state_id", "birth_certificate", "ssn_card", "bank_account", "phone_plan",
] as const;

const roadmapInputSchema = z.object({
  youthName: z.string().trim().max(80).optional(),
  age: z.coerce.number().int().min(13).max(30).optional(),
  county: z.enum(["Contra Costa", "Alameda", "Bay Area", "California", "National"]),
  currentNeeds: z.string().trim().min(5).max(2000),
  futurePlan: z.string().trim().min(3).max(1200),

  /** Step-1 chips: which categories to search. */
  needs: z.array(z.string().trim().max(60)).max(10).optional().default([]),
  /** Changes which housing resources apply, and how urgent they are. */
  housingStatus: z
    .enum(["placement", "doubled_up", "own_place", "shelter", "unsheltered", "unstable", "unsaid"])
    .optional()
    .default("unsaid"),
  /** Documents they already hold. Missing ones become early tasks. */
  documents: z.array(z.enum(DOCUMENT_IDS)).max(5).optional().default([]),
  /** Anything with a date on it — deadlines are what make a plan concrete. */
  deadlines: z
    .array(z.object({ kind: z.string().trim().max(60), date: z.string().trim().max(30).optional() }))
    .max(6)
    .optional()
    .default([]),
  additionalContext: z.string().trim().max(2000).optional(),
  /**
   * Set by the client after a young person has been shown crisis support and
   * chose to continue building their plan anyway. Their call, not ours.
   */
  acknowledgedSafety: z.boolean().optional().default(false),
});

const submissionSchema = z.object({
  title: z.string().trim().min(3).max(140),
  organization: z.string().trim().min(2).max(140),
  description: z.string().trim().min(20).max(2000),
  category: z.string().trim().min(2).max(60),
  county: z.string().trim().min(2).max(80),
  website: z.string().url().max(500),
  contact: z.string().trim().max(300).optional().default(""),
  sourceUrl: z.string().url().max(500),
  relationship: z.string().trim().min(5).max(500),
  submitterName: z.string().trim().max(100).optional().default("Anonymous"),
});

async function initDb() {
  await db.execute("PRAGMA foreign_keys = ON");
  // Existing databases predate intake_json. SQLite has no ADD COLUMN IF NOT
  // EXISTS, and re-adding throws, so the failure is expected and ignored.
  for (const statement of [
    "ALTER TABLE roadmaps ADD COLUMN intake_json TEXT",
    "ALTER TABLE resource_submissions ADD COLUMN reviewed_by TEXT",
    "ALTER TABLE resource_submissions ADD COLUMN resource_id INTEGER",
  ]) {
    try {
      await db.execute(statement);
    } catch {
      /* column already present — SQLite has no ADD COLUMN IF NOT EXISTS */
    }
  }
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS roadmaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      goal_summary TEXT NOT NULL,
      greeting TEXT NOT NULL,
      closing TEXT NOT NULL,
      county TEXT NOT NULL,
      youth_name TEXT NOT NULL DEFAULT 'Friend',
      intake_json TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_roadmaps_session ON roadmaps(session_id, updated_at);
    CREATE TABLE IF NOT EXISTS roadmap_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roadmap_id INTEGER NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      task_text TEXT NOT NULL,
      task_category TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      why_it_matters TEXT NOT NULL,
      motivation_note TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      due_date TEXT,
      blocker_reason TEXT,
      private_note TEXT,
      resource_id INTEGER REFERENCES resources(id),
      task_order INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_session ON roadmap_tasks(session_id, roadmap_id);
    CREATE TABLE IF NOT EXISTS saved_resources (
      session_id TEXT NOT NULL,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(session_id, resource_id)
    );
    CREATE TABLE IF NOT EXISTS resource_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, organization TEXT NOT NULL, description TEXT NOT NULL,
      category TEXT NOT NULL, county TEXT NOT NULL, website TEXT NOT NULL,
      contact TEXT, source_url TEXT NOT NULL, relationship TEXT NOT NULL,
      submitter_name TEXT NOT NULL DEFAULT 'Anonymous', status TEXT NOT NULL DEFAULT 'pending',
      moderator_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT
    );
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
    CREATE TABLE IF NOT EXISTS partner_sessions (
      token_hash TEXT PRIMARY KEY,
      partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_partner_sessions_partner ON partner_sessions(partner_id);
    /* Who did what, and when. Approving a resource puts information in front of
       a young person, so it must be attributable after the fact. */
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER REFERENCES partners(id),
      partner_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS resource_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL, reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  for (const [table, column, definition] of [
    ["partners", "role", "TEXT NOT NULL DEFAULT 'contributor'"],
    ["resource_submissions", "partner_id", "INTEGER REFERENCES partners(id)"],
    ["resource_submissions", "reviewed_by", "TEXT"],
    ["resource_submissions", "resource_id", "INTEGER"],
  ]) {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    if (!columns.rows.some(row => row.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/**
 * Crisis contacts, served from memory. No session, no database, no AI.
 * The frontend also ships these compiled in, so this endpoint is a backup
 * rather than the only source.
 */
app.get("/api/crisis", (_req, res) => res.json({ contacts: CRISIS_CONTACTS }));

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  aiConfigured: Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY !== "your_api_key_here"),
}));

app.get("/api/resources", asyncRoute(async (req, res) => {
  const query = z.object({
    q: z.string().max(300).optional(), county: z.string().max(80).optional(),
    category: z.string().max(80).optional(), urgency: z.string().max(40).optional(),
    age: z.coerce.number().int().min(13).max(99).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
    sort: z.enum(["relevance", "checked", "name"]).optional(),
  }).parse(req.query);

  const filters = {
    query: query.q, county: query.county, category: query.category,
    urgency: query.urgency, age: query.age,
  };
  const [items, total] = await Promise.all([
    listVerifiedResources({ ...filters, sort: query.sort, limit: query.limit, offset: query.offset }),
    countVerifiedResources(filters),
  ]);
  res.json({ items, total, offset: query.offset, hasMore: query.offset + items.length < total });
}));

app.get("/api/resources/:id", asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const resources = await resourcesByIds([id]);
  if (!resources[0]) { res.status(404).json({ error: "Resource not found" }); return; }
  res.json(resources[0]);
}));

app.post("/api/resource-submissions", asyncRoute(async (req, res) => {
  const input = submissionSchema.parse(req.body);
  const result = await db.execute({
    sql: `INSERT INTO resource_submissions
      (title, organization, description, category, county, website, contact, source_url, relationship, submitter_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.title, input.organization, input.description, input.category, input.county,
      input.website, input.contact, input.sourceUrl, input.relationship, input.submitterName],
  });
  res.status(202).json({ id: Number(result.lastInsertRowid), status: "pending", message: "Thanks. A partner will verify this resource before it appears publicly." });
}));

app.post("/api/resources/:id/reports", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { reason } = z.object({ reason: z.string().trim().min(5).max(800) }).parse(req.body);
  await db.execute({ sql: "INSERT INTO resource_reports(resource_id, session_id, reason) VALUES (?, ?, ?)", args: [id, req.sessionId!, reason] });
  res.status(202).json({ message: "Thank you. A partner will review this resource." });
}));

app.get("/api/analytics", asyncRoute(async (_req, res) => {
  const [category, county, totals] = await Promise.all([
    db.execute("SELECT category, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY category ORDER BY count DESC"),
    db.execute("SELECT county, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY county ORDER BY count DESC"),
    db.execute("SELECT COUNT(*) AS verified, SUM(CASE WHEN is_crisis=1 THEN 1 ELSE 0 END) AS crisis FROM resources WHERE status='verified'"),
  ]);
  res.json({ category: category.rows, county: county.rows, totals: totals.rows[0] });
}));

/**
 * Listings to ground a reply on, given the whole conversation rather than the
 * last message alone. A follow-up like "how do I apply for the second one?"
 * matches nothing in search by itself, so:
 *   1. listings recommended in the previous assistant turns are re-supplied;
 *   2. when the message is short, the previous user message is searched too.
 * Search results come first so a fresh topic is not crowded out.
 */
async function groundedForConversation(
  message: string,
  history: SignedMessage[],
  context: { county?: string; age?: number },
  limit = 12,
) {
  const previousUser = [...history].reverse().find(turn => turn.role === "user")?.content ?? "";
  const shortFollowUp = searchTerms(message).length < 3 && previousUser;
  const query = shortFollowUp ? `${message} ${previousUser}` : message;
  const searched = await listVerifiedResources({ query, county: context.county, age: context.age, limit: 10 });

  const carried = history
    .filter(turn => turn.role === "assistant")
    .slice(-3)
    .flatMap(turn => turn.resourceIds ?? []);
  const seen = new Set(searched.map(resource => resource.id));
  const extra = await resourcesByIds(carried.filter(id => !seen.has(id)));
  return [...searched, ...extra].slice(0, limit);
}

app.post("/api/chat", requireSession, asyncRoute(async (req, res) => {
  const input = z.object({
    message: z.string().trim().min(1).max(2000),
    county: z.string().max(80).optional(),
    age: z.number().int().min(13).max(99).optional(),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
      resourceIds: z.array(z.number().int()).max(20).optional(),
    })).max(20).default([]),
    /**
     * Proof that this server produced the history above. Without it the browser
     * could forge what Maya previously said and talk the model out of its own
     * source rules. See services/grounding.ts.
     */
    historyToken: z.string().max(200).optional(),
  }).parse(req.body);

  const assessment = assessSafety(input.message);

  // Untrusted history is dropped, not rejected — losing context is a far better
  // outcome for the person than an error page.
  const verified = verifyHistory(req.sessionId!, input.history as SignedMessage[], input.historyToken);
  if (!verified.trusted && input.history.length) {
    console.warn("Rejected an unverified chat history", { session: req.sessionId!.slice(0, 8) });
  }
  const history = verified.messages;

  // Crisis path: deterministic, model never involved, cannot fail to a 500.
  // The conversation so far is kept, so the person is not asked to start over
  // once they are safe.
  if (assessment.level === "crisis") {
    const crisis = await buildCrisisResponse(assessment, { county: input.county, age: input.age });
    const crisisHistory: SignedMessage[] = [
      ...history,
      { role: "user" as const, content: input.message },
      { role: "assistant" as const, content: crisis.reply },
    ].slice(-20);
    res.json({ ...crisis, history: crisisHistory, historyToken: signHistory(req.sessionId!, crisisHistory) });
    return;
  }

  // Everything below may fail. A young person must still get something useful.
  try {
    const grounded = await groundedForConversation(input.message, history, { county: input.county, age: input.age });
    const result = await getNavigatorResponse(input.message, history.map(({ role, content }) => ({ role, content })) as HistoryMessage[], grounded);

    // Resource IDs were already filtered. This checks the prose itself: any
    // phone number or link the model invented is removed before it is shown.
    const allowed = buildAllowList(grounded, CRISIS_CONTACTS);
    const { reply: cleanReply, removed } = sanitiseReply(result.reply, allowed);
    if (removed.length) {
      console.warn("Removed ungrounded contact details from a reply", { removed });
    }

    const reply = assessment.level === "concern" ? `${cleanReply}\n\n${CONCERN_NOTE}` : cleanReply;
    const nextHistory: SignedMessage[] = [
      ...history,
      { role: "user" as const, content: input.message },
      { role: "assistant" as const, content: reply, resourceIds: result.resourceIds },
    ].slice(-20);

    res.json({
      ...result,
      reply,
      resources: await resourcesByIds(result.resourceIds),
      safetyMode: false,
      crisisContacts: assessment.level === "concern" ? contactsFor(["general"]) : [],
      history: nextHistory,
      historyToken: signHistory(req.sessionId!, nextHistory),
    });
    return;
  } catch (error) {
    console.error("Navigator unavailable, falling back to directory", error);
  }

  // Fallback: the AI is down or unconfigured. Answer with the directory
  // instead of an error, and always include crisis contacts.
  let fallbackResources: GroundedResource[] = [];
  try {
    fallbackResources = await listVerifiedResources({ query: input.message, county: input.county, age: input.age, limit: 6 });
  } catch (error) {
    console.error("Directory lookup failed during fallback", error);
  }
  const degradedReply = fallbackResources.length
    ? "I can't reach my assistant right now, so I searched the verified directory directly. These may be relevant \u2014 open any one to see who qualifies and how to start."
    : "I can't reach my assistant right now, and I didn't find a verified match for that. The 24-hour lines below can help with almost anything, including finding the right local service.";
  const degradedHistory: SignedMessage[] = [
    ...history,
    { role: "user" as const, content: input.message },
    { role: "assistant" as const, content: degradedReply },
  ].slice(-20);
  res.json({
    reply: degradedReply,
    resources: fallbackResources,
    crisisContacts: contactsFor(["general"]),
    needsClarification: false,
    suggestedTasks: [],
    safetyMode: false,
    degraded: true,
    history: degradedHistory,
    historyToken: signHistory(req.sessionId!, degradedHistory),
  });
}));

app.post("/api/roadmaps", requireSession, asyncRoute(async (req, res) => {
  const input = roadmapInputSchema.parse(req.body);

  // The intake asks a young person to describe their situation in their own
  // words. That is exactly where a disclosure shows up, so it is triaged here
  // the same as chat. On a crisis signal we do NOT call the model and do NOT
  // store the text — we show support first and let them decide what happens next.
  const assessment = assessFields(input.currentNeeds, input.futurePlan, input.additionalContext);
  if (assessment.level === "crisis" && !input.acknowledgedSafety) {
    res.status(200).json({
      ...(await buildCrisisResponse(assessment, { county: input.county, age: input.age })),
      roadmapDeferred: true,
    });
    return;
  }
  let grounded = await listVerifiedResources({
    query: [input.currentNeeds, input.futurePlan, ...(input.needs || [])].join(" "),
    county: input.county,
    age: input.age,
    limit: 16,
  });
  if (grounded.length < 8) {
    const regional = await listVerifiedResources({ county: input.county, age: input.age, limit: 20 });
    const seen = new Set(grounded.map(resource => resource.id));
    grounded = [...grounded, ...regional.filter(resource => !seen.has(resource.id))].slice(0, 16);
  }
  const roadmap = await generateGroundedRoadmap({
    youthName: input.youthName || "Friend",
    age: input.age,
    county: input.county,
    currentNeeds: input.currentNeeds,
    futurePlan: input.futurePlan,
    additionalContext: input.additionalContext || "None provided",
    needs: input.needs,
    housingStatus: input.housingStatus,
    documents: input.documents,
    deadlines: input.deadlines,
  }, grounded);

  // One transaction: the plan and every task, or nothing (FC-04).
  const roadmapId = await persistRoadmap(db, req.sessionId!, {
    title: roadmap.title, goalSummary: roadmap.goalSummary, greeting: roadmap.greeting, closing: roadmap.closing,
    county: input.county, youthName: input.youthName || "Friend",
    intake: { needs: input.needs, housingStatus: input.housingStatus, documents: input.documents, deadlines: input.deadlines },
    tasks: roadmap.tasks,
  });
  const [roadmapRow, taskRows, recommended] = await Promise.all([
    db.execute({ sql: "SELECT * FROM roadmaps WHERE id=?", args: [roadmapId] }),
    db.execute({ sql: "SELECT * FROM roadmap_tasks WHERE roadmap_id=? ORDER BY task_order", args: [roadmapId] }),
    resourcesByIds(roadmap.recommendedResourceIds),
  ]);
  res.status(201).json({
    ...mapRoadmap(roadmapRow.rows[0]),
    tasks: taskRows.rows.map(mapTask),
    recommendedResources: recommended,
    // "fallback" means the deterministic plan was used (no key, provider
    // down, or the model draft failed grounding). The UI labels it.
    generatedBy: roadmap.generatedBy,
  });
}));

app.get("/api/roadmaps", requireSession, asyncRoute(async (req, res) => {
  const result = await db.execute({ sql: "SELECT * FROM roadmaps WHERE session_id=? ORDER BY updated_at DESC", args: [req.sessionId!] });
  res.json(result.rows.map(mapRoadmap));
}));

app.get("/api/roadmaps/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const [roadmapRows, taskRows] = await Promise.all([
    db.execute({ sql: "SELECT * FROM roadmaps WHERE id=? AND session_id=?", args: [id, req.sessionId!] }),
    db.execute({ sql: "SELECT * FROM roadmap_tasks WHERE roadmap_id=? AND session_id=? ORDER BY task_order", args: [id, req.sessionId!] }),
  ]);
  if (!roadmapRows.rows[0]) { res.status(404).json({ error: "Roadmap not found" }); return; }
  const tasks = taskRows.rows.map(mapTask);
  const resources = await resourcesByIds(tasks.map(task => task.resourceId).filter((id): id is number => id !== null));
  res.json({ ...mapRoadmap(roadmapRows.rows[0]), tasks, recommendedResources: resources });
}));

app.patch("/api/tasks/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const update = z.object({
    status: z.enum(["not_started", "in_progress", "completed", "blocked"]).optional(),
    dueDate: z.string().date().nullable().optional(),
    blockerReason: z.string().trim().max(500).nullable().optional(),
    privateNote: z.string().trim().max(1000).nullable().optional(),
  }).refine(value => Object.keys(value).length > 0).parse(req.body);

  const fields: string[] = [];
  const args: (string | null)[] = [];
  if (update.status !== undefined) { fields.push("status=?"); args.push(update.status); fields.push("completed_at=?"); args.push(update.status === "completed" ? new Date().toISOString() : null); }
  if (update.dueDate !== undefined) { fields.push("due_date=?"); args.push(update.dueDate); }
  if (update.blockerReason !== undefined) { fields.push("blocker_reason=?"); args.push(update.blockerReason); }
  if (update.privateNote !== undefined) { fields.push("private_note=?"); args.push(update.privateNote); }
  fields.push("updated_at=CURRENT_TIMESTAMP");
  await db.execute({ sql: `UPDATE roadmap_tasks SET ${fields.join(",")} WHERE id=? AND session_id=?`, args: [...args, id, req.sessionId!] });
  const result = await db.execute({ sql: "SELECT * FROM roadmap_tasks WHERE id=? AND session_id=?", args: [id, req.sessionId!] });
  if (!result.rows[0]) { res.status(404).json({ error: "Task not found" }); return; }
  await db.execute({ sql: "UPDATE roadmaps SET updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [Number(result.rows[0].roadmap_id)] });
  res.json(mapTask(result.rows[0]));
}));

app.post("/api/saved-resources/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await db.execute({ sql: "INSERT OR IGNORE INTO saved_resources(session_id, resource_id) VALUES (?, ?)", args: [req.sessionId!, id] });
  res.status(201).json({ saved: true });
}));

app.delete("/api/saved-resources/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await db.execute({ sql: "DELETE FROM saved_resources WHERE session_id=? AND resource_id=?", args: [req.sessionId!, id] });
  res.status(204).send();
}));

app.get("/api/saved-resources", requireSession, asyncRoute(async (req, res) => {
  const result = await db.execute({
    sql: "SELECT r.* FROM saved_resources s JOIN resources r ON r.id=s.resource_id WHERE s.session_id=? ORDER BY s.created_at DESC",
    args: [req.sessionId!],
  });
  res.json(result.rows.map(mapResource));
}));

app.get("/api/session/export", requireSession, asyncRoute(async (req, res) => {
  const [roadmaps, tasks, saved] = await Promise.all([
    db.execute({ sql: "SELECT * FROM roadmaps WHERE session_id=?", args: [req.sessionId!] }),
    db.execute({ sql: "SELECT * FROM roadmap_tasks WHERE session_id=?", args: [req.sessionId!] }),
    db.execute({ sql: "SELECT resource_id, created_at FROM saved_resources WHERE session_id=?", args: [req.sessionId!] }),
  ]);
  res.json({ exportedAt: new Date().toISOString(), roadmaps: roadmaps.rows, tasks: tasks.rows, savedResources: saved.rows });
}));

app.delete("/api/session", requireSession, asyncRoute(async (req, res) => {
  await db.batch([
    { sql: "DELETE FROM roadmap_tasks WHERE session_id=?", args: [req.sessionId!] },
    { sql: "DELETE FROM roadmaps WHERE session_id=?", args: [req.sessionId!] },
    { sql: "DELETE FROM saved_resources WHERE session_id=?", args: [req.sessionId!] },
    { sql: "DELETE FROM resource_reports WHERE session_id=?", args: [req.sessionId!] },
  ], "write");
  res.status(204).send();
}));

app.use("/api/partner/login", rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }));

app.post("/api/partner/login", asyncRoute(async (req, res) => {
  const input = z.object({
    email: z.string().trim().email().max(200),
    password: z.string().min(1).max(200),
  }).parse(req.body);

  const result = await db.execute({
    sql: "SELECT id, email, name, organisation, password_hash, active, role FROM partners WHERE email = ?",
    args: [normaliseEmail(input.email)],
  });
  const row = result.rows[0];

  // Always run a verification so a missing account and a wrong password take
  // roughly the same time, and neither response says which it was.
  const stored = row ? String(row.password_hash) : "scrypt:0000:0000";
  const ok = await verifyPassword(input.password, stored);

  if (!row || !ok || !Number(row.active)) {
    res.status(401).json({ error: "That email and password did not match." });
    return;
  }

  const { token, tokenHash, expiresAt } = newSessionToken();
  await db.execute({
    sql: "INSERT INTO partner_sessions(token_hash, partner_id, expires_at) VALUES (?, ?, ?)",
    args: [tokenHash, Number(row.id), expiresAt],
  });
  await db.execute({ sql: "UPDATE partners SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", args: [Number(row.id)] });

  res.json({
    token,
    expiresAt,
    partner: { name: String(row.name), email: String(row.email), organisation: String(row.organisation || ""), role: row.role === "reviewer" ? "reviewer" : "contributor" },
  });
}));

/**
 * Partner analytics: directory coverage, freshness, completeness, the review
 * pipeline and youth reports. Partner-only because report text is typed by
 * young people and can contain a disclosure. Counts describe the directory,
 * never open beds, eligibility or unmet demand.
 */
app.get("/api/partner/analytics", requirePartner, asyncRoute(async (_req, res) => {
  const [totals, byCategory, byCounty, matrix, freshness, completeness, staleList, pipeline, reports, recentPublished] = await Promise.all([
    db.execute(`SELECT
        SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN status!='verified' THEN 1 ELSE 0 END) AS retired,
        SUM(CASE WHEN status='verified' AND is_crisis=1 THEN 1 ELSE 0 END) AS crisis,
        SUM(CASE WHEN status='verified' AND date(verified_at) >= date('now','-30 days') THEN 1 ELSE 0 END) AS checked_last_30
      FROM resources`),
    db.execute(`SELECT category, COUNT(*) AS count,
        SUM(CASE WHEN lower(cost) LIKE 'free%' AND lower(cost) NOT LIKE '%sliding%' THEN 1 ELSE 0 END) AS free,
        SUM(CASE WHEN cost='' OR lower(cost) LIKE '%not confirmed%' THEN 1 ELSE 0 END) AS cost_unknown,
        SUM(CASE WHEN date(verified_at) < date('now','-180 days') THEN 1 ELSE 0 END) AS stale
      FROM resources WHERE status='verified' GROUP BY category ORDER BY count DESC`),
    db.execute("SELECT county, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY county ORDER BY count DESC"),
    db.execute("SELECT category, county, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY category, county"),
    db.execute(`SELECT
        SUM(CASE WHEN date(verified_at) >= date('now','-90 days') THEN 1 ELSE 0 END) AS fresh,
        SUM(CASE WHEN date(verified_at) < date('now','-90 days') AND date(verified_at) >= date('now','-180 days') THEN 1 ELSE 0 END) AS aging,
        SUM(CASE WHEN date(verified_at) < date('now','-180 days') THEN 1 ELSE 0 END) AS stale,
        SUM(CASE WHEN date(verified_at) IS NULL THEN 1 ELSE 0 END) AS unknown
      FROM resources WHERE status='verified'`),
    db.execute(`SELECT
        SUM(CASE WHEN coalesce(phone,'')!='' THEN 1 ELSE 0 END) AS phone,
        SUM(CASE WHEN coalesce(website,'')!='' THEN 1 ELSE 0 END) AS website,
        SUM(CASE WHEN coalesce(hours,'')!='' THEN 1 ELSE 0 END) AS hours,
        SUM(CASE WHEN coalesce(address,'')!='' THEN 1 ELSE 0 END) AS address,
        SUM(CASE WHEN cost!='' AND lower(cost) NOT LIKE '%not confirmed%' THEN 1 ELSE 0 END) AS cost_known,
        SUM(CASE WHEN age_min IS NOT NULL OR age_max IS NOT NULL THEN 1 ELSE 0 END) AS age_known,
        SUM(CASE WHEN coalesce(languages,'')!='' THEN 1 ELSE 0 END) AS languages,
        SUM(CASE WHEN coalesce(source_url,'')!='' THEN 1 ELSE 0 END) AS source
      FROM resources WHERE status='verified'`),
    db.execute("SELECT id, title, organization, category, county, verified_at FROM resources WHERE status='verified' ORDER BY date(verified_at) ASC, id ASC LIMIT 25"),
    db.execute(`SELECT
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status='pending' AND date(created_at) < date('now','-7 days') THEN 1 ELSE 0 END) AS pending_over_week,
        SUM(CASE WHEN date(created_at) >= date('now','-30 days') THEN 1 ELSE 0 END) AS submitted_last_30
      FROM resource_submissions`),
    db.execute(`SELECT rr.id, rr.resource_id, r.title, r.organization, rr.reason, rr.created_at
      FROM resource_reports rr JOIN resources r ON r.id = rr.resource_id
      ORDER BY rr.created_at DESC LIMIT 20`),
    db.execute(`SELECT COUNT(*) AS count FROM resource_submissions WHERE status='approved' AND date(reviewed_at) >= date('now','-30 days')`),
  ]);
  res.json({
    totals: { ...totals.rows[0], publishedLast30: Number(recentPublished.rows[0]?.count ?? 0) },
    byCategory: byCategory.rows,
    byCounty: byCounty.rows,
    matrix: matrix.rows,
    freshness: freshness.rows[0],
    completeness: completeness.rows[0],
    staleList: staleList.rows,
    pipeline: pipeline.rows[0],
    reports: reports.rows,
    generatedAt: new Date().toISOString(),
  });
}));

app.post("/api/partner/logout", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
  const header = req.header("authorization") || "";
  await db.execute({ sql: "DELETE FROM partner_sessions WHERE token_hash = ?", args: [hashToken(header.slice(7).trim())] });
  res.status(204).send();
}));

app.get("/api/partner/me", requirePartner, (req: PartnerRequest, res) => res.json({ partner: req.partner }));

app.get("/api/partner/my-submissions", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
  const result = await db.execute({ sql: "SELECT * FROM resource_submissions WHERE partner_id=? ORDER BY created_at DESC", args: [req.partner!.id] });
  res.json(result.rows);
}));

app.post("/api/partner/my-submissions", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
  const input = submissionSchema.parse(req.body);
  const partner = req.partner!;
  const result = await db.execute({
    sql: `INSERT INTO resource_submissions(title, organization, description, category, county, website, contact, source_url, relationship, submitter_name, partner_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.title, input.organization, input.description, input.category, input.county, input.website, input.contact, input.sourceUrl, input.relationship, partner.name, partner.id],
  });
  res.status(202).json({ id: Number(result.lastInsertRowid), status: "pending" });
}));

app.use("/api/partner/guide", rateLimit({ windowMs: 60_000, limit: 10 }));
app.post("/api/partner/guide", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
  const input = z.object({
    message: z.string().trim().min(3).max(2000),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
      resourceIds: z.array(z.number().int()).max(20).optional(),
    })).max(20).default([]),
    historyToken: z.string().max(200).optional(),
  }).parse(req.body);
  // Same signing scheme as Maya, keyed to the partner account rather than a
  // youth session, so one staff member cannot replay another's thread.
  const signer = `partner:${req.partner!.id}`;
  const verified = verifyHistory(signer, input.history as SignedMessage[], input.historyToken);
  const history = verified.messages;
  const resources = await groundedForConversation(input.message, history, {}, 10);
  const result = await getPartnerGuideResponse(input.message, resources, history.map(({ role, content }) => ({ role, content })));
  const { reply } = sanitiseReply(result.reply, buildAllowList(resources, CRISIS_CONTACTS));
  const nextHistory: SignedMessage[] = [
    ...history,
    { role: "user" as const, content: input.message },
    { role: "assistant" as const, content: reply, resourceIds: resources.slice(0, 8).map(resource => resource.id) },
  ].slice(-20);
  res.json({ reply, history: nextHistory, historyToken: signHistory(signer, nextHistory) });
}));

app.get("/api/partner/submissions", requirePartner, requireReviewer, asyncRoute(async (_req, res) => {
  const result = await db.execute("SELECT * FROM resource_submissions ORDER BY (status = 'pending') DESC, created_at DESC");
  res.json(result.rows);
}));

/**
 * Review a submission.
 *
 * Approving used to set a status column and stop, so an approved resource never
 * appeared anywhere — the reviewer saw a tick and reasonably assumed it had
 * published. It now writes a real row into `resources`, indexes it for search,
 * and links the submission to what it became.
 *
 * The submission form collects far less than the resource table needs, so the
 * reviewer supplies the missing safety-relevant fields at approval time. That is
 * deliberate: eligibility and cost are what a young person plans around, and
 * neither should be guessed by us or by a model.
 */
const approvalSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  moderatorNote: z.string().trim().max(1000).optional().default(""),
  resource: z.object({
    eligibility: z.string().trim().min(3).max(1000),
    cost: z.string().trim().min(1).max(200),
    applicationSteps: z.string().trim().min(3).max(2000),
    whatToBring: z.string().trim().max(1000).optional().default("Ask them what to bring"),
    serviceArea: z.string().trim().max(200).optional().default(""),
    phone: z.string().trim().max(120).optional().default(""),
    address: z.string().trim().max(300).optional().default(""),
    hours: z.string().trim().max(200).optional().default(""),
    languages: z.string().trim().max(200).optional().default(""),
    accessibility: z.string().trim().max(300).optional().default(""),
    deliveryMode: z.string().trim().max(60).optional().default("Contact for details"),
    urgencyLevel: z.enum(["Emergency", "Urgent", "Standard"]).optional().default("Standard"),
    isCrisis: z.boolean().optional().default(false),
    ageMin: z.number().int().min(0).max(99).nullable().optional(),
    ageMax: z.number().int().min(0).max(99).nullable().optional(),
  }).optional(),
});

app.patch("/api/partner/submissions/:id", requirePartner, requireReviewer, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const update = approvalSchema.parse(req.body);
  const partner = req.partner!;

  const existing = await db.execute({ sql: "SELECT * FROM resource_submissions WHERE id = ?", args: [id] });
  const submission = existing.rows[0];
  if (!submission) { res.status(404).json({ error: "That submission no longer exists" }); return; }

  if (update.status !== "approved") {
    await db.execute({
      sql: `UPDATE resource_submissions SET status=?, moderator_note=?, reviewed_by=?,
            reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
      args: [update.status, update.moderatorNote, partner.email, id],
    });
    await recordAudit(partner, `submission.${update.status}`, "submission", id, update.moderatorNote);
    res.json({ id, status: update.status });
    return;
  }

  if (Number(submission.resource_id)) {
    res.status(409).json({ error: "That submission has already been published." });
    return;
  }
  if (!update.resource) {
    res.status(400).json({
      error: "Approving publishes this to young people, so it needs eligibility, cost, and how to apply.",
      missing: ["eligibility", "cost", "applicationSteps"],
    });
    return;
  }

  // Resource, search index, submission link, and audit rows land together or
  // not at all, and a submission publishes exactly once (FC-04).
  const published = await publishSubmission(db, id, partner, update.resource, update.moderatorNote);
  if (!published.ok) {
    if (published.reason === "not_found") { res.status(404).json({ error: "That submission no longer exists" }); return; }
    res.status(409).json({ error: "That submission has already been published." });
    return;
  }
  const { resourceId, publishedAt: today } = published;
  res.json({ id, status: "approved", resourceId, publishedAt: today });
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Please check the information you entered", details: error.flatten() });
    return;
  }
  console.error(error);
  if (error instanceof ProviderError) {
    // The model is rate-limited or down. Say so in a way a person can act on,
    // and let the browser know it is worth retrying shortly.
    const busy = /429|rate limit/i.test(String(error.cause instanceof Error ? error.cause.message : error.message));
    res.status(503).json({
      error: busy
        ? "The AI guide is busy right now. Wait about a minute and send that again."
        : "The AI guide is not responding right now. The checked directory still works. Try again in a few minutes.",
    });
    return;
  }
  const message = error instanceof Error && error.message === "AI service is not configured"
    ? "The navigator is temporarily unavailable. The verified resource directory still works."
    : "Something went wrong. Please try again.";
  res.status(500).json({ error: message });
});

initDb().then(() => {
  app.listen(PORT, process.env.HOST || "0.0.0.0", () => console.log(`Foster Connect 2.0 API running at http://localhost:${PORT}`));
}).catch(error => {
  console.error("Database initialization failed", error);
  process.exit(1);
});
