-- Founder review (Fostering Wishes, 2026-09-24): listing wording in the founder's words,
-- and the Food Bank of Contra Costa and Solano, which was missing.
-- Apply with: turso db shell foster-connect < data/updates/2026-09-24-founder-review.sql

UPDATE resources SET
  description = 'Scholarships for trade school so current and former foster youth can take the next step toward a career. Fostering Wishes pays for tuition, tools, uniforms, books, safety equipment, and certification or licensing fees, so the cost of a program does not stand between a young person and further opportunity. Scholars are asked to give back once they finish. Fostering Wishes is a volunteer-run nonprofit that works with foster family agencies in Alameda and Contra Costa counties.',
  eligibility = 'Current and former foster youth starting a trade or vocational program. Age limits are not published; ask.',
  cost = 'Free to apply. Ask what the scholarship covers for your program.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 426 AND organization = 'Fostering Wishes';

UPDATE resources SET
  description = 'Pays for the activities that help foster teens in high school belong and grow: sports fees, uniforms, club dues, and event tickets. Requests usually come through the teen''s foster family agency or caseworker. Fostering Wishes is a volunteer-run nonprofit that works with foster family agencies in Alameda and Contra Costa counties.',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 427 AND organization = 'Fostering Wishes';

INSERT INTO resources (title, organization, description, category, county, service_area, eligibility, age_min, age_max, cost, application_steps, what_to_bring, website, phone, address, hours, languages, accessibility, delivery_mode, urgency_level, is_crisis, source_url, verified_at, verified_by, status, tags, field_provenance, kind, fields_na, recheck_at)
VALUES
('Food Bank of Contra Costa and Solano', 'Food Bank of Contra Costa and Solano',
 'Free groceries and produce through food pantries, mobile pantries, and community distributions across Contra Costa County. Call the food assistance line or use the find-food page to get the nearest pickup and its hours. Staff can also explain CalFresh and help you apply.',
 'Food Assistance', 'Contra Costa', 'Contra Costa and Solano counties',
 'Open to anyone who needs food. Each pantry sets its own pickup limits; ask when you call.',
 NULL, NULL, 'Free.',
 'Call 1-855-309-3663 (855-309-FOOD) and ask for the nearest food distribution and its hours, or look up your city on the find-food page below.',
 'Nothing is required at most pantries. Bring a bag if you can.',
 'https://www.foodbankccs.org/find-food/foodbycity/', '1-855-309-3663', '4010 Nelson Ave, Concord, CA 94520', NULL, NULL, NULL, 'Phone or text', 'Standard', 0,
 'https://www.foodbankccs.org/get-help/', '2026-09-24', 'Foster Guide research (web)', 'verified',
 'food bank,pantry,groceries,CalFresh,contra costa,solano,emergency food',
 '{"eligibility":"extracted","cost":"extracted","hours":"varies-by-site","ages":"not-applicable","phone":"extracted"}', 'service', 'hours,languages,age', '2027-03-24');
INSERT INTO resources_fts(resources_fts) VALUES('rebuild');
