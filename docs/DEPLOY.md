# Deploying Foster Connect

This is the checklist for putting the app in front of real people. It is written
so a non-engineer can follow the "you" steps and hand the "engineer" steps to
whoever is helping.

**Chosen setup (2026-09-14, public preview):** frontend on GitHub Pages at
https://fosterguide.org (GitHub Pages custom domain; also https://advikar.github.io/foster-connect/) (built from this private repo by
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

1. **You:** install the Turso CLI and sign in: `curl -sSfL https://get.tur.so/install.sh | bash`
   then `turso auth signup`. (Done 2026-09-14.)
2. **Engineer:** `./scripts/make-seed-db.sh` writes `data/seed/foster_connect_seed.sql`:
   the resource directory only (plans, saved items, partner accounts and audit
   rows emptied), with the FTS search index rebuilt at the end, and checks the
   dump loads and searches. Then `turso db create foster-connect` and
   `turso db shell foster-connect < data/seed/foster_connect_seed.sql`.
   (`--from-file` is rejected by CLI v1.0.32 and `--from-dump` created an empty
   database without an error, so load through the shell and check
   `select count(*) from resources`.) Get the values for Render with
   `turso db show foster-connect --url` and `turso db tokens create foster-connect`.
   (`data/import_resources.py` only writes to a local SQLite file.)
   Done 2026-09-14: 425 resources, search verified.
3. **You:** Groq key from console.groq.com (the local `backend/.env` key works).
   Without a key chat is off and plans use the deterministic builder.
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

## Switching providers later

Nothing in the code is tied to Groq, Render or Turso's dashboard.

- **AI (e.g. Gemini).** The backend calls any OpenAI-compatible
  chat-completions endpoint with JSON mode. In Render set
  `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
  `LLM_MODEL=` a current Gemini Flash model, `LLM_API_KEY=` a Google AI Studio
  key. Check the provider's data-use terms first: Gemini's free tier may use
  prompts to improve Google products, which matters for youth chat. Groq free
  tier is 8,000 tokens/minute per model (about one plan per minute across all
  users); over that, chat and plans fall back to directory search and the
  deterministic builder rather than failing.
- **Hosting (e.g. Google Cloud Run).** The API is a plain Node process that
  reads `PORT` and the variables above. Add a Dockerfile for `backend/`
  (`npm ci --include=dev && npm run build`, `npm start`), deploy it with the
  same environment variables, then point the site at it:
  `gh variable set API_URL --repo advikar/Foster-Connect-2.0 --body <url>` and
  re-run "Deploy site". Turso and the site don't change.

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


## Passcodes (Y6)

`PASSCODE_SECRET` keys the passcode lookup (see `docs/PASSCODE.md`). If unset, `CHAT_SIGNING_SECRET` is used, so nothing extra is required; changing either secret invalidates every saved passcode.


## Seeing who has registered (founder / reviewer)

Sign in as a reviewer and open **Accounts** (`/partners/accounts`): every partner account with email, organization, role, join date, last sign-in, submission count and open password-reset requests. The API has no mail provider, so a reset works like this: the partner taps "Forgot your password?" → the request shows on Accounts → you press "Issue reset link" and email the one-time link (valid 48 hours) to the address on the account. Without the UI: `turso db shell foster-connect "SELECT email, name, organisation, role, created_at FROM partners ORDER BY created_at DESC"`.

## Adding listings after launch

Additive listing SQL lives in `data/updates/<date>-<name>.sql` and ends with an FTS rebuild. Apply with `turso db shell foster-connect < data/updates/<file>.sql` (the 2026-09-20 Fostering Wishes file is the first).

## Email (Resend)

Password-reset links and "new partner account" notices are sent through [Resend](https://resend.com) when `RESEND_API_KEY` is set; otherwise resets stay manual (a reviewer issues the link on Accounts). Setup, once:

1. Create a Resend account, add the domain `fosterguide.org` and add the DNS records it shows (SPF/DKIM TXT records) at your registrar. Wait for "Verified".
2. Create an API key (sending only). In Render → foster-connect-api → Environment set `RESEND_API_KEY`, `NOTIFY_EMAIL` (your address for new-account notices); `MAIL_FROM` and `SITE_URL` come from `render.yaml`. Redeploy.
3. Check `GET /api/health` shows `"mailConfigured": true`, then use "Forgot your password?" on the sign-in page with your own address.

Free tier is 3,000 emails a month, far more than this flow needs. Nothing about young people is ever emailed; only partner accounts have addresses.

## If a reviewer is locked out

Run `scripts/issue-reset-link.sh <email>` from a terminal signed in to Turso. It inserts only a hash and prints a one-time link (48 hours); open it to set a new password. The password never passes through anyone else.
