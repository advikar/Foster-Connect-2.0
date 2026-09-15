# Current handoff

## 2026-09-14 — Render live; AI failing on Render (checkpoint 4)

- User created the Render Blueprint (synced 8e05f9a, service foster-connect-api).
- Verified: https://foster-connect-api.onrender.com/api/health → ok, aiConfigured true; CORS allows https://advikar.github.io; live site https://advikar.github.io/foster-connect/resources?q=housing shows 94 listings from Turso.
- Problem: Ask on the live site and a direct POST /api/chat return `degraded: true` (directory fallback). The same Groq key from backend/.env with openai/gpt-oss-120b returns 200 from this machine at the same time, not rate-limited. Likely cause: the LLM_API_KEY value saved in Render (different key, whitespace, or "LLM_API_KEY=" prefix). Render logs not visible to the agent (no Render CLI/API key).
- Next: user checks Render → foster-connect-api → Logs for "AI provider returned 401/403/404/429" and re-pastes LLM_API_KEY under Environment; then re-test chat, plan, Save and Delete my data on the live site; create reviewer account.
- Ownership released: yes.

## 2026-09-14 — Turso database live; backend hosted-DB and AI fixes (checkpoint 3)

- User chose Turso + Groq + Render, with Gemini / Cloud Run as possible later swaps. Turso account `advikar`; CLI at `~/.turso/turso` (not on the agent shell PATH).
- Turso: `foster-connect` at libsql://foster-connect-advikar.aws-us-west-2.turso.io, loaded from `scripts/make-seed-db.sh` output (now a SQL dump with FTS rebuilt) through `turso db shell`. Verified 425 resources, FTS 'housing' = 90 (same as local), 0 plans/partners. `--from-file` was rejected and `--from-dump` produced an empty DB with no error.
- Bug 1: `@libsql/client` 0.6 failed at boot against Turso ("Unexpected status code while fetching migration jobs: 400"). Upgraded to ^0.18.0. Production-mode smoke test against Turso: /api/health ok, search ok, CORS header for https://advikar.github.io, plan POST saved 8 tasks, DELETE /api/session removed them (Turso back to 0 roadmaps/tasks).
- Bug 2: default model `llama-3.3-70b-versatile` is no longer offered by Groq, so chat/plans would always fall back. Default is now `openai/gpt-oss-120b` (ai.service.ts, .env.example, README, local backend/.env, render.yaml sets LLM_BASE_URL/LLM_MODEL). Local test with the existing key: chat reply grounded (Food Bank number matches the listing), plan generatedBy "ai", 8 tasks. Groq free tier: 8,000 tokens/min for every usable model; one plan is about 5.5k, so a burst returns 429 and the app falls back (observed; fallback worked).
- DEPLOY.md: Turso steps corrected; new "Switching providers later" (Gemini env values + data-use caution; Cloud Run via Dockerfile + API_URL variable).
- Checks: `npm test --prefix backend` 50/50 after both changes.
- Next: user creates Render Blueprint and pastes DATABASE_URL, DATABASE_AUTH_TOKEN (`turso db tokens create foster-connect`), LLM_API_KEY; then verify the live site end to end and create a reviewer account.
- Ownership released: yes.

## 2026-09-14 — UI sync pass + live deployment setup (checkpoint 2)

- Task: user could not see the redesign locally or on GitHub; asked for a hosted site like Cool Equity and for the UI to be consistent everywhere. User chose (2026-09-14): full live app; frontend published from a separate public repo (source stays private); public preview OK before crisis numbers are verified, labeled as preview.
- Owner: Claude Code (Opus 5).
- Why it was "missing": af5a591 was already on origin/main (private repo; commits authored `Advika <you@example.com>`, not linked to the advikar account). Locally the Vite server was not running and the old nodemon backend (started 2026-09-08) was not listening on 4000, so nothing loaded. Repo-local git author is now `advikar <70820122+advikar@users.noreply.github.com>`; earlier commits were not rewritten.
- UI sync: `ErrorFallback.tsx` restyled; `NotFoundPage` renders inside the shell (no duplicate crisis bar, router Link); `PrivacyPage.tsx` rounded-md + serif headings; `RoadmapPage` privacy link is a router `Link`. Bug fixed: pages used React Query `isLoading`, which is false while a query is paused (hidden tab / offline), so Find showed "0 listings · Nothing matched that" and Saved "Nothing saved yet" instead of loading. Now `isPending` in `ResourcesPage`, `SavedPage`, `RoadmapPage`, `InsightsPage`, `PartnerPages`; partner overview stats show "…" on error instead of 0.
- Deploy setup: `frontend/vite.config.ts` (`VITE_BASE`, noindex meta when `VITE_PREVIEW`), preview banner also when `VITE_PREVIEW`; `.github/workflows/deploy-site.yml` (type-check, build with base `/foster-connect/`, 404.html SPA fallback, force-push dist to public `advikar/foster-connect` via deploy key secret `SITE_DEPLOY_KEY`; repo variable `API_URL`=https://foster-connect-api.onrender.com); `render.yaml` (free web service, rootDir backend, CORS https://advikar.github.io, generated CHAT_SIGNING_SECRET, DB/LLM secrets sync:false); `scripts/make-seed-db.sh` (resource-only copy for `turso db create --from-file`, ignored `data/seed/`); `docs/DEPLOY.md` order of operations rewritten (old text wrongly said import_resources.py could target Turso). Created public repo advikar/foster-connect + write deploy key.
- Checks: frontend type-check pass; ESLint on changed pages 0 errors; `npm test --prefix backend` 50/50; production build pass; Pages-style build served at localhost:4173/foster-connect/ (links and deep link /foster-connect/resources resolve; API blocked by CORS as expected for that origin; hidden tab shows "Looking…" not 0). Seed DB: 425 resources, integrity ok. Browser 5173: /nope, /privacy, /resources (401), /saved, /roadmap.
- Not verified: error state "Can't reach the directory" in a visible tab after the isPending change (branch unchanged); the Actions deploy and Pages until pushed; Render/Turso not created (need the user's accounts).
- Pushed 666ab23. "Deploy site" run 34922402129 succeeded; Pages enabled on advikar/foster-connect (status built). https://advikar.github.io/foster-connect/resources loads the redesign in the browser with the preview banner; API calls fail (CORS/no server) because the Render service does not exist yet — `foster-connect-api.onrender.com` returns `x-render-routing: no-server`, so the name is still free.
- Next: user creates Turso + Render accounts per DEPLOY.md steps 1-4; then verify /api/health, directory search, plan, chat and a reviewer sign-in on the live site. Actions warns checkout/setup-node v4 run on Node 20 (deprecated, still works).
- Ownership released: yes.

## 2026-09-14 — UI redesign implementation (checkpoint 1 complete)

- Task: implement the approved redesign (design canvas https://claude.ai/code/artifact/835f8b92-7f0d-4325-9ec8-4ac8adaeeafd) across youth and partner interfaces, plus a fuller partner analytics page. User approved the canvas on 2026-09-14 and asked for it to be coded, with "the analytics page can be more robust".
- Owner: Claude Code (Fable 5.1). Codex's 2026-09-13 research claim (docs only) was still marked unreleased; the user directed implementation. No Codex files were touched.
- Changed: `frontend/index.html` (Source Serif 4 / Source Sans 3 / IBM Plex Mono), `src/styles/globals.css` (new "Paper & Teal" token values under the old token names; `--ink-body`, `--ink-stamp`, `--hover`; `.text-eyebrow` is now mono; light theme forced in `main.tsx`), `components/layout/AppLayout.tsx` (5-tab nav Home/Find/Ask/My plan/Saved, header utilities, crisis footer; exports `Brand`, `Mark`), `safety/QuickExit.tsx`, `safety/CrisisBar.tsx`, `contexts/MayaContext.tsx` (openMaya navigates to `/ask`), new `chat/MayaConversation.tsx` + `pages/AskPage.tsx` (replaces MayaOverlay/MayaLauncher, both deleted), new `hooks/useAboutYou.ts` + `components/home/AboutYouCard.tsx` (optional age band / county / care status in localStorage only), `pages/HomePage.tsx`, `pages/ResourcesPage.tsx` (desktop filter rail, phone sheet, age-band filter mapped to the API's `age`), `components/resources/ResourceRow.tsx` (ruled rows, tags, side-panel detail on desktop via `BottomSheet` direction=right), new `lib/checked.ts`, `primitives/Chip.tsx`, `primitives/BottomSheet.tsx`, `primitives/StepCard.tsx`, `pages/RoadmapPage.tsx` (plan layout, aside), `roadmap/IntakeConversation.tsx` (styling only), `pages/SavedPage.tsx`, `pages/AddResourcePage.tsx`, `pages/PrivacyPage.tsx` (container only), `layout/PartnerLayout.tsx` (sidebar + phone chip nav), `pages/PartnerPages.tsx`, `pages/InsightsPage.tsx` (Coverage rewritten; SignIn/Queue restyled), `router.tsx` (`/ask`), `lib/api.ts` (`fetchPartnerAnalytics`). Backend: `GET /api/partner/analytics` (partner auth) in `server.ts`; `partner-access.test.ts` extended and its resources fixture widened.
- Checks run: `npm run type-check --prefix frontend` pass; ESLint on all changed frontend files (2 fast-refresh warnings on exported helpers, 0 errors); `npm run build --prefix frontend` pass; `npm test --prefix backend` 50/50 pass (analytics: 401 unauthenticated, 200 + shape for a contributor). Browser at 1440 and 375: Home, Find (+ detail side panel), Ask, plan intake, partner sign-in, share-a-resource all rendered with no console errors.
- Not verified: signed-in partner views (overview, submissions, coverage, review queue, staff guide) were not opened in a browser — no partner accounts exist locally and none were created. They are type-checked and the analytics endpoint is API-tested. Plan page with an existing plan and Saved with items were not browser-checked this turn (no session data). Dark theme is disabled (forced light), not restyled.
- Decisions: youth nav Home / Find / Ask / My plan / Saved; no youth sign-in; "About you" stays on device and only pre-fills Find and shapes Home; no photos; partner side keeps /partners and "For partners"; the old `/api/analytics` public endpoint is unchanged.
- Next: (1) have a human sign in as a partner and check the five signed-in screens and the coverage page against real data; (2) independent review of `ResourcesPage` age-band mapping (under18→17, 18-20→19, 21-24→22, 25+→26) and of the analytics SQL; (3) consider a per-county breakdown for the cost/re-check columns on Coverage; (4) update `docs/UI-DIRECTION.md` to point at the canvas as the chosen direction.
- Ownership released: yes.

## 2026-09-13 — comprehensive UI reference scan (active)

- Task: broaden Pinterest and live-site/template research before recommending a design; earlier three-pin shortlist was insufficient and is superseded.
- Owner: Codex, documentation-only editor; workspace FosterConnect2.0.
- Intended files: docs/HANDOFF.md, docs/UI-RESEARCH.md, docs/UI-DIRECTION.md.
- Next checkpoint: record a substantial source inventory, visual observations, navigation checks, shortlist and exclusions; commit and push research.
- Initial check: clean main synchronized with origin/main at previous checkpoint 544415d. No application changes planned during research.
- Ownership released: no.

## 2026-09-13 — project orientation and redesign research

- Task: establish current checkout/GitHub state, reopen local UI, research visual and navigation direction requested by user.
- Owner: Codex; documentation-only editor. Previous owner released ownership.
- Intended files: docs/HANDOFF.md, docs/WORKFLOW.md, docs/UI-DIRECTION.md.
- Checkpoint: live fetch confirms main is four commits ahead of origin/main; clean checkout. Latest commit 057b519 includes the audit and directory review previously described below as uncommitted. FosterConnect is the earlier standalone copy; Foster is the legacy project.
- User instruction: save project work on GitHub; this supersedes the prior push-only-on-separate-request default. Complete reviewed checkpoints should be committed and pushed; exclude credentials, private records and runtime databases.
- Completed: frontend started at http://127.0.0.1:5173/ and homepage visually checked. Design research and navigation proposal saved in docs/UI-DIRECTION.md; shared workflow updated with the user's standing GitHub sync instruction and redesign request. No app source changed.
- Checks: live fetch, clean initial checkout, backend working-directory inspection, homepage browser observation, documentation diff whitespace check. Application tests not rerun for documentation-only work.
- Next: commit/push this checkpoint and the four existing commits; then implement the proposed youth shell/home visual slice in a future implementation checkpoint. Research direction is proposed, not final user selection.
- Ownership released: yes.

Updated: 2026-09-10, after the full audit and the Housing + Mental Health directory review (Claude Code / Fable 5.1).
Status: FC-01 (536af28), FC-02 (4966ca2), FC-04 + FC-06 slice 1 (14a53fb) committed. Uncommitted: docs/AUDIT.md, docs/DIRECTORY-REVIEW.md, data/review/. Ownership released.
Owner: none. Last writer: Claude Code/Fable.
Workspace: `/Users/advikarichhariya/StudentHub/Projects/FosterConnect2.0`
Git: repository exists, remote `https://github.com/advikar/Foster-Connect-2.0`. Database file is untracked and ignored.
Recommended next task: see `docs/AUDIT.md` (2026-09-10). Directory data pass for Housing + Mental Health is in `docs/DIRECTORY-REVIEW.md` and `data/review/housing-mental-health-review.csv` (2026-09-10, web-read only, not phone-verified, nothing written to the DB). Next: a human calls down the CSV; then Sonnet builds `data/apply_review.py` to upsert only human-verified rows and add Calli House.

## Completed

- Youth homepage redesign: search-first, support cards, plan panel, clearer navigation, responsive layouts.
- Dedicated partner shell and routes: overview, sign-in, own submissions, add resource, coverage, staff guide and reviewer queue.
- Authenticated submissions use the server's partner identity and return only the requesting individual's submissions.
- Reviewer role enforced on backend moderation endpoints. Existing/unassigned roles default to contributor. No partner accounts were created.
- Staff guide has a separate authenticated endpoint/prompt, no youth-data or publishing tools. Live provider output was not evaluated.
- Frontend type-check script corrected to check app and Vite configs; existing RoadmapPage typing issues fixed.
- Shared workflow entry points: root AGENTS.md, CLAUDE.md; docs/WORKFLOW.md, HANDOFF.md and TASKS.md.
- FC-06 slice 1 (Fable, 2026-09-08): `data/foster_connect.db` untracked from Git (was committed; local copy kept) and `data/*.db`, `data/backups/`, `.claude/launch.json` ignored. `npm run etl` now refuses with a message; `data/run_etl.py` refuses unless `FC_ALLOW_DESTRUCTIVE_RESET=1`. New `npm run import:resources[:dry-run]`, `npm run backup` (`scripts/backup-db.mjs`, sqlite3 online backup + integrity check, verified once: 425 resources), root `npm test` runs backend tests + frontend type-check + build. `CHAT_SIGNING_SECRET` missing in production now exits at boot like `DATABASE_URL`. New `docs/DEPLOY.md`: hosts, env vars, order of operations, human launch blockers, backups, verification list. README stale claims fixed (demo token, 24 synthetic rows, run_etl).
- FC-04 (Fable, 2026-09-08): new `backend/src/services/persistence.ts`. `publishSubmission` runs resource insert, FTS index, submission claim, and two audit rows in one write transaction; the claim is a conditional `UPDATE ... WHERE resource_id IS NULL` so a lost race rolls the whole thing back and returns `already_published` (409). `persistRoadmap` inserts the plan and all tasks in one transaction. All write transactions and audit inserts go through an in-process queue because the local libsql client shares one connection. Routes in `server.ts` now call these; `recordAudit` uses the same queue. 10 tests in `persistence.test.ts` against temporary SQLite files: injected failures (FTS dropped, audit dropped, bad FK on task 3), ten concurrent approvals, cross-instance claim, concurrent plan creation.
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
   - FC-04: `backend/src/services/persistence.ts` and its test; route changes at the roadmap POST and submission PATCH in `server.ts`. Questions: is the in-process queue (`serialised`) an acceptable throughput cost for a single-instance deploy (every write waits for the previous write)? Should the redundant pre-check `if (Number(submission.resource_id))` in the route be removed now that `publishSubmission` handles it?
   - Browser: generate a plan with `LLM_API_KEY` unset and confirm the fallback notice renders; approve a submission as a reviewer and confirm it appears in search.
   - FC-06 slice 1: `docs/DEPLOY.md` accuracy against `server.ts` env handling; `scripts/backup-db.mjs`; the `run_etl.py` guard; README edits.
2. Commit FC-04 and FC-06 slice 1.
3. Human launch blockers (no code): verify every crisis number in `backend/src/config/crisis.ts` and set `verifiedOn`; decide resource verification ownership (FC-05).
4. FC-06 later slices: CI, uptime ping, Turso restore drill. FC-03 after Astra settles the intake interaction.

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
