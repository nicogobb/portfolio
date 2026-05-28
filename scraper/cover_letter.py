#!/usr/bin/env python3
"""
Cover Letter Generator — uses Groq API (free) to write a tailored cover letter.
Uses only `requests` (already a project dependency) — no extra packages needed.

Usage:
    # Generate from a job in jobs.json by its id field:
    python3 scraper/cover_letter.py --job-id "Jobindex_https://..."

    # Generate from a raw job description string:
    python3 scraper/cover_letter.py --desc "We are looking for a PHP developer..."

    # Override / supplement company name and job title:
    python3 scraper/cover_letter.py --job-id "..." --company "Acme" --title "Senior PHP Developer"

    # Save output to a file instead of (or in addition to) stdout:
    python3 scraper/cover_letter.py --job-id "..." --out cover_letter.txt

Requires GROQ_API_KEY environment variable.
Get a free key at: https://console.groq.com
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

JOBS_FILE     = Path(__file__).parent.parent / "jobs.json"
GROQ_URL      = "https://api.groq.com/openai/v1/chat/completions"
MODEL         = "llama-3.1-8b-instant"
RETRY_DELAYS  = [5, 15, 30]   # backoff on 429

# ── Profile ────────────────────────────────────────────────────────────────────

YOUR_PROFILE = """\
PHP Backend / Full-Stack Developer, 10+ years experience.

Career:
- Software Engineer at Maxtracker (Aug 2025–present): fleet telematics platform,
  10,000+ vehicles, PHP/Kohana/PostgreSQL, real-time data pipelines.
- PHP Web Developer at mydigitalnomads (Apr 2022–Aug 2025): large-scale SaaS,
  fully remote, PHP/MySQL/TypeScript/Docker.
- Web Developer at OSPL (Nov 2019–present, part-time): health insurance system,
  20,000+ affiliates, PHP/MySQL.
- DBA at Mutual Senderos (2014–2019): started career in database administration,
  grew into full-stack web development.

Core skills:
- PHP 8 (OOP, PSR standards, Composer)
- Laravel, Symfony, Kohana, CodeIgniter
- MySQL, PostgreSQL, MongoDB
- REST APIs (design & implementation)
- JavaScript, TypeScript
- Git, GitHub Actions, CI/CD
- Docker (containerised dev environments)
- Linux/Shell, Web Scraping

Location: Copenhagen, Denmark — open to remote or on-site roles.
Languages: Spanish (native), English (professional), Danish (learning).
"""

# ── Generator ──────────────────────────────────────────────────────────────────

def generate_cover_letter(api_key: str, description: str, company: str, title: str) -> str:
    company_line = f"Company: {company}" if company else "Company: (not specified)"
    title_line   = f"Role: {title}"      if title   else "Role: (not specified)"

    prompt = f"""Write a professional cover letter for the job posting below, tailored to the candidate's profile.

## Candidate profile
{YOUR_PROFILE}

## Job posting
{title_line}
{company_line}
Description: {description}

## Instructions
- 3–4 paragraphs, no salutation header, no sign-off/closing line — body paragraphs only.
- Opening: do NOT use "I am writing to express my interest". Start with a direct statement of fit or value.
- Reference specific numbers from the candidate's background (10,000+ vehicles, 20,000+ affiliates, 10+ years).
- Mention 2–3 technologies from the job description that the candidate actually has.
- Tone: direct, confident, professional — not generic or boilerplate.
- If the company name is known, use it naturally in the text — no placeholders like [Company Name].
- Write in English.
- Output ONLY the cover letter body — no intro, no commentary."""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 800,
        "temperature": 0.7,
    }

    for wait in [0] + RETRY_DELAYS:
        if wait:
            print(f"[429] rate limited — retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
        resp = requests.post(GROQ_URL, headers=headers, json=body, timeout=30)
        if resp.status_code == 429:
            continue
        resp.raise_for_status()
        break
    else:
        resp.raise_for_status()

    return resp.json()["choices"][0]["message"]["content"].strip()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate a tailored cover letter via Groq API (free).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument(
        "--job-id",
        metavar="ID",
        help="Job id from jobs.json",
    )
    source.add_argument(
        "--desc",
        metavar="TEXT",
        help="Raw job description text",
    )

    parser.add_argument("--company", metavar="NAME", help="Company name (overrides jobs.json value)")
    parser.add_argument("--title",   metavar="TITLE", help="Job title (overrides jobs.json value)")
    parser.add_argument("--out",     metavar="FILE",  help="Save cover letter to this file")
    args = parser.parse_args()

    # Check API key
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[!] GROQ_API_KEY not set — cannot generate cover letter.", file=sys.stderr)
        print("    Get a free key at: https://console.groq.com", file=sys.stderr)
        sys.exit(1)

    # Resolve description, company, title
    description = ""
    company     = args.company or ""
    title       = args.title   or ""

    if args.job_id:
        if not JOBS_FILE.exists():
            print(f"[!] {JOBS_FILE} not found. Run job_hunter.py first.", file=sys.stderr)
            sys.exit(1)
        data = json.loads(JOBS_FILE.read_text())
        jobs = data.get("jobs", [])
        job  = next((j for j in jobs if j.get("id") == args.job_id), None)
        if job is None:
            print(f"[!] Job id not found: {args.job_id}", file=sys.stderr)
            sys.exit(1)
        description = job.get("description", "")
        if not company:
            company = job.get("company", "")
        if not title:
            title = job.get("title", "")
    else:
        description = args.desc

    if not description:
        print("[!] No description available for this job — cannot generate a tailored letter.",
              file=sys.stderr)
        sys.exit(1)

    print(f"Generating cover letter via Groq / {MODEL}...", file=sys.stderr)
    if company:
        print(f"  Company : {company}", file=sys.stderr)
    if title:
        print(f"  Role    : {title}", file=sys.stderr)
    print("", file=sys.stderr)

    letter = generate_cover_letter(api_key, description, company, title)

    print(letter)

    if args.out:
        out_path = Path(args.out)
        out_path.write_text(letter)
        print(f"\n[✓] Saved to {out_path.resolve()}", file=sys.stderr)


if __name__ == "__main__":
    main()
