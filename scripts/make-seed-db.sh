#!/bin/sh
# Makes data/seed/foster_connect_seed.sql: a SQL dump of the local database with
# the resource directory only. Plans, saved items, submissions, reports,
# partner accounts, sessions and audit rows are emptied so no local test data
# reaches the hosted database. The Turso CLI (v1) only imports dumps, and FTS5
# shadow tables do not dump cleanly, so the search index is dropped from the
# copy and rebuilt from `resources` at the end of the dump. Upload with:
#   turso db create foster-connect --from-dump data/seed/foster_connect_seed.sql
set -eu
cd "$(dirname "$0")/.."
mkdir -p data/seed
db=data/seed/foster_connect_seed.db
out=data/seed/foster_connect_seed.sql
rm -f "$db" "$db-wal" "$db-shm" "$out"
sqlite3 data/foster_connect.db ".backup '$db'"
fts=$(sqlite3 "$db" "select sql from sqlite_master where name='resources_fts'")
sqlite3 "$db" <<'SQL'
DELETE FROM roadmap_tasks;
DELETE FROM roadmaps;
DELETE FROM saved_resources;
DELETE FROM resource_submissions;
DELETE FROM resource_reports;
DELETE FROM partner_sessions;
DELETE FROM partners;
DELETE FROM audit_log;
DROP TABLE resources_fts;
VACUUM;
SQL
{
  sqlite3 "$db" .dump | sed '/^COMMIT;$/d'
  echo "$fts;"
  echo "INSERT INTO resources_fts(resources_fts) VALUES('rebuild');"
  echo "COMMIT;"
} > "$out"
rm -f "$db"
echo "$out: $(grep -c '^INSERT INTO resources ' "$out") resource rows"
# Sanity check: the dump must load into a fresh SQLite database and search.
check=$(mktemp -d)/check.db
sqlite3 "$check" < "$out"
echo "check: $(sqlite3 "$check" "select count(*) from resources") resources, $(sqlite3 "$check" "select count(*) from resources_fts where resources_fts match 'housing'") match 'housing', integrity $(sqlite3 "$check" 'pragma integrity_check')"
rm -f "$check"
