# Small work packets

These are proposed next tasks, not authorization to execute the entire backlog. One editor claims one task in HANDOFF. Update status here when completed. Recommendations can change based on observed results.

## FC-01 — Fix mixed-message crisis detection

Status: ready. Suggested implementer: Fable trial; reviewer: Astra.
Scope: `backend/src/services/safety.ts` and `safety.test.ts`.
Problem: `FIGURATIVE.some(...)` returns `none` for the entire message before checking explicit danger.
Reproduced example: "I am dying to get this job. I want to kill myself tonight." returned `none`. Another: "My mom will kill me. She has a gun."
Acceptance: add failing regressions first; mixed disclosures reach appropriate safety categories; ordinary figurative statements stay non-crisis; avoid treating a parent's threatening phrase as categorically harmless; existing cases still pass. Explain limitations of rule-based detection. No UI changes or real disclosures in fixtures.

## FC-02 — Roadmap grounding and provider failure recovery

Status: ready after FC-01. Suggested implementer: Fable or Astra.
Scope: AI service, grounding, roadmap endpoint and targeted tests.
Problem: invalid resource IDs become null while unsupported prose survives; contact sanitation isn't applied to every roadmap field; configured provider errors bypass deterministic fallback.
Acceptance: unsupported claims/tasks are rejected or safely regenerated; user-visible contact facts grounded across all output fields; timeout/error/malformed response paths covered with mocked providers; fallback clearly labeled; no network calls or user data in tests.

## FC-03 — Make skipped intake answers genuinely unknown

Status: ready. Suggested implementer: Astra for interaction decisions, Sonnet for an agreed implementation.
Scope: intake component, API schema and roadmap input mapping.
Acceptance: distinguish have/need/unknown/prefer-not-to-answer; skipped documents never become automatically missing; optional questions have clear actions; youth can avoid inventing a six-month ambition; migration/backward compatibility addressed; test payload semantics and inspect mobile/keyboard behavior.

## FC-04 — Transactional publishing and plan persistence

Status: ready. Suggested implementer: Fable; Sonnet may execute a concrete agreed design.
Scope: backend routes and isolated integration tests.
Acceptance: resource/index/submission/audit writes are atomic; concurrent approvals don't publish duplicates; failure during plan creation doesn't leave a partial plan; injected-failure/concurrency tests use temporary databases.

## FC-05 — Trustworthy resource freshness

Status: needs a short product/data decision before implementation. Suggested design: Astra + human resource owner; implementation: Sonnet/Fable.
Scope: import pipeline, resource schema, reviewer workflow and resource detail.
Acceptance: imported/extracted information isn't labeled human-verified by default; capture reviewer, evidence, checked fields, date and next review; display unknown availability; create correction/reverification ownership. Verify real services with their authoritative sources; AI confidence is not evidence.

## FC-06 — Launch foundations

Status: ready for a scoped operator task; not permission to deploy.
Suggested implementer: Sonnet for defined setup, Astra/Fable for review.
First slice: establish safe local Git baseline and ignore sensitive/runtime artifacts without publishing a remote.
Later separate slices: retire dangerous legacy ETL entry point, durable backups/restore test, environment configuration, CI, readiness monitoring, account recovery. Keep each slice independently reviewable.

## FC-07 — Independent pilot readiness review

Status: after blockers above.
Suggested technical review: whichever provider did not implement the relevant slice.
Acceptance: verify both personas end to end with synthetic test accounts; inaccessible/empty/loading/error states; mobile and assistive navigation; session expiry and data deletion; partner isolation; realistic AI evaluations. Record unresolved issues. Paid youth and qualified partner review is a separate human step; no model may claim it occurred.
