#!/bin/sh
# Makes data/seed/foster_connect_seed.db: a copy of the local database with the
# resource directory only. Plans, saved items, submissions, reports, partner
# accounts, sessions and audit rows are emptied so no local test data reaches
# the hosted database. Upload it with:
#   turso db create foster-connect --from-file data/seed/foster_connect_seed.db
set -eu
cd "$(dirname "$0")/.."
mkdir -p data/seed
out=data/seed/foster_connect_seed.db
rm -f "$out"
sqlite3 data/foster_connect.db ".backup '$out'"
sqlite3 "$out" <<'SQL'
DELETE FROM roadmap_tasks;
DELETE FROM roadmaps;
DELETE FROM saved_resources;
DELETE FROM resource_submissions;
DELETE FROM resource_reports;
DELETE FROM partner_sessions;
DELETE FROM partners;
DELETE FROM audit_log;

VACUUM;
-- Turso imports expect WAL mode; closing the connection folds the WAL back in.
PRAGMA journal_mode = WAL;
SQL
echo "$out: $(sqlite3 "$out" 'select count(*) from resources') resources, integrity $(sqlite3 "$out" 'pragma integrity_check')"
