# Foster Connect — fixes backlog (2026-09-15)

Source: user's list after the live audit. Worked one at a time, in this order; each item is
committed on its own and its status updated here. Decisions the user still has to make are
marked **Decide**.

Status key: `todo` · `doing` · `done <commit>` · `decide`

## UI

| # | Item | Status | Notes |
|---|------|--------|-------|
| U1 | Accent colour: teal reads as "AI green"; offer a deeper blue and a way to toggle | done | Accent is a token set (`--brand`, `--brand-deep`, `--brand-soft`). Two palettes: **Teal** (current) and **Deep blue** (#1F4E8C / #163A69 / #DCE7F5). Toggle: footer "Accent" switch (preview builds only) + `?accent=blue` URL parameter; choice kept in localStorage. Design board with both side by side and three mark directions: https://claude.ai/artifact/F94E8b5RUzk9arMmDN515V **Decide** which becomes the default. |
| U2 | Logo: replace the two-circle mark with something like the reference image, on a coloured circle, more professional | decide | **The reference image did not come through in the message** — only text arrived. Interim: a serif "FC" monogram on a brand-coloured circle, so the mark is at least legible and consistent with the wordmark. Send the image and it will be redrawn to match. |

## Youth site

| # | Item | Status | Notes |
|---|------|--------|-------|
| Y1 | "Need help now" does not load right | done | The dialog was taller than the viewport and vertically centred inside its scroll container, so the title and close button sat 89px above the screen and could not be scrolled to. Card now uses auto margins so tall content scrolls from the top. |
| Y2 | "Start a new plan" button does not work | done | Clicking cleared the active plan id, but an effect immediately re-selected the first existing plan. A `startingNew` flag now holds the intake open; Back returns to the existing plan. |
| Y3 | Maya offers to add a step when someone asks about a program not on their plan; can remove or change steps on request; breaks big steps into baby steps | done | Backend: the chat route loads the session's current plan and passes it to the model as CURRENT_PLAN; replies carry `planSuggestions` (add / replace / split / remove) validated against listed resources and real task ids, capped at 3, contact-checked like the reply. Frontend shows one-tap cards ("Add to my plan", "Swap it", "Use these steps", "Remove it") that call the same endpoints as manual editing. Verified locally: "add a bus pass… Covenant House step feels too big" → an add card and a 3-step split card; both applied. |
| Y4 | More autonomy on the plan page: add, remove, reorder steps by hand; AI advice optional | done | New `POST /api/roadmaps/:id/tasks`, `DELETE /api/tasks/:id`, `PATCH /api/tasks/:id` gains `taskOrder`/`timeframe`/`taskText`. UI: "Add a step" at the end of each section, move up/down, remove with undo. |
| Y5 | Would badges be a good idea? | decide | **Recommendation: no badges.** For this audience they read as school-app and can feel patronising; a young person who stalls sees a trophy case of things not earned. Keep the quiet progress bar and add a single milestone line ("Two steps done this week") plus the existing "That step counts" toast. If you want more, a private streak counter that only appears once it exists. |
| Y6 | Optional sign-in so a caseworker can hold a young person's info more securely | decide | **Recommendation: yes, later, as "Save this with a passcode".** Not an account with email: a 6+ character passphrase that encrypts the session id so it can be restored on another device. No pressure copy, no prompt on first visit, offered only from My plan and Privacy. Needs its own design + threat model (who can reset it, what a caseworker sees). Not built in this pass. |
| Y7 | Intake: AI on the backend; "idk" for the six-month question; no "other" / free text on chip questions | done | Add "Something else…" free text to every chip question; six-month question accepts "not sure" with a chip. Backend already sends the intake to the model; add the free-text fields to the prompt so they shape the plan. |
| Y8 | Other names for Maya | decide | Ideas that fit "calm guide, not a caseworker": **Wren**, **June**, **Sage**, **Ida**, **Marlo**, **Rue**, **Ines**, **Nova**. Non-person options: **Compass**, **Guide**. Keep one syllable-ish and easy to type. Maya stays unless you pick one. |
| Y9 | Ask: "New chat" that keeps the old context until cleared; does it cost anything? | done | Client-only: archive the current thread into a list (max 5) in localStorage and start fresh. No extra AI usage — Maya is only called when a message is sent. A "Past chats" row lets you reopen one; its signed history goes back with it. |
| Y10 | Find: select multiple counties (Contra Costa + California, etc.) and categories | done | `county` and `category` become comma-separated lists on the API (`IN (...)`); chips become multi-select. |
| Y11 | Some resources are information PDFs; add them without blank Hours/Address headings (youth side and add-resource side) | done | Resource gains `kind`: `service` (default) or `information`. Information listings hide the contact grid and show "Open the guide" instead. Add-resource forms get a "This is a document or guide, not a service" switch; submissions carry it through approval. **Follow-up on the live DB**: after deploy, run `UPDATE resources SET kind='information' WHERE title LIKE '%(PDF)%'` on Turso (3 listings). |

## Partners

| # | Item | Status | Notes |
|---|------|--------|-------|
| P1 | Workspace sidebar visible before sign-in; should be one sign-in page, then everything | done | `/partners` becomes the public landing (P2); every workspace route redirects to `/partners/sign-in` unless signed in; the shell (sidebar, chip row) only renders when signed in. |
| P2 | Public landing page explaining the app with a sign-in button; youth-side link becomes "About us / partners" | done | `/partners` = about + who it is for + what partners can do + sign-in button. Youth header/footer link renamed "About & partners". |
| P3 | Reviewer vs user: main sign-in is for partner users; small "Reviewer sign-in" link at the bottom | done | Same credentials endpoint; the reviewer link goes to `/partners/sign-in?as=reviewer`, which shows the reviewer copy and, after sign-in, lands on the Review queue. Review queue only appears in reviewer navigation. |
| P4 | Coverage: multi-select areas; click a bar to see the resources behind it | todo | Coverage bars become buttons that open a drawer listing the resources (by category / by county / missing a field). County chips multi-select. |
| P5 | "What listings are missing" moves to its own tab / dropdown. Contributors see a thank-you note and can fill gaps (pending review); reviewers approve and see who submitted (with email). Review queue only on reviewer side | todo | New "Fill the gaps" tab. Clicking a completeness bar lists the listings missing that field; each opens an inline edit that files a **change proposal** (new table `resource_changes`: resource_id, field, old, new, note, partner_id, status). Reviewers approve/reject from the Review queue, which shows the proposer's name and email. |
| P6 | Make resources clickable so changes can be made on-site | todo | Every listing in the partner workspace opens an editor; contributor edits become proposals (P5), reviewer edits apply directly and are audited. |
| P7 | Distinguish "vetted: has no phone" from "unknown"; optional re-check date per resource | todo | Field-level `not_applicable` markers (`fields_na` JSON column: e.g. `["phone","address"]`) shown as "None — confirmed" instead of "Not confirmed yet". `recheck_at` date column; Coverage "oldest checks" and the youth "Needs re-check" label use it when set. |

## Order of work

Y1 → Y2 → U1 → U2 (interim) → Y7 → Y9 → Y10 → Y11 → Y4 → Y3 → P2 → P1 → P3 → P7 → P4 → P5 → P6.
Bugs first, then youth items that are self-contained, then plan editing (Y4 before Y3 because Maya's
suggestions need the add/remove endpoints), then the partner restructuring, then the partner data
features that share one change-proposal model.
