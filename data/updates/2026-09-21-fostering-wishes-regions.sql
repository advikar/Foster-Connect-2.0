-- Fostering Wishes serves both counties (founder, 2026-09-21). County lists are comma-separated and matched per county.
UPDATE resources SET county = 'Alameda, Contra Costa', updated_at = CURRENT_TIMESTAMP WHERE id IN (426, 427) AND organization = 'Fostering Wishes';
INSERT INTO resources_fts(resources_fts) VALUES ('rebuild');
