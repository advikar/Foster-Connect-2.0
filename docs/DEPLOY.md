# Deploying Foster Connect

This is the checklist for putting the app in front of real people. It is written
so a non-engineer can follow the "you" steps and hand the "engineer" steps to
whoever is helping.

**Chosen setup (2026-09-14, public preview):** frontend on GitHub Pages at
https://advikar.github.io/foster-connect/ (built from this private repo by
`.github/workflows/deploy-site.yml` and pushed to the public repo
`advikar/foster-connect`, which holds compiled files only), API on Render
(`render.yaml`), database on Turso. The site carries a noindex tag and the
preview banner until the launch blockers below are cleared.

## Shape of a deployment

Three pieces, three hosts:

| Piece | What it is | Where it goes | Cost today |
| --- | --- | --- | --- |
| Frontend | Static files built by `npm run build --prefix frontend` | GitHub Pages (`advikar/foster-connect`) | Free |
| Backend | Node/Express API in `backend/` | Render web service `foster-connect-api` | Free (sleeps after 15 min idle; first request ~1 min) or ~$7/mo always-on |
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

1. **You:** install the Turso CLI and sign in (creates your account):
   `brew install tursodatabase/tap/turso` then `turso auth signup`.
2. **Engineer:** make a seed copy of the local database with only the resource
   directory (plans, saved items, partner accounts and audit rows emptied):
   `./scripts/make-seed-db.sh`. Upload it:
   `turso db create foster-connect --from-file data/seed/foster_connect_seed.db`.
   Then `turso db show foster-connect --url` and
   `turso db tokens create foster-connect`. (`data/import_resources.py` only
   writes to a local SQLite file; it cannot target Turso directly.)
3. **You:** get an LLM key (the default endpoint is Groq; a free key comes from
   console.groq.com). Optional: without it chat is off and plans use the
   deterministic builder.
4. **You:** Render → sign up with GitHub → New → Blueprint → pick
   `advikar/Foster-Connect-2.0`. Paste `DATABASE_URL`, `DATABASE_AUTH_TOKEN`
   and `LLM_API_KEY` when asked. `CHAT_SIGNING_SECRET` is generated and
   `CORS_ORIGINS` is set by the blueprint. Confirm
   `https://foster-connect-api.onrender.com/api/health` returns ok.
5. **Engineer:** if Render gave the service a different URL, update the
   repository variable: `gh variable set API_URL --repo advikar/Foster-Connect-2.0 --body <url>`
   and re-run the "Deploy site" workflow. Pushing frontend changes to `main`
   redeploys the site automatically; pushing backend changes redeploys Render.
6. **You:** create the first reviewer account from a machine with the production
   variables in its environment:
   `DATABASE_URL=... DATABASE_AUTH_TOKEN=... npm run partner --prefix backend -- you@example.org "Your Name" "Org" --role=reviewer`.
   The password prints once. Store it in a password manager.
7. **You:** run through the checks under "Verifying a deploy" with a synthetic
   test account.

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

- No backend CI. The site workflow type-checks and builds the frontend only;
  `npm test` at the root (backend tests, type-check, build) should still be run
  before pushing, because Render deploys backend changes on push.
- No uptime monitoring. Point any free pinger at `/api/health`.
- No password reset for partner accounts. Reset by re-running the partner
  script for that email, which sets a new password and revokes sessions.
