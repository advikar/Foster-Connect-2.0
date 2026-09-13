# Working across Codex and Claude Code

## Product and architecture

Foster Connect helps current and former foster youth find useful local support and take manageable next steps. Initial geography: Alameda and Contra Costa counties, including relevant regional/statewide/national services.

- Youth: `/`, `/resources`, `/roadmap`, `/saved`, `/privacy`; anonymous browsing, plans and Maya.
- Partners: `/partners/*`; separate shell, authenticated contributions, owned submissions, coverage and staff guide. Publishing requires reviewer role.
- Frontend: React, TypeScript, Vite, Tailwind, React Query.
- Backend: Express, TypeScript, Zod, libSQL/SQLite; server-side LLM calls.
- See `docs/dual-interface.md` for role migration, routes and setup.

## Default allocation (recommendations, not capability guarantees)

| Work | First choice | Substitute |
| --- | --- | --- |
| Visual design, responsive journeys, interaction design, integration | Astra | Fable with existing components and specific visual acceptance criteria |
| Difficult backend work, safety/grounding fixes, architecture decisions | Fable trial | Astra; Opus for a focused second opinion |
| Bounded implementation, regression tests, known fixes, documentation | Sonnet | Available Astra/Fable/Opus with the same narrow task |
| Independent review of important changes | A different model from the implementer | Same model in a fresh context with explicit evidence; record lack of independence |

Do not spend a premium-model session redoing a solved small task. Escalate a task after a demonstrated failure or genuine ambiguity. No model may certify service accuracy or human safety based on its confidence alone.

Notes on the allocation (added after the FC-01 trial, 2026-09-08):

- The table was drafted by Astra and assigns Astra design lead and integrator. Treat that as a proposal, not a verdict: give Astra the same kind of bounded trial on a UI task that Fable got on FC-01, and compare.
- Safety-module tests (`safety.test.ts`) encode judgment calls about what counts as a disclosure. Keep test authorship with whichever model owns the fix; do not farm those fixtures out as "routine test writing".
- Opus is optional. The practical escalation ladder is Sonnet, then Fable (or Astra). Add a fourth opinion only when two models disagree.
- Independent review is required, not optional, for: safety/crisis detection, auth and roles, publishing/data integrity, and AI grounding.

## One task, one editor, small checkpoints

1. Read HANDOFF, then the selected task and relevant files. Confirm current file state; handoff notes can be stale after an abrupt cutoff.
2. Claim the task in HANDOFF before editing. Record the working directory and intended file scope. Claims are coordination notes, not actual file locks.
3. Work in a reviewable slice: one regression + fix, one endpoint + UI connection, or one screen + responsive checks. Avoid whole-app rewrites.
4. Checkpoint after each coherent slice, significant failure, or decision: what changed, evidence, unresolved items, exact next action. Update before quota exhaustion; limits can interrupt before a final message.
5. One active implementation per shared checkout. A second model can review independently. Parallel edits require isolated Git worktrees/branches and separate mutable test databases, plus an integration owner.
6. At takeover, stop the outgoing writer first. Inspect partial edits, verify only relevant uncertainty, then continue. Do not reset files, wipe data, or restart from scratch.
7. End with outcome, checks actually run, remaining limitations, and updated HANDOFF/TASKS. Do not auto-start the next backlog task unless authorized.

## Definition of done

- Acceptance criteria met in code and, for UI, observed in the browser.
- Appropriate checks pass; failures and missing checks are documented honestly.
- Critical auth/data/AI changes get independent review when available, with findings resolved; absence of review is recorded, not silently treated as approval.
- Resource claims are evidence-backed. A successful build is not a safety or launch certificate.

## Product decisions to preserve

- The user requested a complete UI redesign on 2026-09-13, superseding the teal/sand identity default. See docs/UI-DIRECTION.md for research and proposed navigation. Preserve readable text, clear actions and responsive navigation. Do not restyle unrelated pages during backend tasks.
- Keep youth and partner experiences separate; do not expose youth plans or chat to partners.
- New/unassigned accounts are contributors; reviewers are explicitly designated. Never bypass sign-in to make a preview work.
- Coverage counts are not proof of service gaps, available beds, or eligibility.
- Show loading, empty and failed states distinctly; don't turn network failures into zero counts.
- AI is an assistant with limited authority, not an eligibility decision-maker or a substitute for a qualified person. Unsupported facts must not be presented as verified.
- Use public information and synthetic test cases. Do not place credentials, private youth records or raw sensitive logs in shared documentation or prompts.

## Commands and operational cautions

From the project root:

- `npm run dev` — frontend 5173, backend 4000. Inspect existing processes before starting duplicates.
- `npm run type-check --prefix frontend` — actual app and Vite configuration.
- `npm run build --prefix frontend` — frontend production build.
- `npm test --prefix backend` — compiles backend and runs tests; integration test needs loopback port 4497 and uses a temporary database.
- `npm run build --prefix backend` — backend compilation when tests are unnecessary.
- Frontend lint: from `frontend`, run `./node_modules/.bin/eslint` on changed source files.

Do not rerun all checks for documentation-only edits. Run broader checks when changes justify them.

Never run root `npm run etl` casually: it still points to legacy `data/run_etl.py`, which drops application tables. Use isolated test fixtures. Back up local data before migrations; never assume production credentials or databases are safe test targets. The partner account script changes passwords and revokes sessions for existing accounts; it is not a read-only role viewer.

Git: repository initialised 2026-09-08 with remote `https://github.com/advikar/Foster-Connect-2.0`. Commit after each reviewed task; parallel editing still needs separate branches or worktrees. Don't commit databases, raw spreadsheets, credentials, or personal data. User authorization updated 2026-09-13: commit and push completed, reviewed project checkpoints to this GitHub remote so Codex and Claude share durable progress. Verify remote synchronization and report failures. Never push credentials, private youth records, runtime databases or unreviewed unrelated changes. GitHub source storage does not itself deploy the app.

## Reusable prompts

Takeover:

> Read AGENTS.md, docs/WORKFLOW.md, docs/HANDOFF.md, and the referenced task in docs/TASKS.md. Resume the active task from current files; if none is active, implement the recommended next task. Claim ownership before edits. Preserve the current design and unrelated work. Checkpoint after each coherent slice. Run relevant checks and update the handoff with evidence and exact next steps. Do not deploy.

Review:

> Read the shared handoff and the named task. Review the implementation read-only against its acceptance criteria. Prioritize correctness, access control, data integrity, and observed UX. Provide file locations, reproduction steps, and concrete fixes. Do not rewrite the feature or invent findings to fill a quota.

Checkpoint before switching:

> Finish the current small edit or leave it clearly marked incomplete. Update docs/HANDOFF.md with changed files, test results, pending commands, decisions, and the exact next action. Release ownership, then stop editing.

These prompts work in either provider's local coding tool pointed at this same directory. A plain web chat does not automatically see these files; provide the relevant files explicitly if using web chat. Chats, browser state, permissions and running processes do not transfer with a model switch.
