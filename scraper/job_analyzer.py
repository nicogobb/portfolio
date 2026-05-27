#!/usr/bin/env python3
"""
Job Analyzer — reads jobs.json and reports keyword frequency.

Usage:
    python3 scraper/job_analyzer.py
    python3 scraper/job_analyzer.py --top 30
    python3 scraper/job_analyzer.py --source LinkedIn
    python3 scraper/job_analyzer.py --denmark
"""

import argparse
import html as html_module
import json
import re
from collections import Counter
from pathlib import Path

JOBS_FILE = Path(__file__).parent.parent / "jobs.json"

# Words to ignore in frequency count
STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "in", "to", "for", "with",
    "on", "at", "is", "be", "we", "you", "our", "your", "will", "are",
    "as", "this", "that", "it", "its", "not", "have", "has", "by",
    "from", "more", "than", "also", "all", "can", "such", "other",
    "including", "within", "across", "about", "their", "into", "using",
    "developer", "development", "engineer", "engineering", "experience",
    "team", "work", "working", "role", "position", "job", "looking",
    "strong", "good", "great", "excellent", "ability", "skills", "skill",
    "knowledge", "understanding", "minimum", "preferred", "required",
    "requirements", "responsibilities", "opportunity", "join", "help",
    "build", "building", "new", "based", "well", "both", "between",
    "ensure", "support", "provide", "implement", "create", "manage",
    "maintain", "improve", "design", "develop", "write", "own",
    "years", "year", "plus", "least", "must", "nice",
}

# Tech skills / phrases to look for specifically
TECH_PHRASES = [
    "php 8", "php 7", "php",
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
    "rest api", "rest apis", "graphql", "soap", "grpc",
    "laravel", "symfony", "codeigniter", "kohana", "wordpress",
    "javascript", "typescript", "react", "vue", "angular", "node.js",
    "html", "css", "tailwind",
    "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
    "git", "github", "gitlab", "ci/cd", "github actions",
    "linux", "nginx", "apache",
    "agile", "scrum", "tdd", "microservices",
    "python", "java", "go", "rust", "ruby", "c#",
    "full stack", "full-stack", "backend", "frontend",
]

# Seniority and work modality — shown separately, not as "missing skills"
SENIORITY_TERMS = ["senior", "lead", "architect", "principal", "staff", "junior", "mid-level"]
MODALITY_TERMS  = ["remote", "hybrid", "on-site", "relocation"]


def clean(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", str(s))
    s = html_module.unescape(s)
    return " ".join(s.split()).lower()


def load_jobs(source_filter=None, denmark_only=False):
    if not JOBS_FILE.exists():
        print(f"[!] {JOBS_FILE} not found. Run job_hunter.py first.")
        return []
    data = json.loads(JOBS_FILE.read_text())
    jobs = data.get("jobs", [])
    if source_filter:
        jobs = [j for j in jobs if j.get("source", "").lower() == source_filter.lower()]
    if denmark_only:
        jobs = [j for j in jobs if j.get("denmark")]
    return jobs


def count_phrases(texts: list[str], phrases: list[str]) -> Counter:
    """Count how many job texts contain each phrase (1 per job, not per occurrence)."""
    counts = Counter()
    for text in texts:
        for phrase in phrases:
            if phrase in text:
                counts[phrase] += 1
    return counts


def count_words(texts: list[str], top_n: int) -> Counter:
    """Count individual word frequency across all texts, excluding stopwords."""
    counts = Counter()
    for text in texts:
        words = re.findall(r'\b[a-z][a-z0-9+#.]*\b', text)
        for w in words:
            if w not in STOPWORDS and len(w) > 2:
                counts[w] += 1
    return counts


def bar(count: int, total: int, width: int = 30) -> str:
    filled = int(width * count / total) if total else 0
    return "█" * filled + "░" * (width - filled)


def main():
    parser = argparse.ArgumentParser(description="Analyze job keyword frequency.")
    parser.add_argument("--top",     type=int, default=25, help="Number of top results")
    parser.add_argument("--source",  type=str, default=None, help="Filter by source (e.g. LinkedIn)")
    parser.add_argument("--denmark", action="store_true", help="Only Denmark jobs")
    parser.add_argument("--words",   action="store_true", help="Show word frequency instead of tech phrases")
    args = parser.parse_args()

    jobs = load_jobs(source_filter=args.source, denmark_only=args.denmark)
    if not jobs:
        print("No jobs found.")
        return

    scope = ""
    if args.source:  scope += f" · source={args.source}"
    if args.denmark: scope += " · denmark only"

    print(f"\n{'═'*55}")
    print(f"  Job Analyzer — {len(jobs)} jobs{scope}")
    print(f"{'═'*55}\n")

    # Combine title + company + description for analysis
    with_desc = sum(1 for j in jobs if j.get("description"))
    texts = [
        clean(f"{j.get('title', '')} {j.get('company', '')} {j.get('description', '')}")
        for j in jobs
    ]

    # ── Source breakdown ──
    from collections import Counter as C
    sources = C(j.get("source", "unknown") for j in jobs)
    print("  Sources")
    print(f"  {'─'*40}")
    for src, cnt in sources.most_common():
        pct = cnt / len(jobs) * 100
        print(f"  {src:<20} {cnt:>3}  {bar(cnt, len(jobs), 20)}  {pct:.0f}%")
    print(f"  (descriptions available: {with_desc}/{len(jobs)} jobs)\n")

    # ── Salary coverage ──
    with_salary = [j for j in jobs if j.get("salary")]
    if with_salary:
        print(f"  Salary data available: {len(with_salary)}/{len(jobs)} jobs")
        for j in with_salary[:8]:
            print(f"    {j['salary']:<12}  {j['title'][:45]}")
        print()

    # ── Seniority & modality breakdown ──
    seniority = count_phrases(texts, SENIORITY_TERMS)
    modality  = count_phrases(texts, MODALITY_TERMS)
    if seniority:
        print("  Seniority level (jobs mentioning each)")
        print(f"  {'─'*40}")
        for term, cnt in seniority.most_common():
            pct = cnt / len(jobs) * 100
            print(f"  {term:<28} {cnt:>3}/{len(jobs)}  {bar(cnt, len(jobs), 20)}  {pct:.0f}%")
        print()
    if modality:
        print("  Work modality (jobs mentioning each)")
        print(f"  {'─'*40}")
        for term, cnt in modality.most_common():
            pct = cnt / len(jobs) * 100
            print(f"  {term:<28} {cnt:>3}/{len(jobs)}  {bar(cnt, len(jobs), 20)}  {pct:.0f}%")
        print()

    # ── Tech keyword frequency ──
    if args.words:
        counts = count_words(texts, args.top)
        title = "Top words (title + description)"
    else:
        counts = count_phrases(texts, TECH_PHRASES)
        title = "Tech skills (jobs mentioning each)"

    top = counts.most_common(args.top)
    if not top:
        print("  No data to show.")
        return

    max_count = top[0][1]
    print(f"  {title}")
    print(f"  {'─'*40}")
    for phrase, count in top:
        pct = count / len(jobs) * 100
        print(f"  {phrase:<28} {count:>3}/{len(jobs)}  {bar(count, max_count, 20)}  {pct:.0f}%")

    print(f"\n{'═'*55}\n")

    # ── Insight: skills you have vs. what's being asked ──
    YOUR_SKILLS = {"php", "php 8", "mysql", "postgresql", "rest api", "rest apis",
                   "laravel", "symfony", "javascript", "typescript", "git", "linux",
                   "github actions", "docker", "mongodb"}
    missing = [(p, c) for p, c in top if p not in YOUR_SKILLS]
    if missing:
        print("  ⚡ Tech skills in demand NOT in your current profile/CV:")
        for phrase, count in missing[:8]:
            print(f"    {phrase:<28} mentioned in {count} jobs ({count/len(jobs)*100:.0f}%)")
        print()


if __name__ == "__main__":
    main()
