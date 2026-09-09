# Small work packets

These are proposed next tasks, not authorization to execute the entire backlog. One editor claims one task in HANDOFF. Update status here when completed. Recommendations can change based on observed results.

## FC-01 — Fix mixed-message crisis detection

Status: implemented 2026-09-08 by Fable; tests pass; awaiting independent review by Astra, then commit.
Scope: `backend/src/services/safety.ts` and `safety.test.ts`.
Approach taken: figurative spans are stripped from the normalized text (not used as a whole-message early return); remaining text goes through the normal rules. Parental "kill me" idiom is stripped only with a consequence clause; bare form is `concern`.
Limitations of rule-based detection (for reviewers and future work): only listed idioms are stripped; disclosures outside the pattern list are missed; stripping cannot understand negation or sarcasm; the concern threshold for a bare parental threat is a product judgment, not a validated clinical one. A model-based second pass would help but must never replace this deterministic net.
Problem: `FIGURATIVE.some(...)` returns `none` for the entire message before checking explicit danger.
Reproduced example: "I am dying to get this job. I want to kill myself tonight." returned `none`. Another: "My mom will kill me. She has a gun."
Acceptance: add failing regressions first; mixed disclosures reach appropriate safety categories; ordinary figurative statements stay non-crisis; avoid treating a parent's threatening phrase as categorically harmless; existing cases still pass. Explain limitations of rule-based detection. No UI changes or real disclosures in fixtures.

## FC-02 — Roadmap grounding and provider failure recovery

Status: implemented 2026-09-08 by Fable; tests pass; awaiting independent review, then commit.
Scope: AI service, grounding, roadmap endpoint and targeted tests. Also a small fallback notice on RoadmapPage.
Approach taken: model output is a draft; `groundRoadmapDraft` drops tasks with unsupplied resource IDs, sanitises every text field against the resource + crisis allow-list, drops tasks that needed contact details removed, rejects drafts with under four surviving tasks. All provider failures fall back to the deterministic plan, labelled `generatedBy: "fallback"`.
Known gap (next layer, not done): an invented organisation name with no phone, URL, or resourceId still survives in prose. Would need an allow-list of supplied `organization`/`title` strings plus a proper-noun heuristic, and a false-positive budget for ordinary capitalised words. Prompting alone does not close this; the check must be in code.
Problem: invalid resource IDs become null while unsupported prose survives; contact sanitation isn't applied to every roadmap field; configured provider errors bypass deterministic fallback.
Acceptance: unsupported claims/tasks are rejected or safely regenerated; user-visible contact facts grounded across all output fields; timeout/error/malformed response paths covered with mocked providers; fallback clearly labeled; no network calls or user data in tests.

## FC-03 — Make skipped intake answers genuinely unknown

Status: ready. Suggested implementer: Astra for interaction decisions, Sonnet for an agreed implementation.
Scope: intake component, API schema and roadmap input mapping.
Acceptance: distinguish have/need/unknown/prefer-not-to-answer; skipped documents never become automatically missing; optional questions have clear actions; youth can avoid inventing a six-month ambition; migration/backward compatibility addressed; test payload semantics and inspect mobile/keyboard behavior.

## FC-04 — Transactional publishing and plan persistence

Status: implemented 2026-09-08 by Fable; tests pass; awaiting independent review, then commit.
Scope: backend routes and isolated integration tests. Implemented in `backend/src/services/persistence.ts` (see HANDOFF for design). Follow-up not done: an HTTP-level approve test in `partner-access.test.ts`.
Acceptance: resource/index/submission/audit writes are atomic; concurrent approvals don't publish duplicates; failure during plan creation doesn't leave a partial plan; injected-failure/concurrency tests use temporary databases.

## FC-05 — Trustworthy resource freshness

Status: needs a short product/data decision before implementation. Suggested design: Astra + human resource owner; implementation: Sonnet/Fable.
Scope: import pipeline, resource schema, reviewer workflow and resource detail.
Acceptance: imported/extracted information isn't labeled human-verified by default; capture reviewer, evidence, checked fields, date and next review; display unknown availability; create correction/reverification ownership. Verify real services with their authoritative sources; AI confidence is not evidence.

## FC-06 — Launch foundations

Status: slice 1 done 2026-09-08 (Fable): database untracked and ignored, legacy ETL disarmed, backup command, root test command, production secret guard, docs/DEPLOY.md, README corrections. Not permission to deploy.
Suggested implementer for later slices: Sonnet for defined setup, Astra/Fable for review.
Remaining slices, each independently reviewable: CI running root `npm test`; uptime ping on `/api/health`; Turso backup + restore drill; partner password reset flow (today: re-run partner script). Human blockers listed in docs/DEPLOY.md are not agent work.

## FC-07 — Independent pilot readiness review

Status: after blockers above.
Suggested technical review: whichever provider did not implement the relevant slice.
Acceptance: verify both personas end to end with synthetic test accounts; inaccessible/empty/loading/error states; mobile and assistive navigation; session expiry and data deletion; partner isolation; realistic AI evaluations. Record unresolved issues. Paid youth and qualified partner review is a separate human step; no model may claim it occurred.
