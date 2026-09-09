# Deploying Foster Connect

This is the checklist for putting the app in front of real people. It is written
so a non-engineer can follow the "you" steps and hand the "engineer" steps to
whoever is helping. Nothing here is done automatically; agents in this repo do
not deploy.

## Shape of a deployment

Three pieces, three hosts:

| Piece | What it is | Where it goes | Cost today |
| --- | --- | --- | --- |
| Frontend | Static files built by `npm run build --prefix frontend` | Any static host (Netlify, Vercel, Cloudflare Pages, Render static) | Free tier |
| Backend | Node/Express API in `backend/` | A Node host that keeps a process running (Render, Railway, Fly.io) | Free or ~$7/mo |
| Database | libSQL/SQLite | Turso (hosted libSQL) | Free tier |

The backend refuses to start in production without a hosted database URL, on
purpose: most hosts wipe local files on every deploy, and a file database there
silently loses every plan and submission.

## Environment variables (backend)

Set these in the host's dashboard, never in the repo.

| Name | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `PORT` | host sets | Usually injected by the host |
| `DATABASE_URL` | yes | From `turso db show <name> --url` |
| `DATABASE_AUTH_TOKEN` | yes | From `turso db tokens create <name>` |
| `CHAT_SIGNING_SECRET` | yes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CORS_ORIGINS` | yes | The frontend's public URL, e.g. `https://fosterconnect.example` |
| `LLM_API_KEY` | recommended | Without it, chat is unavailable and plans use the deterministic builder |
| `LLM_BASE_URL` | optional | Any OpenAI-compatible chat-completions endpoint |
| `LLM_MODEL` | optional | Model name for that endpoint |

Frontend build-time variable: `VITE_API_URL` = the backend's public URL.

## Order of operations

1. **Engineer:** create the Turso database. Load resources with
   `FC_DB=<turso url> python3 data/import_resources.py --dry-run`, then without
   `--dry-run`. Never run `data/run_etl.py` against it.
2. **Engineer:** deploy the backend with the variables above. Confirm
   `GET /api/health` returns `{"status":"ok","aiConfigured":true}`.
3. **Engineer:** build and deploy the frontend with `VITE_API_URL` pointing at
   the backend. Confirm the directory loads and a search returns results.
4. **You:** create the first reviewer account from a machine with the production
   variables in its environment:
   `npm run partner --prefix backend -- you@example.org "Your Name" "Org" --role=reviewer`.
   The password prints once. Store it in a password manager.
5. **You:** run through the launch checks below with a synthetic test account.

## Launch blockers (human work, no code)

- **Crisis numbers.** Every entry in `backend/src/config/crisis.ts` is marked
  `verifiedOn: "UNVERIFIED"`. Someone must call each number, confirm it connects
  and serves this audience, and set the date. A wrong number here is worse than
  no app. Do not launch before this is done.
- **Resource ownership.** Decide who is allowed to mark a resource verified and
  how often entries are rechecked (TASKS.md FC-05).
- **Privacy page.** Confirm the privacy page's promises match what the backend
  actually stores: plans and tasks are stored per anonymous session; chat is not
  stored; partner actions are audited by email.
- **Escalation.** Name the human a partner contacts when a youth disclosure
  comes through a submission or report. The app routes to hotlines; it does not
  notify anyone.

## Backups

- Local file database: `npm run backup` writes a consistent copy to
  `data/backups/` (ignored by Git). Restore by stopping the server and copying
  the file back over `data/foster_connect.db`.
- Turso: `turso db shell <name> .dump > backup.sql` on a schedule, stored
  somewhere private. Test a restore into a scratch database once before launch.

## Verifying a deploy

- `GET /api/health` is ok.
- Search "housing" in the directory returns results with real phone numbers.
- Build a plan with a synthetic intake; confirm tasks appear and a task can be
  marked done.
- Sign in as the reviewer; approve a synthetic submission; confirm it appears in
  search. Reject one; confirm it does not.
- Type a crisis phrase in chat with a test session; confirm the hotline card
  appears and no model reply is shown.
- Delete the test session's data from the privacy page; confirm the plan is gone.

## What is not set up

- No CI. `npm test` at the root runs backend tests, frontend type-check, and
  frontend build; run it before every deploy.
- No uptime monitoring. Point any free pinger at `/api/health`.
- No password reset for partner accounts. Reset by re-running the partner
  script for that email, which sets a new password and revokes sessions.
