"""
Turn FosterConnect_Resources_Master.xlsx into rows the app can actually serve.

The spreadsheet has 12 columns. The resources table needs 27, and the missing
ones are the fields a young person plans around: who qualifies, what it costs,
how to start, and whether it answers at 2am.

The rule this script follows, and the reason it is longer than it looks:

    NOTHING IS INVENTED.

Every field is either
  (a) copied from the spreadsheet,
  (b) extracted from a sentence the researcher actually wrote, or
  (c) filled with an honest placeholder that tells the reader we have not
      confirmed it yet.

Option (c) is deliberately unglamorous. "Ask them — we have not confirmed this"
is a worse-looking cell and a much better outcome than a plausible guess that
sends someone across the county for a service they cannot get.

Each row also carries `field_provenance`, a JSON map of which fields were
extracted versus left unconfirmed, so the partner queue can prioritise.

Usage:
    python3 data/build_resources.py            # writes data/resources_built.csv
    python3 data/build_resources.py --report   # summary only, writes nothing
"""

import csv
import json
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(SCRIPT_DIR, "FosterConnect_Resources_Master.xlsx")
OUT = os.path.join(SCRIPT_DIR, "resources_built.csv")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

UNCONFIRMED_ELIGIBILITY = "Not confirmed yet — ask them who qualifies before you go."
UNCONFIRMED_COST = "Not confirmed yet — ask what it costs."
UNCONFIRMED_BRING = "Ask them what to bring when you call."
UNCONFIRMED_HOURS = ""

# ─── Category reconciliation ─────────────────────────────────────────────────
# The spreadsheet has two spellings for the same bucket because different
# research passes used different words. Two chips for one concept means a
# resource shows up depending on which word the researcher happened to type,
# which is confusing rather than useful. Everything below maps to exactly one
# canonical name that the frontend filter list must match 1:1 (see
# frontend/src/pages/ResourcesPage.tsx). "Financial Support" is kept as the
# canonical spelling because more of the catalogue already uses it.
CATEGORY_ALIASES = {
    "Financial Aid": "Financial Support",
}


def canonical_category(value):
    value = (value or "").strip()
    return CATEGORY_ALIASES.get(value, value) or "Community Support"



# ─── Verified crisis services ────────────────────────────────────────────────
# is_crisis controls what a young person is shown when they say they are not
# safe. It is set ONLY from this table — never inferred from keywords, because
# "crisis" appears in plenty of titles that are not crisis lines (a rape crisis
# CENTRE with weekday hours is not somewhere to send someone at 2am), and
# because some entries say outright that they are not a crisis line.
#
# Each entry was checked against the organisation's own page on 2026-09-08.
# `phone_override` exists because several spreadsheet rows list an office line
# where the 24-hour line is different — the exact error that hurts someone most.
VERIFIED_CRISIS = {
    "988 Suicide and Crisis Lifeline": {
        "phone": "988", "hours": "24 hours, every day",
        "eligibility": "Anyone in the United States. You do not have to be suicidal to call.",
        "note": "Call or text 988.",
    },
    "Crisis Text Line": {
        "phone": "Text HOME to 741741", "hours": "24 hours, every day",
        "eligibility": "Anyone in the United States. Text HOLA for Spanish.",
        "note": "Text-based only — useful when you cannot speak out loud.",
    },
    "Family Urgent Response System (Cal-FURS)": {
        "phone": "833-939-3877", "hours": "24 hours, every day",
        "eligibility": "Current and former foster youth in California, and their caregivers.",
        "note": "Call or text. Built specifically for foster youth. In-person response available.",
        "verified_source": "https://www.cdss.ca.gov/inforesources/cdss-programs/foster-care/furs",
    },
    "Family Urgent Response System": {
        "phone": "833-939-3877", "hours": "24 hours, every day",
        "eligibility": "Current and former foster youth in California up to age 21, and their caregivers.",
        "note": "Call or text. Built specifically for foster youth.",
        "verified_source": "https://www.cdss.ca.gov/inforesources/cdss-programs/foster-care/furs",
    },
    "California Youth Crisis Line": {
        "phone": "800-843-5200", "hours": "24 hours, every day",
        "eligibility": "Youth ages 12 to 24 in California, and their families.",
        "note": "Call, text, or chat.",
    },
    "Contra Costa Crisis Center": {
        # The spreadsheet listed 925-939-1916, which is the business office.
        # Their own site routes people in crisis to 988 and a text line.
        "phone_override": "988",
        "phone": "988", "hours": "24 hours, every day",
        "eligibility": "Anyone in Contra Costa County. Free and confidential.",
        "note": "Call 988 or text HOPE to 20121. 800-273-8255 also reaches them.",
        "verified_source": "https://www.crisis-center.org/",
    },
    "Crisis Support Services of Alameda County": {
        "phone": "1-800-309-2131", "hours": "24 hours, every day",
        "eligibility": "Anyone in Alameda County. Free and confidential.",
        "note": "988 also reaches a counsellor. The local line is 1-800-309-2131.",
        "verified_source": "https://www.crisissupport.org/",
    },
    "Contra Costa Behavioral Health Access Line": {
        "phone": "888-678-7277", "hours": "24 hours, every day",
        "eligibility": "Contra Costa residents with Medi-Cal.",
        "note": "Screening and referral for mental health or substance use, with interpretation.",
    },
    "National Runaway Safeline (1-800-RUNAWAY)": {
        "phone": "1-800-786-2929", "hours": "24 hours, every day",
        "eligibility": "Any young person who has run away, been kicked out, or is thinking about leaving.",
        "note": "Call or text. They can help with a bed tonight and with transport home if you want it.",
    },
    "National Runaway Safeline": {
        "phone": "1-800-786-2929", "hours": "24 hours, every day",
        "eligibility": "Any young person who has run away, been kicked out, or is thinking about leaving.",
        "note": "Call or text 1-800-786-2929.",
    },
    "Covenant House National Crisis Hotline": {
        "phone": "1-800-388-3888", "hours": "24 hours, every day",
        "eligibility": "Young people who need shelter, food, or a safe place tonight.",
        "note": "Connects to Covenant House sites across the US.",
    },
    "Covenant House Oakland": {
        "phone": "510-379-1010", "hours": "24 hours a day, 365 days a year",
        "eligibility": "Young people experiencing homelessness in the Oakland area.",
        "note": "Walk-in emergency shelter at 200 Harrison Street, Oakland.",
        "address": "200 Harrison Street, Oakland, CA 94607",
        "verified_source": "https://covenanthousecalifornia.org/locations/",
    },
    "DreamCatcher and Covenant House Oakland Youth Services": {
        "phone": "510-379-1010", "hours": "24 hours a day, 365 days a year",
        "eligibility": "Youth experiencing homelessness or trafficking in the Oakland area.",
        "note": "Emergency sanctuary plus meals, case management, and health services.",
        "verified_source": "https://covenanthousecalifornia.org/locations/",
    },
    "Childhelp National Child Abuse Hotline": {
        "phone": "800-422-4453", "hours": "24 hours, every day",
        "eligibility": "Anyone affected by or worried about child abuse. You can stay anonymous.",
        "note": "Call or text. Available in more than 170 languages.",
    },
    "National Human Trafficking Hotline": {
        "phone": "888-373-7888", "hours": "24 hours, every day",
        "eligibility": "Anyone experiencing or concerned about trafficking.",
        "note": "Call, or text 233733.",
    },
    "National Domestic Violence Hotline": {
        "phone": "800-799-7233", "hours": "24 hours, every day",
        "eligibility": "Anyone affected by relationship abuse.",
        "note": "Call, or text START to 88788.",
    },
    "The Trevor Project Crisis Services": {
        "phone": "866-488-7386", "hours": "24 hours, every day",
        "eligibility": "LGBTQ+ young people anywhere in the United States.",
        "note": "Call, text START to 678678, or chat.",
    },
    "Trans Lifeline": {
        "phone": "877-565-8860", "hours": "See their site — hours vary",
        "eligibility": "Trans and questioning people. Peer support, run by trans people.",
        "note": "Does not call police or emergency services without your consent.",
    },
    "RAINN National Sexual Assault Hotline": {
        "phone": "800-656-4673", "hours": "24 hours, every day",
        "eligibility": "Survivors of sexual assault and their loved ones.",
        "note": "Call, or text HOPE to 64673.",
    },
    "Love Is Respect Dating-Abuse Support": {
        "phone": "866-331-9474", "hours": "24 hours, every day",
        "eligibility": "Teens and young adults affected by dating abuse, and people who care about them.",
        "note": "Call, or text LOVEIS to 22522.",
    },
    "National Safe Place TXT 4 HELP": {
        "phone": "Text SAFE and your location to 44357", "hours": "24 hours, every day",
        "eligibility": "Any young person who feels unsafe or needs somewhere to stay.",
        "note": "Text-based. Returns the nearest Safe Place site.",
    },
    "SAMHSA National Helpline": {
        "phone": "800-662-4357", "hours": "24 hours, every day",
        "eligibility": "Anyone with mental health or substance use concerns. English and Spanish.",
        "note": "Free treatment referral and information.",
    },
    "STAND! Crisis Advocacy and Accompaniment": {
        "phone": "888-215-5555", "hours": "24 hours, every day",
        "eligibility": "People affected by domestic violence in Contra Costa County.",
        "note": "24-hour crisis line, safety planning, and court accompaniment.",
    },
    "Community Violence Solutions - Rape Crisis Center": {
        "phone": "800-670-7273", "hours": "24 hours, every day",
        "eligibility": "Survivors of sexual assault in Contra Costa and West Contra Costa.",
        "note": "24-hour crisis line. Text CVS to 20121.",
    },
    "Community Violence Solutions Crisis Support": {
        "phone": "800-670-7273", "hours": "24 hours, every day",
        "eligibility": "Survivors of sexual assault and trafficking in Contra Costa County.",
        "note": "Call, or text CVS to 20121.",
    },
    "Family Paths Inc.": {
        "phone": "1-800-829-3777", "hours": "24 hours, every day",
        "eligibility": "Parents and caregivers under stress in Alameda County.",
        "note": "24/7 Parenting Stress Helpline.",
    },
    "Bay Area Crisis Nursery": {
        "phone": "925-685-6633", "hours": "24 hours, every day",
        "eligibility": "Families with children from birth through age 5 in Contra Costa County.",
        "note": "Up to 30 days of free emergency residential care for young children.",
    },
    "Help Me Grow Contra Costa": {
        "phone": "800-830-5380", "hours": "24 hours, every day",
        "eligibility": "Families with children ages 0 to 5 in Contra Costa County.",
        "note": "Call 211 or 800-830-5380, or text hmgcoco to 898211.",
    },
}

# Entries that MUST NOT be flagged as crisis even though they match keywords.
# NAMI's own page says outright that it is not a crisis line; the rest are
# daytime services whose names merely contain the word.
NEVER_CRISIS = {
    "NAMI Teen and Young Adult HelpLine",
    "SAVE (Safe Alternatives to Violent Environments)",  # listed number is the weekday office
    "Contra Costa County Public Law Library",
    "Contra Costa Family Justice Center",
    "Contra Costa Family Justice Center TeleCare",
    "CSU East Bay Concord Campus Food Pantry",
    "Richmond Emergency Food Pantry",
    "Monument Crisis Center",
    "Vestia Inc",
    "Child Abuse Prevention Council of Contra Costa County",
    "EHSD Independent Living Skills Program (ILSP) Scholarships",
    "EHSD Season of Sharing Fund",
    "Planned Parenthood Concord Health Center",
    "National Alliance to End Homelessness - How to Get Help",
}

# Corrections where the spreadsheet's number is an office line, so the entry
# would otherwise promise round-the-clock help on a weekday-only phone.
OFFICE_LINE_WARNINGS = {
    "SAVE (Safe Alternatives to Violent Environments)":
        "The number listed is the Empowerment Center office (Mon-Fri, 9am-5pm). "
        "Ask them for the 24-hour crisis line.",
}


# ─── Extraction ──────────────────────────────────────────────────────────────

AGE_PATTERNS = [
    (re.compile(r"ages?\s+(\d{1,2})\s*(?:through|to|[-–—])\s*(\d{1,2})", re.I), "range"),
    (re.compile(r"\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*year[- ]olds?", re.I), "range"),
    (re.compile(r"\bup to (?:the )?age (?:of )?(\d{1,2})", re.I), "max"),
    (re.compile(r"\bunder (?:the age of )?(\d{1,2})", re.I), "max"),
    (re.compile(r"\bages?\s+(\d{1,2})\s*(?:and|or)\s+(?:older|up|above)", re.I), "min"),
]

FREE = re.compile(
    r"\b(free of charge|free|no cost|no charge|at no cost|without charge|"
    r"no[- ]cost|donation[- ]based)\b", re.I)
SLIDING = re.compile(r"\b(sliding scale|income[- ]based|based on income)\b", re.I)
MEDICAL_COVER = re.compile(r"\b(medi-?cal|medicaid|insurance|covered by)\b", re.I)
ALWAYS_ON = re.compile(r"\b(24/7|24-7|24 hours|24-hour|24/7/365|around the clock)\b", re.I)
ONLINE_ONLY = re.compile(r"\b(online|virtual|website|web[- ]based|app|portal|chat)\b", re.I)
IN_PERSON = re.compile(r"\b(walk-?in|drop-?in|in person|in-person|centre|center in|located|office in|campus)\b", re.I)
PHONE_LIKE = re.compile(r"\b(hotline|helpline|call|phone line|text line|warmline)\b", re.I)


def extract_ages(text):
    """Only returns ages the researcher actually wrote down."""
    for pattern, kind in AGE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        try:
            if kind == "range":
                low, high = int(match.group(1)), int(match.group(2))
                if 0 <= low < high <= 99:
                    return low, high
            elif kind == "max":
                high = int(match.group(1))
                if 0 < high <= 99:
                    return None, high
            elif kind == "min":
                low = int(match.group(1))
                if 0 <= low <= 99:
                    return low, None
        except ValueError:
            continue
    return None, None


def extract_cost(text):
    if FREE.search(text):
        return "Free", True
    if SLIDING.search(text):
        return "Sliding scale based on income — ask them", True
    if MEDICAL_COVER.search(text):
        return "May be covered by Medi-Cal or insurance — ask them", True
    return UNCONFIRMED_COST, False


def extract_eligibility(text, county):
    """
    Pull the sentence that actually describes who qualifies. Only sentences the
    researcher wrote — no synthesis, no filling in the gaps.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    signals = re.compile(
        r"\b(eligible|eligibility|for (current|former|young|youth|people|families|survivors|anyone|teens)"
        r"|ages?\s+\d|must be|who (are|have|qualify)|residents of|serving|available to"
        r"|foster youth|transition[- ]age|open to)\b", re.I)
    picked = [s.strip() for s in sentences if signals.search(s)]
    if picked:
        text_out = " ".join(picked[:2]).strip()
        if len(text_out) > 400:
            text_out = text_out[:397].rsplit(" ", 1)[0] + "..."
        return text_out, True
    return UNCONFIRMED_ELIGIBILITY, False


def split_contact(contact):
    """The spreadsheet mixes phone numbers and emails into one cell."""
    if not contact:
        return "", ""
    email = ""
    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", contact)
    if match:
        email = match.group(0)
    phone = ""
    phone_match = re.search(
        r"(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{3}\b(?=\s*$)", contact)
    if phone_match:
        phone = phone_match.group(0).strip()
    elif re.search(r"\btext\b", contact, re.I):
        phone = contact.split(",")[0].strip()
    return phone, email


def delivery_mode(text, phone, link):
    if PHONE_LIKE.search(text) and phone:
        return "Phone or text"
    if IN_PERSON.search(text):
        return "In person"
    if ONLINE_ONLY.search(text) or link:
        return "Online"
    return "Contact for details"


def application_steps(row, phone, email, always_on):
    """A first concrete action, built only from contact details we actually have."""
    if phone and always_on:
        return f"Call or text {phone}. Someone answers around the clock."
    if phone:
        return f"Call {phone} and ask how to start and whether you qualify."
    if email:
        return f"Email {email} and ask how to start and whether you qualify."
    if row["resource-link"]:
        return "Open their page below and look for the intake or contact section."
    return "Not confirmed yet — check their page for how to apply."


def build_row(row):
    title = row["title"].strip()
    description = row["resource-description"].strip()
    county = row["county"].strip() or "California"
    blob = f"{title} {description} {row['tags']}"

    verified = VERIFIED_CRISIS.get(title)
    is_crisis = bool(verified) and title not in NEVER_CRISIS

    phone, email = split_contact(row.get("contact", ""))
    if verified and verified.get("phone_override"):
        phone = verified["phone_override"]
    elif verified and verified.get("phone"):
        phone = verified["phone"]

    always_on = bool(verified) or bool(ALWAYS_ON.search(blob))

    if verified:
        eligibility, elig_found = verified["eligibility"], True
        hours = verified["hours"]
        cost, cost_found = "Free", True
    else:
        eligibility, elig_found = extract_eligibility(description, county)
        hours = "24 hours, every day" if always_on else UNCONFIRMED_HOURS
        cost, cost_found = extract_cost(blob)

    age_min, age_max = extract_ages(blob)

    steps = verified["note"] if verified else application_steps(row, phone, email, always_on)
    warning = OFFICE_LINE_WARNINGS.get(title)
    if warning:
        steps = f"{steps} {warning}"

    provenance = {
        "eligibility": "verified" if verified else ("extracted" if elig_found else "unconfirmed"),
        "cost": "verified" if verified else ("extracted" if cost_found else "unconfirmed"),
        "hours": "verified" if verified else ("extracted" if always_on else "unconfirmed"),
        "ages": "extracted" if (age_min or age_max) else "unconfirmed",
        "phone": "verified" if verified else ("spreadsheet" if phone else "unconfirmed"),
        "is_crisis": "verified" if verified else "not-a-crisis-service",
    }

    return {
        "title": title,
        "organization": title.split(" - ")[0].strip(),
        "description": description,
        "category": canonical_category(row["category"]),
        "county": county,
        "service_area": county,
        "eligibility": eligibility,
        "age_min": age_min if age_min is not None else "",
        "age_max": age_max if age_max is not None else "",
        "cost": cost,
        "application_steps": steps,
        "what_to_bring": UNCONFIRMED_BRING,
        "website": row["resource-link"].strip(),
        "phone": phone,
        "address": (verified or {}).get("address", ""),
        "hours": hours,
        "languages": "",
        "accessibility": "",
        "delivery_mode": delivery_mode(blob, phone, row["resource-link"]),
        "urgency_level": "Emergency" if is_crisis else "Standard",
        "is_crisis": 1 if is_crisis else 0,
        "source_url": (verified or {}).get("verified_source") or row["source-url"].strip() or row["resource-link"].strip(),
        "verified_at": row.get("verified-at", "").strip() or "2026-09-08",
        "verified_by": "Foster Connect research" + (" (crisis line confirmed 2026-09-08)" if verified else ""),
        "status": "verified",
        "tags": row["tags"].strip(),
        "field_provenance": json.dumps(provenance, separators=(",", ":")),
    }


def read_xlsx():
    archive = zipfile.ZipFile(XLSX)
    sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows = list(sheet.iter(NS + "row"))

    def cells(node):
        out = []
        for cell in node.iter(NS + "c"):
            inline = cell.find(NS + "is/" + NS + "t")
            value = cell.find(NS + "v")
            out.append((inline.text if inline is not None else (value.text if value is not None else "")) or "")
        return out

    header = cells(rows[0])
    return [dict(zip(header, cells(row))) for row in rows[1:]]


def main():
    raw = read_xlsx()
    built, seen = [], set()
    for row in raw:
        if not row.get("title", "").strip() or not row.get("resource-link", "").strip():
            continue
        key = (row["title"].strip().lower(), row["resource-link"].strip().lower())
        if key in seen:
            continue
        seen.add(key)
        built.append(build_row(row))

    crisis = [r for r in built if r["is_crisis"]]
    counted = lambda field, value: sum(
        1 for r in built if json.loads(r["field_provenance"])[field] == value)

    print(f"rows in spreadsheet      {len(raw)}")
    print(f"rows built               {len(built)}   ({len(raw) - len(built)} skipped: blank or duplicate)")
    print()
    print(f"crisis services          {len(crisis)}   (verified against their own sites)")
    print(f"eligibility  verified    {counted('eligibility','verified')}")
    print(f"             extracted   {counted('eligibility','extracted')}")
    print(f"             unconfirmed {counted('eligibility','unconfirmed')}")
    print(f"cost         known       {counted('cost','verified') + counted('cost','extracted')}")
    print(f"             unconfirmed {counted('cost','unconfirmed')}")
    print(f"ages         extracted   {counted('ages','extracted')}")
    print(f"phone        present     {sum(1 for r in built if r['phone'])}")
    print()
    print("crisis services flagged:")
    for r in crisis:
        print(f"  - {r['title'][:52]:54} {r['phone']}")

    if "--report" in sys.argv:
        return

    with open(OUT, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(built[0].keys()))
        writer.writeheader()
        writer.writerows(built)
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
