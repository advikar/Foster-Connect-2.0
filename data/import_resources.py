"""
Load resources_built.csv into the database.

This replaces the old run_etl.py, which began with DROP TABLE on everything
including `roadmaps` and `roadmap_tasks`. Running that once against a live
database would have deleted every young person's saved plan.

This script:
  * never drops anything,
  * upserts on (title, website) so re-running is safe and idempotent,
  * validates every row and refuses the whole import if any row is unsafe,
  * keeps the FTS index in step, since it has no triggers,
  * leaves plans, saved resources, and submissions untouched.

Usage:
    python3 data/import_resources.py --dry-run     # validate, change nothing
    python3 data/import_resources.py               # import
    python3 data/import_resources.py --drop-demo   # also remove the .invalid demo rows
"""

import csv
import os
import re
import sqlite3
import sys
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "resources_built.csv")
DB_PATH = os.environ.get("FC_DB", os.path.join(SCRIPT_DIR, "foster_connect.db"))

REQUIRED = ["title", "organization", "description", "category", "county",
            "eligibility", "cost", "application_steps", "website", "source_url"]

VALID_URGENCY = {"Emergency", "Urgent", "Standard"}

# The demo catalogue used reserved domains and 555 numbers so it could never be
# mistaken for something real. Those must never reach a young person, so the
# importer refuses rather than warning.
FAKE_DOMAIN = re.compile(r"\.invalid\b|example\.(com|org|net)", re.I)
FAKE_PHONE = re.compile(r"\b\d{3}[\s.-]?555[\s.-]?\d{4}\b")


def validate(rows):
    """Returns (errors, warnings). Errors block the import; warnings do not."""
    errors, warnings = [], []
    seen = {}

    for index, row in enumerate(rows, start=2):  # row 1 is the header
        where = f"row {index} ({row.get('title','?')[:40]})"

        for field in REQUIRED:
            if not (row.get(field) or "").strip():
                errors.append(f"{where}: missing {field}")

        website = row.get("website", "")
        if website:
            parsed = urlparse(website if website.startswith("http") else f"https://{website}")
            if not parsed.netloc:
                errors.append(f"{where}: website is not a URL: {website!r}")
            elif FAKE_DOMAIN.search(parsed.netloc):
                errors.append(f"{where}: placeholder domain {parsed.netloc}")

        phone = row.get("phone", "")
        if phone and FAKE_PHONE.search(phone):
            errors.append(f"{where}: 555 placeholder phone {phone!r}")

        if row.get("urgency_level") not in VALID_URGENCY:
            errors.append(f"{where}: urgency_level {row.get('urgency_level')!r}")

        # A crisis-flagged row is what someone gets when they say they are not
        # safe. It must have a way to reach a human and must claim to be open.
        if row.get("is_crisis") == "1":
            if not phone:
                errors.append(f"{where}: flagged is_crisis with no phone or text number")
            if "24" not in (row.get("hours") or "") and "hours vary" not in (row.get("hours") or ""):
                warnings.append(f"{where}: is_crisis but hours are {row.get('hours')!r}")

        for field in ("age_min", "age_max"):
            value = (row.get(field) or "").strip()
            if value and not value.isdigit():
                errors.append(f"{where}: {field} is not a number: {value!r}")

        key = (row["title"].strip().lower(), row["website"].strip().lower())
        if key in seen:
            errors.append(f"{where}: duplicate of row {seen[key]}")
        seen[key] = index

        if (row.get("eligibility") or "").startswith("Not confirmed"):
            warnings.append(f"{where}: eligibility unconfirmed")

    return errors, warnings


COLUMNS = [
    "title", "organization", "description", "category", "county", "service_area",
    "eligibility", "age_min", "age_max", "cost", "application_steps", "what_to_bring",
    "website", "phone", "address", "hours", "languages", "accessibility",
    "delivery_mode", "urgency_level", "is_crisis", "source_url", "verified_at",
    "verified_by", "status", "tags",
]


def ensure_schema(conn):
    """Adds the provenance column if it is missing. Never drops anything."""
    existing = {row[1] for row in conn.execute("PRAGMA table_info(resources)")}
    if not existing:
        raise SystemExit(
            "No `resources` table found. Create the database first with run_etl.py "
            "(on a fresh file) or point FC_DB at the right database."
        )
    if "field_provenance" not in existing:
        conn.execute("ALTER TABLE resources ADD COLUMN field_provenance TEXT")
        print("added column resources.field_provenance")


def main():
    dry_run = "--dry-run" in sys.argv
    drop_demo = "--drop-demo" in sys.argv

    with open(CSV_PATH, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    print(f"read {len(rows)} rows from {os.path.basename(CSV_PATH)}\n")

    errors, warnings = validate(rows)
    if warnings:
        print(f"{len(warnings)} warnings (import continues):")
        for warning in warnings[:6]:
            print(f"   {warning}")
        if len(warnings) > 6:
            print(f"   ... and {len(warnings) - 6} more")
        print()
    if errors:
        print(f"{len(errors)} ERRORS — nothing was imported:")
        for error in errors[:25]:
            print(f"   {error}")
        if len(errors) > 25:
            print(f"   ... and {len(errors) - 25} more")
        raise SystemExit(1)
    print("validation passed\n")

    if dry_run:
        print("dry run — database untouched")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    ensure_schema(conn)

    if drop_demo:
        # Retire rather than delete. Demo rows can already be referenced by a
        # young person's saved plan or bookmarks, and a hard DELETE fails on the
        # foreign key (or, worse, would orphan their data). Retired rows stop
        # appearing everywhere because every query filters status='verified'.
        demo = conn.execute(
            "SELECT id FROM resources WHERE website LIKE '%.invalid%' OR phone LIKE '%555-01%'"
        ).fetchall()
        for (resource_id,) in demo:
            conn.execute("UPDATE resources SET status='retired' WHERE id=?", (resource_id,))
        print(f"retired {len(demo)} demo rows (kept so existing plans do not break)")

    inserted = updated = 0
    for row in rows:
        row = {key: (value if value != "" else None) for key, value in row.items()}
        existing = conn.execute(
            "SELECT id FROM resources WHERE lower(title)=lower(?) AND lower(website)=lower(?)",
            (row["title"], row["website"]),
        ).fetchone()

        values = [row.get(column) for column in COLUMNS]
        if existing:
            assignments = ", ".join(f"{column}=?" for column in COLUMNS)
            conn.execute(
                f"UPDATE resources SET {assignments}, field_provenance=?, "
                f"updated_at=CURRENT_TIMESTAMP WHERE id=?",
                values + [row.get("field_provenance"), existing[0]],
            )
            updated += 1
        else:
            placeholders = ",".join("?" for _ in COLUMNS)
            conn.execute(
                f"INSERT INTO resources ({','.join(COLUMNS)}, field_provenance) "
                f"VALUES ({placeholders}, ?)",
                values + [row.get("field_provenance")],
            )
            inserted += 1

    # The FTS index is external-content with no triggers. A per-row DELETE
    # corrupts it (fts5 needs the original values to unindex), so the whole
    # index is rebuilt once from the content table instead. Cheap at this size.
    conn.execute("INSERT INTO resources_fts(resources_fts) VALUES('rebuild')")
    conn.commit()

    total = conn.execute("SELECT COUNT(*) FROM resources WHERE status='verified'").fetchone()[0]
    crisis = conn.execute("SELECT COUNT(*) FROM resources WHERE is_crisis=1 AND status='verified'").fetchone()[0]
    plans = conn.execute("SELECT COUNT(*) FROM roadmaps").fetchone()[0]
    conn.close()

    print(f"inserted {inserted}, updated {updated}")
    print(f"database now holds {total} verified resources, {crisis} flagged as crisis")
    print(f"{plans} saved plans left untouched")


if __name__ == "__main__":
    main()
