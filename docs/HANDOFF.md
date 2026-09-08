# Current handoff

Updated: 2026-09-08, after dual-interface implementation and cross-tool workflow setup.
Status: idle; no implementation task is claimed.
Owner: none. Last writer: Codex/Astra.
Workspace: `/Users/advikarichhariya/StudentHub/Projects/FosterConnect2.0`
Git: no repository detected. No branch, commit or clean-diff claim is available.
Recommended next task: FC-01 in TASKS.md. Good first bounded trial for Fable; Astra can review afterward. This recommendation is not a dispatched task.

## Completed

- Youth homepage redesign: search-first, support cards, plan panel, clearer navigation, responsive layouts.
- Dedicated partner shell and routes: overview, sign-in, own submissions, add resource, coverage, staff guide and reviewer queue.
- Authenticated submissions use the server's partner identity and return only the requesting individual's submissions.
- Reviewer role enforced on backend moderation endpoints. Existing/unassigned roles default to contributor. No partner accounts were created.
- Staff guide has a separate authenticated endpoint/prompt, no youth-data or publishing tools. Live provider output was not evaluated.
- Frontend type-check script corrected to check app and Vite configs; existing RoadmapPage typing issues fixed.
- Shared workflow entry points: root AGENTS.md, CLAUDE.md; docs/WORKFLOW.md, HANDOFF.md and TASKS.md.

## Last verification (previous implementation turn; not rerun for documentation setup)

- `npm test --prefix backend`: 23 tests passed, including isolated API integration for auth, submission ownership, reviewer restrictions, status updates and logout.
- Frontend actual type checks, changed-file ESLint, production build: passed.
- Browser: desktop partner overview, real category/region coverage, mobile navigation, signed-out gating and return to youth shell checked.
- Signed-in partner UI was not browser-tested; access behavior was API-tested with temporary fixtures.
- Safety tests passing do NOT resolve the known FC-01 mixed-disclosure bug.

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

If instructed to continue FC-01: read `backend/src/services/safety.ts` and its tests. Add a failing regression for a message containing both figurative language and explicit danger. Fix the broad figurative early return without suppressing real disclosures or routing ordinary idioms to crisis. Do not redesign the UI.

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
