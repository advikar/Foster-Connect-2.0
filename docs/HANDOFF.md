# Current handoff

## 2026-09-21 — Tagline, email provider, reviewer sign-in, Quick exit removed (checkpoint 1)

- Task (user): header tagline "Your guide for the next step"; add an email provider; reviewer cannot sign in; remove Quick exit. Owner: Claude Code (Fable 5.1).
- Files: AppLayout.tsx, safety/QuickExit.tsx (deleted), IntakeConversation.tsx (comment), InsightsPage.tsx; backend services/mail.ts (+ test), server.ts, .env.example; render.yaml; docs/DEPLOY.md.
- Done: Brand subtitle "Your guide for the next step"; Quick exit button and component removed (crisis button and footer numbers unchanged); `services/mail.ts` (Resend HTTP API, no SDK; `mailConfigured`, `sendMail`, `resetEmail`, `newAccountEmail`), `/api/partner/reset-request` emails the link directly when mail is configured (row issued_by 'email'), register notifies `NOTIFY_EMAIL`, `/api/health.mailConfigured`; render.yaml + .env.example env keys (RESEND_API_KEY, MAIL_FROM, SITE_URL, NOTIFY_EMAIL); DEPLOY.md "Email" and "If a reviewer is locked out"; `scripts/issue-reset-link.sh <email>` inserts a token hash in Turso and prints a one-time link.
- Reviewer sign-in: Turso shows advika.richhariya@gmail.com is an active reviewer (id 1, last login 2026-09-15), so the sign-in problem is the password, not the account. The agent's attempt to insert a reset token into Turso was blocked by the tool's permission classifier; the user runs the script instead. Also on Turso: sabine.lemmo@fosteringwishes.org registered as a contributor on 2026-09-15.
- Checks: backend 76/76 (3 new mail tests); frontend type-check, ESLint, build. Not verified: a real Resend send (needs the user's key and DNS); Quick exit removal in the browser.
- Reply-to (user chose option A, 2026-09-21): Resend `reply_to` = `MAIL_REPLY_TO` or `NOTIFY_EMAIL`, so replies reach the FosterGuide Gmail; reset email says "reply to this email". render.yaml/.env.example/DEPLOY.md updated. Test asserts reply_to.
- Ownership released: yes.

## 2026-09-20 — Live audit round 3: wording, disclaimer, accounts, Fostering Wishes (checkpoint 1)

- Task: user's audit list for fosterguide.org — remove inaccurate/isolating copy ("Every program", "Turning 21 soon?", "Three taps", "what a 19-year-old gets", they/them line), Health → health & mental health, "Need a place to stay", document subtext, legal disclaimer, scholarship/trade emphasis, Fostering Wishes listings, sort by organization, Nova always shows directory matches, staff guide answers "who runs X / how to start X" from listings, partner accounts: show password, forgot/reset password, reviewer Accounts page listing registered emails. Owner: Claude Code (Fable 5.1).
- Intended files: HomePage, AboutYouCard, IntakeConversation, AskPage, NovaConversation, AddResourcePage, ResourcesPage, AppLayout, PartnerLayout, PartnerPages, InsightsPage, router, api.ts; backend server.ts, prompts.ts, ai.service.ts, partners.ts, partner-access.test.ts; data/seed SQL for the two Fostering Wishes listings; FIXES.md.
- Done (all): Home h1 "Programs for foster youth…" (no "Every"); deadlines heading neutral when age unknown ("Three deadlines worth knowing about", "Why these dates matter"); "Three taps" → "Optional"; intake "Need a place to stay", "Health care" / "Mental health / someone to talk to", "Extended Foster Care ending" (no "aging out"), per-document subtext (ID, birth certificate, SS card, bank, phone), "Most programs" not "Almost every"; Ask aside no pronouns, says not a caseworker or lawyer; NAVIGATOR prompt drops pronoun line, forbids "aging out/at-risk/vulnerable/kids/case", legal questions → legal-aid listing; fallback plan step no longer claims a fee waiver; add-resource hint no "19-year-old"; partner landing h1 no "Every"; Home kinds add Scholarships and "School & training", "Health & mental health" links both categories; hero mentions scholarships and trade school; Nova starter "Scholarships or money for trade school"; Find sort "By organization" (API `sort=organization`); Nova reply attaches top 3 directory matches when the model cites none; staff guide returns `resources` (rendered under the answer) and its prompt answers "who runs X" from listings and "how to start X" generally; disclaimer in the youth footer and partner shell; sign-in Show/Hide password + "Forgot your password?" (POST /api/partner/reset-request, always 202); reviewer Accounts page `/partners/accounts` (GET /api/partner/accounts; POST /api/partner/accounts/:id/reset-link issues a 48 h one-time link the reviewer emails themselves); `/partners/reset?token=` sets the password and signs every device out (POST /api/partner/reset); table `partner_password_resets`. Fostering Wishes: two listings (Trade School Scholarship, Teen Empowerment Program) from fosteringwishes.org, ages/phone not published so left null; `data/updates/2026-09-20-fostering-wishes.sql` applied locally (ids 426/427).
- Checks: backend 73/73 (new reset/accounts assertions); frontend type-check, ESLint (2 pre-existing warnings), build; local browser: Home, Find sort + Fostering Wishes row, Ask starter, footer disclaimer, sign-in Show/Forgot, reviewer Accounts page → issued link → reset page → "Done" (throwaway local rows 9004/9005 created and deleted); API: chat for "Scholarships or money for trade school" returned Fostering Wishes + 2 more listings; guide "Which organizations offer trade-school scholarships?" listed 6 listings.
- Not verified: Enter-to-send on the sign-in form via the browser tool (same synthetic-Return limitation as before); live site until deployed; Turso apply of the seed SQL (see below).
- Merge note: Codex's PR #2 (homepage identity + respectful copy, merged 2026-09-20) landed while this was in progress and covered the same "Every program" / "Turning 21 soon?" / "Three taps" items with its own hedged copy, a new mark and the header subtitle "Support for your next step" (replacing the tagline "Your guide to what you qualify for" from the morning's rebrand). Rebased onto it: Codex's HomePage/AboutYouCard kept; re-applied only the Scholarships kind, "School & training", "Health & mental health" (both categories) and the hero mention of scholarships/trade school. User to confirm which header subtitle they want.
- Known data gap: most listings have organization = title, so "By organization" often equals A–Z until organizations are filled in.
- Live after push: Render served `sort=organization` (200) and Turso returned both Fostering Wishes listings; Pages run 35562028199 was in progress when the session ended.
- Ownership released: yes.

## 2026-09-15 — Nova, handshake mark, under-18 deadlines (checkpoint 4)

- User: rename Maya → Nova (gender neutral); reference image for the mark arrived (two hands clasped into a heart); colour decision deferred; under-18 wording for the "before 21" section; asked whether a fixed Housing list on Home is needed.
- Done: `Maya` → `Nova` across frontend, backend prompts and README (files renamed to `NovaConversation.tsx` / `NovaContext.tsx`; storage keys unchanged on purpose). Mark redrawn as a white heart with the clasp in the accent colour on the brand circle (`AppLayout.tsx` `Mark`, `public/favicon.svg`). Home: under-18 gets its own three items (AB 12 decision, ILP from 16, documents before 18); the Housing list became "Checked recently[, County]" (any kind, sorted by check date, crisis lines excluded). FIXES.md rows U2, Y8, Y12, Y13 updated.
- Checks: backend tests, frontend type-check, lint, build; browser: mark at 160px and 24px, Home with "Under 18 · Alameda" saved.
- Pending user decision: default accent colour (teal vs deep blue).
- Ownership released: yes.

## 2026-09-15 — Fixes backlog worked through (checkpoint 3)

- Task: user's list of UI, youth and partner fixes ("make doc and work one by one"). Doc: `docs/FIXES.md` (every item, status, decisions still open). Owner: Claude Code (Fable 5.1).
- Done, one commit each: Y1 crisis dialog scrolls from the top; Y2 Start a new plan; U1 accent toggle (teal/deep blue, `?accent=blue`, footer switch in preview) + design board https://claude.ai/artifact/F94E8b5RUzk9arMmDN515V; U2 interim FC monogram mark + favicon; Y7 "something else" free text on every intake question and "not sure yet"; Y9 New chat + past chats (localStorage, max 5); Y10 multi-select county/category on API and Find; Y11 `kind` = service|information (guides show "Open the guide", no empty headings; add-resource switch); Y4 plan steps add/reword/move/re-time/remove with undo (`POST /api/roadmaps/:id/tasks`, `DELETE /api/tasks/:id`, wider PATCH); Y3 Maya plan suggestions (CURRENT_PLAN in the prompt, `planSuggestions` grounded and capped, one-tap cards); P1–P3 public `/partners` landing, single sign-in gate with `?next=` and `?as=reviewer`, workspace shell only when signed in, youth links say "About & partners"; P4–P7 `resource_changes` table, `fields_na` + `recheck_at` columns, `GET /api/partner/resources` (missing-field/stale/county/category filters), propose/apply/review routes, Coverage bars open a drawer, multi-select regions, `/partners/gaps` tab, `ResourceEditor`, proposals with proposer email in the Review queue, youth "No phone line — confirmed" wording, re-check date drives "Needs re-check".
- Open decisions in FIXES.md: U1 default accent; U2 the reference image never arrived (send it); Y5 badges (recommend no); Y6 optional sign-in (recommend a passcode design later); Y8 name ideas listed.
- Checks: backend 70/70; frontend type-check, ESLint (2 pre-existing fast-refresh warnings), build; browser at 1024/375 for every item (see FIXES.md notes). Groq rate limit: a 429 now waits and retries once.
- Local throwaway rows (partners 9001/9002, their sessions, changes, audit rows, the test plan, test edits on listings 177/267) deleted after testing.
- After deploy (Pages run 34992476176 success; Render migrated — live listing 267 returns `fieldsNa`): Turso `UPDATE resources SET kind='information' WHERE title LIKE '%(PDF)%'` applied to 8 listings; live Find shows them as Guides; live `/partners` landing renders. Not done live: a reviewer editing a listing (needs the user's real account).
- Ownership released: yes.

## 2026-09-15 — Live audit: AI memory + UI/usability fixes (checkpoint 1)

- Task: user asked for a full audit of https://advikar.github.io/foster-connect/ and /partners/guide and improvements, starting with "AI should remember the conversation until it is cleared". Owner: Claude Code (Fable 5.1).
- Found live (desktop + 375px): Maya had no memory — two-turn test ("My name is Jordan… bus pass" then "What was my name?") → "I don't have your name". Cause: the browser sent its own display list (starting with the local greeting) as `history`, but the server only signed the history it returned, so `verifyHistory` failed every turn and dropped context; the token also lived in a ref that reset on navigation. Staff guide was single-shot by design. Also: organisation line duplicated the title on most rows; "Housing near you" with no county showed crisis text lines; "housing" search ranked a crisis text line first (synonyms "place"/"stay" + unweighted bm25); degraded reply text shown twice; desktop Ask composer scrolled off-screen; provider 429 surfaced as a generic 500.
- Fixed (backend): `SignedMessage.resourceIds` is part of the signed canonical form; `/api/chat` verifies history before the crisis branch and the crisis path now returns a signed history that keeps the thread; new `groundedForConversation()` re-supplies listings cited in the last 3 assistant turns and, for short follow-ups, searches the previous user message too; `/api/partner/guide` accepts `history` + `historyToken` signed with `partner:<id>` and returns the next signed history; `getPartnerGuideResponse` takes history; NAVIGATOR prompt tells the model to use earlier turns; `ProviderError` → 503 with a "busy, wait a minute" or "not responding" message; FTS bm25 column weights (title 12, category 10, tags 6, org 4…) + crisis rows pushed down by 4; housing synonyms now shelter/rent/apartment/transitional/homeless.
- Fixed (frontend): `MayaConversation` stores `{messages, history, historyToken}` in localStorage key `fc-maya-conversation` (survives navigation/reload until "Clear this conversation" or "Delete my data", which also removes it); error bubbles are never sent as history; composer sticky (above the tab bar on phones); degraded label no longer repeats the reply. Staff guide is a thread (sessionStorage `fc-partner-guide-conversation`, cleared on sign-out/"Start over"; Enter sends, Shift+Enter newline). `ResourceRow` hides the organisation when it equals the title. Home "Housing near you" drops crisis rows. Ask/privacy copy updated to say the conversation is kept in the browser until cleared.
- Tests: backend 68/68 (new: signed resourceIds tamper test; navigator and guide send prior turns to the model); frontend type-check, ESLint (2 pre-existing fast-refresh warnings), build pass. Local browser (localhost:5173 + :4000, real Groq): Maya answered "Your name is Jordan. To apply for the Clipper START…" after navigating Home→Ask; guide two-turn via curl with a throwaway local reviewer row (id 9001, deleted afterwards) answered "You named the transportation resource Project Bluebird." (second turn first hit Groq 429 at 8k TPM — the known free-tier limit — and, after a nodemon restart, was correctly dropped because the per-process signing secret changed; production has CHAT_SIGNING_SECRET). Home/Find/guide screenshots at 1440 and 375 with no console errors.
- Not verified: Enter-to-send in Maya's input (the browser tool's synthetic Return did not trigger implicit form submission on either the live or local site; the markup is a standard form + submit button); the guide thread UI end to end with a real account on the live site.
- Audit findings not changed (product decisions): "Checked Sep 2026" on every listing reflects web research, not phone checks; "place to stay tonight" still ranks the Safe Place text line first (arguably right for "tonight"); Find has no "sort by" and no empty-state suggestions; plan intake "Next" button looks disabled when enabled (low-contrast teal); About-you card sits above the plan card on phones, pushing the plan below the fold.
- Live check after 8375480: Actions run succeeded; Render served the new ranking; two-turn memory test on the live site passed ("Your name is Jordan…" after navigating Home → Ask).

### Checkpoint 2 — remaining audit items (user: "fix the remaining audit items too")
- "Checked" wording: API now returns `checkedHow` ("phone" when `verified_by` mentions a confirmed line/call, else "online"); labels read "Checked online Sep 2026" / "Checked by phone …" and the detail sheet says "against the program's own page, not by calling" for online checks (`lib/checked.ts`, `ResourceRow`, `RoadmapPage`).
- Find: `sort` param (relevance | checked | name) on `/api/resources` and `listVerifiedResources`; a Sort select beside the heading; empty state adds "Or browse by kind" chips and "Ask Maya about '<query>'" (AskPage accepts `?q=` once and sends it).
- Plan intake: "Pick one or more to continue." under a disabled Next (it was disabled correctly; the state just wasn't explained).
- Home on phones: About-you card ordered after the plan and Ask cards (`order-last lg:order-first`).
- Groq 429: `callLLM` waits the provider's "try again in Ns" hint (capped at 20 s, default 8 s) and retries once before falling back.
- Checks: backend 68/68; frontend type-check, ESLint on changed files, build; local API sort/checkedHow probes; browser at 1440 (Find sorted A–Z, empty state, intake hint) and 375 (Home order), no console errors. Not verified: the 429 retry against the live provider (no controlled way to trigger it), "place to stay tonight" still lists the Safe Place text line first (left as is).
- Ownership released: yes.

## 2026-09-15 — Partner pages checked live; Markdown in AI replies (checkpoint 2)

- Owner: Claude Code (Opus 5). User signed in as reviewer in a Chrome tab (partner token is per-tab sessionStorage, so an agent tab needs its own sign-in); pages checked read-only there, nothing approved/rejected/submitted.
- Live partner pages: Overview (reviewer badge, 0/0/0 stats, empty "Needs attention"), My submissions (empty state), Add a resource (form + reviewer checklist renders; not submitted), Coverage (401 published / 24 retired; by kind; by region sums to 401; freshness; field completeness: phone 65%, website 100%, cost 42%, age 19%, hours 8%, address 0%, languages 0%; oldest checks; no youth reports; pipeline 0), Review queue (empty), Staff guide (AI answer returned). No console errors.
- Found: AI replies contain Markdown shown literally (Ask for youth and Staff guide; e.g. "**Key Verification Steps**", "`verifiedAt`"). Cause: gpt-oss-120b formats in Markdown; UI renders plain text. Fix: `toPlainText()` in `grounding.ts` (headings, **/__, *em*, `code`, fences, "* " bullets → "- ", [text](url) → "text (url)" so the URL still reaches the contact check) applied before ID stripping/sanitising in roadmap text, navigator reply and suggested tasks, and the partner guide reply; prompts (NAVIGATOR voice, partner guide) ask for plain text. Tests first (3 failed on a no-op stub), 65/65 pass.
- Observation, not changed: every published listing has verified_by "Foster Connect research" dated 2026-09-06/07 (web research; DIRECTORY-REVIEW says not phone-verified), so Coverage shows "Checked in last 30 days 401" and youth listings say "Checked Sep 2026". Product decision whether "Checked" should say how it was checked.
- Pushed 2954731. After redeploy: live Ask reply plain text with "- " list, 0 "**"/backticks, listed contacts intact; Staff guide in the user's tab returned a plain "- " checklist with no Markdown.
- Not checked: partner pages at phone width (would mean resizing the user's own Chrome window); submitting a resource and approving it end to end (would create real records — needs a synthetic submission the user agrees to, then reject/delete).
- Next: independent review of grounding.ts changes (IDs, phones, emails, Markdown); decide on the "Checked" wording; crisis-number verification before sharing with youth.
- Ownership released: yes.

## 2026-09-15 — Resource-ID leak fix + two grounding gaps (checkpoint 2)

- Task: (1) internal resource IDs in youth-facing AI text; (2) reviewer account for the user on the hosted DB. Owner: Claude Code (Opus 5).
- ID fix: `stripResourceIds(text, ids)` in `grounding.ts` removes only SUPPLIED ids in bracketed forms "(150)", "[150]", "(ID 150)", "(resourceId: 150)", "(#150)" (not when followed by a 7-digit phone, so "(415) 555-0199" survives) and explicit labels "resource ID 150", "resourceId 3", "ID: 150". Bare "Resource 1" / "Family Resource Center 3" / "photo ID 3" are untouched (a first version stripped "Resource 1"; caught by the test fixture and tightened). Applied in `groundRoadmapDraft` (logged, never drops a task) and `getNavigatorResponse` (reply, suggestedTasks taskText/motivationNote). Prompt rule added to NAVIGATOR and ROADMAP_GENERATOR in `config/prompts.ts`.
- Gap A (found while verifying, fixed): PHONE_PATTERN only knew ASCII separators. Live gpt-oss-120b output "Call 1‑800‑275‑8777 (Social Security Administration)" used U+2011 and survived; that number is in no listing (SSA listing 310 is 800-772-1213), i.e. a wrong number reached the plan. Separators now include U+2010–U+2015 and U+2212 (no-break spaces via \s), also in `buildAllowList`.
- Gap B (fixed): email addresses were never checked; the URL pass judged only the domain, so an invented address on an allowed domain survived. New EMAIL_PATTERN pass before URLs; allowed emails collected from listing phone, description and applicationSteps (`AllowedContacts.emails`); URL pass skips either half of an address. Note: the live example "kcole@unitycouncil.org" is genuinely in listing 153 application_steps (an earlier check concatenated a NULL phone and wrongly reported it absent) and is correctly kept.
- Tests written first and observed failing (5 ID tests with a no-op stub; 3 of 4 typography/email tests), then 61/61 pass. New cases in `grounding.test.ts` and `ai.service.test.ts`.
- Real model (local, copy of DB): AI plan 7 tasks and chat reply with no resource IDs; listed numbers and the listed Unity Council email kept; no removals logged. A second plan run hit Groq 429 and fell back.
- Independent review still required (AI grounding) and not done.
- Pushed bb4062b. ~4 min later the live API chat reply had no resource IDs, listed numbers and the listed email intact (the only bracketed numbers were "(510)" area codes). The API has no version endpoint, so that Render was already serving bb4062b was not confirmed from here.
- `create-partner.ts` checked with @libsql/client 0.18 against a throwaway local DB (reviewer, active), then deleted. The user's reviewer account (advika.richhariya@gmail.com, "Advika Richhariya", "Foster Connect") is to be created by the user in their own terminal so the password never enters the chat; not yet confirmed created.
- Next: user runs the command, signs in at /foster-connect/partners/sign-in; then check partner overview, coverage, review queue on the live site. Independent review of grounding changes.
- Ownership released: yes.

## 2026-09-15 — Live site verified end to end (checkpoint 5)

- User fixed LLM_API_KEY in Render. Verified on https://advikar.github.io/foster-connect/ against Render + Turso: /api/health ok; POST /api/chat not degraded (grounded reply, Food Bank number matches listing); Find search; Save → shown on Saved; plan intake (6 questions) → AI plan, 7 tasks, 4 directory listings, no fallback notice; Mark done persisted across reload (1 of 7); Privacy → Delete my data → redirected to /foster-connect/, Saved empty; Turso afterwards 0 roadmaps / 0 tasks / 0 saved.
- Bug found, not fixed: gpt-oss-120b writes internal resource IDs into youth-facing task text ("Call Alameda County Welfare-to-Work (150)", "(147)", "(151)", "(421)"). Fix belongs in `groundRoadmapDraft` (strip "(<supplied id>)") and/or the prompt in `config/prompts.ts`; it is AI grounding, so needs a regression test and independent review. Also the plan named banks not in the directory ("Chase or Bank of America") — the known organisation-name gap already noted under FC-02.
- Not done: reviewer account creation; partner screens on the live site; mobile width on the live site.
- Ownership released: yes.

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

## Active checkpoint — round 2 fixes (2026-09-15, Claude)

- Task: user's "Round 2 fixes" list (14 items). Tracked as rows R1–R14 in `docs/FIXES.md`.
- Owner / start: Claude, 2026-09-15 afternoon. Ownership released: yes (after push).
- Files intended: `frontend/src/pages/{HomePage,AskPage,RoadmapPage,ResourcesPage,AddResourcePage,PartnerPages,InsightsPage,PrivacyPage}.tsx`, `frontend/src/components/{chat/NovaConversation,layout/AppLayout,partners/ResourceEditor,partners/ListingDrawer,roadmap/IntakeConversation}.tsx`, `frontend/src/lib/api.ts`, `frontend/public/favicon.svg`, `backend/src/server.ts`, `backend/src/config/prompts.ts`, `backend/src/services/ai.service.ts`, tests.
- Checkpoint 1: survey done. Findings: urgency filter is dead data — every verified row is Emergency (28, all crisis lines) or Standard (373), none "Urgent", so "This week" always returned nothing. Plan/Find/chat reject ages under 13 (zod). Home ILP link pointed at a category, not a search. Quick exit already exists in the header on every page.
- Checkpoint 2 (all 14 edited; see FIXES.md R1–R14). Checks run: backend tests 70/70; frontend + backend `tsc --noEmit` clean; eslint 0 errors (2 pre-existing fast-refresh warnings). Browser (local, throwaway accounts 9001 reviewer / 9003 contributor, deleted afterwards): Home deadlines "Already did this" hides + "1 hidden"; About you 18–20 + Was in care shows the re-enter item; Under 18 ILP link is `/resources?q=ILP` and lands on ILP listings; Find shows "Emergency?" chips; Ask "Clear this conversation" asks first, then clears; partner sign-in has "Create a partner account" (name, organization fields); contributor add-resource lists "Still needed", accepts `example.org/…` and submitted (stored as https://); reviewer Oldest checks row opens the editor directly, kind switched to guide and saved (row 36 restored afterwards). API: register 201 then 409 on duplicate; age 7 accepted by chat and plan schemas; urgency Emergency 28 / Standard 373. Not run: a full plan generation at age 7 (LLM call; validation confirmed only).
- Checkpoint 3 (Y6 passcode): `services/passcode.ts` + 3 unit tests (73/73), routes `GET/POST/DELETE /api/session/passcode`, `POST /api/session/restore` (8/15 min), table `session_passcodes`, `PasscodeCard` on My plan + Privacy, `docs/PASSCODE.md`. Browser: set → cleared local session → restore with different case/spacing → same session id back; wrong passcode refused. Test row deleted.
- Frontend build OK. Committed and pushed; see the deploy run noted below in the recap to the user. Optional follow-up: none pending from the user's round-2 list; accent colour choice still open (U1).

## 2026-09-21 — PDF export redesign (R15)

- Owner: Claude Code (Fable 5.1). Files: `frontend/src/lib/planPdf.ts` (data + font loading), new `frontend/src/lib/planPdfRender.ts` (layout, pure), `frontend/public/fonts/` (Source Sans 3 Regular/Semibold, Source Serif 4 Bold, Latin subsets, OFL licence file).
- Checks: sample render via esbuild+node with a real local plan (4 pages) reviewed as PNGs; frontend tsc, eslint, build; in the dev app "Download this plan (PDF)" fetched the three fonts (200) with no console errors. Not checked: the file on disk from the browser download (tool cannot open it) — the offline render uses the identical code path.
- Ownership released: yes (after push).

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

## 2026-09-20 — Rebrand to Foster Guide (fosterguide.org)

- Task: user bought fosterguide.org (fosterconnect domain taken). Rename every "Foster Connect" on the site to "Foster Guide", add a "your guide to…" tagline, prepare deploy for the custom domain. Owner: Claude Code (Fable 5.1).
- Files: frontend/index.html, AppLayout.tsx, HomePage.tsx, ResourceRow.tsx, ErrorFallback.tsx, PasscodeCard.tsx, InsightsPage.tsx, PartnerPages.tsx, api.ts, backend prompts.ts, ai.service.ts, server.ts, safety.ts, crisis.ts, partners.ts, render.yaml, deploy-site.yml, README, DEPLOY.md.
- Next checkpoint: type-check + backend tests, then commit.
- Done: all user-facing and prompt text says Foster Guide; header subtitle and Home eyebrow now "Your guide to what you qualify for"; page title/og:title carry the tagline; README retitled. `deploy-site.yml` builds with `VITE_BASE=/` and writes `CNAME` = fosterguide.org; `render.yaml` CORS_ORIGINS adds https://fosterguide.org and www. Browser storage keys and the `foster-connect` repo/Render service names unchanged on purpose.
- Checks: frontend type-check pass; backend 73/73; local Home at 1280 shows new brand + tagline.
- Not done by the agent (user's accounts): DNS records at the registrar, Pages custom-domain setting on advikar/foster-connect, CORS_ORIGINS value in Render dashboard (blueprint change syncs only if Render re-syncs the blueprint).
- Ownership released: yes.

## 2026-09-20 — Warm, respectful homepage and identity (Codex)

- Task: approved logo/header/home search hierarchy pass; older foster youth and community partners; respectful copy without unsupported eligibility, completeness or privacy promises.
- Owner: Codex, active in FosterConnect2.0. Existing checkout clean; previous owner released.
- Intended files: HomePage.tsx, AboutYouCard.tsx, AppLayout.tsx, favicon.svg, index.html; focused copy/source notes in docs/UI-DIRECTION.md and TASKS.md.
- Next checkpoint: redraw vector identity, search/category hierarchy, compact optional preferences; replace inaccurate age-21 framing using CDSS/CSAC sources; frontend checks and responsive browser review per project instructions.
- Ownership released: no.
- Checkpoint 1: vector handshake replaced compressed badge; homepage now search + six categories, optional collapsed preferences, explicit partner route. Fixed misleading 21 cutoff framing, unsupported completeness/AI/privacy copy, and recent-listing error state. Sources and enduring tone rules recorded in UI-DIRECTION.md.
- Initial checks: frontend type-check, ESLint, production build passed. Desktop 1096px and phone 390px visibly reviewed; no horizontal category clipping. Local API is offline, so recent-listing failure + retry displayed correctly. Preference/search interactions and final checks next.
- Scope adjustment: PrivacyPage.tsx copy and useAboutYou.ts comment also need correction so the linked privacy explanation agrees with the homepage. Read deleteSessionData: it removes session/chat keys, but does not clear homepage preferences; copy must not promise “nothing ... left”. No deletion behavior changes.
- Final checkpoint: frontend type-check, focused ESLint and build passed after final copy edits; diff whitespace check clean. Browser: 1096px/390px layouts, saved 18–20 + Alameda + former-care guidance, preference clear, county-only save with no age guidance, search “bus pass” → encoded resource query. Removed test preferences. Temporary viewport reset.
- Limitations: local API offline; successful recent listings, existing-plan states, backend/AI and partner account flows not retested. No real accounts/data changed. Under-18 ILP/document links preserved with conditional, non-guaranteed copy. Existing saved plans are not rewritten.
- Delivery: reviewed local changes to a codex review branch, not main (main frontend pushes automatically publish). Existing GitHub Pages/Render hosting retained. No website publication in this turn.
- Exact next action: user can review the local preview; publish the reviewed branch when requested. Ongoing source maintenance and youth/partner tone feedback remain necessary.
- Ownership released: yes.
- Backup status: committed locally on codex/warm-homepage-identity. Push to origin was blocked by automatic approval review: remote destination ownership/authorization for private source egress not verified. No remote synchronization or deployment occurred. Ask the user for explicit authorization before retrying that push.

## 2026-09-20 — Authorized GitHub backup

- Task / owner: user explicitly authorized pushing the reviewed changes; Codex. Intended file: this handoff only; checkpoint: successful push and remote tracking verification.
- Completed: pushed implementation commit 8dc3d3c to origin/codex/warm-homepage-identity in advikar/Foster-Connect-2.0. The earlier approval blocker is resolved. No application changes or new tests; prior validation remains as recorded above.
- This branch does not trigger the main-branch site deployment. Live site unchanged.
- Next action: review/publish when requested. Ownership released: yes.

## 2026-09-20 — Five-finger handshake correction

- Task / owner: user requested five fingers in the logo and instructions for website publication; Codex.
- Intended files: AppLayout.tsx, favicon.svg, HANDOFF.md and FC-09 status. Next checkpoint: four finger contours plus a thumb for each hand, enlarged and header-size visual check, frontend validation, push to the existing authorized review branch. Publication is not requested by the how-to question.
- Ownership released: no.
- Completed: each hand now has four finger contours plus its thumb; expanded the lower contour to avoid clipping, and favicon uses the same geometry. Visually inspected enlarged SVG and desktop/mobile header sizes. Frontend type-check, focused ESLint, build and whitespace checks passed. No backend changes/tests.
- Next action: merge codex/warm-homepage-identity into main to trigger Deploy site when publication is requested. This turn updates the review branch only. Ownership released: yes.

## 2026-09-21 — Round 4: contact email, reports → editor, partner directory search, Nova recall, two-tier data deletion, header partners link, PDF export

- Task / owner: Claude Code (Fable 5.1). Founder's list: (1) contact section with fosterguide.contact@gmail.com on the partner side (and a quiet line on the youth footer); (2) youth reports appear in Needs attention but not the review queue and don't open the listing — make both open the editor, add a reviewer "Resolved" action; (3) partners can't search resources — add a Directory page with search, every result (and Staff guide listings) opens the editor; (4) Nova recalls earlier chats on this device until they are cleared; (5) split "Delete my data" into "Clear from this device" (server data kept, passcode restores; prompts to set a passcode first) and "Delete everything" (double confirmation); (6) "Community partners" header link vanished below 1280px; (7) export as a readable PDF instead of JSON.
- Intended files: AppLayout.tsx, PartnerLayout.tsx, PartnerPages.tsx, InsightsPage.tsx, ListingDrawer.tsx, PrivacyPage.tsx, RoadmapPage.tsx, NovaConversation.tsx, lib/api.ts, new lib/planPdf.ts, router.tsx, backend server.ts (reports resolve + wider search + chat `recall`), backend tests, docs/DEPLOY.md.
- Done: backend `POST /api/partner/reports/:id/resolve` (reviewer), `resolved_at/resolved_by` columns, analytics lists open reports only (50), partner search widened (category, description, eligibility, id), chat accepts `recall` and the NAVIGATOR prompt has an EARLIER_CHATS section. Frontend: `components/partners/ReportsPanel.tsx` (ReportsPanel + PartnerListingButton), Directory page `/partners/resources` + "Search listings" nav, Overview/Coverage/Queue reports open the ListingDrawer editor, Staff guide listings open the editor, `lib/contact.ts` + contact on partner sidebar/footer/landing and youth footer, header "Community partners" visible from `md`, Privacy page rebuilt (PDF download, Clear from this device with passcode prompt, Delete everything with typed DELETE), My plan "Download this plan (PDF)", `lib/planPdf.ts` (jspdf, dynamic import), Nova `recall`.
- Checks run: backend 77/77; frontend tsc, eslint (0 errors), vite build, vitest (3 skipped, as before). Browser (local, throwaway reviewer 9006 deleted afterwards, test report deleted): Overview report row opens editor with the report as subtitle; Directory "trade school" → 3 listings incl. Fostering Wishes #426; Queue shows "1 waiting on you" with the report, Mark handled → 0; Privacy shows passcode-first flow and two-step delete; header shows Community partners at 1024px; both PDFs generated (sample plan rendered and inspected). `POST /api/chat` with `recall` → 200. Not tested: a real Nova reply using recall (needs the LLM; prompt injection path verified by type only), Resend email.
- Ownership released: yes (after push).

## 2026-09-21 — Round 5: editable name/category/regions, multi-county listings, remove partner access, footer contact wording

- Owner: Claude Code (Fable 5.1). Files: backend server.ts (countyMatch/normaliseCounty, changeSchema category+county, EDITABLE_FIELDS, `POST /api/partner/accounts/:id/access`), partner-access.test.ts (fuller resources schema + FTS, new assertions); frontend ResourceEditor.tsx (title/organization inputs, category select, region checkboxes, wider cache invalidation), PartnerPages.tsx Accounts (Remove/Restore access, 3-step confirm), lib/api.ts, lib/listingOptions.ts (shared category/region lists; AddResourcePage uses them), AppLayout footer "Contact us (questions about the site, not emergencies)"; data/updates/2026-09-21-fostering-wishes-regions.sql applied to Turso (ids 426, 427 → "Alameda, Contra Costa") and local.
- Checks: backend 77/77; frontend tsc, eslint 0 errors, build. Browser (local, throwaway accounts 9007/9008 deleted afterwards): editor shows Category select + Region checkboxes, ticked Alameda on #426 and saved as reviewer → DB "Alameda, Contra Costa", youth `/api/resources?county=Alameda` returns it; Accounts: Remove access → warning → typed email → "access removed" + Restore access button; reviewer's own row has no Remove button.
- Not tested: live editor against Render after deploy (route shape unchanged except new fields), Coverage county bar with the combined label.
- Ownership released: yes (after push).

## 2026-09-21 — Complete fosterguide.org audit (Codex)

- Task: audit the live website and corresponding source for journeys, accessibility, content/data trust, privacy/security, SEO and operational readiness; report evidence and prioritized fixes.
- Owner: Codex. Prior editor released ownership; checkout clean at start.
- Intended files: docs/AUDIT-2026-09-21.md and this handoff only. No application edits or production data changes.
- Next checkpoint: live public journeys and focused source checks, then reproducible findings and verification limits.
- Ownership released: no.
- Completed checkpoint: docs/AUDIT-2026-09-21.md records 20 prioritized findings (9 P1, 11 P2), reproduction evidence, remedies, coverage and explicit limits. Key live failures: text-only contacts rendered as calls; Food-only plan rejected at final step; age bands mapped to a single age; crisis modal focus remains outside; crisis SMS data conflicts with current official sources. Additional source risks: non-atomic listing edits/reset consumption, skipped documents treated as missing, misleading verification/privacy claims.
- Checks: all 403 public listings analyzed; 64 priority provider links checked (60 HTTP 200, 3 HTTP 403, 1 connection reset; latter four inconclusive). Desktop + 390px journeys and 320px homepage observed. Live scholarship chat returned three directory cards. Synthetic Food-only plan failed before persistence; no real accounts/listings/reports altered, no calls/texts sent.
- Local checks: backend build + 76/77 tests initially passed (integration blocked by sandbox localhost binding); isolated integration rerun with localhost permission passed, yielding 77/77 across runs. Frontend type-check/build passed; frontend tests 3 skipped, 0 active. Production dependency audits: frontend 5 affected packages, backend 3; exploitability not established. Whitespace check passed.
- Limits: no live authenticated partner review, successful plan/PDF roundtrip, email delivery, credential/deletion changes, real screen reader, clinical review, performance score, or restore drill. Audit only; application untouched.
- Next action: repair audit A01–A09 first in separately claimed implementation checkpoints, with independent review for safety/auth/data-integrity changes. Keep preview designation until launch checks are met.
- Ownership released: yes. Documentation backup to a separate codex audit branch next; no deployment requested.

## 2026-09-21 — Round 6: acting on Codex's AUDIT-2026-09-21

- Owner: Claude Code (Fable 5.1). Scope: P1 A01, A03 (stop inferring "phone" checks), A04, A05, A06, A07, A08 (copy), A09; P2 A10, A11, A14, A15, A16; A02 numbers aligned to providers' current published instructions but left marked unverified until a human calls. Not in scope this round: A12 (founder's Resend setup), A13 (data work), A17–A20 (launch/ops).
- Intended files: frontend ResourceRow.tsx, CrisisBar.tsx, ResourcesPage.tsx, AskPage.tsx, SavedPage.tsx, PartnerPages.tsx, PrivacyPage.tsx, PartnerLayout.tsx, index.css (stamp token), lib/crisis.ts, roadmap intake; backend safety.ts (+tests), server.ts (age filter, needs validation, checkedHow, atomic edits, atomic reset), crisis.ts, ai.service.ts (documents unknown).
- Done: see the "Response" section appended to docs/AUDIT-2026-09-21.md for the per-finding list. New: `frontend/src/lib/contactActions.ts` (+ vitest), `inWriteTransaction` exported from persistence.ts and used for reviewer edits, approvals and password reset; `applyResourceChanges(tx, …)`; `ageTo` query param; `documents` optional (unknown) in intake; `BENIGN_MEANS` and narrower parent-idiom regex in safety.ts.
- Checks: backend 77/77 (new assertions: concurrent reset 204+400, concurrent approval 200+409, admin-only edit keeps verified_at, age band boundaries, Food-only intake not 400; new triage cases); frontend tsc, eslint 0, vitest 4 passed, build. Browser (local): Crisis Text Line detail shows "Text HOME to 741741" as sms: and no Call; emergency dialog puts focus on its Close button, lists tel:/sms: links for every line, Escape closes.
- Still needs a person: call each crisis line and set `verifiedOn`; Resend DNS; data completeness; A17–A20.
- Ownership released: yes (after push).

## 2026-09-21 — Round 7: audit A13, A17–A20

- Owner: Claude Code (Fable 5.1). Scope: A13, A17, A18, A19, A20 — see the round-7 paragraph in docs/AUDIT-2026-09-21.md for what changed per finding.
- Files: backend server.ts (`/api/ready`, `duplicateCandidates` in analytics, `deliveryMode` editable), partner-access.test.ts; frontend `hooks/usePageMeta.ts` (used by every youth page), `components/resources/ListingDeepLink.tsx` (mounted in AppLayout), ResourceRow.tsx (URL-driven open state via `?listing=`, Copy link, delivery tag only for In person / Phone or text), ResourceEditor.tsx (delivery mode select), InsightsPage.tsx (Possible duplicates), lib/api.ts, vite.config.ts (`documentSecurity` CSP/referrer on build), index.html (og:image, canonical), public/{sitemap.xml,robots.txt,social-card.jpg}, package.json (tooling → devDependencies), `.github/workflows/{ci,monitor}.yml`, docs/DEPLOY.md.
- Checks: backend 77/77 (new: /api/ready 200 with count, duplicate group detected, deliveryMode edit); frontend tsc, eslint 0, vitest 4 passed, build; `npm audit --omit=dev` 0 in both. Browser: production build (vite preview, CSP meta present) rendered with no CSP console errors (CORS errors only, local API allows 5173 only); dev server: `/resources?listing=412` opened Crisis Text Line with Copy link and sms links, Escape cleared the URL; page title "Find support · Foster Guide". Restore drill: `turso db create … --from-db foster-connect` → counts 427/2/3/3 matched live; scratch destroyed; dump file deleted.
- Not done: hosting move for 200 deep links and frame-ancestors (decision for launch); Vitest 3 upgrade; human data completeness pass.
- Ownership released: yes (after push).

## 2026-09-21 — Hosting: GitHub Pages → Render static site; noindex removed

- Owner: Claude Code (Fable 5.1). render.yaml gains `foster-guide-site` (runtime static, rootDir frontend, SPA rewrite, CSP with frame-ancestors, X-Frame-Options, Referrer-Policy, nosniff, Permissions-Policy, HSTS, immutable cache for /assets); CORS_ORIGINS adds the onrender.com site origin. deploy-site.yml is manual-only and no longer sets VITE_PREVIEW (no noindex, no preview banner). robots.txt is plain allow + sitemap. DEPLOY.md has the founder's 7 steps (blueprint sync, custom domains, DNS swap, remove Pages domain).
- Checks: render.yaml parses as YAML; frontend build without VITE_PREVIEW has no robots meta and no preview banner (checked in dist). Not verifiable by the agent: Render blueprint sync and DNS (founder's accounts).
- Ownership released: yes (after push).
