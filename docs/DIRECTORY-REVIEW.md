# Directory review: Housing and Mental Health

Date: 2026-09-10. Method: every source URL for the 77 verified Housing and Mental
Health rows was fetched and read for a foster-youth or transition-age-youth
page, phone, hours, eligibility, cost, first step, and referral-only language.
Eight sites block automated fetching and were read through the in-app browser.

Nothing here has been written to the database. The full per-row sheet is
`data/review/housing-mental-health-review.csv`, with two blank columns for the
person who confirms each row by phone. Reading a website is not verification;
it is the prep work that makes a phone call take two minutes instead of ten.

## Headline numbers

| Result | Rows |
| --- | --- |
| Details found, update the entry | 40 |
| Flagged: no youth door, referral-only, or wrong audience | 17 |
| Already complete, keep (confirm by phone) | 11 |
| Duplicate of another row, merge | 5 |
| Not a youth resource, remove | 3 |
| Dead page, replace or remove | 1 |
| No foster-youth or TAY page on the site at all | 28 of 77 |

## Flags a person must decide on

Each of these is in the directory as if a young person could call and get in.
The site says otherwise.

**Referral-only. Youth cannot self-refer; the first step is somewhere else.**

- 94 Hope Solutions: "referred through Contra Costa County's coordinated entry process". First step is 211.
- 113 Crestwood Pleasant Hill: "Referrals come through county mental health clinics". First step is the Contra Costa Access Line 1-888-678-7277.
- 116 Fred Finch CC School-Based: "Referrals are initiated at each school site". First step is the school counsellor.
- 121 Youth Homes Family Pathways: "receives direct referrals from Contra Costa Behavioral Health Services". First step is the Access Line.
- 209 Fred Finch STAY: "receives all referral approvals and assignments from Alameda County Behavioral Health ACCESS". First step is ACCESS 1-800-491-9099, ask for STAY.
- 211 Fred Finch TBS and 208 In-Home Services: county-authorised Medi-Cal services, mostly for minors already in the system.
- 248 La Cheim: residential and school are placements, not walk-ins.

Recommendation: keep these but rewrite the first step to name the real door,
and add a visible "you get here through your worker or the county line" label.

**No youth program at all.**

- 98 SHELTER Inc, 177 Abode, 107 BACR, 112 CCYSB Wraparound, 238 BACS, 207 FERC (for family members, not youth), 399 StandUp for Kids (nearest chapter is San Jose; our counties not confirmed).

Recommendation: 107 and 399 should probably go. The rest stay only with honest
copy: "general adult or family service, no youth-specific entry point".

**Actively misleading today.**

- 185 HACA Section 8: waitlist closed since 2024. A youth following this entry hits a wall. Replace with a Foster Youth to Independence voucher entry whose first step is "ask your ILP coordinator to refer you".
- 99 Uplift Family Services THP: page is empty; the organisation merged into Pacific Clinics in 2022. Find the Pacific Clinics THP page or drop.

## Things the directory is missing

Found while reading, not currently in the database:

- **Calli House**, Richmond. Contra Costa's transition-age-youth shelter, ages 18-24, self-refer, 510-374-3134. Listed on the county's own shelter table. This is the single most useful housing entry for a Contra Costa youth with nowhere to sleep tonight, and it is absent.
- **Northern California Family Center**, unaccompanied minors, self-refer, 800-718-4357. Same table.
- **WestCoast EMPOWR** as its own entry: ages 16-24, Alameda Medi-Cal, has a self-referral button. Currently buried inside the WestCoast row.
- Local **FYI voucher** contacts at HACA, Oakland Housing Authority, and Contra Costa Housing Authority. Need a phone call each.

## Duplicates to merge

- 97/186 My First Place (two counties, fine to keep both, but share the text).
- 111/115 Fred Finch CCTAY.
- 209/210/212 Fred Finch STAY and Transitions.
- 182/184 Covenant House Oakland; make 184 the DreamCatcher minors entry if that is what it is.
- 343/344 FURS. 344's URL redirects to familyresponseca.org.
- 398/414 National Runaway Safeline.

## Remove

- 324 CoC roster: a spreadsheet of administrators.
- 326 JBAY housing: advocacy page, no service.
- 397 NAEH "how to get help": generic, national, duplicates 211 and the Runaway Safeline.

## Good finds worth copying verbatim into the entries

- 179 Alameda Housing Support for Youth: exact eligibility by age band and case status.
- 182/183 Covenant House Oakland: "You do not need a referral or an appointment", TAY drop-in Mon-Thu 12:30-4:00pm at 200 Harrison St.
- 95 MiCasa Concord: rent is one third of income, plus a monthly stipend.
- 110 First Hope: full eligibility list, "the first step is to call us".
- 117 NAMI CC TAY group: days and times, free, ages 16-26.
- 118 Rainbow Community Center: drop-in Mon-Fri 11-4, names LGBTQ youth in foster care.
- 217 Stars: "youth and/or their caretakers interested in our services should call".
- 413 NAMI Teen line: Mon-Fri 10am-10pm Eastern; DB currently blank.

## URL changes

- 203: acbhcs.org now redirects to health.alamedacountyca.gov/department/behavioral-health-department/
- 344: cal-furs.org now redirects to familyresponseca.org
- 93: gripcares.org/hours is a 404

## Limits of this pass

- Extraction used a model reading each page. Numbers and hours were copied, not dialled. The CSV's last two columns exist so a person records the call.
- Eight sites (cchealth.org x4, centrolegal, ferc, lacheim, nami) block scripted fetches; they were read in the browser and are as reliable as the others.
- "Not on site" for hours means the page did not show them, not that the service has none. Most will answer in one call.
- The other 324 rows in the directory have not been reviewed.

## Suggested next step

1. A person works down the CSV in order, calling each UPDATE and KEEP row, filling the last two columns. Housing first. About two afternoons.
2. Decisions on the 17 flags and 4 removals, recorded in the CSV `action` column.
3. Sonnet turns the confirmed CSV into an import: extend `data/build_resources.py` or write a small `data/apply_review.py` that upserts only rows with `human_verified_on` set, and adds the missing entries above.
4. Repeat for Employment, Education, and Financial Support.
