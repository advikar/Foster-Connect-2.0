# Foster Connect — fixes backlog (2026-09-15)

Source: user's list after the live audit. Worked one at a time, in this order; each item is
committed on its own and its status updated here. Decisions the user still has to make are
marked **Decide**.

Status key: `todo` · `doing` · `done <commit>` · `decide`

## UI

| # | Item | Status | Notes |
|---|------|--------|-------|
| U1 | Accent colour: teal reads as "AI green"; offer a deeper blue and a way to toggle | done (colour choice pending) | Accent is a token set (`--brand`, `--brand-deep`, `--brand-soft`). Two palettes: **Teal** (current) and **Deep blue** (#1F4E8C / #163A69 / #DCE7F5). Toggle: footer "Accent" switch (preview builds only) + `?accent=blue` URL parameter; choice kept in localStorage. Design board with both side by side and three mark directions: https://claude.ai/artifact/F94E8b5RUzk9arMmDN515V **Decide** which becomes the default. |
| U2 | Logo: replace the two-circle mark with something like the reference image, on a coloured circle, more professional | done | Reference received (two hands clasped into a heart). Mark is now a white heart with the clasp drawn in the accent colour, on the brand circle; header, tab bar and favicon. Follows the accent token. Tune once the colour is chosen. |

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
| Y8 | Other names for Maya | done | User chose **Nova** (gender neutral). Renamed everywhere: UI copy, prompts ("You are Nova"), components (`NovaConversation`, `NovaContext`, `useNova`, `openNova`). Browser storage keys keep their old `fc-maya-*` names so existing conversations survive. |
| Y9 | Ask: "New chat" that keeps the old context until cleared; does it cost anything? | done | Client-only: archive the current thread into a list (max 5) in localStorage and start fresh. No extra AI usage — Maya is only called when a message is sent. A "Past chats" row lets you reopen one; its signed history goes back with it. |
| Y10 | Find: select multiple counties (Contra Costa + California, etc.) and categories | done | `county` and `category` become comma-separated lists on the API (`IN (...)`); chips become multi-select. |
| Y11 | Some resources are information PDFs; add them without blank Hours/Address headings (youth side and add-resource side) | done | Resource gains `kind`: `service` (default) or `information`. Information listings hide the contact grid and show "Open the guide" instead. Add-resource forms get a "This is a document or guide, not a service" switch; submissions carry it through approval. Live DB: ran `UPDATE resources SET kind='information' WHERE title LIKE '%(PDF)%'` on Turso on 2026-09-15 — 8 listings (267, 268, 279, 280, 339, 393, 394, 424) now show as guides. |

## Partners

| # | Item | Status | Notes |
|---|------|--------|-------|
| P1 | Workspace sidebar visible before sign-in; should be one sign-in page, then everything | done | `/partners` becomes the public landing (P2); every workspace route redirects to `/partners/sign-in` unless signed in; the shell (sidebar, chip row) only renders when signed in. |
| P2 | Public landing page explaining the app with a sign-in button; youth-side link becomes "About us / partners" | done | `/partners` = about + who it is for + what partners can do + sign-in button. Youth header/footer link renamed "About & partners". |
| P3 | Reviewer vs user: main sign-in is for partner users; small "Reviewer sign-in" link at the bottom | done | Same credentials endpoint; the reviewer link goes to `/partners/sign-in?as=reviewer`, which shows the reviewer copy and, after sign-in, lands on the Review queue. Review queue only appears in reviewer navigation. |
| P4 | Coverage: multi-select areas; click a bar to see the resources behind it | done | Region chips multi-select (totals add up across the chosen regions). Every kind / region bar and the re-check link is a button that opens a side drawer listing the resources behind it; each opens the editor. |
| P5 | "What listings are missing" moves to its own tab / dropdown. Contributors see a thank-you note and can fill gaps (pending review); reviewers approve and see who submitted (with email). Review queue only on reviewer side | done | New "Fill the gaps" tab (`/partners/gaps`); Coverage keeps a one-line pointer to it. Each bar opens the listings still missing that field; tapping one opens the editor with that field highlighted. Contributor edits become rows in `resource_changes` (status pending; JSON diff, note, proposer name + email); reviewers see them in the Review queue as before/after diffs with the proposer's email and approve (applies + audits) or decline. Verified locally: contributor proposal → reviewer queue → decline; reviewer "no phone line — confirmed" → published, audit row written, completeness moved 141 → 140. |
| P6 | Make resources clickable so changes can be made on-site | done | `ResourceEditor` (all text fields, ages, confirmed-none markers, re-check date, reviewer "checked by phone/online") reached from any Coverage or Gaps bar. Reviewer saves apply immediately, refresh the search index, set today as the check date under the reviewer's email, and write an audit row; contributor saves file a proposal. |
| P7 | Distinguish "vetted: has no phone" from "unknown"; optional re-check date per resource | done | `resources.fields_na` (JSON, e.g. `["phone","address"]`) and `resources.recheck_at`. Youth detail shows "No phone line — confirmed", "No set hours — confirmed with the program", etc. instead of "Not confirmed yet"; completeness counts a confirmed-none as known; "Needs re-check" (youth label, Coverage counts, oldest-checks list, the partner list filter) fires at 180 days **or** once the re-check date arrives. |

## Added 2026-09-15 (second message)

| # | Item | Status | Notes |
|---|------|--------|-------|
| Y12 | "Before you turn 21" is wrong for someone under 18 | done | With "Under 18" saved in About you, the section becomes "Before you turn 18, three things to line up": Extended Foster Care (AB 12) decision before 18, ILP from 16, documents in hand before 18. 18–20 keeps the 21 deadlines. |
| Y13 | Is a fixed "Housing" list on the home screen needed? | done | No. It is now "Checked recently[, County]": the three most recently checked listings of any kind for their county (crisis lines excluded), linking to Find sorted by check date. Housing is still one tap away in the category bar. |

## Round 2 (2026-09-15, third message)

| # | Item | Status | Notes |
|---|------|--------|-------|
| R1 | Nova is they/them | done | Ask page and plan page copy; NAVIGATOR prompt says Nova's pronouns are they/them. |
| R2 | Logo did not come out right; try again | done | Redrawn from the reference's construction: white heart, thumb outline joined to the far arm's seam, three finger gaps fanning to the lower right, scalloped knuckles on the lower-left edge. Header, tab bar, favicon. Still follows the accent token. |
| R3 | Do we need a quick exit button? | already there | "Quick exit" sits in the header on every youth page (replaces the history entry and jumps to a weather search). Kept; nothing to add. |
| R4 | Ask before clearing: "are you sure? It will forget your history" | done | "Clear this conversation" and "Delete all past chats" now ask inline first ("Nova will forget everything you said here"). "Delete my data" on Privacy already confirmed. |
| R5 | Spelling: "enrol" | done | enroll, license, program, organization in user-facing copy. |
| R6 | Links routed wrong (ILP on Home went to Mentoring) | done | Every Home deadline links to a search for the thing itself (`?q=ILP`, `?q=THP`, `?q=Chafee`, `?q=extended foster care`, `?q=documents`), never a category. Checked each search returns the right listing first. |
| R7 | Home deadlines: "add to my plan" / "already did"; once a plan exists show plan tasks instead | done | Each deadline has "Add to my plan" (when a plan exists; adds a concrete step with the right timeframe) and "Already did this" (hidden on this device; "Show them again"). With a plan, the left column leads with "Up next on your plan" (three open steps, This Week first) and the remaining deadlines follow as "Deadlines not on your plan yet". |
| R8 | Don't assume 18–20 are in Extended Foster Care | done | Uses the care status from About you: in care → re-cert + THP-Plus + Chafee; left care → "Re-enter Extended Foster Care" + THP-Plus + Chafee; unknown → "stay in, or come back" wording. THP-Plus copy says you need not be in care. |
| R9 | Find "How urgent" doesn't make sense | done | The data has only two real levels (28 emergency/crisis lines, 373 standard, none "urgent"), so "This week" always returned nothing. Filter is now "Emergency?": Everything / Emergency — tonight / Not an emergency. |
| R10 | Age 7 in the plan intake failed | done | Server accepted 13–30 only; now 0–99 for plans, chat and Find. Under 14 the intake says the steps will be written for the adult helping, and the generator prompt is told a caregiver is planning for a child. Validation errors now name the field. |
| R11 | Partners can sign up themselves; only reviewers are added by Foster Connect | done | `POST /api/partner/register` creates a contributor account (rate-limited, 12+ char password, audit row) and signs them in. Sign-in page has "Create a partner account". Landing copy updated. Reviewer accounts unchanged. |
| R12 | "I tried adding a resource and could not" | done | Two causes: the two link fields were `type="url"`, so a link typed without `https://` made the browser block the submit silently; and the button was disabled without saying why. Link fields are plain text now (`https://` is added for you), the form lists what is still needed, and server field errors are shown. |
| R13 | Change the format of existing resources (PDF listed as a service) | done | Resource editor has "What kind of listing is this?" (service / guide); reviewers apply it directly, contributors propose it. |
| R14 | Oldest checks: click to verify on the spot | done | Each row opens that listing straight in the editor; saving records today's check under the reviewer's email. |

## Order of work

Y1 → Y2 → U1 → U2 (interim) → Y7 → Y9 → Y10 → Y11 → Y4 → Y3 → P2 → P1 → P3 → P7 → P4 → P5 → P6.
Bugs first, then youth items that are self-contained, then plan editing (Y4 before Y3 because Maya's
suggestions need the add/remove endpoints), then the partner restructuring, then the partner data
features that share one change-proposal model.
