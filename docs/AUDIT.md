# Foster Connect: full audit and to-do list

Date: 2026-09-10. Auditor: Claude Code (Fable 5.1), read-only pass over backend,
frontend, data, docs, and dependency state after FC-01/02/04 and FC-06 slice 1.
Every claim below was checked against the actual files or database, not
inferred from docs. Where I could not verify something, it says so.

Status of the branch at audit time: FC-01 and FC-02 committed; FC-04 and FC-06
slice 1 implemented, tested, uncommitted.

## How to read this

- **P0**: launch blocker. Do not put this in front of a young person until done.
- **P1**: needed before a real pilot with partners and youth.
- **P2**: quality and trust. Do within the first month of a pilot.
- **P3**: later.

Owner codes: **Human** (you or a person you name), **Astra** (design/UI),
**Fable** (hard backend/safety), **Sonnet** (bounded implementation).

---

## P0: launch blockers

### 1. Crisis numbers are all unverified
Evidence: every entry in `backend/src/config/crisis.ts` has `verifiedOn: "UNVERIFIED"`.
Six lines: 988, Crisis Text Line, National Runaway Safeline, Childhelp,
Human Trafficking Hotline, California Youth Crisis Line.
Risk: a wrong or dead number shown to someone in crisis. Worst failure in the product.
Owner: Human. Effort: one hour on the phone.
Done when: each number dialled, hours confirmed, `verifiedOn` set to the date, and a
calendar reminder set to repeat quarterly.

### 2. The directory is mostly placeholders
Evidence, from the live database (401 verified rows):

| Field | Rows with no real value |
| --- | --- |
| phone | 142 |
| hours | 368 |
| address | 400 |
| cost ("Not confirmed yet, ask what it costs") | 271 |
| application steps ("Open their page and look for intake") | 249 |
| eligibility ("Not confirmed yet, ask who qualifies") | 160 |
| age range | 324 |

The placeholder text is honest, which is the right call, but it means the
roadmap builder cannot say "call this number and say X" for most resources, and
the age filter is a no-op for 80% of the catalog.
Owner: Human plus volunteers; the build script already flags what is missing.
Effort: large. Prioritise by category: Housing (35 rows) and Mental Health (47)
first, since those are the crisis-adjacent ones.
Done when: every Housing and Mental Health row has phone, hours, eligibility,
cost, and steps confirmed by a person, with `verified_by` naming them.

### 3. Resource verification has no owner or expiry
Evidence: `verified_at` ranges 2026-07-09 to 2026-09-07; `verified_by` is
"Foster Connect research" for 373 rows. There is no re-verification schedule,
no "stale" state, and the UI shows a verified badge regardless of age.
This is FC-05 in TASKS.md and it is blocked on a product decision, not code.
Owner: Human decides; then Astra + Sonnet implement.
Done when: a named person owns freshness, a review interval is set (90 days is
reasonable), rows past it display "last checked N days ago, confirm before
relying on it", and reviewers have a queue of expiring rows.

### 4. Youth reports go nowhere
Evidence: `POST /api/resources/:id/reports` inserts into `resource_reports` and
tells the youth "A partner will review this resource." No partner endpoint reads
that table; no UI lists it. Zero reports exist today, so nothing has been lost
yet, but the promise in the copy is false.
Owner: Sonnet (backend list endpoint + reviewer queue tab). Astra for placement.
Effort: half a day.
Done when: reviewers see open reports next to pending submissions, can resolve
them, and the resource can be marked "needs recheck".

### 5. Human escalation path does not exist
Evidence: crisis routing shows hotlines and stops. Partner submissions and
reports may contain disclosures; nobody is notified.
Owner: Human. Decide who gets told, how, and within what time.
Done when: written in `docs/DEPLOY.md` and the partner staff guide.

---

## P1: before a real pilot

### 6. Commit and review the uncommitted work
FC-04 (atomic publishing) and FC-06 slice 1 are on disk only. They touch data
integrity and the Git ignore list. Independent review by Astra is required by
the workflow doc for these categories.
Owner: Human to commit; Astra to review.

### 7. FC-03: intake cannot express "I don't know"
Evidence: `IntakeConversation.tsx` treats an unticked document as "missing" and
generates a task to obtain it. The plan then tells someone to apply for a state
ID they may already have. The hint says "Skip it if you'd rather not say", but
skipping produces the same result as "I have none".
Owner: Astra designs the have / need / unknown / prefer-not-to-say interaction;
Sonnet implements against that design; schema change in `roadmapInputSchema`.
Effort: one to two days.

### 8. Invented organisation names still pass grounding
Evidence: FC-02 strips unknown resource IDs, phone numbers, and URLs. A task
that says "Call Sunrise Youth Housing" with `resourceId: null` and no contact
details survives. Documented in TASKS FC-02 as the next layer.
Owner: Fable. Effort: half a day. Needs an allow-list of supplied
`organization`/`title` strings and a capitalised-phrase heuristic with a
false-positive budget (ordinary sentence starts must not be dropped).

### 9. No end-to-end approval test
Evidence: `partner-access.test.ts` boots the real server but only exercises
reject. The approve-and-publish path is unit-tested in `persistence.test.ts`
but never through HTTP.
Owner: Sonnet. Effort: two hours. Extend the existing integration test.

### 10. Public submission endpoint has no abuse control beyond IP rate limit
Evidence: `POST /api/resource-submissions` needs no session and no captcha;
100 requests per minute per IP. A script could fill the reviewer queue with
junk and bury real submissions.
Owner: Sonnet. Effort: two hours. Options: require the anonymous session
header, cap pending submissions per session and per IP per day, and add a
honeypot field. Do not add a third-party captcha; it hurts the youth audience.

### 11. Frontend has effectively no tests
Evidence: one test file, `env.test.ts`. The intake, roadmap, chat overlay, and
partner review UI have none.
Owner: Sonnet. Effort: one day for the high-value set: intake payload shape,
roadmap fallback notice, chat crisis card rendering, partner approval form
validation.

### 12. Dependency vulnerabilities
Backend: `qs` moderate, fix available via `npm audit fix`. Frontend: `js-yaml`
high, `nanoid` high, plus vitest-related moderates, all with fixes available.
The frontend ones are mostly dev tooling but `nanoid` can ship in bundles.
Owner: Sonnet. Effort: 30 minutes plus a full `npm test` run.

### 13. No CI
Evidence: no `.github/workflows`. Root `npm test` exists and passes.
Owner: Sonnet. Effort: 30 minutes. One workflow on push and pull request that
runs root `npm test` with Node 22.

### 14. Deploy checklist has not been walked
`docs/DEPLOY.md` was written from the code, not from a real deploy. Turso
interactive transactions, Render environment injection, and the frontend
`VITE_API_URL` build step have not been exercised.
Owner: Human with an engineer. Effort: half a day the first time.

---

## P2: quality and trust

### 15. Anonymous session model is only as private as the browser
Evidence: session ID is a random UUID in `localStorage`. Anyone on the same
device, or anyone who obtains the ID, can read and delete the plan. There is no
server-side expiry of plans; a plan lives forever unless deleted.
This matches the privacy page ("on this device"). It is acceptable for a pilot
but should be stated more plainly: shared or library computers are a real
scenario for this audience.
Owner: Astra (copy), Sonnet (optional: 180-day inactivity purge job).

### 16. Session data retention has no policy
Evidence: no cleanup job for roadmaps, tasks, saved resources, or reports.
Partner sessions expire after 12 hours but expired rows are deleted lazily.
Owner: Human sets the policy; Sonnet implements a daily purge.

### 17. Partner account recovery is manual
Evidence: no password reset. Recovery is re-running the partner script, which
resets the password and revokes sessions. Fine for three reviewers, not for
thirty.
Owner: later, Sonnet. Needs email sending, which the app does not have.

### 18. Age filtering is mostly inert
Evidence: 324 of 425 rows have no age range, and the filter treats null as
"matches everyone". A 14-year-old sees adult-only services.
Owner: data work (see item 2). No code change needed once ages are filled.

### 19. Category taxonomy has drifted
Evidence: "Financial Support" (55) and "Financial Aid" (2) both exist;
"Scholarships" (8) overlaps Education; "Other" (4); "Technology", "Clothing
Assistance" are not in the roadmap task category enum, so tasks built from them
get coerced. The submission form accepts any free-text category.
Owner: Human agrees a fixed list; Sonnet enforces it in the submission schema
and migrates existing rows.

### 20. Accessibility has not been audited
Evidence: ARIA usage is present and consistent, reduced-motion is supported, a
quick-exit control exists. No screen-reader pass or keyboard-only pass has been
recorded. This audience includes users on old phones and low bandwidth.
Owner: Astra. Effort: half a day using the design accessibility-review skill,
then fixes.

### 21. Live AI output has never been evaluated
Evidence: all AI tests use mocked providers. Nobody has run fifty realistic
youth messages through Maya with the real key and read the replies.
Owner: Human plus Fable. Effort: two hours. Write twenty synthetic prompts
(no real youth data), run them, grade for invented facts, tone, and crisis
handling. Record results in `docs/`.

### 22. Content Security Policy is Helmet's default
Evidence: `helmet()` with no CSP customisation; frontend is served separately.
Acceptable. If the frontend is ever served from the API host, set an explicit
CSP.
Owner: Sonnet, only if hosting changes.

---

## P3: later

### 23. Analytics is counts, not decisions
The PDF's ambition is gap analysis for funders. Today `/api/analytics` returns
counts by category and county. Turning that into "where is the gap" needs
population denominators and a definition of "adequate coverage" that no model
should invent.
Owner: Human defines; Astra designs; Sonnet builds.

### 24. Progress check-ins
The PDF lists check-ins as a core feature. Nothing sends or schedules one; the
app has no notification channel and no contact info for youth by design.
Owner: product decision. An in-app "since you were last here" summary is the
privacy-compatible version.

### 25. Chat history signing key rotates on restart without a secret
Now a hard failure in production (FC-06). In development it still regenerates
per process, which is fine.

### 26. In-process write queue
FC-04 serialises all write transactions in the process. Correct for one
instance; a throughput ceiling if the app ever runs several. Not a problem at
pilot scale.

---

## What is in good shape

Worth saying so the list above does not read as "everything is broken":

- Crisis detection is deterministic, runs before the model, and now handles
  mixed messages. 50 backend tests pass.
- Grounding is enforced in code, not prompts: unknown IDs, phone numbers, and
  URLs are stripped from chat and roadmaps; provider failures fall back to a
  labelled deterministic plan.
- Partner auth is real: scrypt passwords, hashed session tokens, per-account
  revocation, reviewer role gate, audit log with email attribution.
- Publishing is atomic and exactly-once.
- Privacy page matches what the backend stores. Chat is not stored; export and
  delete work.
- Input validation with Zod on every route; JSON body capped at 40 KB; rate
  limits on chat, roadmaps, login, guide; `trust proxy` set for hosted deploys.
- The destructive ETL is disarmed; the database is out of Git; backups exist.

---

## Suggested order for the next two weeks

1. Human: verify crisis numbers (item 1). Same day.
2. Human: commit FC-04 + FC-06; Astra reviews (item 6).
3. Sonnet: audit fix, CI, approval integration test, submission abuse controls (items 12, 13, 9, 10). One day total.
4. Sonnet: reports queue for reviewers (item 4). Half a day.
5. Astra: FC-03 intake design, then Sonnet builds (item 7). Two days.
6. Human: decide resource ownership and interval (item 3); start Housing and Mental Health data pass (item 2).
7. Fable: organisation-name grounding layer (item 8). Half a day.
8. Human + Fable: live AI evaluation with synthetic prompts (item 21).
9. Human: walk the deploy checklist on real hosts (item 14).

Items 1, 2, 3, and 5 are the ones no model can do for you.
