#!/usr/bin/env python3
"""
Job Scorer — uses Groq API (free) to score each job's fit against your profile.
Uses only `requests` (already a project dependency) — no extra packages needed.

Free tier: 30 RPM, 14 400 req/day — more than enough for daily CI runs.
Get a free API key at: https://console.groq.com

Usage:
    python3 scraper/job_scorer.py              # score only unscored jobs
    python3 scraper/job_scorer.py --rescore    # re-score all jobs
    python3 scraper/job_scorer.py --max 20     # score at most 20 jobs
"""

import argparse
import json
import os
import time
from pathlib import Path

import requests

JOBS_FILE  = Path(__file__).parent.parent / "jobs.json"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
MODEL      = "llama-3.1-8b-instant"
REQUEST_DELAY = 2       # seconds between requests (safe at 30 RPM)
RETRY_DELAYS  = [5, 15, 30]  # backoff on 429

# ── Your profile (edit this to keep it up to date) ────────────────────────────

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

# ── Scorer ─────────────────────────────────────────────────────────────────────

def score_job(api_key: str, job: dict) -> dict:
    title   = job.get("title", "")
    company = job.get("company", "")
    desc    = job.get("description", "")

    if desc:
        text       = f"Title: {title}\nCompany: {company}\nDescription: {desc}"
        confidence = "high"
    else:
        text       = f"Title: {title}\nCompany: {company}\n(No description — scored from title only)"
        confidence = "low"

    prompt = f"""Score this job posting's fit for the candidate below. Reply with ONLY valid JSON — no explanation, no markdown.

## Candidate profile
{YOUR_PROFILE}

## Job posting
{text}

## Scoring guide
- 90–100: Perfect match — apply immediately
- 70–89:  Good match — worth applying
- 50–69:  Partial match — some gaps
- 0–49:   Poor match

## Required response format (JSON only)
{{"score": 85, "pros": ["PHP 8 + Laravel match", "Remote-friendly"], "cons": ["Requires AWS certification"]}}

Rules:
- "score" is an integer 0–100
- "pros" and "cons" are arrays of strings, max 2 items each, 3–7 words per item
- If no description is available, lean conservative"""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 200,
        "temperature": 0.1,
    }

    for wait in [0] + RETRY_DELAYS:
        if wait:
            print(f"    [429] rate limited — retrying in {wait}s...")
            time.sleep(wait)
        resp = requests.post(GROQ_URL, headers=headers, json=body, timeout=30)
        if resp.status_code == 429:
            continue
        resp.raise_for_status()
        break
    else:
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw.strip())
    result["confidence"] = confidence
    return result


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Score job fit via Groq API (free).")
    parser.add_argument("--rescore", action="store_true",
                        help="Re-score all jobs (not just unscored ones)")
    parser.add_argument("--max", type=int, default=0,
                        help="Maximum number of jobs to score in this run (0 = all)")
    args = parser.parse_args()

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("[!] GROQ_API_KEY not set — skipping scoring.")
        print("    Get a free key at: https://console.groq.com")
        return

    if not JOBS_FILE.exists():
        print(f"[!] {JOBS_FILE} not found. Run job_hunter.py first.")
        return

    data = json.loads(JOBS_FILE.read_text())
    jobs = data.get("jobs", [])

    to_score = [j for j in jobs if args.rescore or "match_score" not in j]
    if not to_score:
        print("All jobs already scored. Use --rescore to re-score.")
        return

    if args.max and len(to_score) > args.max:
        print(f"Limiting to {args.max} jobs (--max).")
        to_score = to_score[:args.max]

    print(f"Scoring {len(to_score)} job(s) via Groq / {MODEL} (free)...\n")
    scored = 0
    errors = 0

    for j in to_score:
        try:
            result = score_job(api_key, j)
            j["match_score"]      = int(result.get("score", 0))
            j["match_confidence"] = result.get("confidence", "low")
            j["match_pros"]       = result.get("pros", [])[:2]
            j["match_cons"]       = result.get("cons", [])[:2]
            scored += 1
            conf_tag = "" if j["match_confidence"] == "high" else " ~"
            print(f"  [{j['match_score']:>3}%{conf_tag}]  {j['title'][:55]}")
            time.sleep(REQUEST_DELAY)
        except Exception as e:
            errors += 1
            print(f"  [ERR]  {j.get('title', '?')[:50]}: {e}")

    JOBS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\n✓ {scored} scored, {errors} errors → {JOBS_FILE}")


if __name__ == "__main__":
    main()
