# Foster Connect 2.0

An isolated redesign of Foster Connect focused on trustworthy resource navigation,
trauma-informed planning, community verification, and an encouraging journey
timeline. The original `FosterConnect/` project is not modified.

## What is new

- Needs-first home experience for youth and people supporting someone
- Resource catalog built from a researched spreadsheet (`data/build_resources.py` -> `data/import_resources.py`); the legacy 24-row synthetic set is retired
- SQLite FTS5 search with county, age, category, and urgency filtering
- Detailed eligibility, cost, application, document, accessibility, language,
  verification, and freshness fields
- Strict resource-first AI prompting with server-validated resource IDs
- No model-generated links, phone numbers, eligibility, or program records
- Deterministic crisis routing to curated crisis records
- Anonymous browser sessions so one visitor cannot see another visitor's journey
- A full-page, four-phase journey timeline with completed, in-progress, and
  blocked states
- Contextual help for individual steps
- Saved resources, outdated-information reports, data export, and data deletion
- Community submissions remain pending until partner review
- Partner coverage and moderation workspace
- Reduced-motion support and clearer keyboard focus

## Important data warning

The resource catalog is built from a researched spreadsheet, not invented, but
it has not been independently re-verified by calling each service. The crisis
contacts in `backend/src/config/crisis.ts` are all marked UNVERIFIED. Do not put
this in front of young people until both are confirmed. See `docs/DEPLOY.md`.

## Run locally

Requirements: Node.js 22+ and Python 3.

```bash
npm install
npm run install:all
npm run import:resources
npm run dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:4000>.

Partner access uses real accounts. Create one with
`npm run partner --prefix backend -- you@example.org "Name" "Org" --role=reviewer`.
There is no shared token.

## Groq / Llama configuration

The backend uses an OpenAI-compatible chat-completions request. The local `.env`
is configured for Groq and Llama:

```env
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-120b
LLM_API_KEY=your_api_key_here
```

The mentor persona and grounding contract live in
`backend/src/config/prompts.ts`. Request validation, structured response parsing,
resource-ID enforcement, retry behavior, and the deterministic fallback live in
`backend/src/services/ai.service.ts`.

Changing the prompt alone is not the grounding guarantee. The API also:

1. Retrieves only records whose status is `verified`.
2. Filters and ranks records before calling the model.
3. Sends structured resource context with stable numeric IDs.
4. Requires the model to cite those IDs.
5. Removes any ID that was not in the supplied context.
6. Hydrates all links and contact details from SQLite after generation.

## Data model

- `resources`: structured, verified resource facts
- `resources_fts`: SQLite FTS5 index
- `resource_submissions`: pending community contributions
- `resource_reports`: outdated or unsafe-information reports
- `roadmaps`: session-owned journey summaries
- `roadmap_tasks`: session-owned timeline steps
- `saved_resources`: session-owned bookmarks

`npm run import:resources` upserts the built catalog without touching plans or
submissions. `npm run backup` copies the local database to `data/backups/`.
The legacy `data/run_etl.py` drops every table and now refuses to run unless
`FC_ALLOW_DESTRUCTIVE_RESET=1` is set.

## API highlights

- `GET /api/resources`
- `GET /api/resources/:id`
- `POST /api/resource-submissions`
- `POST /api/resources/:id/reports`
- `POST /api/chat`
- `POST /api/roadmaps`
- `GET /api/roadmaps`
- `GET /api/roadmaps/:id`
- `PATCH /api/tasks/:id`
- `GET|POST|DELETE /api/saved-resources`
- `GET /api/session/export`
- `DELETE /api/session`
- `GET|PATCH /api/partner/submissions`

Session-owned endpoints require an `X-Session-ID` header. Partner endpoints
require `Authorization: Bearer <session token>` from `POST /api/partner/login`.

## Deploying

See `docs/DEPLOY.md` for hosts, environment variables, backups, and the human
launch blockers.

## Before a real pilot

This prototype materially improves isolation and grounding, but a real pilot
still requires real identity/authentication decisions, encrypted production
storage, reviewed retention policies, a human escalation workflow, verified
crisis information, ongoing resource ownership and expiry review, formal WCAG
testing, threat modeling, model-safety evaluation, and youth advisory testing.
