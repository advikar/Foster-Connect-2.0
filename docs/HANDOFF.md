# Current handoff

Updated: 2026-09-08, after FC-01 implementation (Claude Code / Fable 5.1).
Status: FC-01 committed (536af28). FC-02 implemented and tested, uncommitted, awaiting independent review. Ownership released.
Owner: none. Last writer: Claude Code/Fable.
Workspace: `/Users/advikarichhariya/StudentHub/Projects/FosterConnect2.0`
Git: repository exists, remote `https://github.com/advikar/Foster-Connect-2.0`, baseline commit "Initial commit". FC-01 changes are uncommitted in the working tree; commit them after review.
Recommended next task: review FC-01 and FC-02, commit, then FC-04 (transactional publishing). See "Next action".

## Completed

- Youth homepage redesign: search-first, support cards, plan panel, clearer navigation, responsive layouts.
- Dedicated partner shell and routes: overview, sign-in, own submissions, add resource, coverage, staff guide and reviewer queue.
- Authenticated submissions use the server's partner identity and return only the requesting individual's submissions.
- Reviewer role enforced on backend moderation endpoints. Existing/unassigned roles default to contributor. No partner accounts were created.
- Staff guide has a separate authenticated endpoint/prompt, no youth-data or publishing tools. Live provider output was not evaluated.
- Frontend type-check script corrected to check app and Vite configs; existing RoadmapPage typing issues fixed.
- Shared workflow entry points: root AGENTS.md, CLAUDE.md; docs/WORKFLOW.md, HANDOFF.md and TASKS.md.
- FC-02 (Fable, 2026-09-08): roadmap model output is treated as a draft and passed through `groundRoadmapDraft` in `ai.service.ts`. Tasks naming a resourceId not supplied are dropped (previously nulled, leaving the invented program in the text). Every text field is run through the chat contact sanitiser with the supplied resources + crisis lines as the allow-list; a task that needed a phone/URL removed is dropped. Under four surviving tasks rejects the draft. All provider failures (timeout, non-2xx, empty body, JSON/schema failure after one repair) are wrapped in `ProviderError` and fall back to the deterministic plan. Roadmaps carry `generatedBy: "ai" | "fallback"`; the POST route returns it and RoadmapPage shows a short notice for fallback. Navigator suggested tasks with unknown resource IDs are dropped too. 16 mocked-fetch tests in `ai.service.test.ts`.
- FC-01 (Fable, 2026-09-08): `assessSafety` no longer returns `none` for a whole message when any idiom matches. Figurative spans are now stripped from the normalized text and the remainder is assessed by the ordinary rules. The "my mom will kill me" idiom is only stripped when a consequence clause follows (if/when/for/because/over/...); a bare parental "kill me" phrase now surfaces as `concern`. Six mixed-message regressions added, plus three new ordinary cases and a bare-threat test. Fixed a pre-existing false positive: "my foster mom is going to kill me when she sees my grades" used to route to violence crisis.

## Last verification (FC-01 + FC-02 turn, 2026-09-08)

- `npm test --prefix backend`: 40 tests passed (23 original, 1 FC-01, 16 FC-02). FC-01 regressions were observed failing before the fix. FC-02 tests mock `globalThis.fetch`; no network, no real key.
- `npm run type-check --prefix frontend`, ESLint on `RoadmapPage.tsx` and `lib/api.ts`, `npm run build --prefix frontend`: passed.
- Not done: browser check of the fallback notice on RoadmapPage (backend not restarted this turn). Live provider output not evaluated; grounding was tested only against synthetic drafts.

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

1. Independent review (Astra or another model, read-only) of:
   - FC-01: `backend/src/services/safety.ts` (`FIGURATIVE`, `BARE_PARENT_THREAT`, `stripFigurative`, `assessSafety`) and `safety.test.ts`. Check whether the consequence-clause lookahead is too permissive (e.g. "my mom will kill me, she said that about my brother" is treated as idiom because of "about").
   - FC-02: `ai.service.ts` (`ProviderError`, `callLLM`, `groundRoadmapDraft`, `generateGroundedRoadmap`, `dropUnknownResourceTasks`), the roadmap POST in `server.ts`, `ai.service.test.ts`, and the notice in `frontend/src/pages/RoadmapPage.tsx`. Open questions: is dropping a task on any removed contact too aggressive (a null-id task quoting 988 is kept; one quoting an unknown number is gone)? The grounding cannot detect an invented ORGANISATION NAME with no phone/URL and no resourceId ("Call Sunrise Youth Housing" with resourceId null survives). A name allow-list against `organization`/`title` would be the next layer; deferred, noted in TASKS.
   - Browser: generate a plan with `LLM_API_KEY` unset and confirm the fallback notice renders and the design still reads calm.
2. Commit FC-02 (FC-01 is already committed as 536af28).
3. Then FC-04 (transactional publishing).

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
