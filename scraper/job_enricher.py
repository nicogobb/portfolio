#!/usr/bin/env python3
"""
Job Enricher — fetches full descriptions for jobs that have none.

Runs after job_hunter.py. Only processes jobs missing a description.
Rate-limited to avoid getting blocked.

Supported sources:
  LinkedIn     — LinkedIn guest job-posting API (no auth required)
  LandingJobs  — individual job page scrape
  WeWorkRemotely / RemoteOK / others — generic article scrape fallback

Usage:
    python3 scraper/job_enricher.py              # enrich all jobs without description
    python3 scraper/job_enricher.py --max 30     # process at most 30 jobs (CI-friendly)
    python3 scraper/job_enricher.py --source LinkedIn --max 50
"""

import argparse
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

JOBS_FILE     = Path(__file__).parent.parent / "jobs.json"
REQUEST_DELAY = 1.5    # seconds between requests
MAX_DESC_CHARS = 2500  # more context than job_hunter's 800 — better for cover letters
TIMEOUT        = 15

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

# ── Source-specific fetchers ──────────────────────────────────────────────────

def fetch_linkedin(job: dict):
    """
    LinkedIn guest API: linkedin.com/jobs-guest/jobs/api/jobPosting/{id}
    No auth required. Returns HTML with the full job description.
    """
    # Extract numeric ID from URN (urn:li:jobPosting:1234567890) or URL
    match = re.search(r'(\d{8,})', job.get("id", "") + job.get("url", ""))
    if not match:
        return None
    job_id = match.group(1)
    url    = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    try:
        r    = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        desc = soup.find("div", class_="show-more-less-html__markup")
        if not desc:
            return None
        return " ".join(desc.get_text().split())
    except Exception:
        return None


def fetch_generic(job: dict):
    """
    Generic fallback: fetch the job URL and look for common description containers.
    Works for WeWorkRemotely, RemoteOK, LandingJobs, and others.
    """
    url = job.get("url", "")
    if not url:
        return None
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")

        # Common selectors across job boards, tried in order
        selectors = [
            {"class": "job-description"},
            {"class": "listing-container"},
            {"class": "job__description"},
            {"id":    "job-description"},
            {"class": "description__text"},
            {"class": "show-more-less-html__markup"},
            {"itemprop": "description"},
        ]
        for attrs in selectors:
            el = soup.find(["div", "section", "article"], attrs)
            if el:
                text = " ".join(el.get_text().split())
                if len(text) > 100:
                    return text

        return None
    except Exception:
        return None


# ── Dispatcher ────────────────────────────────────────────────────────────────

def enrich(job: dict):
    source = job.get("source", "")
    if source == "LinkedIn":
        return fetch_linkedin(job)
    else:
        return fetch_generic(job)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Enrich jobs.json with missing descriptions.")
    parser.add_argument("--max",    type=int,  default=0,  help="Max jobs to enrich (0 = all)")
    parser.add_argument("--source", type=str,  default="", help="Only enrich jobs from this source")
    args = parser.parse_args()

    if not JOBS_FILE.exists():
        print("[!] jobs.json not found. Run job_hunter.py first.")
        return

    data = json.loads(JOBS_FILE.read_text())
    jobs = data.get("jobs", [])

    to_enrich = [
        j for j in jobs
        if not j.get("description")
        and not j.get("description_failed")
        and (not args.source or j.get("source", "").lower() == args.source.lower())
    ]

    if not to_enrich:
        print("All jobs already have descriptions.")
        return

    if args.max and len(to_enrich) > args.max:
        print(f"Limiting to {args.max} jobs (--max).")
        to_enrich = to_enrich[:args.max]

    print(f"Enriching {len(to_enrich)} job(s)...\n")
    enriched = 0
    failed   = 0

    for job in to_enrich:
        label = f"{job.get('source','?')} · {job.get('title','?')[:50]}"
        desc  = enrich(job)
        if desc and len(desc) > 80:
            job["description"] = desc[:MAX_DESC_CHARS]
            enriched += 1
            print(f"  [✓]  {label}")
        else:
            job["description_failed"] = True
            failed += 1
            print(f"  [–]  {label}")
        time.sleep(REQUEST_DELAY)

    JOBS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\n✓ {enriched} enriched, {failed} failed → {JOBS_FILE}")


if __name__ == "__main__":
    main()
