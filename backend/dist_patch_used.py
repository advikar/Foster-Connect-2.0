import io

p = 'server.ts'
s = io.open(p, encoding='utf-8').read()

start = s.index('app.patch("/api/partner/submissions/:id", requirePartner,')
end = s.index('}));', start) + len('}));')

new_patch = r'''/**
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

app.patch("/api/partner/submissions/:id", requirePartner, asyncRoute(async (req: PartnerRequest, res) => {
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

  const detail = update.resource;
  const today = new Date().toISOString().slice(0, 10);
  const inserted = await db.execute({
    sql: `INSERT INTO resources
      (title, organization, description, category, county, service_area, eligibility,
       age_min, age_max, cost, application_steps, what_to_bring, website, phone, address,
       hours, languages, accessibility, delivery_mode, urgency_level, is_crisis,
       source_url, verified_at, verified_by, status, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?)`,
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
      String(submission.source_url), today, partner.email, "community",
    ],
  });
  const resourceId = Number(inserted.lastInsertRowid);

  // The FTS table is external-content with no triggers (see data/run_etl.py),
  // so a new row is invisible to search until it is indexed by hand.
  await db.execute({
    sql: `INSERT INTO resources_fts(rowid, title, organization, description, category,
            county, service_area, eligibility, application_steps, tags)
          SELECT id, title, organization, description, category, county, service_area,
            eligibility, application_steps, tags FROM resources WHERE id = ?`,
    args: [resourceId],
  });

  await db.execute({
    sql: `UPDATE resource_submissions SET status='approved', moderator_note=?, reviewed_by=?,
          resource_id=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
    args: [update.moderatorNote, partner.email, resourceId, id],
  });
  await recordAudit(partner, "submission.approved", "submission", id, `published as resource ${resourceId}`);
  await recordAudit(partner, "resource.published", "resource", resourceId, String(submission.title));

  res.json({ id, status: "approved", resourceId, publishedAt: today });
}));'''

s = s[:start] + new_patch + s[end:]

# pending submissions first in the queue
old_list = 'const result = await db.execute("SELECT * FROM resource_submissions ORDER BY created_at DESC");'
new_list = "const result = await db.execute(\"SELECT * FROM resource_submissions ORDER BY (status = 'pending') DESC, created_at DESC\");"
assert old_list in s
s = s.replace(old_list, new_list, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print("approval publishes; queue ordered")
