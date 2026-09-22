import type { Client, InStatement, ResultSet, Transaction } from "@libsql/client";

/**
 * The two multi-table writes that used to be several independent
 * `db.execute` calls in a row (FC-04).
 *
 * Publishing a submission touches four tables: resources, the FTS index,
 * the submission row, and the audit log. Creating a plan touches two. When any
 * step after the first failed, the earlier rows stayed: a resource with no
 * search entry, a plan with no tasks, an "approved" tick with nothing behind
 * it. Two reviewers clicking Approve together produced two published copies.
 *
 * Both writes now run inside one transaction, and writes are serialised
 * within this process. The serialisation matters because the local sqlite
 * client shares a single connection: interleaving two interactive
 * transactions on it is undefined at best. The conditional UPDATE in
 * `publishSubmission` is the second, independent guard: it holds even across
 * several server instances on a hosted database.
 */

// ─── In-process write serialisation ─────────────────────────────────────────

let queue: Promise<unknown> = Promise.resolve();

/** Run `fn` after every previously queued write has settled. */
export function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function inWriteTransaction<T>(db: Client, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return serialised(async () => {
    const tx = await db.transaction("write");
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } finally {
      // close() rolls back anything not committed; it is a no-op after commit.
      tx.close();
    }
  });
}

// ─── Publishing ─────────────────────────────────────────────────────────────

export interface PublishActor {
  id: number;
  email: string;
}

export interface PublishDetail {
  eligibility: string;
  cost: string;
  applicationSteps: string;
  whatToBring: string;
  serviceArea: string;
  phone: string;
  address: string;
  hours: string;
  languages: string;
  accessibility: string;
  deliveryMode: string;
  urgencyLevel: string;
  isCrisis: boolean;
  ageMin?: number | null;
  ageMax?: number | null;
}

export type PublishResult =
  | { ok: true; resourceId: number; publishedAt: string }
  | { ok: false; reason: "not_found" | "already_published" };

/**
 * Publish an approved submission as a verified resource. Atomic: either the
 * resource, its search entry, the submission link, and both audit rows exist,
 * or none of them do. A submission can be published exactly once, no matter
 * how many reviewers approve it at the same moment.
 */
export async function publishSubmission(
  db: Client,
  submissionId: number,
  actor: PublishActor,
  detail: PublishDetail,
  moderatorNote: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<PublishResult> {
  return inWriteTransaction<PublishResult>(db, async tx => {
    const existing = await tx.execute({ sql: "SELECT * FROM resource_submissions WHERE id = ?", args: [submissionId] });
    const submission = existing.rows[0];
    if (!submission) return { ok: false, reason: "not_found" };
    if (Number(submission.resource_id)) return { ok: false, reason: "already_published" };

    const inserted = await tx.execute({
      sql: `INSERT INTO resources
        (title, organization, description, category, county, service_area, eligibility,
         age_min, age_max, cost, application_steps, what_to_bring, website, phone, address,
         hours, languages, accessibility, delivery_mode, urgency_level, is_crisis,
         source_url, verified_at, verified_by, status, tags, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?)`,
      args: [
        String(submission.title), String(submission.organization), String(submission.description),
        String(submission.category), String(submission.county),
        detail.serviceArea || String(submission.county),
        detail.eligibility,
        detail.ageMin ?? null, detail.ageMax ?? null,
        detail.cost, detail.applicationSteps, detail.whatToBring,
        String(submission.website), detail.phone || String(submission.contact || ""),
        detail.address, detail.hours, detail.languages, detail.accessibility,
        detail.deliveryMode, detail.urgencyLevel, detail.isCrisis ? 1 : 0,
        String(submission.source_url), today, actor.email, "community",
        submission.kind === "information" ? "information" : "service",
      ],
    });
    const resourceId = Number(inserted.lastInsertRowid);

    // External-content FTS table with no triggers: index by hand.
    await tx.execute({
      sql: `INSERT INTO resources_fts(rowid, title, organization, description, category,
              county, service_area, eligibility, application_steps, tags)
            SELECT id, title, organization, description, category, county, service_area,
              eligibility, application_steps, tags FROM resources WHERE id = ?`,
      args: [resourceId],
    });

    // The claim. `resource_id IS NULL` makes this safe even if another
    // instance published between our SELECT and here: zero rows means we
    // lost the race, and the whole transaction (resource included) rolls back.
    const claimed = await tx.execute({
      sql: `UPDATE resource_submissions
            SET status='approved', moderator_note=?, reviewed_by=?, resource_id=?, reviewed_at=CURRENT_TIMESTAMP
            WHERE id=? AND resource_id IS NULL`,
      args: [moderatorNote, actor.email, resourceId, submissionId],
    });
    if (claimed.rowsAffected !== 1) {
      throw new AlreadyPublished();
    }

    await tx.execute(audit(actor, "submission.approved", "submission", submissionId, `published as resource ${resourceId}`));
    await tx.execute(audit(actor, "resource.published", "resource", resourceId, String(submission.title)));

    return { ok: true, resourceId, publishedAt: today };
  }).catch(error => {
    if (error instanceof AlreadyPublished) return { ok: false, reason: "already_published" } as const;
    throw error;
  });
}

class AlreadyPublished extends Error {}

export function audit(actor: PublishActor, action: string, targetType: string, targetId: number | null, detail = ""): InStatement {
  return {
    sql: `INSERT INTO audit_log(partner_id, partner_email, action, target_type, target_id, detail)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [actor.id, actor.email, action, targetType, targetId, detail],
  };
}

// ─── Plans ──────────────────────────────────────────────────────────────────

export interface PlanTask {
  taskText: string;
  taskCategory: string;
  timeframe: string;
  whyItMatters: string;
  motivationNote: string;
  resourceId: number | null;
}

export interface PlanRecord {
  title: string;
  goalSummary: string;
  greeting: string;
  closing: string;
  county: string;
  youthName: string;
  intake: unknown;
  tasks: PlanTask[];
}

/** Insert a plan and all of its tasks, or nothing. Returns the new plan id. */
export async function persistRoadmap(db: Client, sessionId: string, plan: PlanRecord): Promise<number> {
  return inWriteTransaction(db, async tx => {
    const result = await tx.execute({
      sql: `INSERT INTO roadmaps(session_id, title, goal_summary, greeting, closing, county, youth_name, intake_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [sessionId, plan.title, plan.goalSummary, plan.greeting, plan.closing, plan.county, plan.youthName, JSON.stringify(plan.intake)],
    });
    const roadmapId = Number(result.lastInsertRowid);
    for (const [index, task] of plan.tasks.entries()) {
      await tx.execute({
        sql: `INSERT INTO roadmap_tasks
          (roadmap_id, session_id, task_text, task_category, timeframe, why_it_matters, motivation_note, resource_id, task_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [roadmapId, sessionId, task.taskText, task.taskCategory, task.timeframe,
          task.whyItMatters, task.motivationNote, task.resourceId, index],
      });
    }
    return roadmapId;
  });
}

/** Re-exported so the route can keep its single-statement audit calls in the same queue. */
export function executeSerialised(db: Client, statement: InStatement): Promise<ResultSet> {
  return serialised(() => db.execute(statement));
}
