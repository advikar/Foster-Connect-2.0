-- Fostering Wishes (Alamo, CA; EIN 88-3935030), added 2026-09-20 from fosteringwishes.org/what-we-do
-- and /our-partners. Web research only, not confirmed by phone. Apply to Turso with:
--   turso db shell foster-connect < data/updates/2026-09-20-fostering-wishes.sql
INSERT INTO resources (title, organization, description, category, county, service_area, eligibility, age_min, age_max, cost, application_steps, what_to_bring, website, phone, address, hours, languages, accessibility, delivery_mode, urgency_level, is_crisis, source_url, verified_at, verified_by, status, tags, field_provenance, kind, fields_na, recheck_at)
VALUES
('Fostering Wishes Trade School Scholarship', 'Fostering Wishes',
 'Money for trade school for transition-age and former foster youth. Fostering Wishes says the scholarship covers tuition, tools, uniforms, books, safety equipment, and certification or licensing fees. Participants are asked to commit to giving back after completing their program. Fostering Wishes is a volunteer-run nonprofit in Alamo that works with foster family agencies in Contra Costa County; ask whether you qualify if you are in another county.',
 'Scholarships', 'Contra Costa', 'Contra Costa County (through partner foster family agencies); ask about other counties',
 'Transition-age and former foster youth planning to attend a trade or vocational program. Age limits and county rules are not published — ask.',
 NULL, NULL, 'Free to apply. Amounts are not published; ask what the scholarship covers for your program.',
 'Email info@fosteringwishes.org, say which trade program you are starting and when, and ask how to apply. If you have a caseworker or ILP coordinator, ask them to contact Fostering Wishes with you.',
 'Program name, start date and a cost estimate (tuition, tools, fees)',
 'https://www.fosteringwishes.org/what-we-do', NULL, NULL, NULL, NULL, NULL, 'Remote', 'Standard', 0,
 'https://www.fosteringwishes.org/what-we-do', '2026-09-20', 'Foster Guide research (web)', 'verified',
 'scholarship,trade school,vocational,tools,certification,contra costa,former foster youth,transition-age',
 '{"eligibility":"extracted","cost":"unconfirmed","hours":"not-applicable","ages":"not-published","phone":"not-listed"}', 'service', 'phone,hours,address,languages,age', '2027-03-20'),
('Fostering Wishes Teen Empowerment Program', 'Fostering Wishes',
 'Pays for extracurricular costs so foster teens in high school can take part: sports fees, uniforms, and event tickets. Requests usually come through the teen''s foster family agency or caseworker. Fostering Wishes is a volunteer-run nonprofit in Alamo that works with foster family agencies in Contra Costa County.',
 'Community Support', 'Contra Costa', 'Contra Costa County (through partner foster family agencies)',
 'Foster teens in high school. Ask your caseworker or foster family agency to request it.',
 NULL, NULL, 'Free.',
 'Ask your caseworker or foster family agency to email info@fosteringwishes.org about the Teen Empowerment Program, or email them yourself with what the activity is and what it costs.',
 'The activity, the fee or item, and the deadline',
 'https://www.fosteringwishes.org/what-we-do', NULL, NULL, NULL, NULL, NULL, 'Remote', 'Standard', 0,
 'https://www.fosteringwishes.org/what-we-do', '2026-09-20', 'Foster Guide research (web)', 'verified',
 'teens,high school,sports fees,uniforms,extracurricular,contra costa,foster youth',
 '{"eligibility":"extracted","cost":"extracted","hours":"not-applicable","ages":"not-published","phone":"not-listed"}', 'service', 'phone,hours,address,languages,age', '2027-03-20');
INSERT INTO resources_fts(resources_fts) VALUES('rebuild');
