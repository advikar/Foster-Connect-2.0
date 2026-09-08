# Dual interface

Youth routes remain at `/`, `/resources`, `/roadmap`, `/saved`, and `/privacy` with their own shell and Maya context. `/add-resource` remains an anonymous suggestion form.

The partner shell lives under `/partners` and has no youth chat, saved-resource session, or youth plan access:

- `/partners`: overview
- `/partners/sign-in`: account sign-in
- `/partners/submissions`: submissions owned by the signed-in individual
- `/partners/add-resource`: authenticated submission; server records partner identity
- `/partners/coverage`: aggregate directory coverage, not unmet-demand claims
- `/partners/guide`: authenticated staff assistant; independent questions, no youth data or publishing tools
- `/partners/review`: designated reviewers only

## Permissions and migration

Startup adds `partners.role` and `resource_submissions.partner_id` idempotently. Accounts without a role default to contributor, including pre-existing accounts. No person is automatically granted reviewer access. Anonymous historical submissions are not claimed by matching names or organization strings. Reviewers can continue reviewing them.

Contributor: submit, see own submissions, use staff guide.
Reviewer: all contributor actions plus global review queue and publication.

An operator must deliberately provision a reviewer with the existing account tool, using `--role=reviewer`. The tool resets the password and revokes sessions when updating an existing account; do not run it merely to inspect an account. New accounts default to contributor. Example for a NEW reviewer account:

```sh
npm run partner --prefix backend -- reviewer@example.org "Reviewer name" "Organization" --role=reviewer
```

This prints an initial password. Arrange private credential delivery outside this app. No accounts were provisioned as part of this implementation. Existing accounts that need reviewer permissions require an explicit operator decision. Team membership, account recovery and organization-wide ownership remain future work.

## Local development and validation

`npm run dev` starts both services. The UI needs the updated API on port 4000. `HOST=127.0.0.1` binds the backend to loopback for local use. LLM configuration is reused on the server; no provider secret is exposed to the frontend. Guide failures preserve the typed question, without pretending to have generated a response.

`npm test --prefix backend` compiles and runs unit and integration tests. The partner integration test uses a temporary isolated database and a loopback server on port 4497. It checks authentication, per-account ownership, reviewer enforcement, status updates, and logout. Port 4497 must be free.

`npm run type-check --prefix frontend` checks the actual app and Vite configurations. `npm run build --prefix frontend` creates the production frontend.

This is an interface and workflow implementation, not public-launch approval. Resource verification, the previously identified youth safety issues, transactional publishing, recovery policies, and full AI evaluations remain separate launch work. Partner AI suggestions are draft guidance; live provider output has not been safety-certified.
