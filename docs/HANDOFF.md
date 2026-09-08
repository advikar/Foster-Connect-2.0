# Current handoff

Updated: 2026-09-08, after FC-01 implementation (Claude Code / Fable 5.1).
Status: FC-01 implemented and tested; awaiting independent review (Astra). Ownership released.
Owner: none. Last writer: Claude Code/Fable.
Workspace: `/Users/advikarichhariya/StudentHub/Projects/FosterConnect2.0`
Git: repository exists, remote `https://github.com/advikar/Foster-Connect-2.0`, baseline commit "Initial commit". FC-01 changes are uncommitted in the working tree; commit them after review.
Recommended next task: review FC-01, then FC-02 (grounding/provider fallback). See "Next action".

## Completed

- Youth homepage redesign: search-first, support cards, plan panel, clearer navigation, responsive layouts.
- Dedicated partner shell and routes: overview, sign-in, own submissions, add resource, coverage, staff guide and reviewer queue.
- Authenticated submissions use the server's partner identity and return only the requesting individual's submissions.
- Reviewer role enforced on backend moderation endpoints. Existing/unassigned roles default to contributor. No partner accounts were created.
- Staff guide has a separate authenticated endpoint/prompt, no youth-data or publishing tools. Live provider output was not evaluated.
- Frontend type-check script corrected to check app and Vite configs; existing RoadmapPage typing issues fixed.
- Shared workflow entry points: root AGENTS.md, CLAUDE.md; docs/WORKFLOW.md, HANDOFF.md and TASKS.md.
- FC-01 (Fable, 2026-09-08): `assessSafety` no longer returns `none` for a whole message when any idiom matches. Figurative spans are now stripped from the normalized text and the remainder is assessed by the ordinary rules. The "my mom will kill me" idiom is only stripped when a consequence clause follows (if/when/for/because/over/...); a bare parental "kill me" phrase now surfaces as `concern`. Six mixed-message regressions added, plus three new ordinary cases and a bare-threat test. Fixed a pre-existing false positive: "my foster mom is going to kill me when she sees my grades" used to route to violence crisis.

## Last verification (FC-01 turn, 2026-09-08)

- `npm test --prefix backend`: 24 tests passed (was 23; one new test). New regressions were observed failing before the fix (six NOT CRISIS, one bare-threat assertion, one FALSE POSITIVE) and pass after it. Includes isolated API integration for auth, submission ownership, reviewer restrictions, status updates and logout.
- Frontend checks not rerun: no frontend files changed.
- No browser check: no UI change.

Carried over from the previous (dual-interface) turn, not rerun:

- Frontend type checks, changed-file ESLint, production build: passed.
- Browser: desktop partner overview, real category/region coverage, mobile navigation, signed-out gating and return to youth shell checked.
- Signed-in partner UI was not browser-tested; access behavior was API-tested with temporary fixtures.
- Safety detection is still rule-based. Known limits (documented in TASKS FC-01): idioms not in the list are not stripped; a disclosure phrased in a way no rule covers is still missed; concern-level output for bare parental threats is a judgment call, not a verified clinical threshold. Independent review pending.

## Files to start from

- UI shells: `frontend/src/components/layout/AppLayout.tsx`, `PartnerLayout.tsx`
- Partner UI: `frontend/src/pages/PartnerPages.tsx`, `InsightsPage.tsx`, `AddResourcePage.tsx`
- Auth state/API: `frontend/src/contexts/PartnerContext.tsx`, `frontend/src/lib/api.ts`
- Routes: `frontend/src/router.tsx`
- Backend routes/migrations: `backend/src/server.ts`
- AI/safety: `backend/src/services/{ai.service,safety,grounding}.ts`
- Integration test: `backend/src/services/partner-access.test.ts`
- Feature details: `docs/dual-interface.md`

## Runtime and data

Previous turn started loopback backend on port 4000 from compiled `backend/dist/server.js`; frontend was on port 5173. Verify liveness; process handles are tool-specific and not a handoff mechanism. Rebuild/restart backend after changes. API integration tests use port 4497.

Local DB was backed up before role/owner migrations to:
`/var/folders/l5/ybr_wpdj0lb5k_l91ktvcnq80000gn/T/fc-before-dual-interface-_d6wv0b1/foster_connect.db`
This temporary backup may expire; it is not durable disaster recovery.

401 records were shown as published in the local directory. This is an observed status count, not independently verified freshness. Do not infer public-launch readiness.

## Next action

1. Independent review of FC-01 (Astra or another model, read-only): `backend/src/services/safety.ts` (`FIGURATIVE`, `BARE_PARENT_THREAT`, `stripFigurative`, `assessSafety`) and `safety.test.ts`. Check especially: whether stripping a span could ever create a false match by joining neighbouring words (spans are replaced by a space, so it should not), and whether the consequence-clause lookahead is too permissive (e.g. "my mom will kill me, she said that about my brother" would be treated as idiom because of "about").
2. After review, commit FC-01 to Git.
3. Then FC-02 (grounding and provider failure recovery).

## Active checkpoint template (replace when claiming a task)

- Task / acceptance criteria:
- Owner / start time:
- Files intended / actually changed:
- Last completed checkpoint:
- Checks run / outcomes:
- Incomplete edits or running commands:
- Decisions / remaining uncertainty:
- Exact next action:
- Ownership released: yes/no
