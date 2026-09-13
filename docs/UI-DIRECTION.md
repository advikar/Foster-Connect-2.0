# Foster Connect redesign research — 2026-09-13

Status: research and proposed direction, not an implemented redesign or approved final design.

## Current project and access

Canonical checkout: `/Users/advikarichhariya/StudentHub/Projects/FosterConnect2.0`.
Remote: https://github.com/advikar/Foster-Connect-2.0
The sibling FosterConnect is the earlier standalone copy (its own master has no commits); Foster is the legacy Foundry project. The shared handoff and September commits identify 2.0 as the current project.

Local UI: http://127.0.0.1:5173/ ; partner workspace: http://127.0.0.1:5173/partners . Run `npm run dev` from the canonical checkout when both services are stopped. If the backend already runs on 4000, start only `npm run dev:frontend`. Local servers must stay running; a GitHub repository is not a hosted application.

Live fetch confirmed four local commits missing from origin/main at the start of this session: 536af28, 4966ca2, 14a53fb, 057b519. The last includes Claude's audit and directory review. Code implements youth search, saved resources, plans and Maya, plus partner submissions, coverage, staff guide and reviewer-only publishing. The September 10 audit still lists service verification, report handling and human escalation gaps; this is a development preview, not a finished public launch.

## User brief

Complete redesign with a distinctive, engaging, professional identity. Avoid generic AI-product styling. Serve current and former foster youth and professional partners with equally deliberate interfaces. Preserve existing service capabilities and access boundaries. Save work and decisions on GitHub for both Codex and Claude.

## References and verdicts

1. **Year Up United — primary visual and audience-navigation reference.** https://www.yearup.org/ . Browser inspected: real portrait photography, strong dark color blocks, red/orange action accents, large clear headings. Navigation distinguishes Students, Job Training and Corporate Partners; location lookup connects visitors to an action. Adapt its confident tone, audience separation and local search. Keep Foster Connect search visible earlier and avoid oversized media slowing access to urgent information.
2. **Foster Love — program and institutional-content reference.** https://fosterlove.com/ . Page content inspected: named programs, foster-care resources, agency/corporate partnership paths, financials and organizational information. Adapt clear program labels and evidence of organizational accountability. Its donor-heavy navigation is not the right primary structure for youth seeking support.
3. **Hopeway — template candidate for secondary public pages.** https://webflow.com/made-in-webflow/website/hopeway-nonprofit-webflow-template . Webflow lists it as a free nonprofit template. Listing inspected; full live interactions not tested. Consider About/community-story sections only after visual review; it does not establish directory or authenticated workspace suitability.
4. **Voila — reject as the whole-app template.** https://templates.webflow.com/html/voila-website-template ; actual preview https://voilla.webflow.io/ . The listing markets a community/nonprofit system, but the live preview is preschool-oriented, with early-learning copy and a full-screen photographic hero. Program detail structure may be reusable inspiration; the age positioning and dominant hero are wrong for this app. This mismatch is why previews matter more than template labels.
5. **USWDS side navigation — partner navigation reference.** https://designsystem.digital.gov/components/side-navigation/ . Use its clearly labeled hierarchy as a starting point for a persistent partner sidebar. Give the interface Foster Connect branding; do not imply government affiliation.
6. **W3C listing templates — directory layout reference.** https://design-system.w3.org/templates/listings.html . Listing/search-filter structure is relevant to results pages. Adapt a compact filter region and readable result rows, then validate on mobile.

User Pinterest search: https://www.pinterest.com/search/pins/?q=website%20design . Opened in browser, but a persistent sign-in overlay prevented reliable individual-pin inspection. Visible background examples emphasized editorial typography, large photography and asymmetric layouts. No individual pin is claimed as fully reviewed or selected.

These are inspiration sources, not a recommendation to buy a template or migrate the existing React application to Webflow. Do not copy proprietary assets or use another organization's stories as Foster Connect testimonials.

## Recommended visual direction

Bold community editorial: ink navy (#152536), warm paper (#FAF7F0), burnt orange (#C74725), and restrained sky blue (#BBDCEB). Proposed palette, not a tested contrast system yet. Use ink text on light surfaces, strong solid buttons, a distinctive display heading face with a highly readable body face, crisp section rules and varied composition. Use authentic, permissioned community/place imagery with useful captions. Avoid invented testimonials, AI portraits of supposed service users, gradient blobs, excessive pills, glass panels, repetitive icon-card grids and decorative dashboard statistics.

Engagement should come from useful actions, clear saved states, tangible next steps, recognizable local context and real community content. Keep motion brief, optional and respectful of reduced-motion preferences. AI help remains clearly identified where used, but should not dominate the brand or become the entry point for finding services.

## Proposed navigation and screen layouts

Youth desktop: **Find support | My next steps | Saved**, with a clear **For partners** utility link. Brand returns home. Keep urgent support and quick exit consistently available. Mobile: persistent labeled Home / Support / My steps / Saved navigation; keep it clear of chat and urgent-support controls.

Home: concise editorial introduction plus location/search within the first screen, a real community/place image, then clear service links for housing, money and benefits, school and training, employment, healthcare, food, transportation and mental health. Follow with a small resume-plan area. Avoid making the plan promotion equal in size to the primary search action, as the current homepage does.

Directory: search and location at top; desktop filters beside readable results, mobile filters in a dismissible sheet. Show organization, service, location, eligibility summary, cost/unknown status and date/source information. Make Save, contact and next-step actions obvious. Preserve search/filter state on return. Do not hide all useful details behind accordions or claim live availability without data.

Resource detail: Who it helps / What it offers / How to start / What to bring / Contact / Source and last checked. Explicit unknown states. No unsupported verification badges.

My next steps: one current action plus a readable checklist, editable priorities and saved progress. Avoid mandatory questionnaires before browsing; skipping must mean unknown (existing FC-03 work remains separate).

Partners: persistent sidebar for Overview / My submissions / Add resource / Coverage / Staff guide, plus Review queue only for authorized reviewers. Use a restrained version of the same palette, clear status tables, filters and explicit next actions. Youth plans and chat stay inaccessible to partners. Do not imply team-wide submissions are implemented; current ownership is individual.

## Next implementation checkpoint

Implement youth shell and home as one coherent visual slice, then directory/results, plan/saved, and partner workspace. Validate real desktop and mobile navigation, keyboard focus, contrast, loading/empty/error states and existing actions. Do not label untested screens complete. New features such as community events or staffed chat require separate product/content support and should not appear as working features in the redesign.

## Verification this session

Live Git remote fetched; sibling Git/readme state inspected; backend process working directory matches 2.0; frontend started on loopback 5173; homepage visibly rendered in browser. No application code edited and no application regression suite rerun. Research does not certify external template accessibility or backend readiness.
