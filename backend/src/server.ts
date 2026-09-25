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
  type PlanContext,
} from "./services/ai.service";
import { assessSafety, assessFields, type SafetyAssessment } from "./services/safety";
import { buildAllowList, sanitiseReply, signHistory, verifyHistory, type SignedMessage } from "./services/grounding";
import { mailConfigured, newAccountEmail, resetEmail, sendMail, siteUrl } from "./services/mail";
import { canReview, hashPassword, hashToken, newSessionToken, normaliseEmail, passwordProblem, verifyPassword, type Partner } from "./services/partners";
import { contactsFor, CRISIS_CONTACTS, CRISIS_REPLIES, CONCERN_NOTE, type CrisisCategory } from "./config/crisis";
import { audit, executeSerialised, inWriteTransaction, persistRoadmap, publishSubmission } from "./services/persistence";
import { openSession, passcodeLookup, passcodeProblem, sealSession } from "./services/passcode";

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
    kind: row.kind === "information" ? "information" : "service",
    fieldsNa: parseFieldsNa(row.fields_na),
    recheckAt: row.recheck_at ? String(row.recheck_at) : null,
    sourceUrl: rowString(row, "source_url"),
    verifiedAt: rowString(row, "verified_at"),
    /**
     * How the listing was checked. Only a reviewer's explicit "(confirmed by phone)"
     * stamp counts (audit A03); imported "line confirmed" notes describe research
     * against a program's page, so they read as "online".
     */
    checkedHow: /confirmed by phone/i.test(rowString(row, "verified_by")) ? "phone" : "online",
    tags: rowString(row, "tags"),
  };
}

function parseFieldsNa(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
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

/** "a,b, c" → ["a","b","c"]; "All", "" and undefined → []. */
function listParam(value?: string) {
  if (!value) return [];
  return value.split(",").map(item => item.trim()).filter(item => item && item !== "All");
}

/** One place that decides which resources a query may return, so the list
 *  query and the count query can never drift apart. */
/**
 * A listing's county is one region or a comma-separated list ("Alameda, Contra Costa")
 * when a program serves more than one. Matching pads both sides so "Alameda" never
 * matches a hypothetical "Alameda North".
 */
function countyMatch(counties: string[]) {
  return `(${counties.map(() => "(', ' || r.county || ', ') LIKE ?").join(" OR ")})`;
}
function countyArg(county: string) { return `%, ${county}, %`; }
/**
 * Local first (review 2026-09-18, item 42): with a county picked, rank that county's
 * listings before regional (Bay Area), statewide (California) and national ones, so
 * national content does not crowd out local support. 0 is best.
 */
function localityRank(counties: string[]): { sql: string; args: string[] } {
  if (!counties.length) return { sql: "0", args: [] };
  return {
    sql: `CASE WHEN ${countyMatch(counties)} THEN 0 WHEN r.county = 'Bay Area' THEN 1 WHEN r.county = 'California' THEN 2 ELSE 3 END`,
    args: counties.map(countyArg),
  };
}
const COUNTY_OPTIONS = ["Alameda", "Contra Costa", "Bay Area", "California", "National"] as const;
/** Normalise "contra costa,Alameda" → "Alameda, Contra Costa"; null when any part is unknown. */
function normaliseCounty(value: string): string | null {
  const parts = [...new Set(value.split(",").map(part => part.trim()).filter(Boolean))];
  if (!parts.length) return null;
  const known = parts.map(part => COUNTY_OPTIONS.find(option => option.toLowerCase() === part.toLowerCase()));
  if (known.some(part => !part)) return null;
  return (known as string[]).sort((a, b) => COUNTY_OPTIONS.indexOf(a as typeof COUNTY_OPTIONS[number]) - COUNTY_OPTIONS.indexOf(b as typeof COUNTY_OPTIONS[number])).join(", ");
}

function buildResourceFilters(options: {
  county?: string; category?: string; urgency?: string; age?: number; ageTo?: number;
}) {
  const filters = ["r.status = 'verified'"];
  const args: (string | number)[] = [];
  // County and category accept a comma-separated list (Y10): "Contra Costa,California".
  const counties = listParam(options.county);
  if (counties.length) {
    // Regional records ("Bay Area") and statewide/national records must surface
    // for a county search, or they become unreachable entirely (audit D-02).
    filters.push(`(${countyMatch(counties)} OR r.county IN ('California', 'National', 'Bay Area'))`);
    args.push(...counties.map(countyArg));
  }
  const categories = listParam(options.category);
  if (categories.length) {
    filters.push(`r.category IN (${categories.map(() => "?").join(",")})`);
    args.push(...categories);
  }
  // The directory only has two real levels: crisis/emergency lines and
  // everything else (no row is "Urgent"). "Emergency" = tonight; "Standard" =
  // not an emergency. Anything else is ignored rather than returning nothing.
  if (options.urgency === "Emergency") filters.push("(r.urgency_level = 'Emergency' OR r.is_crisis = 1)");
  else if (options.urgency === "Standard") filters.push("(r.urgency_level <> 'Emergency' AND r.is_crisis = 0)");
  if (options.age !== undefined) {
    // A band (age..ageTo) keeps every listing whose stored range overlaps it
    // (audit A06): 21–24 still shows a program whose maximum is 21.
    const upper = Math.max(options.age, options.ageTo ?? options.age);
    filters.push("(r.age_min IS NULL OR r.age_min <= ?) AND (r.age_max IS NULL OR r.age_max >= ?)");
    args.push(upper, options.age);
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
  sort?: "relevance" | "checked" | "name" | "organization";
}) {
  const { filters, args: filterArgs } = buildResourceFilters(options);
  const locality = localityRank(listParam(options.county));

  const terms = options.query ? searchTerms(options.query) : [];
  const explicitOrder = options.sort === "checked" ? "r.verified_at DESC, r.title ASC" : options.sort === "name" ? "r.title ASC" : options.sort === "organization" ? "r.organization COLLATE NOCASE ASC, r.title ASC" : null;
  let sql: string;
  const args: (string | number)[] = [];
  if (terms.length) {
    // Column weights: a word in the title or category says far more about a
    // listing than the same word buried in its description. Without these a
    // crisis text line whose blurb mentions "a safe place to stay" outranked
    // every actual housing programme for "housing".
    // Columns: title, organization, description, category, county, service_area,
    // eligibility, application_steps, tags.
    // bm25 is negative (more negative = better). Crisis lines are always one
    // tap away in the crisis bar, so a plain search ranks them after programmes.
    // Each step away from the picked county costs 2 points, so a clearly
    // better national match still wins but ties go local.
    sql = `SELECT r.*, ${locality.sql} AS locality,
                  bm25(resources_fts, 12.0, 4.0, 1.0, 10.0, 1.0, 1.0, 2.0, 1.0, 6.0) + (r.is_crisis * 4.0) AS relevance
           FROM resources_fts JOIN resources r ON r.id = resources_fts.rowid
           WHERE resources_fts MATCH ? AND ${filters.join(" AND ")}
           ORDER BY ${explicitOrder ?? "relevance + locality * 2.0 ASC, r.verified_at DESC"} LIMIT ?`;
    // Positional parameters follow the SQL text: the locality CASE in the SELECT list comes before MATCH.
    args.push(...locality.args, terms.map(term => `"${term}"`).join(" OR "), ...filterArgs);
  } else {
    sql = `SELECT r.*, ${locality.sql} AS locality FROM resources r WHERE ${filters.join(" AND ")}
           ORDER BY ${explicitOrder ?? "locality ASC, r.is_crisis DESC, r.verified_at DESC, r.title ASC"} LIMIT ?`;
    args.push(...locality.args, ...filterArgs);
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
  age: z.coerce.number().int().min(0).max(99).optional(),
  county: z.enum(["Contra Costa", "Alameda", "Bay Area", "California", "National"]),
  // "Food" and "Work" are valid one-chip answers (audit A05).
  currentNeeds: z.string().trim().min(2).max(2000),
  futurePlan: z.string().trim().min(3).max(1200),

  /** Step-1 chips: which categories to search. */
  needs: z.array(z.string().trim().max(60)).max(10).optional().default([]),
  /** Changes which housing resources apply, and how urgent they are. */
  housingStatus: z
    .enum(["placement", "doubled_up", "own_place", "shelter", "unsheltered", "unstable", "unsaid"])
    .optional()
    .default("unsaid"),
  /** Documents they already hold. Missing ones become early tasks. */
  /** Omitted = not answered (unknown); [] = "none of these" (audit A10). */
  documents: z.array(z.enum(DOCUMENT_IDS)).max(5).optional(),
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
  kind: z.enum(["service", "information"]).optional().default("service"),
});

async function initDb() {
  await db.execute("PRAGMA foreign_keys = ON");
  // Existing databases predate intake_json. SQLite has no ADD COLUMN IF NOT
  // EXISTS, and re-adding throws, so the failure is expected and ignored.
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS session_passcodes (
      lookup TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL, iv TEXT NOT NULL, cipher TEXT NOT NULL, tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT
    )`,
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
    // Y11: "service" (default) or "information" — a PDF/guide with no hours, address or phone to show.
    ["resources", "kind", "TEXT NOT NULL DEFAULT 'service'"],
    ["resource_submissions", "kind", "TEXT NOT NULL DEFAULT 'service'"],
    // P7: fields a reviewer confirmed the listing genuinely has none of (JSON array, e.g. ["phone","address"]),
    // and an optional date after which it should be checked again (a summer scholarship, a pilot).
    ["resources", "fields_na", "TEXT NOT NULL DEFAULT '[]'"],
    ["resources", "recheck_at", "TEXT"],
    // Round 4: a reviewer marks a youth report handled once the listing was re-checked or fixed.
    ["resource_reports", "resolved_at", "TEXT"],
    ["resource_reports", "resolved_by", "TEXT"],
  ]) {
    const columns = await db.execute(`PRAGMA table_info(${table})`);
    if (!columns.rows.some(row => row.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  // P5/P6: a proposed edit to a published listing. Contributors propose; reviewers
  // approve (which applies it) or reject. Reviewer edits are recorded as approved.
  await db.execute(`CREATE TABLE IF NOT EXISTS resource_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    partner_id INTEGER NOT NULL REFERENCES partners(id),
    partner_name TEXT NOT NULL,
    partner_email TEXT NOT NULL,
    changes_json TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    moderator_note TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT
  )`);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_changes_status ON resource_changes(status, created_at)");
  // Password resets (A1). A partner asks from the sign-in page; a reviewer issues
  // a one-time link from the Accounts page and sends it themselves (the API has
  // no mail provider). The raw token is never stored, only its hash.
  await db.execute(`CREATE TABLE IF NOT EXISTS partner_password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    token_hash TEXT UNIQUE,
    issued_by TEXT,
    issued_at TEXT,
    expires_at TEXT,
    used_at TEXT
  )`);
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
  mailConfigured: mailConfigured(),
}));

/**
 * Readiness (audit A20): proves the database answers and holds published
 * listings. /api/health is liveness only and stays green with the data gone.
 * The scheduled monitor workflow calls this.
 */
app.get("/api/ready", asyncRoute(async (_req, res) => {
  try {
    const count = await db.execute("SELECT COUNT(*) AS n FROM resources WHERE status = 'verified'");
    const n = Number(count.rows[0]?.n ?? 0);
    if (n === 0) { res.status(503).json({ status: "empty", verifiedResources: 0 }); return; }
    res.json({ status: "ready", verifiedResources: n });
  } catch (error) {
    console.error("Readiness check failed", error);
    res.status(503).json({ status: "database_unavailable" });
  }
}));

app.get("/api/resources", asyncRoute(async (req, res) => {
  const query = z.object({
    q: z.string().max(300).optional(), county: z.string().max(200).optional(),
    category: z.string().max(400).optional(), urgency: z.string().max(40).optional(),
    age: z.coerce.number().int().min(0).max(99).optional(),
    ageTo: z.coerce.number().int().min(0).max(99).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    offset: z.coerce.number().int().min(0).max(5000).optional().default(0),
    sort: z.enum(["relevance", "checked", "name", "organization"]).optional(),
  }).parse(req.query);

  const filters = {
    query: query.q, county: query.county, category: query.category,
    urgency: query.urgency, age: query.age, ageTo: query.ageTo,
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
      (title, organization, description, category, county, website, contact, source_url, relationship, submitter_name, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.title, input.organization, input.description, input.category, input.county,
      input.website, input.contact, input.sourceUrl, input.relationship, input.submitterName, input.kind],
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

/** The session's most recent plan, for Nova to suggest changes to (Y3). */
async function currentPlanFor(sessionId: string): Promise<PlanContext | null> {
  const plan = await db.execute({ sql: "SELECT id FROM roadmaps WHERE session_id=? ORDER BY updated_at DESC LIMIT 1", args: [sessionId] });
  if (!plan.rows[0]) return null;
  const id = Number(plan.rows[0].id);
  const tasks = await db.execute({ sql: "SELECT id, task_text, timeframe, status FROM roadmap_tasks WHERE roadmap_id=? AND session_id=? ORDER BY task_order", args: [id, sessionId] });
  return { id, tasks: tasks.rows.map(row => ({ id: Number(row.id), taskText: rowString(row, "task_text"), timeframe: rowString(row, "timeframe"), status: rowString(row, "status") })) };
}

app.post("/api/chat", requireSession, asyncRoute(async (req, res) => {
  const input = z.object({
    message: z.string().trim().min(1).max(2000),
    county: z.string().max(80).optional(),
    age: z.number().int().min(0).max(99).optional(),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
      resourceIds: z.array(z.number().int()).max(20).optional(),
    })).max(20).default([]),
    /**
     * Proof that this server produced the history above. Without it the browser
     * could forge what Nova previously said and talk the model out of its own
     * source rules. See services/grounding.ts.
     */
    historyToken: z.string().max(200).optional(),
    /**
     * The person's own earlier messages from past chats kept on their device
     * (never Nova's replies, which could be forged). Lets Nova recall what they
     * said last week until they clear those chats.
     */
    recall: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
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
    const plan = await currentPlanFor(req.sessionId!);
    const result = await getNavigatorResponse(input.message, history.map(({ role, content }) => ({ role, content })) as HistoryMessage[], grounded, plan, input.recall);

    // Resource IDs were already filtered. This checks the prose itself: any
    // phone number or link the model invented is removed before it is shown.
    const allowed = buildAllowList(grounded, CRISIS_CONTACTS);
    const { reply: cleanReply, removed } = sanitiseReply(result.reply, allowed);
    if (removed.length) {
      console.warn("Removed ungrounded contact details from a reply", { removed });
    }

    const reply = assessment.level === "concern" ? `${cleanReply}\n\n${CONCERN_NOTE}` : cleanReply;
    // Suggestion text gets the same contact check as the reply.
    const planSuggestions = result.planSuggestions.map(suggestion => ({
      ...suggestion,
      taskText: sanitiseReply(suggestion.taskText, allowed).reply,
      steps: suggestion.steps.map(step => sanitiseReply(step, allowed).reply),
      why: sanitiseReply(suggestion.why, allowed).reply,
      roadmapId: plan?.id ?? null,
    }));
    const nextHistory: SignedMessage[] = [
      ...history,
      { role: "user" as const, content: input.message },
      { role: "assistant" as const, content: reply, resourceIds: result.resourceIds },
    ].slice(-20);

    res.json({
      ...result,
      reply,
      planSuggestions,
      // The model names the listings it used; when it names none, the person
      // still sees what the directory search found for their words (U-R3).
      resources: result.resourceIds.length ? await resourcesByIds(result.resourceIds) : grounded.filter(resource => !resource.isCrisis).slice(0, 3),
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

const TIMEFRAMES = ["This Week", "30 Days", "3-6 Months", "6-12 Months"] as const;

/**
 * Add a step by hand (Y4). Also used when Nova suggests a step and the person
 * accepts it. A resourceId must be a published listing; nothing else is trusted.
 */
app.post("/api/roadmaps/:id/tasks", requireSession, asyncRoute(async (req, res) => {
  const roadmapId = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({
    taskText: z.string().trim().min(3).max(300),
    timeframe: z.enum(TIMEFRAMES).default("This Week"),
    whyItMatters: z.string().trim().max(500).optional().default(""),
    taskCategory: z.string().trim().max(60).optional().default("General"),
    resourceId: z.number().int().positive().nullable().optional().default(null),
    /** Put it right after this task (same timeframe) instead of at the end. */
    afterTaskId: z.number().int().positive().optional(),
  }).parse(req.body);

  const owner = await db.execute({ sql: "SELECT id FROM roadmaps WHERE id=? AND session_id=?", args: [roadmapId, req.sessionId!] });
  if (!owner.rows[0]) { res.status(404).json({ error: "Roadmap not found" }); return; }
  let resourceId: number | null = null;
  if (input.resourceId) {
    const listing = await resourcesByIds([input.resourceId]);
    resourceId = listing[0] ? input.resourceId : null;
  }
  const ordered = await db.execute({ sql: "SELECT id, task_order FROM roadmap_tasks WHERE roadmap_id=? AND session_id=? ORDER BY task_order", args: [roadmapId, req.sessionId!] });
  const ids = ordered.rows.map(row => Number(row.id));
  const at = input.afterTaskId && ids.includes(input.afterTaskId) ? ids.indexOf(input.afterTaskId) + 1 : ids.length;
  // Open a gap at `at` so the new step lands exactly where asked.
  await db.execute({ sql: "UPDATE roadmap_tasks SET task_order = task_order + 1 WHERE roadmap_id=? AND session_id=? AND task_order >= ?", args: [roadmapId, req.sessionId!, at] });
  const inserted = await db.execute({
    sql: `INSERT INTO roadmap_tasks (roadmap_id, session_id, task_text, task_category, timeframe, why_it_matters, motivation_note, resource_id, task_order)
          VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`,
    args: [roadmapId, req.sessionId!, input.taskText, input.taskCategory, input.timeframe, input.whyItMatters, resourceId, at],
  });
  await db.execute({ sql: "UPDATE roadmaps SET updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [roadmapId] });
  const row = await db.execute({ sql: "SELECT * FROM roadmap_tasks WHERE id=?", args: [Number(inserted.lastInsertRowid)] });
  res.status(201).json(mapTask(row.rows[0]));
}));

app.delete("/api/tasks/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await db.execute({ sql: "DELETE FROM roadmap_tasks WHERE id=? AND session_id=?", args: [id, req.sessionId!] });
  if (!result.rowsAffected) { res.status(404).json({ error: "Task not found" }); return; }
  res.status(204).end();
}));

app.patch("/api/tasks/:id", requireSession, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const update = z.object({
    status: z.enum(["not_started", "in_progress", "completed", "blocked"]).optional(),
    dueDate: z.string().date().nullable().optional(),
    blockerReason: z.string().trim().max(500).nullable().optional(),
    privateNote: z.string().trim().max(1000).nullable().optional(),
    // Editing by hand (Y4).
    taskText: z.string().trim().min(3).max(300).optional(),
    timeframe: z.enum(TIMEFRAMES).optional(),
    taskOrder: z.number().int().min(0).max(500).optional(),
    whyItMatters: z.string().trim().max(500).optional(),
  }).refine(value => Object.keys(value).length > 0).parse(req.body);

  const fields: string[] = [];
  const args: (string | number | null)[] = [];
  if (update.status !== undefined) { fields.push("status=?"); args.push(update.status); fields.push("completed_at=?"); args.push(update.status === "completed" ? new Date().toISOString() : null); }
  if (update.dueDate !== undefined) { fields.push("due_date=?"); args.push(update.dueDate); }
  if (update.blockerReason !== undefined) { fields.push("blocker_reason=?"); args.push(update.blockerReason); }
  if (update.privateNote !== undefined) { fields.push("private_note=?"); args.push(update.privateNote); }
  if (update.taskText !== undefined) { fields.push("task_text=?"); args.push(update.taskText); }
  if (update.timeframe !== undefined) { fields.push("timeframe=?"); args.push(update.timeframe); }
  if (update.taskOrder !== undefined) { fields.push("task_order=?"); args.push(update.taskOrder); }
  if (update.whyItMatters !== undefined) { fields.push("why_it_matters=?"); args.push(update.whyItMatters); }
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
    { sql: "DELETE FROM session_passcodes WHERE session_id=?", args: [req.sessionId!] },
  ], "write");
  res.status(204).send();
}));

/**
 * "Save this with a passcode" (Y6). See services/passcode.ts for the model.
 * PASSCODE_SECRET (or CHAT_SIGNING_SECRET) keys the lookup; without either,
 * a per-process key means passcodes stop working after a restart, which is
 * why production refuses to start without CHAT_SIGNING_SECRET already.
 */
const PASSCODE_SECRET = process.env.PASSCODE_SECRET || process.env.CHAT_SIGNING_SECRET || crypto.randomBytes(32).toString("hex");

app.get("/api/session/passcode", requireSession, asyncRoute(async (req, res) => {
  const row = (await db.execute({ sql: "SELECT created_at, last_used_at FROM session_passcodes WHERE session_id=?", args: [req.sessionId!] })).rows[0];
  res.json(row ? { enabled: true, createdAt: String(row.created_at), lastUsedAt: row.last_used_at ? String(row.last_used_at) : null } : { enabled: false });
}));

app.post("/api/session/passcode", requireSession, asyncRoute(async (req, res) => {
  const { passcode } = z.object({ passcode: z.string().max(200) }).parse(req.body);
  const problem = passcodeProblem(passcode);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const lookup = passcodeLookup(PASSCODE_SECRET, passcode);
  const taken = (await db.execute({ sql: "SELECT session_id FROM session_passcodes WHERE lookup=?", args: [lookup] })).rows[0];
  if (taken && String(taken.session_id) !== req.sessionId) {
    res.status(409).json({ error: "Someone already uses that passcode. Add a word or a number to make it yours." });
    return;
  }
  const sealed = await sealSession(passcode, req.sessionId!);
  await db.batch([
    { sql: "DELETE FROM session_passcodes WHERE session_id=?", args: [req.sessionId!] },
    { sql: "INSERT INTO session_passcodes(lookup, session_id, salt, iv, cipher, tag) VALUES (?, ?, ?, ?, ?, ?)", args: [lookup, req.sessionId!, sealed.salt, sealed.iv, sealed.cipher, sealed.tag] },
  ], "write");
  res.status(201).json({ enabled: true });
}));

app.delete("/api/session/passcode", requireSession, asyncRoute(async (req, res) => {
  await db.execute({ sql: "DELETE FROM session_passcodes WHERE session_id=?", args: [req.sessionId!] });
  res.status(204).send();
}));

// Guessing is the whole risk here, so restores are tightly limited per address.
app.use("/api/session/restore", rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }));
app.post("/api/session/restore", asyncRoute(async (req, res) => {
  const { passcode } = z.object({ passcode: z.string().min(1).max(200) }).parse(req.body);
  const row = (await db.execute({ sql: "SELECT * FROM session_passcodes WHERE lookup=?", args: [passcodeLookup(PASSCODE_SECRET, passcode)] })).rows[0];
  const sessionId = row ? await openSession(passcode, { salt: rowString(row, "salt"), iv: rowString(row, "iv"), cipher: rowString(row, "cipher"), tag: rowString(row, "tag") }) : null;
  if (!sessionId) { res.status(404).json({ error: "No plan matches that passcode. Check the spelling, or it may never have been saved." }); return; }
  await db.execute({ sql: "UPDATE session_passcodes SET last_used_at=CURRENT_TIMESTAMP WHERE session_id=?", args: [sessionId] });
  const plans = (await db.execute({ sql: "SELECT COUNT(*) AS n FROM roadmaps WHERE session_id=?", args: [sessionId] })).rows[0];
  res.json({ sessionId, plans: Number(plans?.n ?? 0) });
}));

/**
 * Self sign-up for partner users (R11). Contributor accounts only: everything
 * a contributor does (new listings, proposed changes) waits for a reviewer, so
 * an unvetted account cannot put anything in front of a young person.
 * Reviewer accounts are still created by Foster Guide.
 */
app.use("/api/partner/register", rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }));
app.post("/api/partner/register", asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(200),
    organisation: z.string().trim().min(2).max(140),
    password: z.string().min(1).max(200),
  }).parse(req.body);
  const problem = passwordProblem(input.password);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const email = normaliseEmail(input.email);
  const existing = await db.execute({ sql: "SELECT id FROM partners WHERE email = ?", args: [email] });
  if (existing.rows[0]) { res.status(409).json({ error: "There is already an account for that email. Sign in instead." }); return; }
  const inserted = await executeSerialised(db, {
    sql: "INSERT INTO partners(email, name, organisation, password_hash, active, role) VALUES (?, ?, ?, ?, 1, 'contributor')",
    args: [email, input.name, input.organisation, await hashPassword(input.password)],
  });
  const id = Number(inserted.lastInsertRowid);
  const partner: Partner = { id, email, name: input.name, organisation: input.organisation, active: true, role: "contributor" };
  const { token, tokenHash, expiresAt } = newSessionToken();
  await db.execute({ sql: "INSERT INTO partner_sessions(token_hash, partner_id, expires_at) VALUES (?, ?, ?)", args: [tokenHash, id, expiresAt] });
  await db.execute({ sql: "UPDATE partners SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", args: [id] });
  await executeSerialised(db, audit(partner, "partner.register", "partner", id, JSON.stringify({ organisation: input.organisation })));
  // Tell the team (when mail is set up). Failure here must not fail the sign-up.
  if (process.env.NOTIFY_EMAIL) {
    const note = newAccountEmail({ name: input.name, email, organisation: input.organisation });
    void sendMail(process.env.NOTIFY_EMAIL, note.subject, note.text);
  }
  res.status(201).json({ token, expiresAt, partner: { name: partner.name, email, organisation: partner.organisation, role: "contributor" } });
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
        SUM(CASE WHEN date(verified_at) < date('now','-180 days') OR (recheck_at IS NOT NULL AND date(recheck_at) <= date('now')) THEN 1 ELSE 0 END) AS stale
      FROM resources WHERE status='verified' GROUP BY category ORDER BY count DESC`),
    db.execute("SELECT county, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY county ORDER BY count DESC"),
    db.execute("SELECT category, county, COUNT(*) AS count FROM resources WHERE status='verified' GROUP BY category, county"),
    db.execute(`SELECT
        SUM(CASE WHEN date(verified_at) >= date('now','-90 days') THEN 1 ELSE 0 END) AS fresh,
        SUM(CASE WHEN date(verified_at) < date('now','-90 days') AND date(verified_at) >= date('now','-180 days') THEN 1 ELSE 0 END) AS aging,
        SUM(CASE WHEN date(verified_at) < date('now','-180 days') OR (recheck_at IS NOT NULL AND date(recheck_at) <= date('now')) THEN 1 ELSE 0 END) AS stale,
        SUM(CASE WHEN date(verified_at) IS NULL THEN 1 ELSE 0 END) AS unknown
      FROM resources WHERE status='verified'`),
    // A field counts as "known" when it is filled in OR a reviewer confirmed the listing has none (P7).
    db.execute(`SELECT
        SUM(CASE WHEN coalesce(phone,'')!='' OR fields_na LIKE '%"phone"%' THEN 1 ELSE 0 END) AS phone,
        SUM(CASE WHEN coalesce(website,'')!='' OR fields_na LIKE '%"website"%' THEN 1 ELSE 0 END) AS website,
        SUM(CASE WHEN coalesce(hours,'')!='' OR fields_na LIKE '%"hours"%' THEN 1 ELSE 0 END) AS hours,
        SUM(CASE WHEN coalesce(address,'')!='' OR fields_na LIKE '%"address"%' THEN 1 ELSE 0 END) AS address,
        SUM(CASE WHEN (cost!='' AND lower(cost) NOT LIKE '%not confirmed%') OR fields_na LIKE '%"cost"%' THEN 1 ELSE 0 END) AS cost_known,
        SUM(CASE WHEN age_min IS NOT NULL OR age_max IS NOT NULL OR fields_na LIKE '%"age"%' THEN 1 ELSE 0 END) AS age_known,
        SUM(CASE WHEN coalesce(languages,'')!='' OR fields_na LIKE '%"languages"%' THEN 1 ELSE 0 END) AS languages,
        SUM(CASE WHEN coalesce(source_url,'')!='' THEN 1 ELSE 0 END) AS source
      FROM resources WHERE status='verified'`),
    db.execute(`SELECT id, title, organization, category, county, verified_at, recheck_at FROM resources WHERE status='verified'
      ORDER BY CASE WHEN recheck_at IS NOT NULL AND date(recheck_at) <= date('now') THEN 0 ELSE 1 END, date(verified_at) ASC, id ASC LIMIT 25`),
    db.execute(`SELECT
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status='pending' AND date(created_at) < date('now','-7 days') THEN 1 ELSE 0 END) AS pending_over_week,
        SUM(CASE WHEN date(created_at) >= date('now','-30 days') THEN 1 ELSE 0 END) AS submitted_last_30
      FROM resource_submissions`),
    db.execute(`SELECT rr.id, rr.resource_id, r.title, r.organization, rr.reason, rr.created_at
      FROM resource_reports rr JOIN resources r ON r.id = rr.resource_id
      WHERE rr.resolved_at IS NULL
      ORDER BY rr.created_at DESC LIMIT 50`),
    db.execute(`SELECT COUNT(*) AS count FROM resource_submissions WHERE status='approved' AND date(reviewed_at) >= date('now','-30 days')`),
  ]);
  const pendingChanges = await db.execute("SELECT COUNT(*) AS count FROM resource_changes WHERE status='pending'");
  // Audit A13: listings that may describe one provider twice. Grouped by the
  // first three words of the title, or by organization when it differs from
  // the title. A lead for a reviewer to merge or clarify, not a verdict.
  const duplicateRows = await db.execute(`
    SELECT id, title, organization, category, county,
      lower(CASE WHEN organization <> '' AND lower(organization) <> lower(title) THEN organization ELSE title END) AS grp_source
    FROM resources WHERE status = 'verified'`);
  const groups = new Map<string, { id: number; title: string; organization: string; category: string; county: string }[]>();
  for (const row of duplicateRows.rows) {
    const key = String(row.grp_source).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3).join(" ");
    if (key.length < 6) continue;
    const list = groups.get(key) ?? [];
    list.push({ id: Number(row.id), title: String(row.title), organization: String(row.organization), category: String(row.category), county: String(row.county) });
    groups.set(key, list);
  }
  const duplicateCandidates = [...groups.entries()].filter(([, list]) => list.length > 1).map(([key, list]) => ({ key, listings: list })).sort((a, b) => b.listings.length - a.listings.length).slice(0, 40);
  res.json({
    duplicateCandidates,
    totals: { ...totals.rows[0], publishedLast30: Number(recentPublished.rows[0]?.count ?? 0) },
    changes: { pending: Number(pendingChanges.rows[0]?.count ?? 0) },
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

/* ── Partner: browse listings behind a Coverage bar, and propose or apply edits (P4–P7) ── */

const MISSING_FILTERS: Record<string, string> = {
  phone: "coalesce(r.phone,'')='' AND r.fields_na NOT LIKE '%\"phone\"%'",
  website: "coalesce(r.website,'')='' AND r.fields_na NOT LIKE '%\"website\"%'",
  hours: "coalesce(r.hours,'')='' AND r.fields_na NOT LIKE '%\"hours\"%'",
  address: "coalesce(r.address,'')='' AND r.fields_na NOT LIKE '%\"address\"%'",
  languages: "coalesce(r.languages,'')='' AND r.fields_na NOT LIKE '%\"languages\"%'",
  cost: "(r.cost='' OR lower(r.cost) LIKE '%not confirmed%') AND r.fields_na NOT LIKE '%\"cost\"%'",
  age: "r.age_min IS NULL AND r.age_max IS NULL AND r.fields_na NOT LIKE '%\"age\"%'",
};
const STALE_FILTER = "(date(r.verified_at) < date('now','-180 days') OR (r.recheck_at IS NOT NULL AND date(r.recheck_at) <= date('now')))";

app.get("/api/partner/resources", requirePartner, asyncRoute(async (req, res) => {
  const query = z.object({
    q: z.string().max(200).optional(),
    county: z.string().max(200).optional(),
    category: z.string().max(400).optional(),
    missing: z.enum(["phone", "website", "hours", "address", "languages", "cost", "age"]).optional(),
    stale: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  }).parse(req.query);
  const { filters, args } = buildResourceFilters({ county: query.county, category: query.category });
  // Partners see exact-county lists (no regional fold-in), otherwise a county bar's list would not match its count.
  const counties = listParam(query.county);
  if (counties.length) { filters.shift(); filters.shift(); filters.unshift("r.status = 'verified'"); filters.push(countyMatch(counties)); args.splice(0, counties.length); args.push(...counties.map(countyArg)); }
  if (query.missing) filters.push(MISSING_FILTERS[query.missing]);
  if (query.stale) filters.push(STALE_FILTER);
  if (query.q) {
    // Title, organization, category, description and eligibility — a reviewer looking for "duffel" or "trade school" finds it.
    filters.push("(lower(r.title) LIKE ? OR lower(r.organization) LIKE ? OR lower(r.category) LIKE ? OR lower(r.description) LIKE ? OR lower(r.eligibility) LIKE ? OR CAST(r.id AS TEXT) = ?)");
    const like = `%${query.q.trim().toLowerCase()}%`; args.push(like, like, like, like, like, query.q.trim());
  }
  const result = await db.execute({ sql: `SELECT r.* FROM resources r WHERE ${filters.join(" AND ")} ORDER BY r.title ASC LIMIT ?`, args: [...args, query.limit] });
  res.json(result.rows.map(mapResource));
}));

/** Reviewer marks a youth report handled (listing re-checked or corrected). The row is kept for the audit trail. */
app.post("/api/partner/reports/:id/resolve", requirePartner, requireReviewer, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await db.execute({ sql: "UPDATE resource_reports SET resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ? AND resolved_at IS NULL", args: [req.partner!.email, id] });
  if (!result.rowsAffected) { res.status(404).json({ error: "That report was not found or is already resolved." }); return; }
  res.status(204).send();
}));

app.get("/api/partner/resources/:id", requirePartner, asyncRoute(async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const resource = (await resourcesByIds([id]))[0];
  if (!resource) { res.status(404).json({ error: "Resource not found" }); return; }
  const changes = await db.execute({ sql: "SELECT id, partner_name, status, note, changes_json, created_at FROM resource_changes WHERE resource_id=? ORDER BY created_at DESC LIMIT 10", args: [id] });
  res.json({ ...resource, changes: changes.rows.map(row => ({ ...row, changes: JSON.parse(String(row.changes_json)) })) });
}));

const EDITABLE_FIELDS = {
  title: "title", organization: "organization", description: "description", eligibility: "eligibility", cost: "cost",
  applicationSteps: "application_steps", whatToBring: "what_to_bring", website: "website", phone: "phone",
  address: "address", hours: "hours", languages: "languages", accessibility: "accessibility", serviceArea: "service_area",
  category: "category", county: "county", deliveryMode: "delivery_mode",
} as const;
const NA_FIELDS = ["phone", "website", "hours", "address", "languages", "cost", "age"] as const;

const changeSchema = z.object({
  changes: z.object({
    title: z.string().trim().min(3).max(140).optional(),
    organization: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    eligibility: z.string().trim().max(1000).optional(),
    cost: z.string().trim().max(200).optional(),
    applicationSteps: z.string().trim().max(2000).optional(),
    whatToBring: z.string().trim().max(1000).optional(),
    website: z.string().trim().max(500).optional(),
    phone: z.string().trim().max(120).optional(),
    address: z.string().trim().max(300).optional(),
    hours: z.string().trim().max(200).optional(),
    languages: z.string().trim().max(200).optional(),
    accessibility: z.string().trim().max(300).optional(),
    serviceArea: z.string().trim().max(200).optional(),
    ageMin: z.number().int().min(0).max(120).nullable().optional(),
    ageMax: z.number().int().min(0).max(120).nullable().optional(),
    /** Fields this listing genuinely has none of, confirmed with the program (P7). */
    fieldsNa: z.array(z.enum(NA_FIELDS)).optional(),
    /** Check this listing again on or before this date (P7). Null clears it. */
    recheckAt: z.string().date().nullable().optional(),
    /** Service vs guide/PDF (Y11); reviewers can re-file a listing (R13). */
    kind: z.enum(["service", "information"]).optional(),
    checkedBy: z.enum(["phone", "online"]).optional(),
    /** Round 5: the basics are editable too — name, organization, category, and one or more regions. */
    category: z.string().trim().min(2).max(80).optional(),
    /** Audit A13: how the service is delivered, set by a person rather than inferred from a link. */
    deliveryMode: z.enum(["In person", "Phone or text", "Online", "Remote", "Contact for details"]).optional(),
    county: z.string().trim().min(2).max(200).transform((value, ctx) => {
      const normalised = normaliseCounty(value);
      if (!normalised) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Region must be one or more of: ${COUNTY_OPTIONS.join(", ")}` });
      return normalised ?? value;
    }).optional(),
  }).refine(value => Object.keys(value).length > 0, { message: "Nothing to change" }),
  note: z.string().trim().max(1000).optional().default(""),
});
type ResourceChanges = z.infer<typeof changeSchema>["changes"];
/** Anything with execute(): the client, or a transaction. */
type Executor = { execute: (statement: import("@libsql/client").InStatement) => Promise<import("@libsql/client").ResultSet> };

/** Apply a change set to a listing and refresh its search entry. The applier's email becomes verified_by. */
/**
 * Runs inside the caller's write transaction (audit A09): the FTS delete, the
 * row update and the FTS re-insert either all land or none do. Administrative
 * edits (name, organization, category, region) do not count as a re-check,
 * so they leave verified_at alone (audit A03).
 */
async function applyResourceChanges(tx: Executor, resourceId: number, changes: ResourceChanges, actor: Partner) {
  const before = await tx.execute({ sql: "SELECT * FROM resources WHERE id=?", args: [resourceId] });
  const row = before.rows[0];
  if (!row) return false;
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    const value = changes[key as keyof typeof EDITABLE_FIELDS];
    if (value !== undefined) { sets.push(`${column}=?`); args.push(value); }
  }
  if (changes.ageMin !== undefined) { sets.push("age_min=?"); args.push(changes.ageMin); }
  if (changes.ageMax !== undefined) { sets.push("age_max=?"); args.push(changes.ageMax); }
  if (changes.fieldsNa !== undefined) { sets.push("fields_na=?"); args.push(JSON.stringify([...new Set(changes.fieldsNa)])); }
  if (changes.recheckAt !== undefined) { sets.push("recheck_at=?"); args.push(changes.recheckAt); }
  if (changes.kind !== undefined) { sets.push("kind=?"); args.push(changes.kind); }
  const ADMIN_ONLY = new Set(["title", "organization", "category", "county", "checkedBy"]);
  const reChecked = Object.keys(changes).some(key => !ADMIN_ONLY.has(key));
  sets.push("updated_at=CURRENT_TIMESTAMP");
  if (reChecked) {
    const today = new Date().toISOString().slice(0, 10);
    sets.push("verified_at=?", "verified_by=?");
    args.push(today, changes.checkedBy === "phone" ? `${actor.email} (confirmed by phone)` : actor.email);
  }
  await tx.execute({
    sql: `INSERT INTO resources_fts(resources_fts, rowid, title, organization, description, category, county, service_area, eligibility, application_steps, tags)
          VALUES ('delete', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [resourceId, rowString(row, "title"), rowString(row, "organization"), rowString(row, "description"), rowString(row, "category"), rowString(row, "county"), rowString(row, "service_area"), rowString(row, "eligibility"), rowString(row, "application_steps"), rowString(row, "tags")],
  });
  await tx.execute({ sql: `UPDATE resources SET ${sets.join(", ")} WHERE id=?`, args: [...args, resourceId] });
  await tx.execute({
    sql: `INSERT INTO resources_fts(rowid, title, organization, description, category, county, service_area, eligibility, application_steps, tags)
          SELECT id, title, organization, description, category, county, service_area, eligibility, application_steps, tags FROM resources WHERE id = ?`,
    args: [resourceId],
  });
  return true;
}

app.post("/api/partner/resources/:id/changes", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = changeSchema.parse(req.body);
  const partner = req.partner!;
  const exists = await db.execute({ sql: "SELECT id, title FROM resources WHERE id=?", args: [id] });
  if (!exists.rows[0]) { res.status(404).json({ error: "Resource not found" }); return; }
  const reviewer = canReview(partner);
  const insertChange = {
    sql: `INSERT INTO resource_changes (resource_id, partner_id, partner_name, partner_email, changes_json, note, status, reviewed_by, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${reviewer ? "CURRENT_TIMESTAMP" : "NULL"})`,
    args: [id, partner.id, partner.name, partner.email, JSON.stringify(input.changes), input.note, reviewer ? "approved" : "pending", reviewer ? partner.email : null],
  };
  if (reviewer) {
    // Record, apply and audit in one transaction (audit A09).
    const changeId = await inWriteTransaction(db, async tx => {
      const inserted = await tx.execute(insertChange);
      const applied = await applyResourceChanges(tx, id, input.changes, partner);
      if (!applied) throw Object.assign(new Error("Resource not found"), { status: 404 });
      await tx.execute(audit(partner, "resource.edit", "resource", id, JSON.stringify({ changeId: Number(inserted.lastInsertRowid), fields: Object.keys(input.changes) })));
      return Number(inserted.lastInsertRowid);
    });
    res.json({ id: changeId, status: "approved", resource: (await resourcesByIds([id]))[0] });
    return;
  }
  const inserted = await executeSerialised(db, insertChange);
  await executeSerialised(db, audit(partner, "resource.propose", "resource", id, JSON.stringify({ changeId: Number(inserted.lastInsertRowid), fields: Object.keys(input.changes) })));
  res.status(202).json({ id: Number(inserted.lastInsertRowid), status: "pending" });
}));

app.get("/api/partner/changes", requirePartner, requireReviewer, asyncRoute(async (req, res) => {
  const status = z.enum(["pending", "approved", "rejected"]).optional().default("pending").parse(req.query.status);
  const result = await db.execute({
    sql: `SELECT c.*, r.title AS resource_title, r.organization AS resource_organization, r.county AS resource_county
          FROM resource_changes c JOIN resources r ON r.id = c.resource_id
          WHERE c.status = ? ORDER BY c.created_at ASC LIMIT 200`,
    args: [status],
  });
  const ids = [...new Set(result.rows.map(row => Number(row.resource_id)))];
  const current = new Map((await resourcesByIds(ids)).map(resource => [resource.id, resource]));
  res.json(result.rows.map(row => ({
    id: Number(row.id), resourceId: Number(row.resource_id), resourceTitle: rowString(row, "resource_title"), resourceOrganization: rowString(row, "resource_organization"), resourceCounty: rowString(row, "resource_county"),
    partnerName: rowString(row, "partner_name"), partnerEmail: rowString(row, "partner_email"), note: rowString(row, "note"), status: rowString(row, "status"),
    changes: JSON.parse(String(row.changes_json)), current: current.get(Number(row.resource_id)) ?? null, createdAt: rowString(row, "created_at"), reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null, moderatorNote: row.moderator_note ? String(row.moderator_note) : null,
  })));
}));

app.patch("/api/partner/changes/:id", requirePartner, requireReviewer, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z.object({ status: z.enum(["approved", "rejected"]), moderatorNote: z.string().trim().max(1000).optional().default("") }).parse(req.body);
  const partner = req.partner!;
  const existing = await db.execute({ sql: "SELECT * FROM resource_changes WHERE id=?", args: [id] });
  const change = existing.rows[0];
  if (!change) { res.status(404).json({ error: "Change not found" }); return; }
  if (String(change.status) !== "pending") { res.status(409).json({ error: "This change was already reviewed." }); return; }
  const parsed = input.status === "approved" ? changeSchema.shape.changes.safeParse(JSON.parse(String(change.changes_json))) : null;
  if (parsed && !parsed.success) { res.status(422).json({ error: "This proposal is no longer valid." }); return; }
  // Claim the proposal conditionally, apply it and audit, all in one
  // transaction: two reviewers approving at once cannot both apply it (audit A09).
  const claimed = await inWriteTransaction(db, async tx => {
    const claim = await tx.execute({ sql: "UPDATE resource_changes SET status=?, moderator_note=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'", args: [input.status, input.moderatorNote, partner.email, id] });
    if (!claim.rowsAffected) return false;
    if (parsed?.success) {
      const applied = await applyResourceChanges(tx, Number(change.resource_id), parsed.data, partner);
      if (!applied) throw Object.assign(new Error("Resource not found"), { status: 404 });
    }
    await tx.execute(audit(partner, `resource.change.${input.status}`, "resource", Number(change.resource_id), JSON.stringify({ changeId: id })));
    return true;
  });
  if (!claimed) { res.status(409).json({ error: "This change was already reviewed." }); return; }
  res.json({ id, status: input.status });
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
    sql: `INSERT INTO resource_submissions(title, organization, description, category, county, website, contact, source_url, relationship, submitter_name, partner_id, kind)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [input.title, input.organization, input.description, input.category, input.county, input.website, input.contact, input.sourceUrl, input.relationship, partner.name, partner.id, input.kind],
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
  // Same signing scheme as Nova, keyed to the partner account rather than a
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
  // Staff see the listings the answer drew on, so "who else runs this kind of
  // program" is answered by the directory itself, not only by prose.
  res.json({ reply, resources: resources.filter(resource => !resource.isCrisis).slice(0, 6), history: nextHistory, historyToken: signHistory(signer, nextHistory) });
}));

/**
 * Password reset, step 1 (A1): anyone can ask. The reply never says whether the
 * address has an account. Nothing is emailed: a reviewer sees the request on
 * the Accounts page and issues the link.
 */
app.use("/api/partner/reset-request", rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: "draft-7", legacyHeaders: false }));
app.post("/api/partner/reset-request", asyncRoute(async (req, res) => {
  const input = z.object({ email: z.string().trim().email().max(200) }).parse(req.body);
  const row = (await db.execute({ sql: "SELECT id, email FROM partners WHERE email = ? AND active = 1", args: [normaliseEmail(input.email)] })).rows[0];
  // With a mail provider the link goes straight to the address on file; the
  // request is recorded as issued by "email" so the Accounts page shows it.
  if (row && mailConfigured()) {
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const mail = resetEmail(`${siteUrl()}/partners/reset?token=${encodeURIComponent(token)}`);
    if (await sendMail(String(row.email), mail.subject, mail.text)) {
      await db.execute({ sql: "INSERT INTO partner_password_resets(partner_id, token_hash, issued_by, issued_at, expires_at) VALUES (?, ?, 'email', CURRENT_TIMESTAMP, ?)", args: [Number(row.id), hashToken(token), expiresAt] });
      res.status(202).json({ message: "If that address has an account, a reset link is on its way to it. Check spam if it has not arrived in a few minutes; it works once and expires in 48 hours." });
      return;
    }
  }
  if (row) {
    const open = await db.execute({ sql: "SELECT id FROM partner_password_resets WHERE partner_id = ? AND used_at IS NULL AND token_hash IS NULL", args: [Number(row.id)] });
    if (!open.rows[0]) await db.execute({ sql: "INSERT INTO partner_password_resets(partner_id) VALUES (?)", args: [Number(row.id)] });
  }
  res.status(202).json({ message: "If that address has an account, a Foster Guide reviewer will send a reset link to it. This is done by a person, so it can take a day." });
}));

/** Step 2: set a new password with a link a reviewer issued. Signs every device out. */
app.post("/api/partner/reset", asyncRoute(async (req, res) => {
  const input = z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(200) }).parse(req.body);
  const problem = passwordProblem(input.password);
  if (problem) { res.status(400).json({ error: problem }); return; }
  const passwordHash = await hashPassword(input.password);
  // One transaction: claim the token (conditionally, so two simultaneous
  // requests cannot both consume it), change the password, revoke sessions
  // (audit A11). Any failure rolls all three back.
  const consumed = await inWriteTransaction(db, async tx => {
    const claim = await tx.execute({
      sql: "UPDATE partner_password_resets SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING partner_id",
      args: [hashToken(input.token), new Date().toISOString()],
    });
    const partnerId = claim.rows[0]?.partner_id;
    if (partnerId === undefined || partnerId === null) return false;
    await tx.execute({ sql: "UPDATE partners SET password_hash = ? WHERE id = ?", args: [passwordHash, Number(partnerId)] });
    await tx.execute({ sql: "DELETE FROM partner_sessions WHERE partner_id = ?", args: [Number(partnerId)] });
    return true;
  });
  if (!consumed) { res.status(400).json({ error: "That reset link is not valid any more. Ask for a new one from the sign-in page." }); return; }
  res.status(204).end();
}));

/**
 * Accounts (A2), reviewers only: every registered partner, when they joined
 * and last signed in, how many listings they have submitted, and open reset
 * requests. This is how the founder sees who has registered.
 */
app.get("/api/partner/accounts", requirePartner, requireReviewer, asyncRoute(async (_req, res) => {
  const result = await db.execute(`
    SELECT p.id, p.email, p.name, p.organisation, p.role, p.active, p.created_at, p.last_login_at,
      (SELECT COUNT(*) FROM resource_submissions s WHERE s.partner_id = p.id) AS submissions,
      (SELECT COUNT(*) FROM partner_password_resets r WHERE r.partner_id = p.id AND r.used_at IS NULL AND r.token_hash IS NULL) AS reset_requested,
      (SELECT MAX(r.issued_at) FROM partner_password_resets r WHERE r.partner_id = p.id AND r.used_at IS NULL AND r.token_hash IS NOT NULL AND r.expires_at > CURRENT_TIMESTAMP) AS reset_issued_at
    FROM partners p ORDER BY p.created_at DESC`);
  res.json(result.rows.map(row => ({
    id: Number(row.id), email: String(row.email), name: String(row.name), organisation: String(row.organisation || ""),
    role: row.role === "reviewer" ? "reviewer" : "contributor", active: Boolean(Number(row.active)),
    createdAt: String(row.created_at), lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    submissions: Number(row.submissions), resetRequested: Number(row.reset_requested) > 0,
    resetIssuedAt: row.reset_issued_at ? String(row.reset_issued_at) : null,
  })));
}));

/** Issue a one-time reset link (valid 48 hours). Returned once; the reviewer sends it to the partner's email themselves. */
/**
 * Reviewer removes a partner's access (or restores it). The row stays, so their
 * submissions and edits keep their audit trail; sessions and open reset links go.
 * A reviewer cannot remove their own access.
 */
app.post("/api/partner/accounts/:id/access", requirePartner, requireReviewer, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  if (id === req.partner!.id) { res.status(400).json({ error: "You cannot remove your own access. Ask another reviewer." }); return; }
  const target = (await db.execute({ sql: "SELECT id FROM partners WHERE id = ?", args: [id] })).rows[0];
  if (!target) { res.status(404).json({ error: "Account not found" }); return; }
  await db.batch([
    { sql: "UPDATE partners SET active = ? WHERE id = ?", args: [active ? 1 : 0, id] },
    ...(active ? [] : [
      { sql: "DELETE FROM partner_sessions WHERE partner_id = ?", args: [id] },
      { sql: "DELETE FROM partner_password_resets WHERE partner_id = ? AND used_at IS NULL", args: [id] },
    ]),
  ], "write");
  console.info(active ? "Partner access restored" : "Partner access removed", { id, by: req.partner!.email });
  res.status(204).send();
}));

app.post("/api/partner/accounts/:id/reset-link", requirePartner, requireReviewer, asyncRoute(async (req: PartnerRequest, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const target = (await db.execute({ sql: "SELECT id, email FROM partners WHERE id = ? AND active = 1", args: [id] })).rows[0];
  if (!target) { res.status(404).json({ error: "No active account with that id." }); return; }
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const open = (await db.execute({ sql: "SELECT id FROM partner_password_resets WHERE partner_id = ? AND used_at IS NULL AND token_hash IS NULL", args: [id] })).rows[0];
  if (open) {
    await db.execute({ sql: "UPDATE partner_password_resets SET token_hash = ?, issued_by = ?, issued_at = CURRENT_TIMESTAMP, expires_at = ? WHERE id = ?", args: [hashToken(token), req.partner!.email, expiresAt, Number(open.id)] });
  } else {
    await db.execute({ sql: "INSERT INTO partner_password_resets(partner_id, token_hash, issued_by, issued_at, expires_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)", args: [id, hashToken(token), req.partner!.email, expiresAt] });
  }
  await executeSerialised(db, audit(req.partner!, "partner.reset_link", "partner", id, ""));
  res.json({ token, expiresAt, email: String(target.email) });
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
    // Name the first field that failed so a person can fix it ("age: must be…").
    const flat = error.flatten();
    const first = Object.entries(flat.fieldErrors).find(([, messages]) => messages && messages.length);
    const hint = first ? ` (${first[0]}: ${(first[1] as string[])[0]})` : "";
    res.status(400).json({ error: `Please check the information you entered${hint}`, details: flat });
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
  app.listen(PORT, process.env.HOST || "0.0.0.0", () => console.log(`Foster Guide API running at http://localhost:${PORT}`));
}).catch(error => {
  console.error("Database initialization failed", error);
  process.exit(1);
});
