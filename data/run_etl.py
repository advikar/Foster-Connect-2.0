import csv
import os
import sqlite3

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "raw", "synthetic_resources.csv")
DB_PATH = os.path.join(SCRIPT_DIR, "foster_connect.db")


def normalize_optional_int(value):
    return int(value) if value and value.strip() else None


def run_pipeline():
    with open(CSV_PATH, newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(
        """
        DROP TABLE IF EXISTS resource_reports;
        DROP TABLE IF EXISTS saved_resources;
        DROP TABLE IF EXISTS roadmap_tasks;
        DROP TABLE IF EXISTS roadmaps;
        DROP TABLE IF EXISTS resource_submissions;
        DROP TABLE IF EXISTS resources_fts;
        DROP TABLE IF EXISTS resources;
        CREATE TABLE resources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          organization TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          county TEXT NOT NULL,
          service_area TEXT NOT NULL,
          eligibility TEXT NOT NULL,
          age_min INTEGER,
          age_max INTEGER,
          cost TEXT NOT NULL,
          application_steps TEXT NOT NULL,
          what_to_bring TEXT NOT NULL,
          website TEXT,
          phone TEXT,
          address TEXT,
          hours TEXT,
          languages TEXT,
          accessibility TEXT,
          delivery_mode TEXT NOT NULL,
          urgency_level TEXT NOT NULL,
          is_crisis INTEGER NOT NULL DEFAULT 0,
          source_url TEXT NOT NULL,
          verified_at TEXT NOT NULL,
          verified_by TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'verified',
          tags TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE VIRTUAL TABLE resources_fts USING fts5(
          title, organization, description, category, county, service_area,
          eligibility, application_steps, tags, content='resources', content_rowid='id'
        );
        CREATE INDEX idx_resources_county ON resources(county);
        CREATE INDEX idx_resources_category ON resources(category);
        CREATE INDEX idx_resources_status ON resources(status);
        """
    )

    columns = list(rows[0].keys())
    placeholders = ",".join("?" for _ in columns)
    sql = f"INSERT INTO resources ({','.join(columns)}) VALUES ({placeholders})"
    for row in rows:
        row["age_min"] = normalize_optional_int(row["age_min"])
        row["age_max"] = normalize_optional_int(row["age_max"])
        row["is_crisis"] = int(row["is_crisis"])
        conn.execute(sql, [row[column] for column in columns])

    conn.execute(
        """
        INSERT INTO resources_fts(rowid, title, organization, description, category,
          county, service_area, eligibility, application_steps, tags)
        SELECT id, title, organization, description, category, county, service_area,
          eligibility, application_steps, tags FROM resources
        """
    )
    conn.commit()
    conn.close()
    print(f"Loaded {len(rows)} verified synthetic resources into {DB_PATH}")


if __name__ == "__main__":
    run_pipeline()
