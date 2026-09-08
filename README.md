# Foster Connect 2.0

An isolated redesign of Foster Connect focused on trustworthy resource navigation,
trauma-informed planning, community verification, and an encouraging journey
timeline. The original `FosterConnect/` project is not modified.

## What is new

- Needs-first home experience for youth and people supporting someone
- 24 structured, explicitly synthetic resources for safe testing
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

## Important demo warning

Every organization, address, website, and phone number in the included resource
catalog is fictional. Websites use the reserved `.invalid` domain and phone
numbers use the 555 range. Replace the catalog with reviewed real resources
before any public or service-delivery use.

## Run locally

Requirements: Node.js 22+ and Python 3.

```bash
npm install
npm run install:all
python3 data/run_etl.py
npm run dev
```

Open <http://localhost:5173>. The API runs on <http://localhost:4000>.

The local partner demo token is `demo-partner-access`. It is intentionally a
non-secret development value. Replace it with real partner authentication before
deployment.

## Groq / Llama configuration

The backend uses an OpenAI-compatible chat-completions request. The local `.env`
is configured for Groq and Llama:

```env
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=llama-3.3-70b-versatile
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

Run `python3 data/run_etl.py` to reset the 2.0 demo database and reload the 24
synthetic resources. This reset removes demo roadmaps, tasks, submissions, and
reports from the 2.0 database.

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
require `Authorization: Bearer <PARTNER_ACCESS_TOKEN>`.

## Before a real pilot

This prototype materially improves isolation and grounding, but a real pilot
still requires real identity/authentication decisions, encrypted production
storage, reviewed retention policies, a human escalation workflow, verified
crisis information, ongoing resource ownership and expiry review, formal WCAG
testing, threat modeling, model-safety evaluation, and youth advisory testing.
